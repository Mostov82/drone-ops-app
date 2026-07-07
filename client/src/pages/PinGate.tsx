// DO-005 — Full-screen PIN gate rendered instead of the shell until authenticated.
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ApiRequestError, login, setupPin } from "@/lib/auth-api";

const pinFieldClass =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-center text-lg tracking-widest focus-visible:outline-none focus-visible:ring-2";

interface PinGateProps {
  mode: "setup" | "login";
  onAuthenticated: () => void;
}

export default function PinGate({ mode, onAuthenticated }: PinGateProps) {
  const { t, i18n } = useTranslation();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "setup" && pin !== confirmPin) {
      setError(t("auth.pinMismatch"));
      return;
    }
    setBusy(true);
    try {
      await (mode === "setup" ? setupPin(pin) : login(pin));
      onAuthenticated();
    } catch (err) {
      setError(
        (err instanceof ApiRequestError && err.localized(i18n.language)) || t("auth.serverError"),
      );
      setPin("");
      setConfirmPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form onSubmit={submit} className="w-80 rounded-lg border border-border p-8">
        <p className="text-sm text-muted-foreground">{t("app.title")}</p>
        <h1 className="mt-1 text-xl font-semibold">
          {t(mode === "setup" ? "auth.setupTitle" : "auth.loginTitle")}
        </h1>
        {mode === "setup" && (
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.setupDescription")}</p>
        )}

        <label className="mt-6 flex flex-col gap-1 text-sm">
          {t("auth.pinLabel")}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={12}
            className={pinFieldClass}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>

        {mode === "setup" && (
          <label className="mt-4 flex flex-col gap-1 text-sm">
            {t("auth.confirmPinLabel")}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              className={pinFieldClass}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full" disabled={busy || pin === ""}>
          {t(mode === "setup" ? "auth.setPin" : "auth.unlock")}
        </Button>

        {mode === "login" && (
          <p className="mt-4 text-xs text-muted-foreground">{t("auth.resetHint")}</p>
        )}
      </form>
    </main>
  );
}
