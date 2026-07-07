// DO-005 — Change-PIN section of the Settings page (requires the current PIN).
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ApiRequestError, changePin } from "@/lib/auth-api";

const fieldClass =
  "h-9 w-40 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2";

export default function ChangePinSection() {
  const { t, i18n } = useTranslation();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);
    if (newPin !== confirmNewPin) {
      setError(t("auth.pinMismatch"));
      return;
    }
    setBusy(true);
    try {
      await changePin(currentPin, newPin);
      setNotice(t("auth.changed"));
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    } catch (err) {
      setError(
        (err instanceof ApiRequestError && err.localized(i18n.language)) || t("auth.serverError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    { key: "current", label: t("auth.currentPinLabel"), value: currentPin, set: setCurrentPin },
    { key: "new", label: t("auth.newPinLabel"), value: newPin, set: setNewPin },
    { key: "confirm", label: t("auth.confirmNewPinLabel"), value: confirmNewPin, set: setConfirmNewPin },
  ];

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium">{t("auth.changeTitle")}</h2>
      <form onSubmit={submit}>
        <div className="mt-3 flex flex-wrap gap-4">
          {fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              {field.label}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                className={fieldClass}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={busy || currentPin === "" || newPin === ""}>
            {t("auth.changeSubmit")}
          </Button>
          <span className="min-h-5 text-sm" aria-live="polite">
            {notice && <span className="text-muted-foreground">{notice}</span>}
            {error && (
              <span role="alert" className="text-destructive">
                {error}
              </span>
            )}
          </span>
        </div>
      </form>
    </section>
  );
}
