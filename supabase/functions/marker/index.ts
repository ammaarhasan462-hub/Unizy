// The marker: a Module Map (topics + practice questions at three levels) for any UCL, Imperial, Queen Mary or LSE module, and marking of
// a student's practice answer against the university's grade bands and the department's own published criteria.
//
// POST { action: "questions", code }                     -> topics + questions; starts writing them if the module has none yet
//                                                           (signed in; returns { pending: true } while they are being written)
// POST { action: "warm", code }  + header x-warm-key     -> background batch: writes a module's questions (no user)
// POST { action: "deepen", code, topic_pos } + x-ops-key -> full pack for one topic: more questions, an example answer plan for every
//                                                           exam-style / First-class question, then a second examiner pass that checks it all
// POST { action: "guest_mark", code, question_id, answer } -> signed out: mark ONE answer to a question from the bank (no account; per network
//                                                           per day and site-wide caps, inside the daily £ budget; nothing is saved)
// POST { action: "mark", code, question, answer, ... }   -> marks one practice answer (signed in, counts as an Assess marking)
//      question_id?, topic_pos?, tier?, prev_id? (the attempt this one rewrites)
//      attachments?: photos / video frames / PDFs / document text holding (part of) the answer — see attach.ts
//
// Tiers: foundation = quick-recall questions with a short answer the student checks themselves (never sent for marking);
// exam = exam-style; first = First-class stretch (synoptic / evaluative / harder). Questions are written fresh in the
// style of each module. They are never copied from real UCL papers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BUDGET_MSG, PAUSED_MSG, budgetReached, costUsd, handleAccountProblem, isAccountProblem, recordSpend } from "./common.ts";
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
const CODE_RE = /^[A-Z]{2,4}[0-9][0-9A-Z]{1,5}$/; // UCL ECON0013, Imperial MATH40001, Queen Mary ECN115, LSE EC1A1 / LSE100

// Universities. Modules carry a `uni`; everything the examiner says follows it.
const UNIS: Record<string, { name: string; long: string; source: string }> = {
  ucl: { name: "UCL", long: "UCL", source: "UCL's public module catalogue" },
  imperial: { name: "Imperial", long: "Imperial College London", source: "Imperial College London's official programme specifications" },
  qmul: { name: "Queen Mary", long: "Queen Mary University of London", source: "Queen Mary's official module directory" },
  lse: { name: "LSE", long: "the London School of Economics and Political Science", source: "the LSE Calendar's undergraduate course guides" },
};
const uniOf = (mod: any) => UNIS[mod?.uni] || UNIS.ucl;
const bare = (U: { long: string }) => U.long.replace(/^the /, "");
const anU = (U: { long: string }) => (/^[AEIO]/.test(bare(U)) ? "an " : "a ") + bare(U); // "a UCL", "an Imperial College London", "a Queen Mary…"
// module size as each university prints it
const sizeOf = (mod: any) => mod.uni === "lse" ? (mod.credits == 0.5 ? "half unit" : mod.credits == 1 ? "full unit" : mod.credits ? `${mod.credits} units` : "")
  : mod.uni === "imperial" ? (mod.ects ? `${mod.ects} ECTS` : "") : (mod.credits ? `${mod.credits} credits` : mod.ects ? `${mod.ects} ECTS` : "");
const UUID_RE = /^[0-9a-f-]{36}$/;
const OPENS_PER_DAY = 15; // new modules one student can have written per day (each costs a few pence)

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
  if (mod.uni && mod.uni !== "ucl") {
    // Imperial, Queen Mary and LSE: describe the module from the verified facts held on the row
    const U = uniOf(mod), size = sizeOf(mod);
    const facts = [
      `${mod.code} ${mod.title} is ${anU(U)} ${mod.uni === "lse" ? "course" : "module"} in ${mod.department || "its department"}${mod.faculty ? " (" + mod.faculty + ")" : ""}.`,
      [size, mod.year_of_study ? `usually taken in Year ${mod.year_of_study}` : "", mod.mtype ? mod.mtype : "", mod.term ? `term: ${mod.term}` : ""].filter(Boolean).join(", "),
      Array.isArray(mod.programmes) && mod.programmes.length ? `Programmes: ${mod.programmes.join("; ")}.` : "",
      mod.status ? mod.status + "." : "",
      mod.summary || mod.details || "",
    ].filter(Boolean).join("\n");
    return facts;
  }
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

async function rubricFor(service: any, department: string | null, uni = "ucl"): Promise<string> {
  const { data } = await service.from("marking_rubrics").select("key, department, title, body").eq("uni", uni);
  const rows = (data || []) as any[];
  const dept = rows.find((r) => r.department && r.department === department);
  const base = rows.find((r) => !r.department);
  const U = UNIS[uni] || UNIS.ucl;
  return [dept ? `DEPARTMENT CRITERIA (${dept.title}) — apply these first:\n${dept.body.trim()}` : "", base ? `${U.name.toUpperCase()}-WIDE CRITERIA (${base.title}):\n${base.body.trim()}` : ""].filter(Boolean).join("\n\n");
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
  return null;
}

// A Module Map cut off by the length limit: keep every complete topic.
function parseTopics(text: string): any[] | null {
  const whole = parseJson(text);
  if (whole && Array.isArray(whole.topics)) return whole.topics;
  if (Array.isArray(whole)) return whole;
  const t = text.trim(), c = t.indexOf("[");
  if (c < 0) return null;
  for (let end = t.lastIndexOf("}"); end > c; end = t.lastIndexOf("}", end - 1)) {
    try { const v = JSON.parse(t.slice(c, end + 1) + "]"); if (Array.isArray(v) && v.length) return v; } catch { /* keep trying */ }
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

const systemFor = (U: { name: string; long: string }) => `You are the examiner inside a revision website for ${bare(U)} students. You write exam-style practice questions and mark practice answers the way an experienced, fair ${bare(U)} examiner in the relevant department would. Be accurate and specific; never invent cases, statutes, studies, statistics, quotations or reading; never claim a question comes from a real ${U.name} paper; never name lecturers; never refer to yourself as an AI or name any model or company — you are the student's tutor. Reply with only the JSON value requested: no prose before or after, no code fences.`;

const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const KINDS = ["essay", "problem", "short"];

async function loadMap(service: any, code: string) {
  const [{ data: topics }, { data: questions }] = await Promise.all([
    service.from("module_topics").select("position, title, summary").eq("code", code).order("position"),
    service.from("module_questions").select("id, topic, kind, tier, topic_pos, question, answer, guide, steps, position").eq("code", code).order("position"),
  ]);
  return { topics: topics || [], questions: questions || [] };
}

// Write a module's topics and questions (one call), save them, and mark the job done or failed.
async function writeMap(service: any, apiKey: string, mod: any, source: "open" | "batch") {
  const code = mod.code;
  const fail = (error: string) => service.from("question_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error: error.slice(0, 500) }).eq("code", code);
  try {
    const details = await moduleDetails(service, mod);
    const U = uniOf(mod);
    const prompt = `Build a revision Module Map for this ${bare(U)} module: split it into its main topics, in teaching order, and write practice questions for each topic at three levels.

MODULE: ${mod.code} ${mod.title}
Department: ${mod.department || "unknown"} · Faculty: ${mod.faculty || "unknown"} · ${levelWord(mod.level)} · ${sizeOf(mod) || "? credits"} · ${mod.term || ""}
Description (from ${U.source}):
"""
${details.slice(0, 5000)}
"""

Rules:
- 8 topics (6 if the description is thin, up to 10 for a broad module). "title" under 8 words; "summary" one sentence under 25 words on what the topic covers. Stay within what the description says the module covers; where it is thin, use the standard core of this subject at this level.
- For each topic write:
  • "recall": 2 Foundation questions on core definitions, key terms, principles, key cases / thinkers / equations. Each has a model "a" (answer) under 45 words that a student can check themselves against.
  • "exam": 1 exam-style question at the standard of a typical ${bare(U)} exam for this module.
  • "first": 1 harder First-class stretch question on the same topic: synoptic (links to another topic of this module), evaluative, a counter-argument to assess, or an edge case / harder calculation.
- Match the discipline's exam format: essay questions for humanities and social sciences; for law, a mix of essay questions and problem questions (a short fact scenario to advise on); calculation / derivation questions for quantitative subjects; short structured questions with marks in brackets for sciences and medicine. Language, project, dissertation or placement modules: practise the kind of written work they assess. Exam and First questions should be answerable in about 45 minutes without notes.
- For "exam" and "first": "kind" is "essay" | "problem" | "short"; "guide" has one sentence (under 30 words) each on what a First, a 2:1 and a 2:2 answer does for THIS question; and ONLY for a calculation, derivation or other worked numerical / formal problem, "steps" = 3-6 worked-solution steps (each under 50 words, the last giving the final answer). No "steps" for essays or law problem questions.
- Every question under 110 words. Never copy or claim to reproduce real ${U.name} exam questions. Only mention cases, statutes, authors or studies that are real and well established.

Return one JSON object:
{"topics": [{"title": "...", "summary": "...", "recall": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}], "exam": {"kind": "essay", "question": "...", "guide": {"first": "...", "two_one": "...", "two_two": "..."}}, "first": {"kind": "essay", "question": "...", "guide": {...}}}]}`;
    const res = await callClaude(apiKey, systemFor(U), prompt, 12000);
    if (!res.ok) {
      console.error("map upstream", code, res.status, res.text.slice(0, 300));
      if (isAccountProblem(res.status, res.text)) await handleAccountProblem(service, res.status, res.text);
      await fail("upstream " + res.status + ": " + res.text);
      return;
    }
    if (source === "batch") await service.rpc("ai_add_batch_spend", { p_usd: costUsd(SONNET, res.usage) });
    else await recordSpend(service, SONNET, res.usage);
    const topics = (parseTopics(res.text) || []).filter((t: any) => t && t.title && (t.exam || t.recall));
    if (topics.length < 3) { console.error("map parse", code, res.truncated, res.text.slice(0, 300)); await fail("parse"); return; }

    // someone else may have written them meanwhile
    const { data: again } = await service.from("module_topics").select("position").eq("code", code).limit(1);
    if (again && again.length) { await service.from("question_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("code", code); return; }
    const { data: last } = await service.from("module_questions").select("position").eq("code", code).order("position", { ascending: false }).limit(1);
    let pos = last && last.length ? (last[0].position ?? 0) + 1 : 0;

    const trows = topics.slice(0, 10).map((t: any, i: number) => ({ code, position: i, title: s(t.title, 120), summary: s(t.summary, 300) || null }));
    const qrows: any[] = [];
    const marked = (q: any, tier: string, i: number, title: string) => {
      if (!q || typeof q.question !== "string" || !q.question.trim()) return;
      const steps = Array.isArray(q.steps) ? q.steps.map((x: any) => s(x, 400)).filter(Boolean).slice(0, 8) : [];
      const g = q.guide && typeof q.guide === "object" ? q.guide : null;
      qrows.push({
        code, position: pos++, topic_pos: i, topic: title, tier, kind: KINDS.includes(q.kind) ? q.kind : "essay",
        question: s(q.question, MAX_QUESTION),
        guide: g ? { first: s(g.first, 400), two_one: s(g.two_one, 400), two_two: s(g.two_two, 400) } : null,
        steps: steps.length >= 2 ? steps : null,
      });
    };
    topics.slice(0, 10).forEach((t: any, i: number) => {
      const title = s(t.title, 120);
      (Array.isArray(t.recall) ? t.recall : []).slice(0, 3).forEach((r: any) => {
        if (r && r.q && r.a) qrows.push({ code, position: pos++, topic_pos: i, topic: title, tier: "foundation", kind: "recall", question: s(r.q, 600), answer: s(r.a, 800) });
      });
      marked(t.exam, "exam", i, title);
      marked(t.first, "first", i, title);
    });
    const { error: e1 } = await service.from("module_topics").insert(trows);
    if (e1) { await fail("topics insert: " + e1.message); return; }
    const { error: e2 } = await service.from("module_questions").insert(qrows);
    if (e2) { await service.from("module_topics").delete().eq("code", code); await fail("questions insert: " + e2.message); return; }
    await service.from("question_jobs").update({ status: "done", finished_at: new Date().toISOString(), error: null }).eq("code", code);
  } catch (e) {
    console.error("map error", code, String(e));
    await fail(String(e));
  }
}

// ---------- full packs ----------
// Owner-only batch jobs authenticate with a key kept in the ops_keys table (service role only), or the WARM_KEY secret.
async function opsAllowed(service: any, req: Request): Promise<boolean> {
  const got = req.headers.get("x-ops-key") || req.headers.get("x-warm-key") || "";
  if (!got) return false;
  const warm = Deno.env.get("WARM_KEY");
  if (warm && got === warm) return true;
  const { data } = await service.from("ops_keys").select("key").eq("name", "deepen").maybeSingle();
  return !!(data && data.key && data.key === got);
}

const PACK_RECALL = 5, PACK_EXAM = 2; // per topic in a full pack (First-class stays at 1, plus anything already there)

// One topic of a full pack: write the extra questions and an example answer plan for every exam-style and First-class
// question, then have a second examiner check the whole topic and correct it. Updates module_packs as topics finish.
async function deepenTopic(service: any, apiKey: string, mod: any, pos: number) {
  const code = mod.code, U = uniOf(mod);
  const spend = (u: any) => service.rpc("ai_add_batch_spend", { p_usd: costUsd(SONNET, u) });
  const done = async (err?: string) => {
    const [{ data: tps }, { data: qs }] = await Promise.all([
      service.from("module_topics").select("position").eq("code", code),
      service.from("module_questions").select("id, tier, answer, topic_pos").eq("code", code),
    ]);
    const tierQs = (qs || []).filter((q: any) => q.topic_pos != null && q.tier !== "foundation");
    const planned = new Set(tierQs.filter((q: any) => q.answer).map((q: any) => q.topic_pos));
    const all = (tps || []).every((t: any) => planned.has(t.position));
    await service.from("module_packs").update({
      status: all ? "done" : "running", questions: (qs || []).filter((q: any) => q.topic_pos != null).length,
      finished_at: all ? new Date().toISOString() : null, error: err ? err.slice(0, 500) : null,
    }).eq("code", code);
  };
  try {
    const [{ data: topic }, { data: existing }] = await Promise.all([
      service.from("module_topics").select("position, title, summary").eq("code", code).eq("position", pos).maybeSingle(),
      service.from("module_questions").select("id, tier, kind, question, answer, guide, steps").eq("code", code).eq("topic_pos", pos).order("position"),
    ]);
    if (!topic) { await done("no topic " + pos); return; }
    const ex = (existing || []) as any[];
    const nRecall = ex.filter((q) => q.tier === "foundation").length, nExam = ex.filter((q) => q.tier === "exam").length;
    const addRecall = Math.max(0, PACK_RECALL - nRecall), addExam = Math.max(0, PACK_EXAM - nExam);
    const details = await moduleDetails(service, mod);
    const ref = (i: number) => "E" + (i + 1);
    const listing = ex.map((q, i) => `[${ref(i)}] ${q.tier === "foundation" ? "Quick recall" : q.tier === "first" ? "First-class stretch" : "Exam-style"} (${q.kind}): ${q.question}${q.answer ? "\n   Answer given: " + q.answer : ""}${q.guide ? "\n   Guide — First: " + q.guide.first + " | 2:1: " + q.guide.two_one + " | 2:2: " + q.guide.two_two : ""}${q.steps ? "\n   Worked steps: " + q.steps.join(" / ") : ""}`).join("\n");
    const ctx = `MODULE: ${mod.code} ${mod.title}
Department: ${mod.department || "unknown"} · ${levelWord(mod.level)} · ${sizeOf(mod) || "? credits"}
Description (from ${U.source}):
"""
${details.slice(0, 3500)}
"""
TOPIC ${pos + 1}: ${topic.title}${topic.summary ? " — " + topic.summary : ""}`;

    // 1) write
    const write = `You are building the full revision pack for one topic of this ${bare(U)} module.

${ctx}

QUESTIONS ALREADY IN THIS TOPIC:
${listing || "(none)"}

Write:
- "recall": ${addRecall} NEW Foundation quick-recall questions on this topic (definitions, key terms, principles, key cases / thinkers / equations / results that a student must know cold). Each with a model answer "a" under 45 words a student can check themselves against. Do not repeat what the existing questions already test.
- "exam": ${addExam} NEW exam-style question(s) on this topic at the standard of a typical ${bare(U)} exam for this module, different in angle from the existing ones. Same rules as before: "kind" "essay" | "problem" | "short"; "guide" with one sentence each (under 30 words) on what a First, a 2:1 and a 2:2 answer does; "steps" (3-6 worked steps, last one the final answer) ONLY for calculation / derivation / formal problems. Under 110 words each.
- "plans": an example First-class answer plan for EVERY exam-style and First-class question in this topic — the existing ones (keyed by their ref, e.g. "E3") and your new exam questions (keyed "N1", "N2"). Each plan is 4-7 bullet points (each under 30 words): the argument or method in order, the key material to use (only real, well-established cases, authors, studies, results), and the judgement or final answer. For a calculation, the plan gives the method and the final numerical answer.
Match the discipline's exam format. Never copy or claim to reproduce real ${U.name} exam questions.

Return one JSON object:
{"recall": [{"q": "...", "a": "..."}], "exam": [{"kind": "essay", "question": "...", "guide": {"first": "...", "two_one": "...", "two_two": "..."}, "steps": []}], "plans": {"E1": ["...", "..."], "N1": ["..."]}}`;
    const w = await callClaude(apiKey, systemFor(U), write, 6000);
    if (!w.ok) { await done("write upstream " + w.status + ": " + w.text); return; }
    await spend(w.usage);
    const wj = parseJson(w.text);
    if (!wj || typeof wj !== "object") { await done("write parse"); return; }
    const newRecall = (Array.isArray(wj.recall) ? wj.recall : []).filter((r: any) => r && r.q && r.a).slice(0, addRecall);
    const newExam = (Array.isArray(wj.exam) ? wj.exam : []).filter((q: any) => q && typeof q.question === "string" && q.question.trim()).slice(0, addExam);
    const plans = wj.plans && typeof wj.plans === "object" ? wj.plans : {};

    // 2) check: a second examiner reviews everything in the topic and corrects it
    const pkg: any = { items: [] as any[] };
    ex.forEach((q, i) => pkg.items.push({ ref: ref(i), tier: q.tier, kind: q.kind, question: q.question, answer: q.tier === "foundation" ? q.answer : undefined, guide: q.guide || undefined, steps: q.steps || undefined, plan: q.tier !== "foundation" ? plans[ref(i)] : undefined }));
    newRecall.forEach((r: any, i: number) => pkg.items.push({ ref: "R" + (i + 1), tier: "foundation", kind: "recall", question: s(r.q, 600), answer: s(r.a, 800) }));
    newExam.forEach((q: any, i: number) => pkg.items.push({ ref: "N" + (i + 1), tier: "exam", kind: KINDS.includes(q.kind) ? q.kind : "essay", question: s(q.question, MAX_QUESTION), guide: q.guide, steps: Array.isArray(q.steps) && q.steps.length >= 2 ? q.steps : undefined, plan: plans["N" + (i + 1)] }));
    const check = `You are the second examiner checking a revision pack before students use it. Be strict about accuracy.

${ctx}

PACK (JSON):
${JSON.stringify(pkg)}

Check every item:
1. Facts: every definition, answer, case, statute, author, study, date, formula and number is correct and well established. Recompute every calculation and worked step yourself.
2. The question is clear, answerable in an exam without notes, on this topic, and at the right level for this module.
3. Recall answers fully and correctly answer their question.
4. Each plan would genuinely earn a First on its question and uses only real material; for calculations the final answer matches your own working.
5. Guides describe sensibly different First / 2:1 / 2:2 answers.
Fix anything wrong or weak by rewriting that field. If an item cannot be fixed, list its ref in "drop".

Return one JSON object with ONLY the items you changed, each with its ref and the corrected fields, and the refs to drop:
{"fixes": [{"ref": "E2", "question": "...", "answer": "...", "guide": {...}, "steps": [...], "plan": [...]}], "drop": ["R3"], "notes": "one short sentence on what you changed"}`;
    const c = await callClaude(apiKey, systemFor(U), check, 6000);
    let fixes: Record<string, any> = {}, drop = new Set<string>();
    if (c.ok) {
      await spend(c.usage);
      const cj = parseJson(c.text);
      if (cj && Array.isArray(cj.fixes)) cj.fixes.forEach((f: any) => { if (f && typeof f.ref === "string") fixes[f.ref] = f; });
      if (cj && Array.isArray(cj.drop)) cj.drop.forEach((r: any) => drop.add(String(r)));
    } else { await done("check upstream " + c.status + ": " + c.text); return; } // never publish unchecked

    const plan = (v: any) => Array.isArray(v) ? v.map((x: any) => "• " + s(x, 300).replace(/^[•\-*]\s*/, "")).filter((x: string) => x.length > 3).slice(0, 8).join("\n") : "";
    const guideOf = (g: any) => g && typeof g === "object" ? { first: s(g.first, 400), two_one: s(g.two_one, 400), two_two: s(g.two_two, 400) } : null;
    const stepsOf = (v: any) => { const a = Array.isArray(v) ? v.map((x: any) => s(x, 400)).filter(Boolean).slice(0, 8) : []; return a.length >= 2 ? a : null; };

    // existing questions: apply fixes and add plans (never delete: students' attempts point at them)
    for (let i = 0; i < ex.length; i++) {
      const q = ex[i], f = fixes[ref(i)] || {}, upd: any = {};
      if (drop.has(ref(i))) continue;
      if (f.question) upd.question = s(f.question, q.tier === "foundation" ? 600 : MAX_QUESTION);
      if (q.tier === "foundation") { if (f.answer) upd.answer = s(f.answer, 800); }
      else {
        const p = plan(f.plan || plans[ref(i)]);
        if (p) upd.answer = p;
        if (f.guide) upd.guide = guideOf(f.guide);
        if (f.steps) upd.steps = stepsOf(f.steps);
      }
      if (Object.keys(upd).length) await service.from("module_questions").update(upd).eq("id", q.id);
    }
    // new questions
    const { data: last } = await service.from("module_questions").select("position").eq("code", code).order("position", { ascending: false }).limit(1);
    let qpos = last && last.length ? (last[0].position ?? 0) + 1 : 0;
    const rows: any[] = [];
    newRecall.forEach((r: any, i: number) => {
      const k = "R" + (i + 1), f = fixes[k] || {};
      if (drop.has(k)) return;
      rows.push({ code, position: qpos++, topic_pos: pos, topic: topic.title, tier: "foundation", kind: "recall", question: s(f.question || r.q, 600), answer: s(f.answer || r.a, 800) });
    });
    newExam.forEach((q: any, i: number) => {
      const k = "N" + (i + 1), f = fixes[k] || {};
      if (drop.has(k)) return;
      const p = plan(f.plan || plans[k]);
      rows.push({
        code, position: qpos++, topic_pos: pos, topic: topic.title, tier: "exam", kind: KINDS.includes(q.kind) ? q.kind : "essay",
        question: s(f.question || q.question, MAX_QUESTION), guide: guideOf(f.guide || q.guide), steps: stepsOf(f.steps || q.steps), answer: p || null,
      });
    });
    if (rows.length) {
      const { error } = await service.from("module_questions").insert(rows);
      if (error) { await done("insert: " + error.message); return; }
    }
    await done();
  } catch (e) {
    console.error("deepen error", code, pos, String(e));
    await done(String(e));
  }
}

// ---------- signed-out "try one marked answer" ----------
const GUEST_PER_NET = 2, GUEST_DAILY = 60, GUEST_MAX_ANSWER = 9_000;
async function sha256(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function countEvent(service: any, event: string) {
  try {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const { data } = await service.from("site_events").select("n").eq("day", day).eq("event", event).maybeSingle();
    if (data) await service.from("site_events").update({ n: (data.n || 0) + 1 }).eq("day", day).eq("event", event);
    else await service.from("site_events").insert({ day, event, n: 1 });
  } catch { /* ignore */ }
}
// per network per day (daily-salted hash, no IP kept), site-wide per day, and inside the shared daily £ budget
async function guestTake(service: any, net: string): Promise<{ ok: boolean; reason?: string }> {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const [{ data: st }, { data: sp }, { data: rows }] = await Promise.all([
    service.from("ai_settings").select("daily_budget_gbp, usd_per_gbp").eq("id", true).maybeSingle(),
    service.from("ai_spend").select("usd").eq("day", day).maybeSingle(),
    service.from("guest_marks").select("net, n").eq("day", day),
  ]);
  if (st && sp && +sp.usd >= +st.daily_budget_gbp * +st.usd_per_gbp) return { ok: false, reason: "budget" };
  const all = (rows || []) as any[];
  if (all.reduce((t, r) => t + (r.n || 0), 0) >= GUEST_DAILY) return { ok: false, reason: "global" };
  const mine = all.find((r) => r.net === net);
  if (mine && mine.n >= GUEST_PER_NET) return { ok: false, reason: "net" };
  if (mine) await service.from("guest_marks").update({ n: mine.n + 1 }).eq("day", day).eq("net", net);
  else await service.from("guest_marks").insert({ day, net, n: 1 });
  service.from("guest_marks").delete().lt("day", new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)).then(() => {}, () => {});
  return { ok: true };
}
async function guestRefund(service: any, net: string) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const { data } = await service.from("guest_marks").select("n").eq("day", day).eq("net", net).maybeSingle();
  if (data) await service.from("guest_marks").update({ n: Math.max(0, (data.n || 0) - 1) }).eq("day", day).eq("net", net);
}

// Mark one practice answer (shared by signed-in marking and the signed-out "try one" marking).
// Returns { resp } to send straight back (errors, refusals), or the shaped result.
async function runMark(service: any, apiKey: string, mod: any, code: string, o: {
  question: string; answer: string; minutes: number | null; questionId: string | null; prevId: string | null; userId: string | null; att: any; hasAtt: boolean;
}, refund: () => Promise<unknown>): Promise<any> {
  const { question, answer, minutes, questionId, prevId, att, hasAtt } = o;
  const [details, rubric, { data: topics }] = await Promise.all([
    moduleDetails(service, mod), rubricFor(service, mod.department, mod.uni || "ucl"),
    service.from("module_topics").select("position, title").eq("code", code).order("position"),
  ]);
  let guide = "", tier: string | null = null, topicPos: number | null = null;
  if (questionId) {
    const { data: q } = await service.from("module_questions").select("guide, tier, topic_pos").eq("id", questionId).eq("code", code).maybeSingle();
    if (q?.guide) guide = `Indicative guide for this question — First: ${q.guide.first} | 2:1: ${q.guide.two_one} | 2:2: ${q.guide.two_two}`;
    if (q) { tier = q.tier || "exam"; topicPos = q.topic_pos ?? null; }
  }
  const tlist = (topics || []) as any[];
  const askTopic = topicPos == null && tlist.length > 0;
  let prev: any = null;
  if (prevId && o.userId) {
    const { data: p } = await service.from("mark_attempts").select("id, result").eq("id", prevId).eq("user_id", o.userId).maybeSingle();
    if (p?.result) prev = { id: p.id, mark_low: p.result.mark_low, mark_high: p.result.mark_high, class: p.result.class };
  }
  const src = hasAtt ? "the student's answer (for attachments, as you transcribe it)" : "the student's answer";
  const U = uniOf(mod);
  const prompt = `Mark this practice exam answer as ${anU(U)} examiner in ${mod.department || "this department"} would.

MODULE: ${mod.code} ${mod.title} · ${levelWord(mod.level)} · Department: ${mod.department || "unknown"}
Module description: """${details.slice(0, 2500)}"""

MARKING CRITERIA:
${rubric}
${guide ? "\n" + guide + "\n" : ""}${tier === "first" ? "\nThis is a First-class stretch question: hold the answer to the First descriptors, but mark it fairly on the same scale.\n" : ""}
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
- "lost" = 2 to 5 places where marks were lost, in the order they appear. "quote" = 6 to 30 consecutive words copied EXACTLY, character for character, from ${src} (if the problem is something missing, quote the sentence where it should have gone). "issue" = what is wrong or missing there (under 35 words). "fix" = what would have earned the marks (under 35 words).
- "model_plan" = a First-class plan for this question: 3 to 6 short bullet points.
- "model_paragraph" = one paragraph (120-200 words) showing the weakest part of the student's answer done at First-class standard. Use only well-established material; no invented citations.
- "rewrite" = the paragraph the student should rewrite first: "quote" = its first 6 to 12 words copied exactly from ${src}; "task" = what to change in it (under 40 words).
- "cards" = 2 to 4 flashcards on knowledge the student got wrong or left out: "front" a short question (under 25 words), "back" the answer (under 45 words). Only well-established facts.
- "allocation" = an indicative mark scheme for THIS question split into 4 to 7 line items that together are worth 100 marks, and what this answer earned on each: "item" = what earns the marks (under 14 words), "available" = int, "awarded" = int from 0 to available. The awarded marks must add up to a total inside your mark range.
- "warnings" = 2 or 3 examiner warnings: the traps students most often fall into on THIS question (whether or not this student did), each one sentence under 30 words, written as advice ("Don't…", "Watch for…").
${askTopic ? `- "topic_pos" = the number of the module topic this question mostly belongs to, from: ${tlist.map((t) => t.position + " = " + t.title).join("; ")}. Use -1 if none fits.\n` : ""}${hasAtt ? `- If the attachments do not contain an answer to this question (blank, unreadable, or about something else), do not mark: set "refused": true and say briefly what's wrong in "refuse_reason" (e.g. which photo can't be read). If only part is unreadable, mark the rest and say which part in the headline.
- "transcript" = a faithful transcription of the answer content in the attachments, in order, so the student has a typed copy (keep their wording and mistakes; mark unreadable words as [unclear]; max 2,000 words).
` : ""}
Return one JSON object:
{"refused": false, "refuse_reason": "",${hasAtt ? ' "transcript": "...",' : ""} "class": "First" | "2:1" | "2:2" | "Third" | "Fail", "mark_low": int, "mark_high": int, "headline": one sentence verdict, "criteria": [{"name": criterion name, "band": "First" | "2:1" | "2:2" | "Third" | "Fail", "comment": 1-3 sentences}], "strengths": [2-3 short points], "changes": [{"change": "...", "why": "..."}, x3], "lost": [{"quote": "...", "issue": "...", "fix": "..."}], "model_plan": ["..."], "model_paragraph": "...", "rewrite": {"quote": "...", "task": "..."}, "cards": [{"front": "...", "back": "..."}], "allocation": [{"item": "...", "available": int, "awarded": int}], "warnings": ["..."]${askTopic ? ', "topic_pos": int' : ""}}`;

  const res = await callClaude(apiKey, systemFor(U), hasAtt ? [...att.blocks, { type: "text", text: prompt }] : prompt, hasAtt ? 10000 : 8000);
  if (!res.ok) {
    console.error("mark upstream", code, res.status, res.text.slice(0, 300));
    await refund();
    if (hasAtt && res.status === 400 && attachmentError(res.text)) return { resp: json(400, { code: "attachment_rejected", message: attachmentError(res.text) }) };
    if (isAccountProblem(res.status, res.text)) { EdgeRuntime.waitUntil(handleAccountProblem(service, res.status, res.text)); return { resp: json(503, { code: "ai_paused", message: PAUSED_MSG }) }; }
    if (res.status === 429 || res.status === 529) return { resp: json(429, { code: "rate_limited", message: "The marker is busy right now. Try again in a minute." }) };
    return { resp: json(502, { code: "upstream_error", message: "The marker had a problem. Try again." }) };
  }
  EdgeRuntime.waitUntil(recordSpend(service, SONNET, res.usage));
  const out = parseJson(res.text);
  if (!out || typeof out !== "object" || Array.isArray(out)) { console.error("mark parse", code, res.truncated, res.text.slice(0, 300)); await refund(); return { resp: json(502, { code: "upstream_error", message: "The marker had a problem reading that. Try again." }) }; }
  if (out.refused) {
    await refund();
    return { resp: json(200, { refused: true, message: String(out.refuse_reason || "This looks like coursework you’ll submit. The marker is for exam practice only.") }) };
  }
  const classes = ["First", "2:1", "2:2", "Third", "Fail"];
  let lo = Math.max(0, Math.min(100, Math.round(+out.mark_low || 0))), hi = Math.max(0, Math.min(100, Math.round(+out.mark_high || lo)));
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo > 6) hi = lo + 5;
  const mid = (lo + hi) / 2;
  const cls = mid >= 70 ? "First" : mid >= 60 ? "2:1" : mid >= 50 ? "2:2" : mid >= 40 ? "Third" : "Fail";
  if (askTopic && Number.isInteger(+out.topic_pos) && tlist.some((t) => t.position === +out.topic_pos)) topicPos = +out.topic_pos;
  const cards = Array.isArray(out.cards) ? out.cards.map((c: any) => ({ front: s(c?.front, 300), back: s(c?.back, 600) })).filter((c: any) => c.front.length >= 3 && c.back).slice(0, 4) : [];
  // mark allocation: line items worth 100 in total, awarded marks scaled so they add up to the middle of the range
  let allocation: { item: string; available: number; awarded: number }[] = [];
  if (Array.isArray(out.allocation)) {
    const rows = out.allocation.slice(0, 8).map((a: any) => ({ item: s(a?.item, 140), available: Math.max(1, Math.round(+a?.available || 0)), awarded: Math.max(0, Math.round(+a?.awarded || 0)) })).filter((a: any) => a.item);
    const avail = rows.reduce((t: number, a: any) => t + a.available, 0);
    if (rows.length >= 2 && avail > 0) {
      rows.forEach((a: any) => { a.available = Math.max(1, Math.round(a.available * 100 / avail)); a.awarded = Math.min(a.available, a.awarded); });
      const got = rows.reduce((t: number, a: any) => t + a.awarded, 0);
      if (got > 0 && (got < lo || got > hi)) rows.forEach((a: any) => { a.awarded = Math.min(a.available, Math.round(a.awarded * mid / got)); });
      allocation = rows;
    }
  }
  const warnings = Array.isArray(out.warnings) ? out.warnings.slice(0, 3).map((x: any) => s(x, 300)).filter(Boolean) : [];
  const result = {
    class: cls,
    mark_low: lo, mark_high: hi,
    headline: s(out.headline, 400),
    criteria: Array.isArray(out.criteria) ? out.criteria.slice(0, 6).map((c: any) => ({ name: s(c?.name, 80), band: classes.includes(c?.band) ? c.band : "", comment: s(c?.comment, 800) })) : [],
    strengths: Array.isArray(out.strengths) ? out.strengths.slice(0, 4).map((x: any) => s(x, 300)) : [],
    changes: Array.isArray(out.changes) ? out.changes.slice(0, 3).map((c: any) => ({ change: s(c?.change || c, 1200), why: s(c?.why, 800) })) : [],
    lost: Array.isArray(out.lost) ? out.lost.slice(0, 6).map((l: any) => ({ quote: s(l?.quote, 400), issue: s(l?.issue, 400), fix: s(l?.fix, 400) })).filter((l: any) => l.issue) : [],
    model_plan: Array.isArray(out.model_plan) ? out.model_plan.slice(0, 7).map((x: any) => s(x, 300)).filter(Boolean) : [],
    model_paragraph: s(out.model_paragraph, 2500),
    rewrite: out.rewrite && typeof out.rewrite === "object" ? { quote: s(out.rewrite.quote, 300), task: s(out.rewrite.task, 400) } : null,
    cards: cards.length,
    allocation,
    warnings,
    rubric: rubric.startsWith("DEPARTMENT CRITERIA") ? mod.department : U.name + "-wide",
  };
  return { result, out, cards, topicPos, tier, prev };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { code: "invalid_request", message: "POST only" });
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { code: "ai_paused", message: PAUSED_MSG });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { code: "prompt_too_large", message: "Those attachments are too large to send at once. Try fewer or smaller files." });
    body = JSON.parse(raw);
  } catch { return json(400, { code: "invalid_request", message: "Bad request." }); }

  // ---------- background batch (no user; secret key) ----------
  if (body.action === "warm") {
    if (!(await opsAllowed(service, req))) return json(401, { code: "invalid_request", message: "No." });
    const code = String(body.code || "").toUpperCase().trim();
    const { data: mod } = await service.from("ucl_modules").select("*").eq("code", code).maybeSingle();
    if (!mod) return json(404, { code: "not_found" });
    const { data: has } = await service.from("module_topics").select("position").eq("code", code).limit(1);
    if (has && has.length) { await service.from("question_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("code", code); return json(200, { done: true }); }
    const { data: claimed } = await service.rpc("claim_question_job", { p_code: code, p_source: "batch", p_user: null });
    if (!claimed) return json(202, { pending: true });
    EdgeRuntime.waitUntil(writeMap(service, apiKey, mod, "batch"));
    return json(202, { pending: true, started: true });
  }

  if (body.action === "deepen") {
    if (!(await opsAllowed(service, req))) return json(401, { code: "invalid_request", message: "No." });
    const code = String(body.code || "").toUpperCase().trim(), pos = Math.round(+body.topic_pos);
    const { data: mod } = await service.from("ucl_modules").select("*").eq("code", code).maybeSingle();
    if (!mod || !Number.isInteger(pos) || pos < 0) return json(404, { code: "not_found" });
    await service.from("module_packs").upsert({ code, status: "running", started_at: new Date().toISOString() }, { onConflict: "code", ignoreDuplicates: true });
    EdgeRuntime.waitUntil(deepenTopic(service, apiKey, mod, pos));
    return json(202, { started: true });
  }

  // ---------- signed out: try one marked answer ----------
  if (body.action === "guest_mark") {
    const code = String(body.code || "").toUpperCase().trim();
    const questionId = typeof body.question_id === "string" && UUID_RE.test(body.question_id) ? body.question_id : null;
    const answer = String(body.answer || "").trim();
    if (!CODE_RE.test(code) || !questionId) return json(400, { code: "invalid_request", message: "Pick a question from the module first." });
    if (!body.practice) return json(400, { code: "invalid_request", message: "Please confirm this is exam practice, not work you’re submitting." });
    if (answer.split(/\s+/).length < 40) return json(400, { code: "invalid_request", message: "Write at least a paragraph or two so there’s something to mark." });
    if (answer.length > GUEST_MAX_ANSWER) return json(413, { code: "prompt_too_large", message: "That’s longer than the free try allows (about 1,500 words). Sign up free to mark longer answers." });
    const [{ data: mod }, { data: q }] = await Promise.all([
      service.from("ucl_modules").select("*").eq("code", code).maybeSingle(),
      service.from("module_questions").select("id, question, tier").eq("id", questionId).eq("code", code).maybeSingle(),
    ]);
    if (!mod || !q || q.tier === "foundation") return json(404, { code: "not_found", message: "We couldn’t find that question." });
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const net = await sha256("unizy-guestmark:" + new Date().toISOString().slice(0, 10) + ":" + ip + ":" + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(-16));
    const take = await guestTake(service, net);
    if (!take.ok) {
      EdgeRuntime.waitUntil(countEvent(service, "guest_mark_used"));
      if (take.reason === "net") return json(429, { code: "guest_used", message: "You’ve used your free marked answer. Sign up free to keep going: 3 days of marking with no card needed." });
      return json(429, { code: "guest_busy", message: "Free tries are busy right now. Sign up free to get your answer marked: 3 days of marking with no card needed." });
    }
    const minutes = Number.isFinite(+body.minutes) && +body.minutes > 0 ? Math.min(600, Math.round(+body.minutes)) : null;
    const refund = () => guestRefund(service, net);
    const mk = await runMark(service, apiKey, mod, code, { question: q.question, answer, minutes, questionId, prevId: null, userId: null, att: { blocks: [], summary: "" }, hasAtt: false }, refund);
    if (mk.resp) { EdgeRuntime.waitUntil(countEvent(service, "guest_mark_fail")); return mk.resp; }
    EdgeRuntime.waitUntil(countEvent(service, "guest_mark_done"));
    return json(200, { ...mk.result, answer, guest: true, topic_pos: mk.topicPos, tier: mk.tier, cards: 0 });
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json(401, { code: "session_expired", message: "Please sign in to continue." });

  const code = String(body.code || "").toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { code: "invalid_request", message: "Pick a module first." });
  const { data: mod } = await service.from("ucl_modules").select("*").eq("code", code).maybeSingle();
  if (!mod) return json(404, { code: "not_found", message: "We couldn’t find that module." });

  // ---------- Module Map: topics + questions ----------
  if (body.action === "questions") {
    const map = await loadMap(service, code);
    if (map.topics.length) return json(200, { ...map, cached: true });

    const { data: job } = await service.from("question_jobs").select("status, started_at, tries").eq("code", code).maybeSingle();
    if (job && job.status === "running" && Date.now() - Date.parse(job.started_at) < 3 * 60e3) return json(202, { ...map, pending: true });
    if (job && job.status === "failed" && job.tries >= 4) return json(502, { ...map, code: "upstream_error", message: "We couldn’t write questions for this module. Use your own past-paper question below for now." });

    // writing uses the shared daily £ budget but not the student's own allowance (questions are saved for everyone)
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const since = new Date(Date.now() - 864e5).toISOString();
    const [{ data: st }, { data: sp }, { count: mine }] = await Promise.all([
      service.from("ai_settings").select("daily_budget_gbp, usd_per_gbp").eq("id", true).maybeSingle(),
      service.from("ai_spend").select("usd").eq("day", day).maybeSingle(),
      service.from("question_jobs").select("code", { count: "exact", head: true }).eq("requested_by", user.id).eq("source", "open").gte("started_at", since),
    ]);
    if (st && sp && +sp.usd >= +st.daily_budget_gbp * +st.usd_per_gbp) return json(503, { ...map, code: "ai_paused", message: "Questions for this module will be written tomorrow. For now, use your own past-paper question below." });
    if ((mine || 0) >= OPENS_PER_DAY) return json(429, { ...map, code: "rate_limited", message: "You’ve opened a lot of new modules today. Questions for this one will be ready tomorrow; you can use your own past-paper question now." });

    const { data: claimed } = await service.rpc("claim_question_job", { p_code: code, p_source: "open", p_user: user.id });
    if (claimed) EdgeRuntime.waitUntil(writeMap(service, apiKey, mod, "open"));
    return json(202, { ...map, pending: true });
  }

  // ---------- mark a practice answer ----------
  if (body.action === "mark") {
    const question = String(body.question || "").trim();
    const answer = String(body.answer || "").trim();
    const minutes = Number.isFinite(+body.minutes) && +body.minutes > 0 ? Math.min(600, Math.round(+body.minutes)) : null;
    const questionId = typeof body.question_id === "string" && UUID_RE.test(body.question_id) ? body.question_id : null;
    const prevId = typeof body.prev_id === "string" && UUID_RE.test(body.prev_id) ? body.prev_id : null;
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
      return json(429, { code: "rate_limited", reason: take.reason, upgrade: !!take.upgrade || take.reason === "free_assess", message: take.message || msg[take.reason] || msg.daily });
    }
    const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: 2, p_kind: "assess", p_tier: take.tier });

    const mk = await runMark(service, apiKey, mod, code, { question, answer, minutes, questionId, prevId, userId: user.id, att, hasAtt }, refund);
    if (mk.resp) return mk.resp;
    const { result, out, cards, topicPos, tier, prev } = mk;
    // with attachments, keep a typed copy of what was marked so history shows the answer
    let stored = answer;
    if (hasAtt) {
      const transcript = s(out.transcript, 16000);
      stored = [answer, `[Attached: ${att.summary}]`, transcript].filter(Boolean).join("\n\n");
    }
    const { data: saved } = await service.from("mark_attempts").insert({ user_id: user.id, code, question_id: questionId, question, answer: stored, minutes, result, topic_pos: topicPos, tier: questionId ? tier : "own", prev_id: prev ? prev.id : null }).select("id, created_at").single();
    // flashcards from what was missed; they show up in "Due today" on the dashboard
    if (cards.length) {
      EdgeRuntime.waitUntil(service.from("review_cards").upsert(cards.map((c: any) => ({ user_id: user.id, code, topic_pos: topicPos, front: c.front, back: c.back, attempt_id: saved?.id || null })), { onConflict: "user_id,code,front", ignoreDuplicates: true }));
    }
    return json(200, { ...result, answer: stored, id: saved?.id, created_at: saved?.created_at, topic_pos: topicPos, tier: questionId ? tier : "own", prev, left: take.left, plan: take.tier });
  }

  return json(400, { code: "invalid_request", message: "Unknown action." });
});
