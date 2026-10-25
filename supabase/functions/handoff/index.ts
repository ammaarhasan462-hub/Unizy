// Unizy sign-in handoff: once a sign-in or confirmation link is opened on any device,
// the tab that asked for it logs in by itself (with its own, separate session).
//  - "complete": called by the device that opened the email link (signed in), with the pairing code.
//  - "claim":    polled by the waiting tab with the same pairing code; returns a one-time token it can exchange for a session.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const MAX_AGE_MIN = 20;

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "bad request" }); }
  const pair = typeof body?.pair === "string" ? body.pair : "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(pair)) return json(400, { error: "bad pair" });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const pairHash = await sha256(pair);
  const since = new Date(Date.now() - MAX_AGE_MIN * 60_000).toISOString();

  if (body.action === "complete") {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data, error } = await service.auth.getUser(token);
    if (error || !data?.user) return json(401, { error: "not signed in" });
    const { error: upErr } = await service.from("auth_handoff").upsert({ pair_hash: pairHash, user_id: data.user.id, created_at: new Date().toISOString(), claimed_at: null });
    if (upErr) return json(500, { error: "could not save" });
    // tidy up old pairings
    await service.from("auth_handoff").delete().lt("created_at", since);
    return json(200, { ok: true });
  }

  if (body.action === "claim") {
    // atomically mark as claimed so a pairing can only be used once
    const { data: rows, error } = await service.from("auth_handoff")
      .update({ claimed_at: new Date().toISOString() })
      .eq("pair_hash", pairHash).is("claimed_at", null).gte("created_at", since)
      .select("user_id");
    if (error) return json(500, { error: "lookup failed" });
    if (!rows || !rows.length) return json(200, { pending: true });
    const { data: u, error: uErr } = await service.auth.admin.getUserById(rows[0].user_id);
    if (uErr || !u?.user?.email) return json(500, { error: "user not found" });
    const { data: link, error: lErr } = await service.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (lErr || !link?.properties?.hashed_token) return json(500, { error: "could not create session" });
    return json(200, { token_hash: link.properties.hashed_token, type: "magiclink" });
  }

  return json(400, { error: "unknown action" });
});
