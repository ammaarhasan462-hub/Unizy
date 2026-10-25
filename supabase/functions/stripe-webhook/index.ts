// Unizy Stripe webhook: verifies Stripe's signature, then switches Pro on or off.
//  - Monthly (subscription): tracked in stripe_subscriptions, kept up to date by subscription and invoice events.
//  - Year pass (£39, one-off): 12 months of Pro.   - Exam pass (£12, one-off): 6 weeks of Pro.  Passes stack.
// The buyer is identified by client_reference_id (their Unizy user id), which the pricing page adds to the payment link.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ok = (msg = "ok") => new Response(JSON.stringify({ received: true, note: msg }), { status: 200, headers: { "Content-Type": "application/json" } });
const bad = (status: number, msg: string) => new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSES: Record<number, { plan: "year" | "exam"; days: number }> = { 3900: { plan: "year", days: 365 }, 1200: { plan: "exam", days: 42 } };
// Unizy's payment links in the shared Stripe account (anything else in the account is ignored)
const LINKS: Record<string, "monthly" | "year" | "exam"> = {
  plink_1UUYFEJ9aAvWLq3XbojDY7bX: "monthly",
  plink_1UUYGrJ9aAvWLq3X1aKjYYJW: "year",
  plink_1UUYHvJ9aAvWLq3XSzRuvsdO: "exam",
};
const PASS_BY_PLAN = { year: PASSES[3900], exam: PASSES[1200] };

async function verify(raw: string, header: string, secret: string) {
  const items = header.split(",").map((kv) => kv.trim());
  const t = (items.find((kv) => kv.startsWith("t=")) || "").slice(2);
  const sigs = items.filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + raw)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare
  return sigs.some((sig) => sig.length === hex.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}
const ts = (sec: unknown) => (typeof sec === "number" && sec > 0 ? new Date(sec * 1000).toISOString() : null);

Deno.serve(async (req) => {
  if (req.method !== "POST") return bad(405, "POST only");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return bad(503, "webhook secret not set");
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("Stripe-Signature") || "", secret))) return bad(400, "bad signature");

  let ev: any;
  try { ev = JSON.parse(raw); } catch { return bad(400, "bad json"); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // handle each event once
  const { error: dup } = await db.from("stripe_events").insert({ id: ev.id, type: ev.type });
  if (dup) return ok("already handled");

  const o = ev.data?.object || {};
  const fail = async (msg: string) => { await db.from("stripe_events").delete().eq("id", ev.id); return bad(500, msg); };

  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const uid = typeof o.client_reference_id === "string" && UUID.test(o.client_reference_id) ? o.client_reference_id : null;
    const linkPlan = o.payment_link ? LINKS[o.payment_link] : undefined;
    if (o.payment_link && !linkPlan) return ok("not a Unizy payment link");
    if (!uid) return ok("no unizy user on this checkout");
    if (o.customer) await db.from("billing").upsert({ user_id: uid, stripe_customer: o.customer, updated_at: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: false });
    if (o.mode === "subscription" && o.subscription) {
      const { data: existing } = await db.from("stripe_subscriptions").select("sub_id, period_end, status").eq("sub_id", o.subscription).maybeSingle();
      const row: any = { sub_id: o.subscription, user_id: uid, customer: o.customer, updated_at: new Date().toISOString() };
      if (!existing) { row.status = "active"; row.period_end = new Date(Date.now() + 32 * 86400_000).toISOString(); }
      const { error } = await db.from("stripe_subscriptions").upsert(row, { onConflict: "sub_id" });
      if (error) return fail("could not save subscription");
      return ok("monthly on");
    }
    if (o.mode === "payment" && o.payment_status === "paid") {
      // with Adaptive Pricing the buyer may pay in their own currency; the original GBP amount is in currency_conversion
      const gbpTotal = String(o.currency).toLowerCase() === "gbp" ? o.amount_total
        : String(o.currency_conversion?.source_currency || "").toLowerCase() === "gbp" ? o.currency_conversion?.amount_total : null;
      const pass = linkPlan === "year" || linkPlan === "exam" ? PASS_BY_PLAN[linkPlan] : PASSES[gbpTotal as number];
      if (!pass) return ok("unknown amount " + o.amount_total);
      const { data: b } = await db.from("billing").select("pass_until").eq("user_id", uid).maybeSingle();
      const start = Math.max(Date.now(), b?.pass_until ? new Date(b.pass_until).getTime() : 0);
      const until = new Date(start + pass.days * 86400_000).toISOString();
      const { error } = await db.from("billing").upsert({ user_id: uid, pass_plan: pass.plan, pass_until: until, stripe_customer: o.customer || undefined, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) return fail("could not save pass");
      return ok(pass.plan + " pass until " + until);
    }
    return ok("nothing to do");
  }

  if (ev.type.startsWith("customer.subscription.")) {
    const periodEnd = ts(o.current_period_end) || ts(o.items?.data?.[0]?.current_period_end);
    const { data: existing } = await db.from("stripe_subscriptions").select("user_id").eq("sub_id", o.id).maybeSingle();
    let uid = existing?.user_id || null;
    if (!uid && o.customer) { const { data: b } = await db.from("billing").select("user_id").eq("stripe_customer", o.customer).maybeSingle(); uid = b?.user_id || null; }
    // only Unizy subscriptions: ones we already know, or from a customer who bought through Unizy
    if (!existing && !uid) { await db.from("stripe_events").delete().eq("id", ev.id); return ok("not a Unizy subscription (yet)"); }
    const row: any = { sub_id: o.id, customer: o.customer, status: ev.type === "customer.subscription.deleted" ? "canceled" : o.status, cancel_at_period_end: !!o.cancel_at_period_end, updated_at: new Date().toISOString() };
    if (periodEnd) row.period_end = periodEnd;
    if (uid) row.user_id = uid;
    const { error } = await db.from("stripe_subscriptions").upsert(row, { onConflict: "sub_id" });
    if (error) return fail("could not update subscription");
    return ok("subscription " + row.status);
  }

  if (ev.type === "invoice.paid") {
    const sub = o.subscription || o.parent?.subscription_details?.subscription;
    if (!sub) return ok("not a subscription invoice");
    const end = ts(o.lines?.data?.[0]?.period?.end);
    const row: any = { sub_id: sub, customer: o.customer, status: "active", updated_at: new Date().toISOString() };
    if (end) row.period_end = new Date(new Date(end).getTime() + 2 * 86400_000).toISOString(); // 2 days' grace for renewals
    const { data: existing } = await db.from("stripe_subscriptions").select("user_id").eq("sub_id", sub).maybeSingle();
    if (!existing?.user_id && o.customer) { const { data: b } = await db.from("billing").select("user_id").eq("stripe_customer", o.customer).maybeSingle(); if (b?.user_id) row.user_id = b.user_id; }
    if (!existing && !row.user_id) { await db.from("stripe_events").delete().eq("id", ev.id); return ok("not a Unizy invoice (yet)"); }
    const { error } = await db.from("stripe_subscriptions").upsert(row, { onConflict: "sub_id" });
    if (error) return fail("could not update invoice");
    return ok("renewed");
  }

  return ok("ignored " + ev.type);
});
