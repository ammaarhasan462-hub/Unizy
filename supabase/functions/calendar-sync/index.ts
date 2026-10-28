// Unizy calendar sync: reads a student's university calendar feed (Moodle, Canvas, Blackboard or timetable iCal link)
// and returns its events, so lectures, deadlines and exams appear in their Unizy Plan. The feed is fetched here,
// server-side, because browsers can't read other sites' calendars directly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseIcs } from "./ics.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_BYTES = 4_000_000;

// Only public internet hosts: no IP literals, local names or internal domains.
function safeUrl(raw: string): URL | null {
  let s = String(raw || "").trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:/i, "https:");
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "443" && u.port !== "80") return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|svc|cluster)$/.test(h)) return null;
  if (/(^|\.)supabase\.(co|in|net)$/.test(h)) return null;
  if (u.protocol === "http:") u.protocol = "https:";
  return u;
}

function lmsOf(u: URL): string {
  const p = u.pathname + u.search;
  if (/export_execute\.php|\/calendar\/export/i.test(p) || /moodle/i.test(u.hostname)) return "Moodle";
  if (/\/feeds\/calendars\//i.test(p) || /instructure|canvas/i.test(u.hostname)) return "Canvas";
  if (/blackboard|\/learn\/api|bb-?calendar/i.test(u.hostname + p)) return "Blackboard";
  if (/outlook|office365|live\.com/i.test(u.hostname)) return "Outlook";
  if (/google\.com/i.test(u.hostname)) return "Google Calendar";
  if (/timetable|scientia|celcat|cmis/i.test(u.hostname + p)) return "Timetable";
  return "Calendar";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, message: "POST only" });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  if (!userData?.user) return json(401, { ok: false, code: "session_expired", message: "Please sign in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "Bad request." }); }
  const now0 = Date.now();
  // an .ics file the student uploaded (exported from their timetable or calendar)
  if (typeof body?.ics === "string") {
    const raw = body.ics as string;
    if (raw.length > MAX_BYTES) return json(413, { ok: false, message: "That calendar file is too big. Export a shorter date range if you can." });
    if (!/BEGIN:VCALENDAR/i.test(raw)) return json(400, { ok: false, message: "That isn’t a calendar file. Choose the .ics file you downloaded from your timetable or calendar." });
    const parsed = parseIcs(raw, { fromMs: now0 - 14 * 86400000, toMs: now0 + 300 * 86400000, max: 1200 });
    return json(200, { ok: true, source: "File", name: parsed.name, count: parsed.events.length, events: parsed.events });
  }
  let url = safeUrl(body?.url);
  if (!url) return json(400, { ok: false, message: "That doesn’t look like a calendar link. Copy the full https:// or webcal:// address from your uni’s calendar export page." });
  const source = lmsOf(url);

  const now = Date.now();
  const fromMs = now - 14 * 86400000, toMs = now + 220 * 86400000;

  let res: Response | null = null;
  try {
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(url.toString(), {
        redirect: "manual",
        headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "UnizyCalendarSync/1.0 (+https://unizy.uk)" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = safeUrl(new URL(res.headers.get("location")!, url).toString());
        if (!next) return json(400, { ok: false, message: "That calendar link redirects somewhere Unizy can’t read." });
        url = next; continue;
      }
      break;
    }
  } catch {
    return json(502, { ok: false, message: "Couldn’t reach that calendar. Check the link works, then try again." });
  }
  if (!res || !res.ok) {
    const st = res ? res.status : 0;
    return json(400, { ok: false, message: st === 401 || st === 403 ? "Your uni refused access to that calendar. Make a fresh export link (some expire) and paste it again." : st === 404 ? "That calendar link wasn’t found. Make a fresh export link and paste it again." : "Your uni’s calendar didn’t respond properly (" + st + "). Try again later." });
  }

  // read at most MAX_BYTES
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } return json(413, { ok: false, message: "That calendar is too big to read. Export a shorter date range if your uni lets you." }); }
    chunks.push(value);
  }
  const buf = new Uint8Array(size); let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  const text = new TextDecoder().decode(buf);
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return json(400, { ok: false, message: /<html/i.test(text) ? "That link opens a web page, not a calendar file. Look for “Export calendar”, “Calendar feed” or “Subscribe” and copy that link instead." : "That link isn’t a calendar file (.ics)." });
  }
  const { name, events } = parseIcs(text, { fromMs, toMs, max: 900 });
  return json(200, { ok: true, source, name, count: events.length, events });
});
