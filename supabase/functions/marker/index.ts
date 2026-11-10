// The marker: exam-style practice questions for any UCL module, and marking of a student's practice answer
// against UCL's grade bands and the department's own published criteria.
//
// POST { action: "questions", code }                     -> generates and caches practice questions (signed in)
// POST { action: "mark", code, question, answer, ... }   -> marks one practice answer (signed in, counts as an Assess marking)
//      attachments?: photos / video frames / PDFs / document text holding (part of) the answer — see attach.ts
//
// Practice questions are written fresh in the style of each module. They are never copied from real UCL papers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BUDGET_MSG, PAUSED_MSG, budgetReached, handleAccountProblem, isAccountProblem, recordSpend } from "./common.ts";
import { MAX_BODY, attachmentError, parseAttachments } from "./attach.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SONNET = "claude-sonnet-5-5";
const MAX_ANSWER = 14_000; // characters, roughly 2,300 words
const MAX_QUESTION = 3_000;
const CODE_RE = /^[A-Z]{4}[0-9]{4}$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// The full description from the module's public UCL catalogue page, cached on the module row.
async function moduleDetails(service: any, mod: any): Promise<string> {
  if (mod.details && mod.details_at && Date.now() - Date.parse(mod.details_at) < 120 * 864e5) return mod.details;
  if (!mod.url || !/^https:\/\/www\.ucl\.ac\.uk\/module-catalogue\//.test(mod.url)) return mod.summary || "";
  try {
    const r = await fetch(mod.url, { headers: { "User-Agent": "Mozilla/5.0 (study site module lookup)" } });
    if (!r.ok) return mod.summary || "";
    const text = stripHtml(await r.text());
    const start = text.search(/Module description|Aims|Outline|Description/i);
    const body = (start >= 0 ? text.slice(start) : text).replace(/\n(Module deliveries|Intended teaching term|Teaching and assessment|Assessment|Methods of assessment)[\s\S]*$/i, (m) => m.slice(0, 1500));
    const details = body.slice(0, 6000);
    if (details.length > 200) {
      await service.from("ucl_modules").update({ details, details_at: new Date().toISOString() }).eq("code", mod.code);
      return details;
    }
  } catch { /* fall back to the short summary */ }
  return mod.summary || "";
}

async function rubricFor(service: any, department: string | null): Promise<string> {
  const { data } = await service.from("marking_rubrics").select("key, department, title, body");
  const rows = (data || []) as any[];
  const dept = rows.find((r) => r.department && r.department === department);
  const base = rows.find((r) => !r.department);
  return [dept ? `DEPARTMENT CRITERIA (${dept.title}) — apply these first:\n${dept.body.trim()}` : "", base ? `UCL-WIDE CRITERIA (${base.title}):\n${base.body.trim()}` : ""].filter(Boolean).join("\n\n");
}

function levelWord(level: number | null) {
  return level === 4 ? "Level 4 (first-year undergraduate)" : level === 5 ? "Level 5 (second-year undergraduate)" : level === 6 ? "Level 6 (final-year undergraduate)" : level === 7 ? "Level 7 (integrated master's / postgraduate)" : "undergraduate";
}

function parseJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch { /* try to find the outermost object/array */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}"), c = t.indexOf("["), d = t.lastIndexOf("]");
  if (c >= 0 && d > c && (a < 0 || c < a)) { try { return JSON.parse(t.slice(c, d + 1)); } catch { /* ignore */ } }
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* ignore */ } }
  // a cut-off array: keep the complete objects
  if (c >= 0 && (a < 0 || c < a)) {
    for (let end = t.lastIndexOf("}"); end > c; end = t.lastIndexOf("}", end - 1)) {
      try { const v = JSON.parse(t.slice(c, end + 1) + "]"); if (Array.isArray(v) && v.length) return v; } catch { /* keep trying */ }
    }
  }
  return null;
}

async function callClaude(apiKey: string, system: string, user: string | any[], maxTokens: number) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: SONNET, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) {
    let text = "";
    try { text = await r.text(); const e = JSON.parse(text)?.error; text = e?.message || text; } catch { /* ignore */ }
    return { ok: false as const, status: r.status, text };
  }
  const data = await r.json();
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { ok: true as const, text, usage: data.usage, truncated: data.stop_reason === "max_tokens" };
}

const SYSTEM = "You are the examiner inside a revision website for UCL students. You write exam-style practice questions and mark practice answers the way an experienced, fair UCL examiner in the relevant department would. Be accurate and specific; never invent cases, statutes, studies, statistics, quotations or reading; never claim a question comes from a real UCL paper; never refer to yourself as an AI or name any model or company — you are the student's tutor. Reply with only the JSON value requested: no prose before or after, no code fences.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "invalid_request", message: "POST only" });
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { code: "ai_paused", message: PAUSED_MSG });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json(401, { code: "session_expired", message: "Please sign in to continue." });

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { code: "prompt_too_large", message: "Those attachments are too large to send at once. Try fewer or smaller files." });
    body = JSON.parse(raw);
  } catch { return json(400, { code: "invalid_request", message: "Bad request." }); }
  const code = String(body.code || "").toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { code: "invalid_request", message: "Pick a module first." });
  const { data: mod } = await service.from("ucl_modules").select("*").eq("code", code).maybeSingle();
  if (!mod) return json(404, { code: "not_found", message: "We couldn’t find that module." });

  // ---------- practice questions for a module ----------
  if (body.action === "questions") {
    const { data: existing } = await service.from("module_questions").select("id, topic, kind, question, guide, position").eq("code", code).order("position");
    if (existing && existing.length) return json(200, { questions: existing, cached: true });

    // generation uses the shared daily £ budget but not the student's own allowance (questions are cached for everyone)
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const [{ data: st }, { data: sp }] = await Promise.all([
      service.from("ai_settings").select("daily_budget_gbp, usd_per_gbp").eq("id", true).maybeSingle(),
      service.from("ai_spend").select("usd").eq("day", day).maybeSingle(),
    ]);
    if (st && sp && +sp.usd >= +st.daily_budget_gbp * +st.usd_per_gbp) return json(503, { code: "ai_paused", message: BUDGET_MSG });

    const details = await moduleDetails(service, mod);
    const prompt = `Write 6 exam-style practice questions for this UCL module, in the style UCL examiners in this department typically set.

MODULE: ${mod.code} ${mod.title}
Department: ${mod.department || "unknown"} · Faculty: ${mod.faculty || "unknown"} · ${levelWord(mod.level)} · ${mod.credits ?? "?"} credits · ${mod.term || ""}
Catalogue description (from UCL's public module catalogue):
"""
${details.slice(0, 5000)}
"""

Rules:
- Cover different topics from the description, roughly in teaching order. Stay strictly within what the description says the module covers; if it is thin, keep questions to the core of the subject at this level.
- Match the discipline: essay questions for humanities and social sciences; problem / calculation / "derive and explain" questions for quantitative subjects; short structured questions (with marks in brackets) where that is the norm (e.g. sciences, medicine). For a dissertation, project, language-skills or placement module, write questions that practise the kind of written work it assesses.
- Each question must be answerable in about 45 minutes in exam conditions, without notes. Keep each question under 110 words (multi-part questions included).
- Do not copy or claim to reproduce real UCL exam questions.
- For each question give an indicative marking guide: one sentence (under 35 words) each on what a First, a 2:1 and a 2:2 answer does for THIS question.

Return a JSON array of 6 objects: {"topic": short topic name, "kind": "essay" | "problem" | "short", "question": the full question text, "guide": {"first": "...", "two_one": "...", "two_two": "..."}}`;
    const res = await callClaude(apiKey, SYSTEM, prompt, 8000);
    if (!res.ok) {
      console.error("questions upstream", code, res.status, res.text.slice(0, 300));
      if (isAccountProblem(res.status, res.text)) { EdgeRuntime.waitUntil(handleAccountProblem(service, res.status, res.text)); return json(503, { code: "ai_paused", message: PAUSED_MSG }); }
      return json(502, { code: "upstream_error", message: "Couldn’t write questions just now. Try again in a moment." });
    }
    EdgeRuntime.waitUntil(recordSpend(service, SONNET, res.usage));
    const arr = parseJson(res.text);
    if (!Array.isArray(arr) || !arr.length) console.error("questions parse", code, res.truncated, res.text.slice(0, 300));
    if (!Array.isArray(arr) || !arr.length) return json(502, { code: "upstream_error", message: "Couldn’t write questions just now. Try again." });
    // someone else may have generated them meanwhile
    const { data: again } = await service.from("module_questions").select("id").eq("code", code).limit(1);
    if (!again || !again.length) {
      const rows = arr.slice(0, 10).filter((q: any) => q && typeof q.question === "string" && q.question.trim()).map((q: any, i: number) => ({
        code, position: i, topic: String(q.topic || "").slice(0, 120) || null,
        kind: ["essay", "problem", "short"].includes(q.kind) ? q.kind : "essay",
        question: String(q.question).slice(0, MAX_QUESTION),
        guide: q.guide && typeof q.guide === "object" ? { first: String(q.guide.first || ""), two_one: String(q.guide.two_one || ""), two_two: String(q.guide.two_two || "") } : null,
      }));
      await service.from("module_questions").insert(rows);
    }
    const { data: saved } = await service.from("module_questions").select("id, topic, kind, question, guide, position").eq("code", code).order("position");
    return json(200, { questions: saved || [] });
  }

  // ---------- mark a practice answer ----------
  if (body.action === "mark") {
    const question = String(body.question || "").trim();
    const answer = String(body.answer || "").trim();
    const minutes = Number.isFinite(+body.minutes) && +body.minutes > 0 ? Math.min(600, Math.round(+body.minutes)) : null;
    const questionId = typeof body.question_id === "string" && /^[0-9a-f-]{36}$/.test(body.question_id) ? body.question_id : null;
    if (!body.practice) return json(400, { code: "invalid_request", message: "Please confirm this is exam practice, not work you’re submitting." });
    if (question.length < 10) return json(400, { code: "invalid_request", message: "Add the question you’re answering." });
    if (question.length > MAX_QUESTION) return json(413, { code: "prompt_too_large", message: "That question is too long. Paste just the question." });
    const att = parseAttachments(body.attachments);
    if ("error" in att) return json(400, { code: "attachment_rejected", message: att.error });
    const hasAtt = att.blocks.length > 0;
    if (!hasAtt && answer.split(/\s+/).length < 40) return json(400, { code: "invalid_request", message: "Write at least a paragraph or two so there’s something to mark." });
    if (answer.length > MAX_ANSWER) return json(413, { code: "prompt_too_large", message: "That answer is too long to mark in one go (about 2,300 words max)." });

    const { data: take, error: takeErr } = await service.rpc("ai_take_plan", { p_user: user.id, p_units: 2, p_kind: "assess" });
    if (takeErr || !take) return json(500, { code: "upstream_error", message: "Couldn’t check your allowance. Try again." });
    if (!take.ok) {
      if (take.reason === "budget") {
        EdgeRuntime.waitUntil(service.from("ai_settings").select("daily_budget_gbp").eq("id", true).single().then(({ data }: any) => budgetReached(service, "£" + (data?.daily_budget_gbp ?? "?") + " a day")));
        return json(503, { code: "ai_paused", message: BUDGET_MSG });
      }
      const msg: Record<string, string> = {
        free_assess: "You’ve used this week’s free marking. Go Pro for unlimited marking, or your free marking comes back on Monday.",
        daily: "You’ve reached today’s marking limit. It resets at midnight (UK time).",
        global: "The marker is very busy today. Please try again tomorrow.",
      };
      return json(429, { code: "rate_limited", reason: take.reason, upgrade: take.reason === "free_assess", message: msg[take.reason] || msg.daily });
    }
    const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: 2, p_kind: "assess", p_tier: take.tier });

    const [details, rubric] = await Promise.all([moduleDetails(service, mod), rubricFor(service, mod.department)]);
    let guide = "";
    if (questionId) {
      const { data: q } = await service.from("module_questions").select("guide").eq("id", questionId).maybeSingle();
      if (q?.guide) guide = `Indicative guide for this question — First: ${q.guide.first} | 2:1: ${q.guide.two_one} | 2:2: ${q.guide.two_two}`;
    }
    const prompt = `Mark this practice exam answer as a UCL examiner in ${mod.department || "this department"} would.

MODULE: ${mod.code} ${mod.title} · ${levelWord(mod.level)} · Department: ${mod.department || "unknown"}
Module description: """${details.slice(0, 2500)}"""

MARKING CRITERIA:
${rubric}
${guide ? "\n" + guide + "\n" : ""}
QUESTION: """${question}"""
${minutes ? `Written in ${minutes} minutes (exam conditions).` : "Time taken not given."}

STUDENT'S ANSWER:
${hasAtt ? `The answer is ${answer ? "partly typed below and partly " : ""}in the attachments sent before this message: ${att.summary}. Read handwriting, photographed pages, video stills and documents carefully; together with any typed text they make up one answer, in the order given. Ignore anything that is clearly not part of the answer.\n` : ""}${answer ? `"""\n${answer}\n"""` : "(No typed text: the whole answer is in the attachments.)"}

Instructions:
- This is a revision tool for exam practice only. If the answer or question makes clear it is assessed coursework the student intends to submit (an essay assignment, dissertation chapter, take-home assessment they will hand in), do not mark it: set "refused": true and explain briefly in "refuse_reason".
- Judge the answer against the criteria at the module's level, best fit. Be honest and calibrated, as a real second marker would be: do not inflate. Most competent answers are 2:1 or 2:2; reserve 70+ for answers that genuinely meet the First descriptors.
- Give a mark range no wider than 5 marks (e.g. 62-66) and the class it falls in.
- Feedback must quote or point to specific parts of the student's answer.
- "changes" = the three changes that would most raise the mark, most important first, each concrete enough to act on in the next attempt. Keep each "change" under 70 words and each "why" under 40 words.
${hasAtt ? `- If the attachments do not contain an answer to this question (blank, unreadable, or about something else), do not mark: set "refused": true and say briefly what's wrong in "refuse_reason" (e.g. which photo can't be read). If only part is unreadable, mark the rest and say which part in the headline.
- "transcript" = a faithful transcription of the answer content in the attachments, in order, so the student has a typed copy (keep their wording and mistakes; mark unreadable words as [unclear]; max 2,000 words).
` : ""}- "example_answer" = a concise First-class answer to the same question (400-650 words) for comparison, written at this level; use only well-established material, no invented citations. Start with a one-line plan.

Return one JSON object:
{"refused": false, "refuse_reason": "",${hasAtt ? ' "transcript": "...",' : ""} "class": "First" | "2:1" | "2:2" | "Third" | "Fail", "mark_low": int, "mark_high": int, "headline": one sentence verdict, "criteria": [{"name": criterion name, "band": "First" | "2:1" | "2:2" | "Third" | "Fail", "comment": 1-3 sentences}], "strengths": [2-3 short points], "changes": [{"change": what to do, "why": how it maps to the criteria}, x3], "example_answer": "..."}`;

    const res = await callClaude(apiKey, SYSTEM, hasAtt ? [...att.blocks, { type: "text", text: prompt }] : prompt, hasAtt ? 10000 : 6000);
    if (!res.ok) {
      console.error("mark upstream", code, res.status, res.text.slice(0, 300));
      await refund();
      if (hasAtt && res.status === 400 && attachmentError(res.text)) return json(400, { code: "attachment_rejected", message: attachmentError(res.text) });
      if (isAccountProblem(res.status, res.text)) { EdgeRuntime.waitUntil(handleAccountProblem(service, res.status, res.text)); return json(503, { code: "ai_paused", message: PAUSED_MSG }); }
      if (res.status === 429 || res.status === 529) return json(429, { code: "rate_limited", message: "The marker is busy right now. Try again in a minute." });
      return json(502, { code: "upstream_error", message: "The marker had a problem. Try again." });
    }
    EdgeRuntime.waitUntil(recordSpend(service, SONNET, res.usage));
    const out = parseJson(res.text);
    if (!out || typeof out !== "object" || Array.isArray(out)) { console.error("mark parse", code, res.truncated, res.text.slice(0, 300)); await refund(); return json(502, { code: "upstream_error", message: "The marker had a problem reading that. Try again." }); }
    if (out.refused) {
      await refund();
      return json(200, { refused: true, message: String(out.refuse_reason || "This looks like coursework you’ll submit. The marker is for exam practice only.") });
    }
    const classes = ["First", "2:1", "2:2", "Third", "Fail"];
    let lo = Math.max(0, Math.min(100, Math.round(+out.mark_low || 0))), hi = Math.max(0, Math.min(100, Math.round(+out.mark_high || lo)));
    if (hi < lo) [lo, hi] = [hi, lo];
    if (hi - lo > 6) hi = lo + 5;
    const mid = (lo + hi) / 2;
    const cls = mid >= 70 ? "First" : mid >= 60 ? "2:1" : mid >= 50 ? "2:2" : mid >= 40 ? "Third" : "Fail";
    const result = {
      class: cls,
      mark_low: lo, mark_high: hi,
      headline: String(out.headline || "").slice(0, 400),
      criteria: Array.isArray(out.criteria) ? out.criteria.slice(0, 6).map((c: any) => ({ name: String(c?.name || "").slice(0, 80), band: classes.includes(c?.band) ? c.band : "", comment: String(c?.comment || "").slice(0, 800) })) : [],
      strengths: Array.isArray(out.strengths) ? out.strengths.slice(0, 4).map((s: any) => String(s).slice(0, 300)) : [],
      changes: Array.isArray(out.changes) ? out.changes.slice(0, 3).map((c: any) => ({ change: String(c?.change || c || "").slice(0, 1200), why: String(c?.why || "").slice(0, 800) })) : [],
      example_answer: String(out.example_answer || "").slice(0, 8000),
      rubric: rubric.startsWith("DEPARTMENT CRITERIA") ? mod.department : "UCL-wide",
    };
    // with attachments, keep a typed copy of what was marked so history shows the answer
    let stored = answer;
    if (hasAtt) {
      const transcript = String(out.transcript || "").trim().slice(0, 16000);
      stored = [answer, `[Attached: ${att.summary}]`, transcript].filter(Boolean).join("\n\n");
    }
    const { data: saved } = await service.from("mark_attempts").insert({ user_id: user.id, code, question_id: questionId, question, answer: stored, minutes, result }).select("id, created_at").single();
    return json(200, { ...result, answer: stored, id: saved?.id, created_at: saved?.created_at, left: take.left, tier: take.tier });
  }

  return json(400, { code: "invalid_request", message: "Unknown action." });
});
