// DO-005 — File-storage foundation for the document vault (DO-009) and permit
// packages (GB-05). Layout per GB-01 Gate 3 (shared with DO-004's backup):
// app-data/documents/<entity-type>/<uuid>.<ext>, relativePath stored relative
// to app-data so it matches the backup archive's internal layout.
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { ApiError } from "../api-error.js";

export interface DocumentMeta {
  id: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface DocumentMetaStore {
  create(data: Omit<DocumentMeta, "id" | "uploadedAt">): Promise<DocumentMeta>;
  get(id: string): Promise<DocumentMeta | null>;
  list(): Promise<DocumentMeta[]>;
  delete(id: string): Promise<void>;
}

export function createPrismaDocumentMetaStore(): DocumentMetaStore {
  return {
    async create(data) {
      const { prisma } = await import("../db.js");
      return prisma.document.create({ data });
    },
    async get(id) {
      const { prisma } = await import("../db.js");
      return prisma.document.findUnique({ where: { id } });
    },
    async list() {
      const { prisma } = await import("../db.js");
      return prisma.document.findMany({ orderBy: { uploadedAt: "desc" } });
    },
    async delete(id) {
      const { prisma } = await import("../db.js");
      await prisma.document.delete({ where: { id } });
    },
  };
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // default cap per intent doc

// Allowed types (intent doc: pdf, png, jpg). Extension AND declared MIME must
// match; content sniffing is a known, deliberate gap (no content-inspection
// dependency added).
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export const fileTypeNotAllowed = (): ApiError =>
  new ApiError(400, "FILE_TYPE_NOT_ALLOWED", {
    en: "Only PDF, PNG, or JPG files can be stored.",
    he: "ניתן לשמור רק קובצי PDF, PNG או JPG.",
  });

export const fileTooLarge = (maxBytes: number): ApiError =>
  new ApiError(413, "FILE_TOO_LARGE", {
    en: `The file is too large. The limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    he: `הקובץ גדול מדי. הגודל המרבי הוא ${Math.floor(maxBytes / (1024 * 1024))} מגה-בייט.`,
  });

const documentNotFound = (): ApiError =>
  new ApiError(404, "DOCUMENT_NOT_FOUND", {
    en: "Document not found.",
    he: "המסמך לא נמצא.",
  });

export interface DocumentStorageOptions {
  appDataDir: string;
  meta: DocumentMetaStore;
  maxSizeBytes?: number;
}

export class DocumentStorage {
  private readonly documentsDir: string;
  readonly maxSizeBytes: number;

  constructor(private readonly opts: DocumentStorageOptions) {
    this.documentsDir = path.join(opts.appDataDir, "documents");
    this.maxSizeBytes = opts.maxSizeBytes ?? MAX_UPLOAD_BYTES;
  }

  /** entityType becomes the subfolder; DO-009 passes real entity types, generic uploads use "general". */
  async save(fileName: string, mimeType: string, data: Buffer, entityType = "general"): Promise<DocumentMeta> {
    if (data.length === 0 || data.length > this.maxSizeBytes) {
      throw data.length === 0
        ? new ApiError(400, "FILE_EMPTY", { en: "The file is empty.", he: "הקובץ ריק." })
        : fileTooLarge(this.maxSizeBytes);
    }
    const ext = path.extname(fileName).toLowerCase().slice(1);
    const declaredMime = mimeType.split(";")[0].trim().toLowerCase();
    if (!(ext in ALLOWED) || ALLOWED[ext] !== declaredMime) {
      throw fileTypeNotAllowed();
    }
    if (!/^[a-z][a-z-]{0,29}$/.test(entityType)) {
      throw new ApiError(400, "INVALID_ENTITY_TYPE", {
        en: "Invalid entity type.",
        he: "סוג ישות לא חוקי.",
      });
    }

    const storedName = `${randomUUID()}.${ext}`;
    const relativePath = path.posix.join("documents", entityType, storedName);
    const absoluteDir = path.join(this.documentsDir, entityType);
    const absolutePath = path.join(absoluteDir, storedName);

    fs.mkdirSync(absoluteDir, { recursive: true });
    fs.writeFileSync(absolutePath, data);
    try {
      // File then row; a failed row write must not leave an orphan file.
      return await this.opts.meta.create({
        fileName,
        relativePath,
        mimeType: declaredMime,
        sizeBytes: data.length,
      });
    } catch (err) {
      fs.rmSync(absolutePath, { force: true });
      throw err;
    }
  }

  async read(id: string): Promise<{ meta: DocumentMeta; absolutePath: string }> {
    const meta = await this.opts.meta.get(id);
    if (!meta) throw documentNotFound();
    const absolutePath = this.resolveWithinDocuments(meta.relativePath);
    if (!fs.existsSync(absolutePath)) throw documentNotFound();
    return { meta, absolutePath };
  }

  list(): Promise<DocumentMeta[]> {
    return this.opts.meta.list();
  }

  /** Removes file and metadata row together — no orphans in either direction. */
  async remove(id: string): Promise<void> {
    const meta = await this.opts.meta.get(id);
    if (!meta) throw documentNotFound();
    fs.rmSync(this.resolveWithinDocuments(meta.relativePath), { force: true });
    await this.opts.meta.delete(id);
  }

  /** Defense against path traversal via a tampered relativePath. */
  private resolveWithinDocuments(relativePath: string): string {
    const absolute = path.resolve(this.opts.appDataDir, relativePath);
    const root = path.resolve(this.documentsDir);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw documentNotFound();
    }
    return absolute;
  }
}
