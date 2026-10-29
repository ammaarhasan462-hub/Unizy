// Unizy sign-up: creates an account with email + password straight away (no confirmation link),
// then sends a short "you've signed up" email. The page then logs in with the same email and password.
// Email links are only used for password resets and the optional "email me a link" log-in.
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

async function sendWelcome(email: string, name: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const hi = name ? `Hi ${name},` : "Hi,";
  const text = `${hi}

You've signed up to Unizy with this email address. You're all set: log in any time at https://unizy.uk/login with your email and password.

Forgotten your password? Reset it at https://unizy.uk/reset.html

If you didn't sign up, reply to this email or contact hello@unizy.uk.

Unizy`;
  const html = `<div style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;line-height:1.55;color:#17302A;max-width:520px">
<p>${esc(hi)}</p>
<p>You've signed up to Unizy with this email address. You're all set: log in any time with your email and password.</p>
<p><a href="https://unizy.uk/app" style="display:inline-block;background:#17302A;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open Unizy</a></p>
<p style="font-size:14px;color:#5D6D67">Forgotten your password? <a href="https://unizy.uk/reset.html" style="color:#17302A">Reset it here</a>.<br>If you didn't sign up, reply to this email or contact hello@unizy.uk.</p>
</div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Unizy <noreply@unizy.uk>", reply_to: "hello@unizy.uk", to: [email], subject: "Welcome to Unizy", text, html }),
    });
  } catch { /* the account still works if the email fails */ }
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
    email_confirm: true,
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

  await sendWelcome(email, name);
  return json(200, { ok: true });
});
