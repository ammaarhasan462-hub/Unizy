// Shared AI helpers: cost tracking against the daily £ budget, and email alerts.
// Prices are US dollars per million tokens (Claude API list prices for prompts under 100k tokens).
export const PRICES: Record<string, { in: number; out: number; cw: number; cr: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10, cw: 2.5, cr: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cw: 0.125, cr: 0.01 },
};
export const PAUSED_MSG = "Unizy’s AI is taking a short break and will be back soon. Your notes, flashcards and topic tests still work.";
export const BUDGET_MSG = "Unizy’s AI has reached its limit for today and will be back after midnight (UK time). Your notes, flashcards and topic tests still work.";

export function costUsd(model: string, u: any): number {
  const p = PRICES[model] || PRICES["claude-sonnet-5-5"];
  return ((+u?.input_tokens || 0) * p.in + (+u?.output_tokens || 0) * p.out + (+u?.cache_creation_input_tokens || 0) * p.cw + (+u?.cache_read_input_tokens || 0) * p.cr) / 1e6;
}
export async function recordSpend(service: any, model: string, usage: any) {
  try { await service.rpc("ai_add_spend", { p_usd: costUsd(model, usage) }); } catch { /* ignore */ }
}
// Is this Anthropic error about money (credit ran out, spend limit hit) or a bad key?
export function isAccountProblem(status: number, text: string) {
  return status === 401 || ((status === 400 || status === 402 || status === 403) && /credit balance|billing|spend limit|usage limit|insufficient|purchase credits/i.test(text));
}
export async function alertOwner(service: any, kind: "budget" | "credit", subject: string, text: string) {
  try {
    const { data: send } = await service.rpc("ai_alert_once", { p_kind: kind });
    if (!send) return;
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Unizy alerts <noreply@unizy.uk>", to: ["hello@unizy.uk"], subject, text }),
    });
  } catch { /* ignore */ }
}
export async function handleAccountProblem(service: any, status: number, text: string) {
  const why = status === 401 ? "Anthropic rejected the API key (it may have been deleted or changed)." : "Anthropic refused the request because of billing: the credit balance may have run out or the monthly spend limit was reached.";
  await alertOwner(service, "credit", "Unizy AI is paused: action needed",
    why + "\n\nStudents are seeing a friendly “AI is taking a short break” message; notes, flashcards and tests still work.\n\nTo fix: open console.anthropic.com → Billing, check the credit balance, auto-reload and monthly spend limit.\n\nAnthropic said: " + text.slice(0, 400));
}
export async function budgetReached(service: any, budgetText: string) {
  await alertOwner(service, "budget", "Unizy AI hit today’s budget",
    "Unizy’s AI reached today’s budget (" + budgetText + ") and is paused until midnight UK time. Students see a friendly message; everything else works.\n\nIf this keeps happening, more students are using the AI — consider raising daily_budget_gbp in the ai_settings table, or check how many are on Pro.");
}
