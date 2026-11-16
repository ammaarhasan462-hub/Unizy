// Unizy weekly email (Monday morning): each student's revision plan for the week (their 2 weakest topics per module,
// nearest exam first), whether their free weekly marked answer is ready, and an exam countdown.
// No AI: the plan comes from rpc weekly_plan. Sent with Resend from noreply@unizy.uk.
//   POST (header x-ops-key = ops_keys 'deepen')   -> sends this week's batch (pg_cron calls it on Mondays)
//   POST { dry: true } with the same header       -> returns the emails it would send, sends nothing
//   GET  ?unsub=<token>                            -> turns the weekly email off and shows a confirmation page
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://unizy.uk";
const FN = Deno.env.get("SUPABASE_URL") + "/functions/v1/weekly-email";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const weeks = (d: number) => d <= 13 ? `${d} day${d === 1 ? "" : "s"}` : `${Math.round(d / 7)} weeks`;

function page(title: string, body: string) {
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Unizy</title></head>
<body style="margin:0;background:#F4F4EF;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#17302A"><div style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border-radius:18px;box-shadow:0 2px 12px rgba(0,0,0,.06)">
<h1 style="font-size:22px;margin:0 0 10px">${esc(title)}</h1><p style="line-height:1.55;margin:0 0 18px">${body}</p><a href="${SITE}/dashboard" style="color:#2B4F44;font-weight:600">Go to your dashboard</a></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function build(u: any) {
  const name = u.name ? esc(u.name) : "there";
  const plan: any[] = Array.isArray(u.plan) ? u.plan : [];
  const st = u.status || {};
  const free = st.tier === "free";
  const exam = plan.find((m) => m.days != null);
  const subject = exam ? `${exam.code} exam in ${weeks(exam.days)}: your plan this week` : plan.length ? `Your Unizy plan for this week` : `Pick your modules for a weekly plan`;
  const unsub = `${FN}?unsub=${u.token}`;
  const rows = plan.map((m) => {
    const topics = (m.topics || []).map((t: any) =>
      `<li style="margin:0 0 6px"><a href="${SITE}/dashboard/practice/${encodeURIComponent(m.code)}?t=${t.pos}" style="color:#17302A;font-weight:600">${esc(t.title)}</a>${t.tried ? ` <span style="color:#8A5E1E">· your mark so far ~${t.score}</span>` : ` <span style="color:#5D6D67">· not practised yet</span>`}</li>`).join("");
    return `<div style="border:1px solid #E6DEC4;border-radius:14px;padding:14px 16px;margin:0 0 12px;background:#FBF7EC">
<div style="font-size:13px;letter-spacing:.06em;color:#8A5E1E;font-weight:700">${esc(m.code)}${m.days != null ? ` · EXAM IN ${esc(weeks(m.days)).toUpperCase()}` : ""}</div>
<div style="font-size:16px;font-weight:700;margin:2px 0 8px">${esc(m.title)}</div>
<div style="font-size:14px;color:#44534D;margin:0 0 6px">This week, practise:</div><ul style="margin:0;padding-left:18px;font-size:14.5px;line-height:1.45">${topics}</ul>
<a href="${SITE}/dashboard/practice/${encodeURIComponent(m.code)}?q=start" style="display:inline-block;margin-top:10px;background:#17302A;color:#F1DDA9;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;font-size:14px">Start a 5-minute question →</a></div>`;
  }).join("");
  const lead = free ? `<p style="margin:0 0 14px;line-height:1.55"><b>Your free marked answer for this week is ready.</b> Use it on one of the topics below and see exactly what would move you up a class.</p>`
    : `<p style="margin:0 0 14px;line-height:1.55">Here’s where to spend your practice time this week, starting with your weakest topics.</p>`;
  const body = plan.length ? lead + rows : `<p style="margin:0 0 14px;line-height:1.55">Add your modules and every Monday you’ll get a short plan: your two weakest topics in each, and a 5-minute question to start on.</p>
<a href="${SITE}/dashboard/account#course" style="display:inline-block;background:#17302A;color:#F1DDA9;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;font-size:14px">Add my modules →</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F4F4EF;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#17302A">
<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="font-weight:800;font-size:18px;margin:0 0 14px">Unizy</div>
<div style="background:#fff;border-radius:18px;padding:22px 20px"><h1 style="font-size:20px;margin:0 0 12px">Hi ${name}, here’s your week</h1>${body}
<p style="margin:16px 0 0;font-size:13.5px;color:#5D6D67;line-height:1.5">Add your exam dates on each module’s page and this email will count down to them.</p></div>
<p style="font-size:12px;color:#5D6D67;line-height:1.5;margin:14px 4px 0">You’re getting this because you have a Unizy account. One email a week, on Mondays. <a href="${unsub}" style="color:#5D6D67">Unsubscribe</a> · Unizy, London</p></div></body></html>`;
  const text = `Hi ${u.name || "there"},\n\n` + (plan.length ? (free ? "Your free marked answer for this week is ready.\n\n" : "") + plan.map((m) =>
    `${m.code} ${m.title}${m.days != null ? ` (exam in ${weeks(m.days)})` : ""}\nThis week: ${(m.topics || []).map((t: any) => t.title).join("; ")}\n${SITE}/dashboard/practice/${m.code}?q=start`).join("\n\n")
    : `Add your modules for a weekly plan: ${SITE}/dashboard/account#course`) + `\n\nUnsubscribe: ${unsub}`;
  return { subject, html, text, unsub };
}

Deno.serve(async (req) => {
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  if (req.method === "GET") {
    const t = url.searchParams.get("unsub") || "";
    if (!/^[0-9a-f-]{36}$/i.test(t)) return page("Link not recognised", "This unsubscribe link isn’t valid. You can turn the weekly email off in your dashboard under Account.");
    await service.rpc("unsubscribe_weekly", { p_token: t });
    return page("You’re unsubscribed", "You won’t get the weekly plan email any more. You can turn it back on any time under Account in your dashboard.");
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (url.searchParams.get("unsub")) { // one-click unsubscribe from the mail app (RFC 8058)
    const t = url.searchParams.get("unsub") || "";
    if (/^[0-9a-f-]{36}$/i.test(t)) await service.rpc("unsubscribe_weekly", { p_token: t });
    return new Response("ok");
  }
  const got = req.headers.get("x-ops-key") || "";
  const { data: k } = await service.from("ops_keys").select("key").eq("name", "deepen").maybeSingle();
  if (!got || !k || k.key !== got) return new Response(JSON.stringify({ error: "no" }), { status: 401 });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }

  if (body.dry) {
    // preview without marking anyone as sent: read the plan for up to 5 users directly
    const { data: users } = await service.from("email_prefs").select("user_id, token").eq("weekly", true).limit(5);
    const out = [];
    for (const r of users || []) {
      const [{ data: plan }, { data: status }] = await Promise.all([service.rpc("weekly_plan", { p_user: r.user_id }), service.rpc("plan_status", { p_user: r.user_id })]);
      const m = build({ name: "", token: r.token, plan, status });
      out.push({ subject: m.subject, text: m.text.slice(0, 600) });
    }
    return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no RESEND_API_KEY" }), { status: 500 });
  const { data: batch, error } = await service.rpc("weekly_email_batch", { p_limit: Math.min(90, +body.limit || 90) });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let sent = 0, failed = 0;
  for (const u of (batch as any[]) || []) {
    const m = build(u);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Unizy <noreply@unizy.uk>", reply_to: "hello@unizy.uk", to: [u.email], subject: m.subject, html: m.html, text: m.text,
        headers: { "List-Unsubscribe": `<${m.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    }).catch(() => null);
    if (r && r.ok) sent++; else failed++;
    await new Promise((res) => setTimeout(res, 600)); // stay under Resend's rate limit
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
