// Unizy AI proxy: signed-in students call Claude through here, within their plan's allowance and Unizy's daily £ budget.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BUDGET_MSG, PAUSED_MSG, budgetReached, handleAccountProblem, isAccountProblem, recordSpend } from "./common.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Unizy-Units-Left, X-Unizy-Tier",
};
const SONNET = "claude-sonnet-5-5", HAIKU = "claude-haiku-5-5";
const MAX_TOKENS: Record<string, number> = { tutor: 2000, mark: 3000, cards: 8000, questions: 8000, notes: 6000, assess: 8000, other: 4000 };
const MAX_INPUT_BYTES = 110_000;
const MAX_IMAGES = 5;
const MAX_IMAGE_B64 = 6_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "invalid_request", message: "POST only" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { code: "ai_paused", message: PAUSED_MSG });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await service.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json(401, { code: "session_expired", message: "Please sign in again." });

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > MAX_INPUT_BYTES + MAX_IMAGES * MAX_IMAGE_B64) return json(413, { code: "prompt_too_large", message: "That’s too much to send at once." });
    body = JSON.parse(raw);
  } catch {
    return json(400, { code: "invalid_request", message: "Bad request." });
  }

  // Normalise the conversation. With cache=true the first turn is a stable "course knowledge" prefix that Anthropic can cache.
  let turns: { role: "user" | "assistant"; content: string }[] = [];
  if (typeof body.input === "string") turns = [{ role: "user", content: body.input }];
  else if (Array.isArray(body.input)) turns = body.input.filter((t: any) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim()).map((t: any) => ({ role: t.role, content: t.content }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return json(400, { code: "invalid_request", message: "Nothing to send." });
  let prefix: string | null = null;
  if (body.cache && turns.length > 1 && turns[0].role === "user" && turns[0].content.length > 4000) { prefix = turns[0].content; turns = turns.slice(1); }
  const inputBytes = new TextEncoder().encode((prefix || "") + turns.map((t) => t.content).join("")).length;
  if (inputBytes > MAX_INPUT_BYTES) return json(413, { code: "prompt_too_large", message: "That’s too long to send in one go. Try a shorter piece." });
  const lastText = turns[turns.length - 1].content;

  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  for (const im of images) {
    if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== "string" || im.data.length > MAX_IMAGE_B64) return json(400, { code: "image_rejected", message: "One of the photos couldn’t be used. Try a smaller JPEG or PNG." });
  }

  let kind = typeof body.kind === "string" && MAX_TOKENS[body.kind] ? body.kind : "other";
  // marking work (typed or photographed) always counts as an Assess marking, whatever the client says
  if (images.length || /Mark it as a|Student’s typed work/.test(lastText)) kind = "assess";
  const units = 1 + Math.floor(inputBytes / 30000) + images.length + (kind === "assess" ? 1 : 0);

  const { data: take, error: takeErr } = await service.rpc("ai_take_plan", { p_user: user.id, p_units: units, p_kind: kind });
  if (takeErr || !take) return json(500, { code: "upstream_error", message: "Couldn’t check your AI allowance. Try again." });
  if (!take.ok) {
    if (take.reason === "budget") {
      EdgeRuntime.waitUntil(service.from("ai_settings").select("daily_budget_gbp").eq("id", true).single().then(({ data }: any) => budgetReached(service, "£" + (data?.daily_budget_gbp ?? "?") + " a day")));
      return json(503, { code: "ai_paused", reason: "budget", message: BUDGET_MSG });
    }
    const msg: Record<string, string> = {
      free_weekly: "You’ve used this week’s 10 free AI actions. Upgrade to Unizy Pro for much more, or your free allowance resets on Monday. Notes, flashcards and tests still work.",
      free_assess: "Your free plan includes 1 Assess marking a week, and you’ve used it. Upgrade to Unizy Pro to have more work marked, or try again on Monday.",
      daily: "You’ve used today’s AI allowance. It resets at midnight (UK time). Notes, flashcards and tests still work.",
      global: "Unizy’s AI is very busy today and has reached its daily limit. Please try again tomorrow.",
    };
    return json(429, { code: "rate_limited", reason: take.reason, upgrade: take.reason === "free_weekly" || take.reason === "free_assess", message: msg[take.reason] || msg.daily });
  }
  const left = take.left;
  const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: units, p_kind: kind, p_tier: take.tier });

  // Model: Haiku for quick jobs and for free-plan students (except Assess marking); Sonnet otherwise.
  const model = body.tier === "quick" || (take.tier === "free" && kind !== "assess") ? HAIKU : SONNET;

  // Build messages as content blocks so the knowledge prefix can carry a cache marker.
  const msgs: { role: "user" | "assistant"; content: any[] }[] = [];
  if (prefix) msgs.push({ role: "user", content: [{ type: "text", text: prefix, cache_control: { type: "ephemeral" } }] });
  for (const t of turns) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === t.role) last.content.push({ type: "text", text: t.content });
    else msgs.push({ role: t.role, content: [{ type: "text", text: t.content }] });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (images.length) msgs[msgs.length - 1].content.unshift(...images.map((im: any) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })));

  const system = "You are the AI inside Unizy, a study website for UK university students. Follow the instructions in the user's message exactly. Be accurate; never invent cases, statutes, studies, statistics or quotations; never give drug doses." +
    (body.json ? " Your reply will be machine-parsed: reply with only the JSON value requested — no prose before or after, no code fences." : "");

  const stream = !!body.stream;
  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: MAX_TOKENS[kind], system, messages: msgs, stream }),
    });
  } catch {
    await refund();
    return json(502, { code: "upstream_error", message: "Couldn’t reach the AI. Try again in a moment." });
  }
  if (!upstream.ok) {
    await refund();
    const status = upstream.status;
    let detail = "", text = "";
    try { text = await upstream.text(); const e = JSON.parse(text)?.error; detail = e?.type || ""; text = e?.message || text; } catch { /* ignore */ }
    if (isAccountProblem(status, text)) {
      EdgeRuntime.waitUntil(handleAccountProblem(service, status, text));
      return json(503, { code: "ai_paused", message: PAUSED_MSG });
    }
    if (status === 429 || status === 529) return json(429, { code: "rate_limited", message: "The AI is busy right now. Try again in a minute." });
    if (status === 400) return json(400, { code: "invalid_request", message: "The AI couldn’t take that request" + (detail ? " (" + detail + ")" : "") + "." });
    return json(502, { code: "upstream_error", message: "The AI had a problem. Try again." });
  }

  const headers = { ...CORS, "X-Unizy-Units-Left": String(left), "X-Unizy-Tier": String(take.tier) };
  if (stream && upstream.body) {
    // pass the stream to the student and, in the background, read the token usage to record the real cost
    const [toClient, toMeter] = upstream.body.tee();
    EdgeRuntime.waitUntil((async () => {
      const reader = toMeter.getReader(), dec = new TextDecoder();
      let buf = "", usage: any = {};
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const ev = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = ev.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const d = JSON.parse(line.slice(5));
              if (d.type === "message_start" && d.message?.usage) usage = { ...d.message.usage };
              if (d.type === "message_delta" && d.usage) usage = { ...usage, ...d.usage };
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      await recordSpend(service, model, usage);
    })());
    return new Response(toClient, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }
  const data = await upstream.json();
  EdgeRuntime.waitUntil(recordSpend(service, model, data.usage));
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return new Response(JSON.stringify({ text, truncated: data.stop_reason === "max_tokens", left }), { headers: { ...headers, "Content-Type": "application/json" } });
});
