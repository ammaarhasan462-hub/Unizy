// Minimal iCalendar (RFC 5545) reader for university calendar feeds: Moodle, Canvas, Blackboard and timetable exports.
// Turns VEVENTs into plain events in UK local time, expanding simple weekly/daily repeats.

export type FeedEvent = {
  uid: string; title: string; date: string; time: string | null; endTime: string | null; allDay: boolean;
  location: string; desc: string; cats: string; url: string; due: boolean;
};

const TZ = "Europe/London";

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}
function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
type Prop = { name: string; params: Record<string, string>; value: string };
function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM2="b:c":VALUE  (a colon inside quotes is not the separator)
  let i = 0, inQ = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ":" && !inQ) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i), value = line.slice(i + 1);
  const parts = head.split(";");
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) { const k = p.indexOf("="); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ""); }
  return { name: parts[0].toUpperCase(), params, value };
}

const pad = (n: number) => String(n).padStart(2, "0");
// Wall-clock parts of an instant in UK time.
function ukParts(ms: number) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` };
}
// Offset (minutes) of a named zone at an instant, e.g. America/New_York → -300.
function zoneOffset(tz: string, ms: number): number {
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
    const name = f.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(name);
    return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
  } catch { return 0; }
}
const WINDOWS_TZ: Record<string, string> = { "GMT Standard Time": "Europe/London", "W. Europe Standard Time": "Europe/Berlin", "Romance Standard Time": "Europe/Paris", "Eastern Standard Time": "America/New_York", "Pacific Standard Time": "America/Los_Angeles", UTC: "UTC" };

type When = { ms: number; allDay: boolean; date: string; time: string | null };
export function parseWhen(value: string, params: Record<string, string>): When | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mi, , z] = m;
  if (!hh || params.VALUE === "DATE") {
    return { ms: Date.UTC(+y, +mo - 1, +d, 12), allDay: true, date: `${y}-${mo}-${d}`, time: null };
  }
  const naive = Date.UTC(+y, +mo - 1, +d, +hh, +mi);
  let ms: number;
  if (z) ms = naive;
  else {
    let tz = params.TZID ? params.TZID.replace(/^\//, "") : TZ;
    tz = WINDOWS_TZ[tz] || tz;
    // two passes so times either side of a clock change resolve correctly
    let off = zoneOffset(tz, naive);
    ms = naive - off * 60000;
    off = zoneOffset(tz, ms);
    ms = naive - off * 60000;
  }
  const uk = ukParts(ms);
  return { ms, allDay: false, date: uk.date, time: uk.time };
}

const DAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function expand(start: When, rule: string, exdates: Set<string>, fromMs: number, toMs: number, max: number): When[] {
  const r: Record<string, string> = {};
  for (const kv of rule.split(";")) { const k = kv.indexOf("="); if (k > 0) r[kv.slice(0, k).toUpperCase()] = kv.slice(k + 1); }
  const freq = r.FREQ, interval = Math.max(1, +r.INTERVAL || 1);
  const count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? (parseWhen(r.UNTIL, {})?.ms ?? Infinity) + (r.UNTIL.length === 8 ? 36 * 3600000 : 0) : Infinity;
  if (freq !== "WEEKLY" && freq !== "DAILY") return [start];
  const out: When[] = [];
  const startDow = new Date(start.date + "T12:00:00Z").getUTCDay();
  const byDay = freq === "WEEKLY" && r.BYDAY ? r.BYDAY.split(",").map((x) => DAYS[x.replace(/^[+-]?\d+/, "")]).filter((x) => x !== undefined) : [startDow];
  const step = freq === "DAILY" ? 1 : 7;
  let n = 0;
  // walk day by day from the first occurrence's week, keeping wall-clock time (so repeats survive clock changes)
  const base = new Date(start.date + "T12:00:00Z");
  const weekStart = new Date(base.getTime() - (freq === "WEEKLY" ? ((startDow + 6) % 7) * 86400000 : 0));
  for (let k = 0; k < 800 && n < count; k++) {
    const blockStart = weekStart.getTime() + k * step * interval * 86400000;
    const days = freq === "WEEKLY" ? [...byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => blockStart + ((d + 6) % 7) * 86400000) : [blockStart];
    for (const dayMs of days) {
      const dd = new Date(dayMs);
      const date = `${dd.getUTCFullYear()}-${pad(dd.getUTCMonth() + 1)}-${pad(dd.getUTCDate())}`;
      if (date < start.date) continue;
      const occ: When = start.allDay ? { ms: Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), 12), allDay: true, date, time: null }
        : parseWhen(date.replace(/-/g, "") + "T" + start.time!.replace(":", "") + "00", { TZID: TZ })!;
      if (occ.ms > until) return out;
      n++;
      if (n > count) return out;
      if (!exdates.has(occ.date) && occ.ms >= fromMs && occ.ms <= toMs) out.push(occ);
      if (out.length >= max) return out;
    }
    if (blockStart > toMs) break;
  }
  return out;
}

const DUE_RE = /\b(is due|due date|due\b|deadline|submission|submit|hand[- ]?in|closes|exam\b|examination|test\b|quiz)\b/i;
const NOT_DUE_RE = /\b(opens|is open|available from|starts)\b/i;

export function parseIcs(text: string, opts: { fromMs: number; toMs: number; max?: number }): { name: string; events: FeedEvent[] } {
  const max = opts.max || 800;
  const lines = unfold(text);
  let name = "";
  const events: FeedEvent[] = [];
  const overridden = new Set<string>();
  let cur: Prop[] | null = null, depth = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (/^BEGIN:VEVENT$/i.test(line)) { cur = []; depth = 0; continue; }
    if (cur && /^BEGIN:/i.test(line)) { depth++; continue; } // skip nested VALARM etc.
    if (cur && /^END:VEVENT$/i.test(line)) {
      const ev = cur; cur = null;
      const get = (n: string) => ev.find((p) => p.name === n);
      const st = get("DTSTART"); if (!st) continue;
      const start = parseWhen(st.value, st.params); if (!start) continue;
      const en = get("DTEND");
      const end = en ? parseWhen(en.value, en.params) : null;
      const status = (get("STATUS")?.value || "").toUpperCase();
      if (status === "CANCELLED") continue;
      const title = unescapeText(get("SUMMARY")?.value || "").trim().slice(0, 200) || "Untitled";
      const desc = unescapeText(get("DESCRIPTION")?.value || "").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, 600);
      const location = unescapeText(get("LOCATION")?.value || "").trim().slice(0, 160);
      const cats = unescapeText(ev.filter((p) => p.name === "CATEGORIES").map((p) => p.value).join(",")).slice(0, 200);
      const url = (get("URL")?.value || "").trim().slice(0, 400);
      const uid = (get("UID")?.value || title + st.value).slice(0, 200);
      const recurId = get("RECURRENCE-ID");
      const baseUid = (get("UID")?.value || "").slice(0, 200);
      if (recurId) { const rw = parseWhen(recurId.value, recurId.params); if (rw) overridden.add(baseUid + "#" + rw.date); }
      const ex = new Set<string>();
      for (const p of ev.filter((p) => p.name === "EXDATE")) for (const v of p.value.split(",")) { const w = parseWhen(v, p.params); if (w) ex.add(w.date); }
      const rrule = get("RRULE")?.value;
      const occs = rrule && !recurId ? expand(start, rrule, ex, opts.fromMs, opts.toMs, max) : (start.ms >= opts.fromMs && start.ms <= opts.toMs ? [start] : []);
      const durMs = end && !start.allDay ? end.ms - start.ms : 0;
      const hay = title + " " + desc + " " + url;
      const due = !NOT_DUE_RE.test(title) && (DUE_RE.test(hay) || /\/(assignments?|quizzes|mod\/assign|mod\/quiz|turnitin)\b/i.test(url + " " + desc));
      for (const o of occs) {
        const endTime = durMs > 0 ? ukParts(o.ms + durMs).time : null;
        events.push({ uid: uid + (recurId ? "@" + recurId.value : "") + (rrule ? "#" + o.date : ""), title, date: o.date, time: o.time, endTime, allDay: o.allDay, location, desc, cats, url, due });
        if (events.length >= max) break;
      }
      if (events.length >= max) break;
      continue;
    }
    if (cur) {
      if (/^END:/i.test(line)) { depth = Math.max(0, depth - 1); continue; }
      if (depth > 0) continue;
      const p = parseLine(line); if (p) cur.push(p);
      continue;
    }
    if (/^X-WR-CALNAME:/i.test(line)) name = unescapeText(line.slice(13)).trim().slice(0, 80);
  }
  // a recurring event's overridden instance (RECURRENCE-ID) replaces the generated one for that date
  const kept = events.filter((e) => !(e.uid.includes("#") && overridden.has(e.uid)));
  kept.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  return { name, events: kept };
}
