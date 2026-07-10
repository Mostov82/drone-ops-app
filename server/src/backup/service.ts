// DO-004 — Backup & restore of the app-data directory (SQLite DB + documents/).
// Backup uses SQLite's VACUUM INTO for a consistent live snapshot (runtime use of a
// SQLite feature, not a schema dependency — NFR-7 unaffected).
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { PrismaClient } from "@prisma/client";

export interface BackupPaths {
  appDataDir: string;
  dbFile: string;
  documentsDir: string;
}

export function resolvePaths(): BackupPaths {
  const appDataDir = process.env.APP_DATA_DIR ?? path.resolve(process.cwd(), "..", "app-data");
  return {
    appDataDir,
    dbFile: path.join(appDataDir, "drone-ops.db"),
    documentsDir: path.join(appDataDir, "documents"),
  };
}

export class BackupError extends Error {
  constructor(
    public code: string,
    public messages: { en: string; he: string },
  ) {
    super(messages.en);
  }
}

interface Manifest {
  app: string;
  version: string;
  createdAt: string;
  migrations: string[];
}

async function appliedMigrations(prisma: PrismaClient): Promise<string[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name",
    );
    return rows.map((r) => r.migration_name);
  } catch {
    return [];
  }
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Create a timestamped zip (DB snapshot + documents + manifest) in destDir. */
export async function createBackup(
  prisma: PrismaClient,
  destDir: string,
  paths: BackupPaths = resolvePaths(),
): Promise<{ archivePath: string }> {
  if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) {
    throw new BackupError("DEST_NOT_FOUND", {
      en: "Backup destination folder does not exist.",
      he: "תיקיית היעד לגיבוי אינה קיימת.",
    });
  }
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const archivePath = path.join(destDir, `drone-ops-backup_${stamp}.zip`);

  // Consistent snapshot of a possibly-live DB.
  const snapshot = path.join(os.tmpdir(), `drone-ops-snap-${randomUUID()}.db`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);

  try {
    const zip = new AdmZip();
    zip.addLocalFile(snapshot, "database", "drone-ops.db");
    if (fs.existsSync(paths.documentsDir)) {
      zip.addLocalFolder(paths.documentsDir, "documents");
    }
    const manifest: Manifest = {
      app: "drone-ops-app",
      version: appVersion(),
      createdAt: new Date().toISOString(),
      migrations: await appliedMigrations(prisma),
    };
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    zip.writeZip(archivePath);
  } finally {
    fs.rmSync(snapshot, { force: true });
  }
  return { archivePath };
}

/** Full-replacement restore. Caller is responsible for user confirmation (route enforces it). */
export async function restoreBackup(
  prisma: PrismaClient,
  archivePath: string,
  paths: BackupPaths = resolvePaths(),
): Promise<{ restored: true }> {
  if (!fs.existsSync(archivePath)) {
    throw new BackupError("ARCHIVE_NOT_FOUND", {
      en: "Backup archive not found.",
      he: "קובץ הגיבוי לא נמצא.",
    });
  }
  const zip = new AdmZip(archivePath);
  const manifestEntry = zip.getEntry("manifest.json");
  const dbEntry = zip.getEntry("database/drone-ops.db");
  if (!manifestEntry || !dbEntry) {
    throw new BackupError("ARCHIVE_INVALID", {
      en: "This file is not a Drone Operations App backup.",
      he: "הקובץ אינו גיבוי של אפליקציית תפעול הרחפנים.",
    });
  }
  const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as Manifest;
  if (manifest.app !== "drone-ops-app") {
    throw new BackupError("ARCHIVE_INVALID", {
      en: "This file is not a Drone Operations App backup.",
      he: "הקובץ אינו גיבוי של אפליקציית תפעול הרחפנים.",
    });
  }
  const current = await appliedMigrations(prisma);
  const same =
    manifest.migrations.length === current.length &&
    manifest.migrations.every((m, i) => m === current[i]);
  if (!same) {
    throw new BackupError("SCHEMA_MISMATCH", {
      en: "This backup was made with a different database schema version and cannot be restored by this app version.",
      he: "גיבוי זה נוצר עם גרסת מסד נתונים שונה ולא ניתן לשחזרו בגרסה זו של האפליקציה.",
    });
  }

  // Extract to a temp area first — never unpack straight over live data.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "drone-ops-restore-"));
  zip.extractAllTo(staging, true);

  // Swap. Prisma reconnects lazily on the next query after $disconnect().
  await prisma.$disconnect();
  const aside = `${paths.appDataDir}.pre-restore-${randomUUID()}`;
  fs.mkdirSync(aside, { recursive: true });
  try {
    if (fs.existsSync(paths.dbFile)) fs.renameSync(paths.dbFile, path.join(aside, "drone-ops.db"));
    if (fs.existsSync(paths.documentsDir))
      fs.renameSync(paths.documentsDir, path.join(aside, "documents"));
    fs.mkdirSync(paths.appDataDir, { recursive: true });
    fs.copyFileSync(path.join(staging, "database", "drone-ops.db"), paths.dbFile);
    const stagedDocs = path.join(staging, "documents");
    if (fs.existsSync(stagedDocs)) {
      fs.cpSync(stagedDocs, paths.documentsDir, { recursive: true });
    } else {
      fs.mkdirSync(paths.documentsDir, { recursive: true });
    }
  } catch (err) {
    // Roll back the swap if anything failed mid-way.
    if (fs.existsSync(path.join(aside, "drone-ops.db")))
      fs.renameSync(path.join(aside, "drone-ops.db"), paths.dbFile);
    if (fs.existsSync(path.join(aside, "documents"))) {
      fs.rmSync(paths.documentsDir, { recursive: true, force: true });
      fs.renameSync(path.join(aside, "documents"), paths.documentsDir);
    }
    throw err;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  fs.rmSync(aside, { recursive: true, force: true });
  return { restored: true };
}
