// Unizy LTI 1.3 tool: lets students open Unizy straight from their university's Moodle, Canvas or Blackboard course page.
// The LMS signs them in with their university account, so they arrive in Unizy already logged in, verified as students
// at that university, with the course they came from picked out.
//   GET/POST /lti/login   OIDC login initiation (called by the LMS)
//   POST     /lti/launch  the signed launch (id_token) from the LMS
//   GET      /lti/jwks    Unizy's public key set
//   GET      /lti/config  JSON configuration (Canvas can import it by URL)
// Each university's LMS has to be registered once (public.lti_add_platform); see https://unizy.uk/lti.html.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://unizy.uk";
const BASE = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "") + "/functions/v1/lti";
const CLAIM = "https://purl.imsglobal.org/spec/lti/claim/";
const UNI_NAMES: Record<string, string> = { ucl: "UCL", imperial: "Imperial", lse: "LSE", oxford: "Oxford", cambridge: "Cambridge", qmul: "Queen Mary" };

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
const fail = (msg: string) => redirect(SITE + "/lti.html#error=" + encodeURIComponent(msg));

const b64u = {
  enc: (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const rand = (n = 32) => b64u.enc(crypto.getRandomValues(new Uint8Array(n)));

// ---- Unizy's own key pair (created on first use, kept in a locked table)
async function toolKey(): Promise<{ kid: string; jwk: JsonWebKey }> {
  const { data } = await service.from("lti_keys").select("kid, private_jwk").eq("id", 1).maybeSingle();
  if (data) return { kid: data.kid, jwk: data.private_jwk };
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const kid = "unizy-" + rand(8);
  await service.from("lti_keys").insert({ id: 1, kid, private_jwk: jwk });
  const { data: again } = await service.from("lti_keys").select("kid, private_jwk").eq("id", 1).single();
  return { kid: again.kid, jwk: again.private_jwk };
}
async function publicJwks() {
  const { kid, jwk } = await toolKey();
  return { keys: [{ kty: "RSA", alg: "RS256", use: "sig", kid, n: jwk.n, e: jwk.e }] };
}

// ---- platform keys (cached for an hour)
const jwksCache = new Map<string, { at: number; keys: any[] }>();
async function platformKey(url: string, kid: string | undefined) {
  let c = jwksCache.get(url);
  if (!c || Date.now() - c.at > 3600_000 || (kid && !c.keys.some((k) => k.kid === kid))) {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("Couldn’t fetch the university’s keys.");
    c = { at: Date.now(), keys: ((await r.json()).keys || []) };
    jwksCache.set(url, c);
  }
  const k = kid ? c.keys.find((x) => x.kid === kid) : c.keys.find((x) => x.kty === "RSA");
  if (!k) throw new Error("The university’s signing key wasn’t found.");
  return await crypto.subtle.importKey("jwk", { kty: k.kty, n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}
async function verifyJwt(token: string, jwksUrl: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("The launch token is malformed.");
  const header = JSON.parse(new TextDecoder().decode(b64u.dec(parts[0])));
  if (header.alg !== "RS256") throw new Error("Unsupported launch signature.");
  const key = await platformKey(jwksUrl, header.kid);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u.dec(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("The launch signature didn’t check out.");
  return JSON.parse(new TextDecoder().decode(b64u.dec(parts[1])));
}

async function params(req: Request): Promise<URLSearchParams> {
  const url = new URL(req.url);
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) return new URLSearchParams(await req.text());
    if (ct.includes("multipart/form-data")) { const f = await req.formData(); const p = new URLSearchParams(); for (const [k, v] of f.entries()) p.set(k, String(v)); return p; }
  }
  return url.searchParams;
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const route = path.slice(path.lastIndexOf("/") + 1);
  try {
    if (route === "jwks") return jsonRes(200, await publicJwks());

    if (route === "config") {
      const { kid } = await toolKey();
      return jsonRes(200, {
        title: "Unizy",
        description: "Notes, flashcards, practice questions and study rooms for your exact modules.",
        oidc_initiation_url: BASE + "/login",
        target_link_uri: BASE + "/launch",
        public_jwk_url: BASE + "/jwks",
        public_jwk_kid: kid,
        scopes: [],
        extensions: [{ domain: "unizy.uk", platform: "canvas.instructure.com", privacy_level: "public",
          settings: { placements: [{ placement: "course_navigation", message_type: "LtiResourceLinkRequest", text: "Unizy", target_link_uri: BASE + "/launch", windowTarget: "_blank" }] } }],
        custom_fields: { course_code: "$Canvas.course.sisSourceId" },
      });
    }

    if (route === "login") {
      const p = await params(req);
      const iss = p.get("iss") || "", hint = p.get("login_hint") || "", clientId = p.get("client_id") || "";
      if (!iss || !hint) return fail("Your university’s system didn’t send the details Unizy needs to sign you in.");
      let q = service.from("lti_platforms").select("*").eq("issuer", iss).eq("active", true);
      if (clientId) q = q.eq("client_id", clientId);
      const { data: plats } = await q.limit(2);
      if (!plats || plats.length !== 1) return fail("Your university hasn’t connected Unizy yet. Ask your digital education team to set it up (unizy.uk/lti.html).");
      const plat = plats[0];
      const depl = p.get("lti_deployment_id");
      if (depl && plat.deployment_ids.length && !plat.deployment_ids.includes(depl)) return fail("This Unizy link isn’t set up for that part of your university’s system.");
      const state = rand(), nonce = rand();
      await service.from("lti_states").delete().lt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
      const { error } = await service.from("lti_states").insert({ state, nonce, platform_id: plat.id });
      if (error) return fail("Couldn’t start signing in. Try again.");
      const auth = new URL(plat.auth_endpoint);
      const set = (k: string, v: string | null) => { if (v) auth.searchParams.set(k, v); };
      set("scope", "openid"); set("response_type", "id_token"); set("response_mode", "form_post"); set("prompt", "none");
      set("client_id", plat.client_id); set("redirect_uri", BASE + "/launch"); set("login_hint", hint);
      set("lti_message_hint", p.get("lti_message_hint")); set("state", state); set("nonce", nonce);
      return redirect(auth.toString());
    }

    if (route === "launch") {
      const p = await params(req);
      if (p.get("error")) return fail("Your university’s system said: " + (p.get("error_description") || p.get("error")));
      const idToken = p.get("id_token") || "", state = p.get("state") || "";
      if (!idToken || !state) return fail("The sign-in from your university didn’t come through. Open Unizy from your course page again.");
      const { data: st } = await service.from("lti_states").select("*").eq("state", state).maybeSingle();
      if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60000) return fail("That sign-in link expired. Open Unizy from your course page again.");
      await service.from("lti_states").delete().eq("state", state);
      const { data: plat } = await service.from("lti_platforms").select("*").eq("id", st.platform_id).single();
      const c = await verifyJwt(idToken, plat.jwks_url);
      const now = Math.floor(Date.now() / 1000);
      const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
      if (c.iss !== plat.issuer) throw new Error("The launch came from an unexpected system.");
      if (!aud.includes(plat.client_id) || (aud.length > 1 && c.azp && c.azp !== plat.client_id)) throw new Error("The launch wasn’t meant for Unizy.");
      if (!c.exp || c.exp < now - 30 || (c.iat && c.iat > now + 120)) throw new Error("The launch has expired. Open Unizy again.");
      if (c.nonce !== st.nonce) throw new Error("The launch couldn’t be matched to your sign-in.");
      const dep = c[CLAIM + "deployment_id"];
      if (plat.deployment_ids.length && !plat.deployment_ids.includes(dep)) throw new Error("This Unizy link isn’t set up for that part of your university’s system.");
      const type = c[CLAIM + "message_type"];
      if (type && type !== "LtiResourceLinkRequest") throw new Error("Unizy only supports opening from a course link.");

      const email = String(c.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Your university didn’t share your email with Unizy, so you can’t be signed in. Ask them to turn on “share email” for the Unizy tool, or sign in at unizy.uk.");
      const name = String(c.given_name || c.name || "").trim().slice(0, 60);
      const ctx = c[CLAIM + "context"] || {};
      const roles: string[] = (c[CLAIM + "roles"] || []).map((r: string) => r.replace(/^.*[#/]/, "")).slice(0, 10);

      // find the student: an account already verified with this uni email, else the account with this email, else a new one
      let userId: string | null = null, loginEmail = email;
      const { data: v } = await service.from("uni_verifications").select("user_id").eq("email", email).maybeSingle();
      if (v) {
        userId = v.user_id;
        const { data: u } = await service.auth.admin.getUserById(v.user_id);
        if (u?.user?.email) loginEmail = u.user.email;
      } else {
        const { data: created } = await service.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
        if (created?.user) userId = created.user.id;
      }
      const { data: link, error: linkErr } = await service.auth.admin.generateLink({ type: "magiclink", email: loginEmail, options: { redirectTo: SITE + "/app.html" } });
      if (linkErr || !link?.properties?.action_link) return fail("Couldn’t sign you in just now. Try again, or sign in at unizy.uk.");
      userId = userId || link.user?.id || null;
      if (!userId) return fail("Couldn’t sign you in just now. Try again.");

      // the university's own system vouched for this student, so they count as verified at that university
      if (!v) {
        const { data: mine } = await service.from("uni_verifications").select("user_id, uni").eq("user_id", userId).maybeSingle();
        if (!mine) await service.from("uni_verifications").insert({ user_id: userId, uni: plat.uni, email });
      }
      await service.from("lti_launches").insert({
        user_id: userId, platform_id: plat.id, uni: plat.uni, context_id: String(ctx.id || "").slice(0, 200),
        context_label: String(ctx.label || "").slice(0, 200), context_title: String(ctx.title || "").slice(0, 300), roles,
      });
      const course = String(ctx.title || ctx.label || "").slice(0, 120);
      return redirect(SITE + "/lti.html#go=" + encodeURIComponent(link.properties.action_link) + "&uni=" + encodeURIComponent(UNI_NAMES[plat.uni] || "") + (course ? "&course=" + encodeURIComponent(course) : ""));
    }

    return jsonRes(404, { error: "Not found. See https://unizy.uk/lti.html" });
  } catch (e) {
    if (route === "launch" || route === "login") return fail(e instanceof Error ? e.message : "Something went wrong signing you in.");
    return jsonRes(500, { error: "Something went wrong." });
  }
});
