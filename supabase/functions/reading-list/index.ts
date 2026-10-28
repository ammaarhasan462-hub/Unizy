// Unizy reading lists: imports a module's official reading list from the university's public Talis Aspire
// reading-list site (e.g. ucl.rl.talis.com), with its weekly sections, and caches it for a week for everyone.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Universities with public Talis Aspire reading lists. Others (Leganto) need a uni login, so we link instead.
const TENANTS: Record<string, string> = { ucl: "ucl.rl.talis.com", lse: "lse.rl.talis.com", qmul: "qmul.rl.talis.com" };
const OTHER: Record<string, string> = {
  imperial: "Imperial’s reading lists (Leganto) need your Imperial login, so open them from Blackboard.",
  oxford: "Oxford’s reading lists (ORLO) need your Oxford login, so open them from Canvas.",
  cambridge: "Cambridge’s reading lists (Leganto) need your Raven login, so open them from Moodle.",
};
const CACHE_DAYS = 7;
const MAX_REQUESTS = 260;

type Item = { t: string; a: string; y: string; k: string; j: string; doi: string; url: string };
type Section = { name: string; items: Item[] };

const tail = (u: string) => String(u || "").replace(/^https?:\/\/[^/]+\//, "");
const val = (o: any, p: string) => { for (const k of Object.keys(o || {})) if (k.endsWith("/" + p) || k.endsWith("#" + p)) return (o[k] || []).map((x: any) => String(x.value)); return []; };
const ordered = (o: any) => Object.keys(o || {}).filter((k) => /#_\d+$/.test(k)).sort((a, b) => +a.split("#_")[1] - +b.split("#_")[1]).map((k) => String(o[k][0]?.value || ""));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, message: "POST only" });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  if (!userData?.user) return json(401, { ok: false, message: "Please sign in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "Bad request." }); }
  const uni = String(body?.uni || "");
  const code = String(body?.code || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (OTHER[uni]) return json(200, { ok: false, reason: "login", message: OTHER[uni] });
  const host = TENANTS[uni];
  if (!host) return json(200, { ok: false, reason: "unsupported", message: "Reading lists aren’t available for this university yet." });
  if (!code || code.length < 4) return json(200, { ok: false, reason: "nocode", message: "This module has no code, so its reading list can’t be found automatically." });

  const { data: cached } = await service.from("reading_lists").select("data, fetched_at").eq("tenant", host).eq("module_code", code).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_DAYS * 86400000 && !body?.refresh) return json(200, { ok: true, cached: true, ...cached.data });

  let requests = 0;
  const get = async (path: string) => {
    if (++requests > MAX_REQUESTS) throw new Error("too big");
    const r = await fetch("https://" + host + "/" + path.replace(/^\//, "") + ".json", { headers: { Accept: "application/json", "User-Agent": "UnizyReadingLists/1.0 (+https://unizy.uk)" }, signal: AbortSignal.timeout(12000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("status " + r.status);
    return await r.json();
  };
  // run fetches with limited concurrency
  const pool = async <T, R>(xs: T[], n: number, f: (x: T) => Promise<R>) => {
    const out: R[] = new Array(xs.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]); } }));
    return out;
  };

  try {
    const mod = await get("modules/" + code + "/lists");
    if (!mod) {
      const data = { found: false, module: code.toUpperCase(), sections: [], link: "https://" + host + "/modules/" + code + ".html" };
      await service.from("reading_lists").upsert({ tenant: host, module_code: code, data, fetched_at: new Date().toISOString() });
      return json(200, { ok: true, ...data });
    }
    const listIds = Object.values(mod).flatMap((o: any) => val(o, "usesList")).map(tail).filter((x) => x.startsWith("lists/")).slice(0, 4);
    if (!listIds.length) return json(200, { ok: true, found: false, module: code.toUpperCase(), sections: [], link: "https://" + host + "/modules/" + code + ".html" });
    // pick the most recently published list (lists roll over each academic year)
    const lists = (await pool(listIds, 4, (id) => get(id))).map((j, i) => ({ id: listIds[i], j })).filter((x) => x.j);
    const pickTime = (x: any) => { const o = Object.values(x.j)[0] as any; return Date.parse(val(o, "lastPublished")[0] || val(o, "lastUpdated")[0] || "") || 0; };
    lists.sort((a, b) => pickTime(b) - pickTime(a));
    const best = lists[0];
    const listObj = Object.entries(best.j).find(([k]) => tail(k) === best.id)?.[1] as any;
    const listName = val(listObj, "name")[0] || code.toUpperCase();
    const top = ordered(listObj).map(tail);

    // walk sections (two levels deep) and collect item ids in reading order
    const sections: { name: string; ids: string[] }[] = [];
    const loose: string[] = [];
    const secIds = top.filter((x) => x.startsWith("sections/"));
    top.filter((x) => x.startsWith("items/")).forEach((x) => loose.push(x));
    const secJson = await pool(secIds, 10, (id) => get(id));
    const sub: { parent: number; id: string }[] = [];
    secJson.forEach((sj, i) => {
      const o = sj ? (Object.entries(sj).find(([k]) => tail(k) === secIds[i])?.[1] as any) : null;
      const kids = o ? ordered(o).map(tail) : [];
      sections.push({ name: (val(o, "name")[0] || "Section " + (i + 1)).trim().slice(0, 200), ids: kids.filter((x) => x.startsWith("items/")) });
      kids.filter((x) => x.startsWith("sections/")).forEach((x) => sub.push({ parent: i, id: x }));
    });
    const subJson = await pool(sub.slice(0, 40), 10, (s) => get(s.id));
    subJson.forEach((sj, i) => {
      const o = sj ? (Object.entries(sj).find(([k]) => tail(k) === sub[i].id)?.[1] as any) : null;
      if (o) sections.splice(sections.length, 0, { name: (sections[sub[i].parent]?.name + " · " + (val(o, "name")[0] || "")).slice(0, 200), ids: ordered(o).map(tail).filter((x) => x.startsWith("items/")) });
    });
    if (loose.length) sections.unshift({ name: "Reading", ids: loose });

    const allIds = [...new Set(sections.flatMap((s) => s.ids))].slice(0, MAX_REQUESTS - requests - 2);
    const itemJson = await pool(allIds, 12, (id) => get(id).catch(() => null));
    const items: Record<string, Item> = {};
    itemJson.forEach((ij, i) => {
      if (!ij) return;
      const byTail: Record<string, any> = {};
      Object.entries(ij).forEach(([k, v]) => { byTail[tail(k)] = v; });
      const it = byTail[allIds[i]];
      const resId = tail(val(it, "resource")[0] || "");
      const res = byTail[resId];
      if (!res) return;
      const authorsSeq = byTail[tail(val(res, "authorList")[0] || "")];
      const authors = (authorsSeq ? ordered(authorsSeq) : val(res, "creator")).map((p) => (val(byTail[tail(p)], "name")[0] || "")).filter(Boolean);
      const types = val(res, "type").map((t) => t.replace(/^.*[#/]/, ""));
      const kind = types.find((t) => /Book|Article|Chapter|Webpage|Website|Document|Journal|AudioVisual|Report/i.test(t)) || "";
      const part = byTail[tail(val(res, "isPartOf")[0] || "")];
      items[allIds[i]] = {
        t: (val(res, "title")[0] || "").trim().slice(0, 300),
        a: authors.slice(0, 3).join("; ") + (authors.length > 3 ? " et al." : ""),
        y: (val(res, "date")[0] || "").slice(0, 10),
        k: /Article/i.test(kind) ? "Article" : /Chapter/i.test(kind) ? "Chapter" : /Book/i.test(kind) ? "Book" : /Web/i.test(kind) ? "Web page" : kind.replace(/([a-z])([A-Z])/g, "$1 $2"),
        j: (part ? val(part, "title")[0] || "" : "").slice(0, 200),
        doi: (val(res, "doi")[0] || "").slice(0, 120),
        url: (val(res, "url")[0] || val(res, "onlineResource")[0] || "").slice(0, 400),
      };
    });
    const out: Section[] = sections.map((s) => ({ name: s.name, items: s.ids.map((id) => items[id]).filter((x) => x && x.t) })).filter((s) => s.items.length);
    const data = { found: true, module: code.toUpperCase(), title: listName, link: "https://" + host + "/" + best.id + ".html", sections: out, count: out.reduce((a, s) => a + s.items.length, 0) };
    await service.from("reading_lists").upsert({ tenant: host, module_code: code, data, fetched_at: new Date().toISOString() });
    return json(200, { ok: true, ...data });
  } catch (e) {
    if (cached) return json(200, { ok: true, cached: true, stale: true, ...cached.data });
    return json(502, { ok: false, message: String(e).includes("too big") ? "That reading list is too long to import in one go." : "Couldn’t reach the university’s reading-list site. Try again later." });
  }
});
