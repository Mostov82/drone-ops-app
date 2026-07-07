import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "127.0.0.1"; // local-only by design (PRD: local-first, single machine)

createApp().listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
