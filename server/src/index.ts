import { createApp } from "./app.js";
import { runBootPipeline } from "./provisioning/pipeline.js";
import { demDownloader } from "./provisioning/dem-downloader.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "127.0.0.1"; // local-only by design (PRD: local-first, single machine)

async function startServer() {
  try {
    await runBootPipeline();
    demDownloader.start();

    createApp().listen(PORT, HOST, () => {
      console.log(`[server] listening on http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error("[server] Failed to boot server:", err);
    process.exit(1);
  }
}

startServer();
