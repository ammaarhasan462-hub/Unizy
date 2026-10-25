// Unizy AI proxy: signed-in students call Claude through here, within daily limits.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Unizy-Units-Left",
};
const MODELS: Record<string, string> = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
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
  if (!apiKey) return json(503, { code: "sampling_disabled", message: "The AI isn’t switched on yet. Try again later." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
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

  // Normalise the conversation
  let turns: { role: "user" | "assistant"; content: string }[] = [];
  if (typeof body.input === "string") turns = [{ role: "user", content: body.input }];
  else if (Array.isArray(body.input)) turns = body.input.filter((t: any) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim()).map((t: any) => ({ role: t.role, content: t.content }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return json(400, { code: "invalid_request", message: "Nothing to send." });
  // merge consecutive same-role turns; Anthropic requires alternation starting with user
  const merged: typeof turns = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + t.content; else merged.push({ ...t });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  const inputBytes = new TextEncoder().encode(merged.map((t) => t.content).join("")).length;
  if (inputBytes > MAX_INPUT_BYTES) return json(413, { code: "prompt_too_large", message: "That’s too long to send in one go. Try a shorter piece." });

  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  for (const im of images) {
    if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== "string" || im.data.length > MAX_IMAGE_B64) return json(400, { code: "image_rejected", message: "One of the photos couldn’t be used. Try a smaller JPEG or PNG." });
  }

  const kind = typeof body.kind === "string" && MAX_TOKENS[body.kind] ? body.kind : "other";
  const tier = body.tier === "quick" ? "quick" : body.tier === "complex" ? "complex" : "default";
  const units = 1 + Math.floor(inputBytes / 30000) + images.length + (kind === "assess" ? 1 : 0);

  const { data: left, error: takeErr } = await service.rpc("ai_take", { p_user: user.id, p_units: units });
  if (takeErr) return json(500, { code: "upstream_error", message: "Couldn’t check your AI allowance. Try again." });
  if (left === -1) return json(429, { code: "rate_limited", message: "You’ve used today’s AI allowance. It resets at midnight (UK time). Notes, flashcards and tests still work." });
  if (left === -2) return json(429, { code: "rate_limited", message: "Unizy’s AI is very busy today and has reached its daily limit. Please try again tomorrow." });

  const refund = () => service.rpc("ai_refund", { p_user: user.id, p_units: units });

  const last = merged[merged.length - 1];
  const messages: any[] = merged.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));
  messages.push({
    role: "user",
    content: images.length
      ? [...images.map((im: any) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text: last.content }]
      : last.content,
  });
  const system = "You are the AI inside Unizy, a study website for UK university students. Follow the instructions in the user's message exactly. Be accurate; never invent cases, statutes, studies, statistics or quotations; never give drug doses." +
    (body.json ? " Your reply will be machine-parsed: reply with only the JSON value requested — no prose before or after, no code fences." : "");

  const stream = !!body.stream;
  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODELS[tier], max_tokens: MAX_TOKENS[kind], system, messages, stream }),
    });
  } catch {
    await refund();
    return json(502, { code: "upstream_error", message: "Couldn’t reach the AI. Try again in a moment." });
  }
  if (!upstream.ok) {
    await refund();
    const status = upstream.status;
    let detail = "";
    try { detail = (await upstream.json())?.error?.type || ""; } catch { /* ignore */ }
    if (status === 429 || status === 529) return json(429, { code: "rate_limited", message: "The AI is busy right now. Try again in a minute." });
    if (status === 400) return json(400, { code: "invalid_request", message: "The AI couldn’t take that request" + (detail ? " (" + detail + ")" : "") + "." });
    return json(502, { code: "upstream_error", message: "The AI had a problem. Try again." });
  }

  const headers = { ...CORS, "X-Unizy-Units-Left": String(left) };
  if (stream) return new Response(upstream.body, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  const data = await upstream.json();
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return new Response(JSON.stringify({ text, truncated: data.stop_reason === "max_tokens", left }), { headers: { ...headers, "Content-Type": "application/json" } });
});
