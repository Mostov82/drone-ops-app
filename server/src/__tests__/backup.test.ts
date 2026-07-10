import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { PrismaClient } from "@prisma/client";
import { createBackup, restoreBackup, BackupError, type BackupPaths } from "../backup/service.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "do004-test-"));
const appDataDir = path.join(tmp, "app-data");
const paths: BackupPaths = {
  appDataDir,
  dbFile: path.join(appDataDir, "drone-ops.db"),
  documentsDir: path.join(appDataDir, "documents"),
};
const destDir = path.join(tmp, "backups");
let prisma: PrismaClient;

beforeAll(async () => {
  fs.mkdirSync(paths.documentsDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(paths.documentsDir, "license.pdf"), "PDF-BYTES-לרישיון");
  prisma = new PrismaClient({ datasources: { db: { url: `file:${paths.dbFile}` } } });
  await prisma.$executeRawUnsafe(
    `CREATE TABLE _prisma_migrations (migration_name TEXT, finished_at TEXT)`,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations VALUES ('20260707162011_init', '2026-07-07')`,
  );
  await prisma.$executeRawUnsafe(`CREATE TABLE Operator (id TEXT PRIMARY KEY, name TEXT)`);
  await prisma.$executeRawUnsafe(`INSERT INTO Operator VALUES ('op1', 'יונתן Test')`);
});

afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("backup → wipe → restore round trip", () => {
  it("restores DB rows and document bytes exactly", async () => {
    const { archivePath } = await createBackup(prisma, destDir, paths);
    expect(fs.existsSync(archivePath)).toBe(true);

    // Wipe: mutate DB and delete the document.
    await prisma.$executeRawUnsafe(`DELETE FROM Operator`);
    fs.rmSync(path.join(paths.documentsDir, "license.pdf"));

    await restoreBackup(prisma, archivePath, paths);

    const rows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
      `SELECT * FROM Operator`,
    );
    expect(rows).toEqual([{ id: "op1", name: "יונתן Test" }]);
    expect(fs.readFileSync(path.join(paths.documentsDir, "license.pdf"), "utf8")).toBe(
      "PDF-BYTES-לרישיון",
    );
  });

  it("refuses an archive with a different migration state", async () => {
    const { archivePath } = await createBackup(prisma, destDir, paths);
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations VALUES ('20260801_phase1', '2026-08-01')`,
    );
    await expect(restoreBackup(prisma, archivePath, paths)).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
    await prisma.$executeRawUnsafe(
      `DELETE FROM _prisma_migrations WHERE migration_name='20260801_phase1'`,
    );
  });

  it("refuses a non-backup zip and a missing destination", async () => {
    await expect(createBackup(prisma, path.join(tmp, "nope"), paths)).rejects.toBeInstanceOf(
      BackupError,
    );
    const bogus = path.join(tmp, "bogus.zip");
    const AdmZip = (await import("adm-zip")).default;
    const z = new AdmZip();
    z.addFile("random.txt", Buffer.from("hi"));
    z.writeZip(bogus);
    await expect(restoreBackup(prisma, bogus, paths)).rejects.toMatchObject({
      code: "ARCHIVE_INVALID",
    });
  });

  it("backs up consistently while rows are being written (live-DB snapshot)", async () => {
    const writes = (async () => {
      for (let i = 0; i < 50; i++) {
        await prisma.$executeRawUnsafe(`INSERT INTO Operator VALUES ('w${i}', 'writer')`);
      }
    })();
    const { archivePath } = await createBackup(prisma, destDir, paths);
    await writes;
    // The snapshot is internally consistent: openable and readable.
    await restoreBackup(prisma, archivePath, paths);
    const rows = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM Operator`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
