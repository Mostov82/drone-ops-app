// DO-004 — Backup & restore section of the Settings page.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2";

interface BilingualMessage {
  en: string;
  he: string;
}

interface ApiError {
  code: string;
  message: BilingualMessage;
}

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function BackupSection() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language === "he" ? "he" : "en") as keyof BilingualMessage;

  const [destDir, setDestDir] = useState("");
  const [archivePath, setArchivePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBackup = async () => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await post("/api/backup", { destDir });
      if (res.ok) {
        const { archivePath: created } = (await res.json()) as { archivePath: string };
        setNotice(`${t("backup.success")} ${created}`);
      } else {
        const err = (await res.json()) as ApiError;
        setError(err.message?.[lang] ?? t("backup.error"));
      }
    } catch {
      setError(t("backup.error"));
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    // Explicit, destructive-action confirmation (NFR-4) — bilingual via i18n.
    if (!window.confirm(t("restore.confirmPrompt"))) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await post("/api/restore", { archivePath, confirm: "REPLACE_ALL_DATA" });
      if (res.ok) {
        setNotice(t("restore.success"));
        // Full replacement — reload so every view reflects the restored data.
        window.setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = (await res.json()) as ApiError;
        setError(err.message?.[lang] ??  t("restore.error"));
      }
    } catch {
      setError(t("restore.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium">{t("backup.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("backup.description")}</p>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        {t("backup.destLabel")}
        <input
          type="text"
          className={fieldClass}
          value={destDir}
          onChange={(e) => setDestDir(e.target.value)}
          placeholder={t("backup.destPlaceholder")}
        />
      </label>
      <Button className="mt-2" disabled={busy || destDir.trim() === ""} onClick={runBackup}>
        {t("backup.run")}
      </Button>

      <h3 className="mt-6 text-sm font-medium">{t("restore.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("restore.description")}</p>
      <label className="mt-3 flex flex-col gap-1 text-sm">
        {t("restore.archiveLabel")}
        <input
          type="text"
          className={fieldClass}
          value={archivePath}
          onChange={(e) => setArchivePath(e.target.value)}
          placeholder={t("restore.archivePlaceholder")}
        />
      </label>
      <Button
        className="mt-2"
        variant="outline"
        disabled={busy || archivePath.trim() === ""}
        onClick={runRestore}
      >
        {t("restore.run")}
      </Button>

      <div className="mt-3 min-h-5 text-sm" aria-live="polite">
        {notice && <span className="text-muted-foreground">{notice}</span>}
        {error && (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
