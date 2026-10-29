// Unizy sign-in and password-reset codes.
// Emails a 6-digit code instead of a link. Uni mail systems (Microsoft 365 at UCL, Imperial, LSE…) open every
// link in an email to scan it, which used up one-time sign-in links before the student could click them.
// A code can't be "clicked", so it survives scanning. The page then calls /auth/v1/verify with the code.
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
const MAX_PER_IP_PER_HOUR = 150;
const MAX_PER_EMAIL_PER_HOUR = 8;

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendCode(email: string, code: string, purpose: "login" | "reset") {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("no email key");
  const what = purpose === "reset" ? "reset your password" : "log in";
  const subject = purpose === "reset" ? `${code} is your Unizy password reset code` : `${code} is your Unizy sign-in code`;
  const text = `Your Unizy code is ${code}

Type it on the Unizy page to ${what}. It works once and expires in an hour.

If you didn't ask for this, you can ignore this email. Your account is safe.

Unizy · unizy.uk`;
  const spaced = code.split("").join(" ");
  const html = `<div style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;line-height:1.55;color:#17302A;max-width:480px">
<p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px">Your Unizy code</p>
<p style="margin:0 0 18px;color:#5D6D67">Type it on the Unizy page to ${what}.</p>
<p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:6px;font-weight:700;background:#F4F4EF;border:1px solid #DDE3DE;border-radius:10px;padding:14px 18px;display:inline-block">${spaced}</p>
<p style="margin:0;font-size:14px;color:#5D6D67">It works once and expires in an hour. If you didn't ask for this, ignore this email; your account is safe.</p>
</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Unizy <noreply@unizy.uk>", reply_to: "hello@unizy.uk", to: [email], subject, text, html }),
  });
  if (!r.ok) throw new Error("send failed " + r.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
  const purpose: "login" | "reset" = body?.purpose === "reset" ? "reset" : "login";
  if (!EMAIL_RE.test(email)) return json(400, { error: "invalid_email" });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // rate limits (reuses the hashed signup_attempts log)
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256("unizy-code-ip:" + ip), emHash = await sha256("unizy-code-em:" + email);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [{ count: ipCount }, { count: emCount }] = await Promise.all([
    service.from("signup_attempts").select("ip_hash", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hourAgo),
    service.from("signup_attempts").select("ip_hash", { count: "exact", head: true }).eq("ip_hash", emHash).gte("created_at", hourAgo),
  ]);
  if ((ipCount || 0) >= MAX_PER_IP_PER_HOUR || (emCount || 0) >= MAX_PER_EMAIL_PER_HOUR) return json(429, { error: "rate_limited" });
  await service.from("signup_attempts").insert([{ ip_hash: ipHash }, { ip_hash: emHash }]);

  const type = purpose === "reset" ? "recovery" : "magiclink";
  let { data, error } = await service.auth.admin.generateLink({ type, email });
  if (error && purpose === "login") {
    // no account yet: "email me a code" also creates one, like the old sign-in link did
    const created = await service.auth.admin.createUser({ email, email_confirm: true });
    if (created.error && !/already/i.test(String(created.error.message))) return json(500, { error: "failed" });
    ({ data, error } = await service.auth.admin.generateLink({ type, email }));
  }
  if (error && /second|frequen|rate|too many/i.test(String(error.message))) return json(429, { error: "too_soon" });
  if (error || !data?.properties?.email_otp) {
    // for resets, don't reveal whether an account exists
    return purpose === "reset" ? json(200, { ok: true }) : json(500, { error: "failed" });
  }
  try { await sendCode(email, data.properties.email_otp, purpose); } catch { return json(502, { error: "email_failed" }); }
  return json(200, { ok: true, digits: data.properties.email_otp.length });
});
