// Unizy lecture packs: turns a student's lecture slides or handout (PDF, PowerPoint, Word or text) into a study pack
// for one module: notes with page citations, flashcards and practice questions, mapped onto the official module outline.
// The slide content is also split into page-sized passages and embedded, so the tutor can quote the student's own slides.
//   action "build":  { module, uni, degree, year, title, pdf? (base64) | pages? [{n, text}] }
//   action "search": { moduleKey, query, k }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { BUDGET_MSG, PAUSED_MSG, budgetReached, handleAccountProblem, isAccountProblem, recordSpend } from "./common.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
declare const Supabase: any;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SONNET = "claude-sonnet-5-5", HAIKU = "claude-haiku-5-5";
const MAX_PDF_B64 = 26_000_000;
const MAX_TEXT = 160_000;

let embedder: any = null;
async function embed(text: string): Promise<number[]> {
  if (!embedder) embedder = new Supabase.ai.Session("gte-small");
  return await embedder.run(text.slice(0, 1800), { mean_pool: true, normalize: true });
}
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
const arr = (v: unknown, n: number) => (Array.isArray(v) ? v : []).slice(0, n);
const pageNum = (v: unknown) => { const n = Math.round(+String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 && n < 2000 ? n : null; };

async function claude(apiKey: string, model: string, content: any[], system: string, maxTokens: number) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(135000),
  });
  if (!r.ok) { let t = ""; try { t = await r.text(); t = JSON.parse(t)?.error?.message || t; } catch { /* ignore */ } return { ok: false, status: r.status, text: t }; }
  const d = await r.json();
  return { ok: true, status: 200, data: d, text: (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, message: "POST only" });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json(401, { ok: false, code: "session_expired", message: "Please sign in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "That upload didn’t come through. Try again." }); }
  const action = String(body?.action || "build");

  // ---------------------------------------------------------------- search the student's own slides
  if (action === "search") {
    const k = str(body?.moduleKey, 80), q = str(body?.query, 1500);
    if (!k || !q) return json(200, { ok: true, hits: [] });
    try {
      const e = await embed(q);
      const { data, error } = await service.rpc("match_lecture_chunks", { p_user: user.id, p_module_key: k, p_embedding: JSON.stringify(e), p_k: Math.min(8, +body?.k || 5) });
      if (error) return json(200, { ok: true, hits: [] });
      return json(200, { ok: true, hits: (data || []).filter((h: any) => h.similarity > 0.3).map((h: any) => ({ pack: h.pack_id, title: h.title, page: h.page, text: h.text, sim: Math.round(h.similarity * 100) / 100 })) });
    } catch { return json(200, { ok: true, hits: [] }); }
  }
  if (action !== "build") return json(400, { ok: false, message: "Unknown action." });

  // ---------------------------------------------------------------- build a pack
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { ok: false, code: "ai_paused", message: PAUSED_MSG });
  const mod = body?.module || {};
  const moduleKey = str(mod.key, 80), moduleName = str(mod.name, 160);
  if (!moduleKey || !moduleName) return json(400, { ok: false, message: "Pick a module first." });
  const title = str(body?.title, 120) || "Lecture";
  const pdf = typeof body?.pdf === "string" ? body.pdf : null;
  const pages: { n: number; text: string }[] = arr(body?.pages, 400).map((p: any, i: number) => ({ n: pageNum(p?.n) || i + 1, text: str(p?.text, 6000) })).filter((p: any) => p.text);
  if (pdf) {
    if (pdf.length > MAX_PDF_B64 || !/^[A-Za-z0-9+/=]+$/.test(pdf.slice(0, 200))) return json(413, { ok: false, message: "That PDF is too big (max about 19 MB). Upload one lecture at a time." });
  } else if (!pages.length) {
    return json(400, { ok: false, message: "That file didn’t contain any text Unizy could read. If it’s a scanned PDF, upload the PDF itself." });
  }
  const textAll = pages.map((p) => "=== Page " + p.n + " ===\n" + p.text).join("\n\n").slice(0, MAX_TEXT);
  const nPages = pdf ? 0 : pages.length;

  const units = 3 + (pdf ? Math.floor(pdf.length * 0.75 / 1_500_000) : Math.floor(textAll.length / 40000));
  const { data: take, error: takeErr } = await service.rpc("ai_take_plan", { p_user: user.id, p_units: units, p_kind: "pack" });
  if (takeErr || !take) return json(500, { ok: false, message: "Couldn’t check your allowance. Try again." });
  if (!take.ok) {
    if (take.reason === "budget") {
      EdgeRuntime.waitUntil(service.from("ai_settings").select("daily_budget_gbp").eq("id", true).single().then(({ data }: any) => budgetReached(service, "£" + (data?.daily_budget_gbp ?? "?") + " a day")));
      return json(503, { ok: false, code: "ai_paused", message: BUDGET_MSG });
    }
    const msg: Record<string, string> = {
      free_weekly: "You’ve used this week’s free actions, and building a lecture pack uses one. Upgrade to Unizy Pro for more.",
      daily: "You’ve used today’s allowance. It resets at midnight (UK time).",
      global: "Unizy is very busy today. Please try again tomorrow.",
    };
    return json(429, { ok: false, code: "rate_limited", upgrade: take.reason === "free_weekly", message: msg[take.reason] || msg.daily });
  }
  const refund = () => service.rpc("ai_refund_plan", { p_user: user.id, p_units: units, p_kind: "pack", p_tier: take.tier });

  const topics: string[] = arr(mod.topics, 40).map((t: any) => str(t, 160)).filter(Boolean);
  const outline = [
    "Module: " + moduleName + (mod.code ? " (" + str(mod.code, 30) + ")" : "") + " — " + str(body?.uni, 80) + ", " + str(body?.degree, 140) + ", Year " + (+body?.year || 1) + ".",
    mod.summary ? "Official outline: " + str(mod.summary, 2000) : "",
    topics.length ? "Official topic list (index: topic):\n" + topics.map((t, i) => i + ": " + t).join("\n") : "No official topic list is published for this module.",
  ].filter(Boolean).join("\n");
  const docBlock = pdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } } : { type: "text", text: "LECTURE MATERIAL (page by page):\n" + textAll };

  const mainPrompt = [
    "A UK university student uploaded the lecture material above for one of their modules. Build them a study pack from it.",
    "", outline, "",
    "Rules:",
    "- Work from the lecture material. Every note line, card and question must be traceable to a page; cite pages as [p.N] (page or slide numbers as in the material).",
    "- You may add a short standard explanation to make a point clear; mark anything not in the material with “(beyond the slides)”.",
    "- Never invent cases, statutes, studies, statistics, quotations or references. Plain Unicode for maths, not LaTeX. No drug doses.",
    "- Map the lecture onto the official topic list where it fits (use the index), so it slots into the course.",
    "",
    "Reply with only JSON in this shape:",
    "{\"title\": \"short lecture title\", \"summary\": \"2-3 sentences on what the lecture covers\",",
    " \"topics\": [{\"i\": official topic index or null, \"name\": \"topic as taught in this lecture\", \"pages\": [page numbers]}],",
    " \"notes\": [{\"h\": \"section heading\", \"body\": \"clear revision notes as short paragraphs and '- ' bullets; end each point with its [p.N] citation\"}],",
    " \"cards\": [{\"f\": \"front\", \"b\": \"back (1-3 sentences)\", \"p\": page}],",
    " \"questions\": [",
    "   {\"type\": \"mcq\", \"d\": 1-5, \"q\": \"...\", \"options\": [\"...\",\"...\",\"...\",\"...\"], \"answer\": index, \"why\": \"1-2 sentences\", \"p\": page},",
    "   {\"type\": \"short\", \"d\": 1-5, \"marks\": 2-6, \"q\": \"...\", \"markScheme\": [\"one point per mark\"], \"modelAnswer\": \"40-120 words\", \"p\": page},",
    "   {\"type\": \"long\", \"d\": 3-5, \"marks\": 10-25, \"q\": \"60-150 words\", \"markScheme\": [\"...\"], \"modelAnswer\": \"200-300 words\", \"p\": page}],",
    " \"gaps\": [\"official topics this lecture only touches on, worth reading up\"]}",
    "Aim for 4-8 note sections (up to about 1,400 words in total), 15-25 cards, and 10 questions (6 mcq, 3 short, 1 long).",
  ].join("\n");

  const digestPrompt = [
    "For EVERY page (or slide) of the lecture material above, write a compact plain-text digest of what is on that page: the key terms, definitions, formulas, claims and examples, in up to 70 words.",
    "Skip pages that are only a title, contents or blank. Reply with only JSON: {\"pages\": [{\"p\": page number, \"t\": \"digest\"}]}",
  ].join("\n");

  const system = "You build accurate university study materials from a student's own lecture slides. Reply with only the JSON value requested — no prose, no code fences.";
  const mainCall = claude(apiKey, SONNET, [docBlock, { type: "text", text: mainPrompt }], system, 10000);
  // page passages for search: for text uploads we already have the text; PDFs get a quick per-page digest
  const digestCall = pdf ? claude(apiKey, HAIKU, [docBlock, { type: "text", text: digestPrompt }], system, 9000) : Promise.resolve(null);
  let main: any, digest: any;
  try { [main, digest] = await Promise.all([mainCall, digestCall]); }
  catch { await refund(); return json(502, { ok: false, message: "That took too long to read. Try a shorter file (one lecture at a time)." }); }

  if (!main.ok) {
    await refund();
    if (isAccountProblem(main.status, main.text)) { EdgeRuntime.waitUntil(handleAccountProblem(service, main.status, main.text)); return json(503, { ok: false, code: "ai_paused", message: PAUSED_MSG }); }
    if (main.status === 429 || main.status === 529) return json(429, { ok: false, message: "Unizy is busy right now. Try again in a minute." });
    if (main.status === 400 && /page|pdf|document|too long|prompt/i.test(main.text)) return json(400, { ok: false, message: "That file is too long to read in one go (max 100 pages). Upload one lecture at a time." });
    return json(502, { ok: false, message: "Something went wrong reading that file. Try again." });
  }
  EdgeRuntime.waitUntil(recordSpend(service, SONNET, main.data.usage));
  if (digest && digest.ok) EdgeRuntime.waitUntil(recordSpend(service, HAIKU, digest.data.usage));
  const raw = parseJson(main.text);
  if (!raw) { await refund(); return json(502, { ok: false, message: "That file couldn’t be turned into a pack. Try again, or try a different copy." }); }

  const out = {
    title: str(raw.title, 120) || title,
    summary: str(raw.summary, 800),
    topics: arr(raw.topics, 20).map((t: any) => ({ i: Number.isInteger(t?.i) && t.i >= 0 && t.i < topics.length ? t.i : null, name: str(t?.name, 160), pages: arr(t?.pages, 30).map(pageNum).filter(Boolean) })).filter((t: any) => t.name),
    notes: arr(raw.notes, 10).map((n: any) => ({ h: str(n?.h, 160), body: str(n?.body, 6000) })).filter((n: any) => n.h && n.body),
    cards: arr(raw.cards, 30).map((c: any) => ({ f: str(c?.f, 300), b: str(c?.b, 800), p: pageNum(c?.p) })).filter((c: any) => c.f && c.b),
    questions: arr(raw.questions, 14).filter((q: any) => q && q.q && ["mcq", "short", "long"].includes(q.type)).map((q: any) => ({ ...q, p: pageNum(q.p) })),
    gaps: arr(raw.gaps, 8).map((g: any) => str(g, 200)).filter(Boolean),
  };

  // passages for search
  let passages: { page: number; text: string }[] = [];
  if (!pdf) {
    for (const p of pages) {
      const t = p.text.replace(/\s+/g, " ").trim();
      for (let i = 0; i < t.length && passages.length < 300; i += 1100) passages.push({ page: p.n, text: t.slice(i, i + 1200) });
    }
  } else {
    const d = digest && digest.ok ? parseJson(digest.text) : null;
    passages = arr(d?.pages, 160).map((x: any) => ({ page: pageNum(x?.p) || 0, text: str(x?.t, 900) })).filter((x: any) => x.text.length > 20);
  }
  // also make each note section searchable (they carry the citations)
  out.notes.forEach((n: any) => { const m = /\[p\.?\s*(\d+)/.exec(n.body); passages.push({ page: m ? +m[1] : 0, text: (n.h + ": " + n.body).slice(0, 1200) }); });

  const { data: packRow, error: packErr } = await service.from("lecture_packs").insert({
    user_id: user.id, module_key: moduleKey, module_name: moduleName, title: out.title, source: pdf ? "pdf" : str(body?.kind, 20) || "text",
    pages: nPages || (passages.length ? Math.max(...passages.map((p) => p.page)) : 0), topics: out.topics,
  }).select("id").single();
  const toIndex = passages.slice(0, 220);
  if (!packErr && packRow) {
    // index the passages after replying, so a long lecture doesn't keep the student waiting
    EdgeRuntime.waitUntil((async () => {
      let batch: any[] = [];
      for (const p of toIndex) {
        try { batch.push({ pack_id: packRow.id, user_id: user.id, module_key: moduleKey, page: p.page, text: p.text, embedding: JSON.stringify(await embed(out.title + " — p." + p.page + ": " + p.text)) }); } catch { /* skip */ }
        if (batch.length >= 40) { await service.from("lecture_chunks").insert(batch); batch = []; }
      }
      if (batch.length) await service.from("lecture_chunks").insert(batch);
    })());
  }
  return json(200, { ok: true, left: take.left, packId: packRow?.id || null, searchable: packErr ? 0 : toIndex.length, ...out });
});
