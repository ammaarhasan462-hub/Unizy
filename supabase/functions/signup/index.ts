// Unizy sign-up: creates an unverified account with email + password, then emails a 6-digit
// verification code (codes survive uni mail scanners, unlike links). The page verifies the code with
// /auth/v1/verify, which confirms the email and logs the student in. Unverified accounts can't log in
// with a password until verified (the log-in page offers a new code).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// campus wifi puts a whole university behind a few shared IPs, so the per-IP limit is generous
const MAX_PER_IP_PER_HOUR = 100;

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sendVerify(email: string, name: string, code: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("no email key");
  const hi = name ? `Hi ${name},` : "Hi,";
  const text = `${hi}

Your Unizy verification code is ${code}

Type it on the sign-up page to verify your email and finish creating your account. It works once and expires in an hour.

If you didn't sign up, you can ignore this email.

Unizy · unizy.uk`;
  const spaced = code.split("").join(" ");
  const html = `<div style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;line-height:1.55;color:#17302A;max-width:520px">
<p style="margin:0 0 6px">${esc(hi)}</p>
<p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px">Verify your email</p>
<p style="margin:0 0 18px;color:#5D6D67">Type this code on the Unizy sign-up page to finish creating your account.</p>
<p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:6px;font-weight:700;background:#F4F4EF;border:1px solid #DDE3DE;border-radius:10px;padding:14px 18px;display:inline-block">${spaced}</p>
<p style="margin:0;font-size:14px;color:#5D6D67">It works once and expires in an hour. If you didn't sign up, ignore this email.</p>
</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Unizy <noreply@unizy.uk>", reply_to: "hello@unizy.uk", to: [email], subject: `${code} is your Unizy verification code`, text, html }),
  });
  if (!r.ok) throw new Error("send failed " + r.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }

  const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim().replace(/[\r\n<>]/g, "").slice(0, 60);
  if (!EMAIL_RE.test(email)) return json(400, { error: "invalid_email" });
  if (password.length < 8 || password.length > 72) return json(400, { error: "weak_password" });
  if (password.toLowerCase() === email || /^(password|12345678|qwerty)/i.test(password)) return json(400, { error: "weak_password" });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // basic rate limit per IP
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256("unizy-signup:" + ip);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await service.from("signup_attempts").select("ip_hash", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo);
  if ((count || 0) >= MAX_PER_IP_PER_HOUR) return json(429, { error: "rate_limited" });
  await service.from("signup_attempts").insert({ ip_hash: ipHash });
  await service.from("signup_attempts").delete().lt("created_at", new Date(Date.now() - 86400_000).toISOString());

  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: name ? { full_name: name } : {},
  });
  if (error) {
    const code = String((error as any).code || "");
    const msg = String(error.message || "");
    if (code === "email_exists" || /already (been )?registered|already exists/i.test(msg)) return json(409, { error: "exists" });
    if (code === "weak_password" || /password/i.test(msg)) return json(400, { error: "weak_password" });
    if (code === "email_address_invalid" || /email/i.test(msg)) return json(400, { error: "invalid_email" });
    return json(500, { error: "failed" });
  }

  // a 6-digit code: verifying it confirms the email and signs the student in
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const otp = link?.properties?.email_otp;
  if (linkErr || !otp) { console.error("verify link", String(linkErr?.message || "no otp")); return json(200, { ok: true, verify: true, sent: false }); }
  try { await sendVerify(email, name, otp); } catch (e) { console.error("verify email", String(e)); return json(200, { ok: true, verify: true, sent: false }); }
  return json(200, { ok: true, verify: true, sent: true, digits: otp.length });
});
