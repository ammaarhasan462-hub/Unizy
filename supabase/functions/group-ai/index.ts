// Unizy group chat AI: when someone @mentions Professor <Uni> or Dr <Uni> in a group chat,
// this writes the tutor's reply into the chat for everyone. Counts against the asker's AI allowance.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BUDGET_MSG, PAUSED_MSG, budgetReached, handleAccountProblem, isAccountProblem, recordSpend } from "./common.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UNI: Record<string, { short: string; full: string }> = {
  ucl: { short: "UCL", full: "University College London" },
  imperial: { short: "Imperial", full: "Imperial College London" },
  lse: { short: "LSE", full: "London School of Economics and Political Science" },
  oxford: { short: "Oxford", full: "University of Oxford" },
  cambridge: { short: "Cambridge", full: "University of Cambridge" },
  qmul: { short: "Queen Mary", full: "Queen Mary University of London" },
};
const clip = (v: unknown, n: number) => (typeof v === "string" ? v : "").slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { message: "POST only" });
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { message: PAUSED_MSG });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: ud } = await service.auth.getUser(token);
  const user = ud?.user;
  if (!user) return json(401, { message: "Please log in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { message: "Bad request." }); }
  const groupId = clip(body.group, 40), messageId = Number(body.message);
  if (!groupId || !Number.isFinite(messageId)) return json(400, { message: "Bad request." });

  // the asker must be in the group, and the message must be theirs, recent and not yet answered
  const { data: mem } = await service.from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (!mem) return json(403, { message: "You’re not in that group." });
  const { data: msg } = await service.from("chat_messages").select("id, user_id, kind, body, created_at").eq("id", messageId).eq("group_id", groupId).maybeSingle();
  if (!msg || msg.user_id !== user.id || msg.kind !== "user") return json(400, { message: "Couldn’t find that message." });
  if (Date.now() - new Date(msg.created_at).getTime() > 10 * 60_000) return json(400, { message: "That message is too old to answer." });
  const { data: already } = await service.from("chat_messages").select("id").eq("reply_to", messageId).eq("kind", "ai").maybeSingle();
  if (already) return json(200, { ok: true, id: already.id });

  const { data: grp } = await service.from("chat_groups").select("name, uni").eq("id", groupId).single();
  const uni = UNI[grp?.uni] || { short: "your uni", full: "your university" };
  const persona = body.persona === "dr" ? "dr" : "prof";
  const tutor = (persona === "dr" ? "Dr " : "Professor ") + uni.short;

  const { data: take, error: takeErr } = await service.rpc("ai_take_plan", { p_user: user.id, p_units: 1, p_kind: "group" });
  if (takeErr || !take) return json(500, { message: "Couldn’t check your tutor allowance." });
  if (!take.ok) {
    if (take.reason === "budget") {
      EdgeRuntime.waitUntil(service.from("ai_settings").select("daily_budget_gbp").eq("id", true).single().then(({ data }: any) => budgetReached(service, "£" + (data?.daily_budget_gbp ?? "?") + " a day")));
      return json(503, { message: BUDGET_MSG });
    }
    const m = take.reason === "free_weekly" ? "You’ve used this week’s free tutor actions, so " + tutor + " can’t answer you right now. Upgrade to Unizy Pro, or try again on Monday."
      : take.reason === "global" ? "Unizy’s tutor is very busy today. Try again tomorrow." : "You’ve used today’s tutor allowance. It resets at midnight (UK time).";
    return json(429, { message: m, upgrade: take.reason === "free_weekly" });
  }
  const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: 1, p_kind: "group", p_tier: take.tier });
  const model = take.tier === "free" ? "claude-haiku-5-5" : "claude-sonnet-5-5";

  // recent conversation for context
  const { data: recent } = await service.from("chat_messages").select("id, user_id, kind, ai_name, body").eq("group_id", groupId).lte("id", messageId).order("id", { ascending: false }).limit(20);
  const ids = [...new Set((recent || []).map((r: any) => r.user_id).filter(Boolean))];
  const { data: profs } = ids.length ? await service.from("profiles").select("user_id, display_name, degree_name, year").in("user_id", ids) : { data: [] as any[] };
  const nameOf: Record<string, string> = {};
  (profs || []).forEach((p: any) => { nameOf[p.user_id] = p.display_name || "A student"; });
  const asker = (profs || []).find((p: any) => p.user_id === user.id);
  const transcript = (recent || []).reverse().filter((r: any) => r.kind !== "system")
    .map((r: any) => (r.kind === "ai" ? r.ai_name : nameOf[r.user_id] || "A student") + ": " + r.body).join("\n");

  const ctx = body.context || {};
  const topics = Array.isArray(ctx.topics) ? ctx.topics.slice(0, 20).map((t: unknown) => clip(t, 120)).filter(Boolean) : [];
  const course = [
    asker?.degree_name ? "Asker’s course: " + asker.degree_name + (asker.year ? ", year " + asker.year : "") : "",
    ctx.module ? "Module they are studying now: " + clip(ctx.module, 160) + (ctx.code ? " (" + clip(ctx.code, 20) + ")" : "") : "",
    ctx.summary ? "Official module outline: " + clip(ctx.summary, 1500) : "",
    topics.length ? "Topics in this module: " + topics.join("; ") : "",
  ].filter(Boolean).join("\n");

  const system = `You are ${tutor}, the Unizy tutor (a friendly cat${persona === "dr" ? " with a stethoscope" : " in a professor’s mortarboard"}) for students at ${uni.full}. ` +
    `You are replying inside a group chat of ${uni.short} students called “${clip(grp?.name, 60)}”. ` +
    `Answer the latest message that mentions you, using the chat for context. Be accurate, clear and encouraging, at UK university level, ${persona === "dr" ? "with a clinical, medical-school slant where relevant" : "in the style of a supportive lecturer"}. ` +
    `Keep it short for a chat: usually under 150 words, unless they ask for more detail. Use plain text with short paragraphs or simple dashes for lists; no markdown headings, tables or bold. ` +
    `Never invent cases, statutes, studies, statistics or quotations; say when you’re unsure. Never give drug doses. If they want assessed work written for them, help them learn and plan instead. ` +
    `Don’t start with your name or a greeting like “Great question”. ` +
    `Accuracy matters more than confidence: if you are not sure, say so plainly (“I’m not certain, but…”) and suggest how to check (lecture slides, the reading list, the module page). If someone in the chat has said something incorrect, gently correct it. ` +
    `Put “(general knowledge)” after any claim that isn’t supported by the COURSE CONTEXT. End with one final line that starts with “SOURCES:” and lists, separated by semicolons, only what you used: “Outline” for the official module outline or topics in the COURSE CONTEXT, and “General knowledge” for anything beyond it.`;
  const prompt = (course ? "=== COURSE CONTEXT ===\n" + course + "\n\n" : "") + "=== GROUP CHAT (oldest first) ===\n" + transcript.slice(-12000) + "\n\nReply as " + tutor + " to the last message.";

  let text = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) {
      await refund();
      let et = ""; try { et = await r.text(); et = JSON.parse(et)?.error?.message || et; } catch { /* ignore */ }
      if (isAccountProblem(r.status, et)) { EdgeRuntime.waitUntil(handleAccountProblem(service, r.status, et)); return json(503, { message: PAUSED_MSG }); }
      return json(r.status === 429 || r.status === 529 ? 429 : 502, { message: tutor + " is busy right now. Try again in a minute." });
    }
    const d = await r.json();
    EdgeRuntime.waitUntil(recordSpend(service, model, d.usage));
    text = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  } catch {
    await refund();
    return json(502, { message: "Couldn’t reach " + tutor + ". Try again." });
  }
  if (!text) { await refund(); return json(502, { message: tutor + " didn’t have an answer. Try asking another way." }); }

  const { data: ins, error: insErr } = await service.from("chat_messages")
    .insert({ group_id: groupId, user_id: null, kind: "ai", ai_name: tutor, reply_to: messageId, body: text.slice(0, 7900) }).select("id").single();
  if (insErr) { if (String(insErr.code) === "23505") return json(200, { ok: true }); await refund(); return json(500, { message: "Couldn’t post the answer." }); }
  await service.from("chat_groups").update({ last_message_at: new Date().toISOString() }).eq("id", groupId);
  return json(200, { ok: true, id: ins.id, left: take.left });
});
