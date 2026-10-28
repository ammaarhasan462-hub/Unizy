// Unizy 1-click setup: reads a student's timetable or module handbook (PDF or screenshots) and returns
// their modules, weekly classes, dated sessions, deadlines/exams and a short handbook summary per module,
// matched against the uni's official module list. Counts as one AI action (more units for big files).
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

const MODEL = "claude-sonnet-5-5";
const MAX_FILES = 6;
const MAX_TOTAL_B64 = 24_000_000; // ~18 MB of files
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseJson(text: string): any {
  const s = String(text || "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}
const str = (v: unknown, n: number) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, n);
const hhmm = (v: unknown) => { const m = /^(\d{1,2})[:.](\d{2})/.exec(str(v, 8)); return m && +m[1] < 24 && +m[2] < 60 ? m[1].padStart(2, "0") + ":" + m[2] : null; };
const ymd = (v: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(v, 10)); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? m[0] : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, message: "POST only" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { ok: false, code: "ai_paused", message: PAUSED_MSG });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json(401, { ok: false, code: "session_expired", message: "Please sign in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "That upload didn’t come through. Try again." }); }
  const files = (Array.isArray(body?.files) ? body.files : []).slice(0, MAX_FILES);
  if (!files.length) return json(400, { ok: false, message: "Add your timetable or handbook first." });
  let total = 0, pdfBytes = 0;
  for (const f of files) {
    if (!f || !TYPES.has(f.media_type) || typeof f.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(f.data.slice(0, 200))) return json(400, { ok: false, message: "Use a PDF or a JPEG/PNG screenshot." });
    total += f.data.length;
    if (f.media_type === "application/pdf") pdfBytes += f.data.length * 0.75;
  }
  if (total > MAX_TOTAL_B64) return json(413, { ok: false, message: "That’s too big to read in one go (max about 18 MB). Upload just the timetable pages or the assessment section." });

  const ctx = body?.context || {};
  const mods: { i: number; code: string; name: string; term: string }[] = (Array.isArray(ctx.modules) ? ctx.modules : []).slice(0, 400)
    .map((m: any, i: number) => ({ i, code: str(m?.code, 30), name: str(m?.name, 140), term: str(m?.term, 30) }));
  const todayStr = ymd(ctx.today) || new Date().toISOString().slice(0, 10);

  const images = files.filter((f: any) => f.media_type !== "application/pdf").length;
  const units = 2 + images + Math.floor(pdfBytes / 1_000_000);
  const { data: take, error: takeErr } = await service.rpc("ai_take_plan", { p_user: user.id, p_units: units, p_kind: "import" });
  if (takeErr || !take) return json(500, { ok: false, message: "Couldn’t check your allowance. Try again." });
  if (!take.ok) {
    if (take.reason === "budget") {
      EdgeRuntime.waitUntil(service.from("ai_settings").select("daily_budget_gbp").eq("id", true).single().then(({ data }: any) => budgetReached(service, "£" + (data?.daily_budget_gbp ?? "?") + " a day")));
      return json(503, { ok: false, code: "ai_paused", message: BUDGET_MSG });
    }
    const msg: Record<string, string> = {
      free_weekly: "You’ve used this week’s free actions, and reading a timetable uses one. Upgrade to Unizy Pro, or add your classes by hand in Plan.",
      daily: "You’ve used today’s allowance. It resets at midnight (UK time). You can add classes by hand in Plan meanwhile.",
      global: "Unizy is very busy today. Please try again tomorrow, or add classes by hand in Plan.",
    };
    return json(429, { ok: false, code: "rate_limited", upgrade: take.reason === "free_weekly", message: msg[take.reason] || msg.daily });
  }
  const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: units, p_kind: "import", p_tier: take.tier });

  const catalogue = mods.length
    ? mods.map((m) => m.i + " | " + (m.code || "-") + " | " + m.name + (m.term ? " | " + m.term : "")).join("\n")
    : "(no official list available: set \"m\" to null for every module)";

  const prompt = [
    "You set up a UK university student's study planner from the document(s) attached: a timetable, a module handbook, a course calendar or an assessment schedule (as a PDF, screenshots or photos).",
    "Student: " + str(ctx.uniFull || ctx.uni, 80) + ", " + str(ctx.degree, 140) + ", Year " + (+ctx.year || 1) + ". Today is " + todayStr + " (academic year 2026/27). Times are UK local time.",
    "",
    "OFFICIAL MODULE LIST for this student's year (index | code | name | term):",
    catalogue,
    "",
    "Read the documents carefully and extract ONLY what they actually say. Never guess or invent a class, date, time, room or weighting. If something is unclear or illegible, leave it out and mention it in \"warn\".",
    "",
    "1. Modules: every module the documents mention for this student. Match each to the official list by code first, then by name (allow abbreviations like \"Micro 2\" → \"Microeconomics II\"). \"m\" is the matching index or null if none matches.",
    "2. Weekly classes: recurring teaching (lectures, seminars, tutorials, labs, workshops, supervisions). \"d\" is the weekday 0=Mon … 6=Sun, \"s\"/\"e\" start and end \"HH:MM\" (24h). \"w\" is the teaching weeks exactly as written (e.g. \"1-5, 7-11\"), or \"\". If the same class appears in several weeks of a grid with the same day and time, list it once.",
    "3. One-off sessions on specific dates (a field trip, a revision lecture, a class that only runs once): \"date\" YYYY-MM-DD.",
    "4. Deadlines and exams: coursework due dates, tests, exams, presentations. \"date\" YYYY-MM-DD, \"t\" \"HH:MM\" or null, \"k\" one of essay, coursework, problem-set, test, exam, presentation, other, \"wt\" the weighting as written (e.g. \"30%\") or \"\". Only include ones with a real calendar date: if a date is given only as \"Week 7\" and the document states when Week 1 starts, work out the date; otherwise put it in \"warn\" instead.",
    "5. Handbook summary (only if the documents describe a module rather than just timetable it): for each module, \"sum\" 2-4 sentences on what it covers, \"as\" the assessment breakdown as short lines, \"rd\" up to 6 key readings exactly as named, \"tp\" the weekly topics in order (up to 20). Omit staff names, emails and phone numbers.",
    "",
    "Reply with only JSON in exactly this shape (keep it compact; empty arrays are fine):",
    "{\"type\": \"timetable\" | \"handbook\" | \"mixed\" | \"other\",",
    " \"mods\": [{\"code\": \"...\", \"name\": \"...\", \"m\": index or null}],",
    " \"classes\": [{\"mod\": \"code or name as in mods\", \"title\": \"Lecture\", \"d\": 0-6, \"s\": \"HH:MM\", \"e\": \"HH:MM\", \"loc\": \"room or online\", \"w\": \"\"}],",
    " \"once\": [{\"mod\": \"...\", \"title\": \"...\", \"date\": \"YYYY-MM-DD\", \"s\": \"HH:MM\" or null, \"e\": \"HH:MM\" or null, \"loc\": \"\"}],",
    " \"due\": [{\"mod\": \"...\", \"title\": \"Essay 1\", \"k\": \"essay\", \"date\": \"YYYY-MM-DD\", \"t\": \"HH:MM\" or null, \"wt\": \"\"}],",
    " \"hb\": [{\"mod\": \"...\", \"sum\": \"...\", \"as\": [\"...\"], \"rd\": [\"...\"], \"tp\": [\"...\"]}],",
    " \"warn\": [\"short notes on anything you couldn’t read or date\"]}",
    "If the documents aren't a timetable or course document at all, reply {\"type\": \"other\", \"mods\": [], \"classes\": [], \"once\": [], \"due\": [], \"hb\": [], \"warn\": [\"what the file seems to be\"]}.",
  ].join("\n");

  const content: any[] = files.map((f: any) => f.media_type === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
    : { type: "image", source: { type: "base64", media_type: f.media_type, data: f.data } });
  content.push({ type: "text", text: prompt });

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 12000,
        system: "You extract structured data from university course documents for a study planner. Be exact and never invent details. Reply with only the JSON value requested — no prose, no code fences.",
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(140000),
    });
  } catch {
    await refund();
    return json(502, { ok: false, message: "Couldn’t read that just now. Try again in a moment." });
  }
  if (!upstream.ok) {
    await refund();
    const status = upstream.status;
    let text = "";
    try { text = await upstream.text(); text = JSON.parse(text)?.error?.message || text; } catch { /* ignore */ }
    if (isAccountProblem(status, text)) {
      EdgeRuntime.waitUntil(handleAccountProblem(service, status, text));
      return json(503, { ok: false, code: "ai_paused", message: PAUSED_MSG });
    }
    if (status === 429 || status === 529) return json(429, { ok: false, message: "Unizy is busy right now. Try again in a minute." });
    if (status === 400 && /page|pdf|document/i.test(text)) return json(400, { ok: false, message: "That PDF is too long or couldn’t be opened. Upload just the timetable or assessment pages (up to 100 pages)." });
    if (status === 400) return json(400, { ok: false, message: "That file couldn’t be read. Try a clearer screenshot or a different PDF." });
    return json(502, { ok: false, message: "Something went wrong reading that. Try again." });
  }
  const data = await upstream.json();
  EdgeRuntime.waitUntil(recordSpend(service, MODEL, data.usage));
  const raw = parseJson((data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""));
  if (!raw) { await refund(); return json(502, { ok: false, message: "That couldn’t be read properly. Try again, or try a clearer copy." }); }

  // tidy and validate everything before it reaches the student's planner
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v : []).slice(0, n);
  const validIdx = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < mods.length ? v as number : null);
  const out = {
    type: ["timetable", "handbook", "mixed", "other"].includes(raw.type) ? raw.type : "mixed",
    mods: arr(raw.mods, 30).map((m: any) => ({ code: str(m?.code, 30), name: str(m?.name, 140), m: validIdx(m?.m) })).filter((m: any) => m.code || m.name),
    classes: arr(raw.classes, 120).map((c: any) => ({ mod: str(c?.mod, 140), title: str(c?.title, 80) || "Class", d: Number.isInteger(c?.d) && c.d >= 0 && c.d <= 6 ? c.d : null, s: hhmm(c?.s), e: hhmm(c?.e), loc: str(c?.loc, 80), w: str(c?.w, 60) })).filter((c: any) => c.d !== null && c.s),
    once: arr(raw.once, 120).map((c: any) => ({ mod: str(c?.mod, 140), title: str(c?.title, 120) || "Session", date: ymd(c?.date), s: hhmm(c?.s), e: hhmm(c?.e), loc: str(c?.loc, 80) })).filter((c: any) => c.date),
    due: arr(raw.due, 120).map((c: any) => ({ mod: str(c?.mod, 140), title: str(c?.title, 140) || "Deadline", k: str(c?.k, 20) || "other", date: ymd(c?.date), t: hhmm(c?.t), wt: str(c?.wt, 20) })).filter((c: any) => c.date),
    hb: arr(raw.hb, 30).map((h: any) => ({ mod: str(h?.mod, 140), sum: str(h?.sum, 1200), as: arr(h?.as, 12).map((x: any) => str(x, 200)).filter(Boolean), rd: arr(h?.rd, 6).map((x: any) => str(x, 200)).filter(Boolean), tp: arr(h?.tp, 20).map((x: any) => str(x, 160)).filter(Boolean) })).filter((h: any) => h.mod && (h.sum || h.as.length || h.tp.length)),
    warn: arr(raw.warn, 8).map((x: any) => str(x, 240)).filter(Boolean),
  };
  if (!out.mods.length && !out.classes.length && !out.once.length && !out.due.length && !out.hb.length) await refund();
  return json(200, { ok: true, left: take.left, ...out });
});
