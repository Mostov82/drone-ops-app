// DO-010 — Regulations Ruleset editor (FR-A5), reached from Settings (FR-S3).
// Rules are grouped by category; every value renders with its unit and, until
// a human sets lastVerifiedAt, the unverified badge. Edits write append-only
// change history server-side.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import UnverifiedBadge from "@/components/UnverifiedBadge";
import { SETTINGS_PATH } from "@/lib/navigation";
import {
  getRuleHistory,
  listRules,
  markRuleVerified,
  updateRuleValue,
  RulesetRequestError,
  type Rule,
  type RuleChange,
  type RuleValueSnapshot,
} from "@/lib/ruleset-api";

const fieldClass =
  "h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2";

// Display order for known categories; anything new from the data sorts after.
const CATEGORY_ORDER = ["ALTITUDE", "DISTANCE", "OPERATIONAL", "LICENSING", "PERMITS", "WEIGHT"];

function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

export default function RulesetPage() {
  const { t, i18n } = useTranslation();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    listRules()
      .then(setRules)
      .catch(() => setLoadFailed(true));
  }, []);

  const replaceRule = (updated: Rule) =>
    setRules((current) =>
      current ? current.map((r) => (r.id === updated.id ? updated : r)) : current,
    );

  const categories = rules
    ? [...new Set(rules.map((r) => r.category))].sort(
        (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
      )
    : [];

  return (
    <article className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{t("ruleset.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("ruleset.description")}</p>
      <Link to={SETTINGS_PATH} className="mt-2 inline-block text-sm underline">
        {t("ruleset.backToSettings")}
      </Link>

      {loadFailed && (
        <p role="alert" className="mt-4 rounded-md border border-border bg-primary/5 px-3 py-2 text-sm">
          {t("ruleset.loadError")}
        </p>
      )}

      {categories.map((category) => (
        <section key={category} className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`ruleset.category.${category}`, { defaultValue: category })}
          </h2>
          <ul className="mt-2 space-y-3">
            {rules
              ?.filter((r) => r.category === category)
              .map((rule) => (
                <RuleRow key={rule.id} rule={rule} lang={i18n.language} onChanged={replaceRule} />
              ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function formatValue(
  rule: Pick<Rule, "valueType" | "numberValue" | "boolValue" | "textValue" | "unit">,
  t: (key: string) => string,
): string {
  switch (rule.valueType) {
    case "NUMBER":
      if (rule.numberValue === null) return t("ruleset.value.unset");
      return rule.unit ? `${rule.numberValue} ${rule.unit}` : String(rule.numberValue);
    case "BOOLEAN":
      if (rule.boolValue === null) return t("ruleset.value.unset");
      return rule.boolValue ? t("ruleset.value.true") : t("ruleset.value.false");
    default:
      return rule.textValue ?? t("ruleset.value.unset");
  }
}

function RuleRow({
  rule,
  lang,
  onChanged,
}: {
  rule: Rule;
  lang: string;
  onChanged: (rule: Rule) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<RuleChange[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = lang === "he" ? "he-IL" : "en-GB";
  const label = t(`ruleset.rule.${rule.key}`, { defaultValue: rule.label });

  const surfaceError = (err: unknown, fallbackKey: string) => {
    const bilingual = err instanceof RulesetRequestError ? err.apiError?.message : undefined;
    setError(bilingual?.[lang === "he" ? "he" : "en"] ?? t(fallbackKey));
  };

  const startEdit = () => {
    setError(null);
    if (rule.valueType === "NUMBER") setDraft(rule.numberValue === null ? "" : String(rule.numberValue));
    else if (rule.valueType === "BOOLEAN") setDraft(rule.boolValue === false ? "false" : "true");
    else setDraft(rule.textValue ?? "");
    setNote("");
    setEditing(true);
  };

  const save = async () => {
    let value: number | boolean | string;
    if (rule.valueType === "NUMBER") {
      value = Number(draft);
      if (draft.trim() === "" || !Number.isFinite(value)) return;
    } else if (rule.valueType === "BOOLEAN") {
      value = draft === "true";
    } else {
      value = draft;
      if (value.trim() === "") return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateRuleValue(rule.key, value, note.trim() || undefined);
      onChanged(updated);
      setEditing(false);
      if (showHistory) setHistory(await getRuleHistory(rule.key));
    } catch (err) {
      surfaceError(err, "ruleset.saveError");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await markRuleVerified(rule.key));
    } catch (err) {
      surfaceError(err, "ruleset.verifyError");
    } finally {
      setBusy(false);
    }
  };

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setError(null);
    try {
      setHistory(await getRuleHistory(rule.key));
      setShowHistory(true);
    } catch (err) {
      surfaceError(err, "ruleset.loadError");
    }
  };

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <UnverifiedBadge lastVerifiedAt={rule.lastVerifiedAt} />
        {rule.lastVerifiedAt !== null && (
          <span className="text-xs text-muted-foreground">
            {t("ruleset.verifiedOn", {
              date: new Date(rule.lastVerifiedAt).toLocaleDateString(locale),
            })}
          </span>
        )}
      </div>
      {rule.description && (
        <p className="mt-1 text-xs text-muted-foreground">{rule.description}</p>
      )}

      {!editing && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm" dir="ltr">
            {formatValue(rule, t)}
          </span>
          <Button variant="outline" size="sm" disabled={busy} onClick={startEdit}>
            {t("ruleset.edit")}
          </Button>
          {rule.lastVerifiedAt === null && (
            <Button variant="outline" size="sm" disabled={busy} onClick={verify}>
              {t("ruleset.markVerified")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={toggleHistory}>
            {showHistory ? t("ruleset.history.hide") : t("ruleset.history.show")}
          </Button>
        </div>
      )}

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {rule.valueType === "BOOLEAN" ? (
            <select
              className={fieldClass}
              value={draft}
              aria-label={label}
              onChange={(e) => setDraft(e.target.value)}
            >
              <option value="true">{t("ruleset.value.true")}</option>
              <option value="false">{t("ruleset.value.false")}</option>
            </select>
          ) : (
            <label className="flex flex-col gap-1 text-xs">
              {rule.unit ? `${t("ruleset.valueLabel")} (${rule.unit})` : t("ruleset.valueLabel")}
              <input
                type={rule.valueType === "NUMBER" ? "number" : "text"}
                className={`${fieldClass} w-36`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs">
            {t("ruleset.noteLabel")}
            <input
              type="text"
              className={`${fieldClass} w-56`}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button size="sm" disabled={busy} onClick={save}>
            {t("ruleset.save")}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(false)}>
            {t("ruleset.cancel")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {showHistory && history && (
        <div className="mt-3 border-t border-border pt-2">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("ruleset.history.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {history.map((change) => (
                <li key={change.id} className="text-xs text-muted-foreground">
                  <span>{new Date(change.changedAt).toLocaleString(locale)}: </span>
                  <span dir="ltr">
                    {formatValue({ ...snapshotAsRule(rule, change.previousValue) }, t)}
                    {" → "}
                    {formatValue({ ...snapshotAsRule(rule, change.newValue) }, t)}
                  </span>
                  {change.note && (
                    <span>
                      {" — "}
                      {change.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function snapshotAsRule(rule: Rule, snap: RuleValueSnapshot) {
  return {
    valueType: rule.valueType,
    numberValue: snap.numberValue,
    boolValue: snap.boolValue,
    textValue: snap.textValue,
    unit: snap.unit,
  };
}
