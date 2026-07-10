// Client for the Regulations Ruleset editor API (server/src/ruleset/routes.ts, DO-010).
// Regulatory values only ever arrive from the server — never constants here (NFR-5).

export interface BilingualMessage {
  en: string;
  he: string;
}

export interface RulesetApiError {
  code: string;
  message: BilingualMessage;
}

export interface Rule {
  id: string;
  key: string;
  category: string;
  label: string;
  valueType: "NUMBER" | "BOOLEAN" | "TEXT";
  numberValue: number | null;
  boolValue: boolean | null;
  textValue: string | null;
  unit: string | null;
  description: string | null;
  lastVerifiedAt: string | null;
}

export interface RuleValueSnapshot {
  numberValue: number | null;
  boolValue: boolean | null;
  textValue: string | null;
  unit: string | null;
}

export interface RuleChange {
  id: string;
  changedAt: string;
  previousValue: RuleValueSnapshot;
  newValue: RuleValueSnapshot;
  note: string | null;
}

/** Thrown for non-OK responses; carries the server's bilingual message when present. */
export class RulesetRequestError extends Error {
  constructor(public apiError: RulesetApiError | null) {
    super(apiError?.message.en ?? "Ruleset request failed");
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const err = (await res.json().catch(() => null)) as RulesetApiError | null;
  throw new RulesetRequestError(err);
}

export async function listRules(): Promise<Rule[]> {
  const res = await fetch("/api/ruleset");
  const body = await parseOrThrow<{ rules: Rule[] }>(res);
  return body.rules;
}

export async function getRuleHistory(key: string): Promise<RuleChange[]> {
  const res = await fetch(`/api/ruleset/${encodeURIComponent(key)}/history`);
  const body = await parseOrThrow<{ changes: RuleChange[] }>(res);
  return body.changes;
}

export async function updateRuleValue(
  key: string,
  value: number | boolean | string,
  note?: string,
): Promise<Rule> {
  const res = await fetch(`/api/ruleset/${encodeURIComponent(key)}/value`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note ? { value, note } : { value }),
  });
  const body = await parseOrThrow<{ rule: Rule }>(res);
  return body.rule;
}

export async function markRuleVerified(key: string): Promise<Rule> {
  const res = await fetch(`/api/ruleset/${encodeURIComponent(key)}/verify`, {
    method: "POST",
  });
  const body = await parseOrThrow<{ rule: Rule }>(res);
  return body.rule;
}
