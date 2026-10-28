// Unizy uni email check: emails a 6-digit code to a student's university address (e.g. name@ucl.ac.uk)
// and confirms it. Verified students can use their uni's module hubs, marketplace and shared focus rooms.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UNIS: Record<string, { name: string; re: RegExp; domain: string }> = {
  ucl: { name: "UCL", re: /@([a-z0-9-]+\.)*ucl\.ac\.uk$/, domain: "ucl.ac.uk" },
  imperial: { name: "Imperial", re: /@([a-z0-9-]+\.)*(imperial|ic)\.ac\.uk$/, domain: "imperial.ac.uk" },
  lse: { name: "LSE", re: /@([a-z0-9-]+\.)*lse\.ac\.uk$/, domain: "lse.ac.uk" },
  oxford: { name: "Oxford", re: /@([a-z0-9-]+\.)*ox\.ac\.uk$/, domain: "ox.ac.uk" },
  cambridge: { name: "Cambridge", re: /@([a-z0-9-]+\.)*cam\.ac\.uk$/, domain: "cam.ac.uk" },
  qmul: { name: "Queen Mary", re: /@([a-z0-9-]+\.)*qmul\.ac\.uk$/, domain: "qmul.ac.uk" },
};
const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, message: "POST only" });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await service.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json(401, { ok: false, message: "Please sign in again." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "Bad request." }); }
  const action = String(body?.action || "");

  if (action === "send") {
    const uni = String(body?.uni || "");
    const u = UNIS[uni];
    if (!u) return json(400, { ok: false, message: "Choose your university first." });
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) return json(400, { ok: false, message: "Enter your full uni email address." });
    if (!u.re.test(email)) return json(400, { ok: false, message: "Use your " + u.name + " email address, ending in " + u.domain + "." });

    const { data: taken } = await service.from("uni_verifications").select("user_id").eq("email", email).maybeSingle();
    if (taken && taken.user_id !== user.id) return json(400, { ok: false, message: "That uni email is already verified on another Unizy account. Log in to that account, or email hello@unizy.uk." });

    const { data: prev } = await service.from("uni_verify_codes").select("*").eq("user_id", user.id).maybeSingle();
    const day = today();
    const sendsToday = prev && prev.sends_day === day ? prev.sends : 0;
    if (prev && Date.now() - new Date(prev.sent_at).getTime() < 60000) return json(429, { ok: false, message: "We’ve just sent a code. Wait a minute before asking for another." });
    if (sendsToday >= 5) return json(429, { ok: false, message: "That’s the most codes we can send today. Try again tomorrow." });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json(503, { ok: false, message: "Uni email checks are switched off just now. Try again later." });

    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const code = String(n).padStart(6, "0");
    const hash = await sha256(user.id + ":" + code);
    const row = { user_id: user.id, uni, email, code_hash: hash, expires_at: new Date(Date.now() + 15 * 60000).toISOString(), attempts: 0, sent_at: new Date().toISOString(), sends_day: day, sends: sendsToday + 1 };
    const { error } = await service.from("uni_verify_codes").upsert(row, { onConflict: "user_id" });
    if (error) return json(500, { ok: false, message: "Couldn’t start the check. Try again." });

    const text = `Your Unizy code is ${code}

Enter it in Unizy to confirm you're a ${u.name} student. It works for 15 minutes.

If you didn't ask for this, you can ignore this email.

Unizy`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#141414;max-width:520px">
<p>Your Unizy code is</p>
<p style="font-size:32px;font-weight:800;letter-spacing:.18em;margin:8px 0 16px">${code}</p>
<p>Enter it in Unizy to confirm you're a ${u.name} student. It works for 15 minutes.</p>
<p style="font-size:14px;color:#55554F">If you didn't ask for this, you can ignore this email.</p>
</div>`;
    let sent = false;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Unizy <noreply@unizy.uk>", reply_to: "hello@unizy.uk", to: [email], subject: "Your Unizy code: " + code, text, html }),
      });
      sent = r.ok;
    } catch { sent = false; }
    if (!sent) return json(502, { ok: false, message: "Couldn’t send the email just now. Try again in a minute." });
    return json(200, { ok: true, message: "We’ve sent a 6-digit code to " + email + ". It can take a minute, and uni inboxes sometimes put it in junk or quarantine." });
  }

  if (action === "check") {
    const code = String(body?.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json(400, { ok: false, message: "Enter the 6-digit code from the email." });
    const { data: c } = await service.from("uni_verify_codes").select("*").eq("user_id", user.id).maybeSingle();
    if (!c || new Date(c.expires_at).getTime() < Date.now()) return json(400, { ok: false, message: "That code has expired. Send a new one." });
    if (c.attempts >= 5) return json(429, { ok: false, message: "Too many wrong codes. Send a new one." });
    if ((await sha256(user.id + ":" + code)) !== c.code_hash) {
      await service.from("uni_verify_codes").update({ attempts: c.attempts + 1 }).eq("user_id", user.id);
      return json(400, { ok: false, message: "That code isn’t right. Check the latest email and try again." });
    }
    const { error } = await service.from("uni_verifications").upsert({ user_id: user.id, uni: c.uni, email: c.email, verified_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return json(400, { ok: false, message: /duplicate|unique/i.test(error.message) ? "That uni email is already verified on another Unizy account." : "Couldn’t save that. Try again." });
    await service.from("uni_verify_codes").delete().eq("user_id", user.id);
    return json(200, { ok: true, uni: c.uni, email: c.email, message: "You’re verified as a " + UNIS[c.uni].name + " student." });
  }

  return json(400, { ok: false, message: "Unknown action." });
});
