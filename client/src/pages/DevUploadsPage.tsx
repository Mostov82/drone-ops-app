// DO-005 — DEV-ONLY upload test page proving the upload → store → retrieve →
// delete round trip. Mounted only when import.meta.env.DEV (see App.tsx), never
// linked from navigation. The real document vault (DO-009) replaces this.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface DocumentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  relativePath: string;
}

interface BilingualMessage {
  en: string;
  he: string;
}

export default function DevUploadsPage() {
  const { t, i18n } = useTranslation();
  const lang: keyof BilingualMessage = i18n.language.startsWith("he") ? "he" : "en";
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.ok) setDocuments(((await res.json()) as { documents: DocumentMeta[] }).documents);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const showApiError = async (res: Response) => {
    try {
      const body = (await res.json()) as { message?: BilingualMessage };
      setError(body.message?.[lang] ?? res.statusText);
    } catch {
      setError(res.statusText);
    }
  };

  const upload = async () => {
    if (!file) return;
    setNotice(null);
    setError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "x-file-name": encodeURIComponent(file.name),
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (res.ok) {
      setNotice(t("devUploads.uploaded"));
      setFile(null);
      await refresh();
    } else {
      await showApiError(res);
    }
  };

  const remove = async (id: string) => {
    setNotice(null);
    setError(null);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotice(t("devUploads.deleted"));
      await refresh();
    } else {
      await showApiError(res);
    }
  };

  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-semibold">{t("devUploads.title")}</h1>
      <p className="mt-2 inline-block rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive">
        DEV — {t("devUploads.devOnly")}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={() => void upload()} disabled={!file}>
          {t("devUploads.upload")}
        </Button>
      </div>

      <div className="mt-3 min-h-5 text-sm" aria-live="polite">
        {notice && <span className="text-muted-foreground">{notice}</span>}
        {error && (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        )}
      </div>

      <ul className="mt-6 flex flex-col gap-2">
        {documents.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("devUploads.empty")}</li>
        )}
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate" title={doc.relativePath}>
              {doc.fileName}{" "}
              <span className="text-xs text-muted-foreground">
                ({Math.ceil(doc.sizeBytes / 1024)} KB)
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/documents/${doc.id}/file`, "_blank")}
              >
                {t("devUploads.view")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void remove(doc.id)}>
                {t("devUploads.delete")}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
