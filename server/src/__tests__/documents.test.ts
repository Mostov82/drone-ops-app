import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Response } from "superagent";
import {
  authedAgent,
  makeApp,
  memoryDocumentMetaStore,
  tempAppDataDir,
} from "./helpers.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\n%fake-but-binary-enough\n%%EOF", "utf8");

async function upload(
  agent: Awaited<ReturnType<typeof authedAgent>>,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<Response> {
  return agent
    .post("/api/documents")
    .set("x-file-name", encodeURIComponent(fileName))
    .set("content-type", mimeType)
    .send(data);
}

describe("document storage round trip", () => {
  it("upload stores under documents/, returns a relative path, creates the metadata row", async () => {
    const appDataDir = tempAppDataDir();
    const app = makeApp({ appDataDir });
    const agent = await authedAgent(app);

    const res = await upload(agent, "רישיון-מפעיל.pdf", "application/pdf", PDF_BYTES);
    expect(res.status).toBe(201);
    expect(res.body.fileName).toBe("רישיון-מפעיל.pdf");
    expect(res.body.relativePath).toMatch(/^documents\/general\/[0-9a-f-]{36}\.pdf$/);
    expect(res.body.sizeBytes).toBe(PDF_BYTES.length);

    const onDisk = path.join(appDataDir, res.body.relativePath);
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk).equals(PDF_BYTES)).toBe(true);

    const list = await agent.get("/api/documents");
    expect(list.body.documents).toHaveLength(1);
    expect(list.body.documents[0].id).toBe(res.body.id);
  });

  it("retrieves the exact bytes with the declared type and original name", async () => {
    const app = makeApp();
    const agent = await authedAgent(app);
    const { body } = await upload(agent, "scan.pdf", "application/pdf", PDF_BYTES);

    const res = await agent
      .get(`/api/documents/${body.id}/file`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("scan.pdf");
    expect((res.body as Buffer).equals(PDF_BYTES)).toBe(true);
  });

  it("delete removes both the file and the metadata row", async () => {
    const appDataDir = tempAppDataDir();
    const app = makeApp({ appDataDir });
    const agent = await authedAgent(app);
    const { body } = await upload(agent, "temp.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const onDisk = path.join(appDataDir, body.relativePath);
    expect(fs.existsSync(onDisk)).toBe(true);

    expect((await agent.delete(`/api/documents/${body.id}`)).status).toBe(204);
    expect(fs.existsSync(onDisk)).toBe(false);
    expect((await agent.get(`/api/documents/${body.id}/file`)).status).toBe(404);
    expect((await agent.delete(`/api/documents/${body.id}`)).status).toBe(404);
    expect((await agent.get("/api/documents")).body.documents).toHaveLength(0);
  });

  it("rejects disallowed types with a bilingual error", async () => {
    const app = makeApp();
    const agent = await authedAgent(app);

    const txt = await upload(agent, "notes.txt", "text/plain", Buffer.from("hello"));
    expect(txt.status).toBe(400);
    expect(txt.body.code).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(txt.body.message.en).toContain("PDF");
    expect(txt.body.message.he).toContain("PDF");

    // Extension/MIME mismatch is also a rejection (trigger 3: ext + MIME check).
    const mismatch = await upload(agent, "sneaky.pdf", "image/png", PDF_BYTES);
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code).toBe("FILE_TYPE_NOT_ALLOWED");
  });

  it("rejects oversized files with a bilingual error", async () => {
    const app = makeApp({ maxUploadBytes: 1024 });
    const agent = await authedAgent(app);
    const res = await upload(agent, "big.pdf", "application/pdf", Buffer.alloc(4096, 1));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
    expect(res.body.message.en).toBeTypeOf("string");
    expect(res.body.message.he).toBeTypeOf("string");
  });

  it("requires a file name", async () => {
    const app = makeApp();
    const agent = await authedAgent(app);
    const res = await agent
      .post("/api/documents")
      .set("content-type", "application/pdf")
      .send(PDF_BYTES);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("FILE_NAME_REQUIRED");
  });

  it("leaves no orphan file when the metadata write fails", async () => {
    const appDataDir = tempAppDataDir();
    const failing = memoryDocumentMetaStore();
    failing.create = async () => {
      throw new Error("simulated row failure");
    };
    const app = makeApp({ appDataDir, documentMetaStore: failing });
    const agent = await authedAgent(app);

    const res = await upload(agent, "doomed.pdf", "application/pdf", PDF_BYTES);
    expect(res.status).toBe(500);

    const generalDir = path.join(appDataDir, "documents", "general");
    const leftovers = fs.existsSync(generalDir) ? fs.readdirSync(generalDir) : [];
    expect(leftovers).toHaveLength(0);
  });
});
