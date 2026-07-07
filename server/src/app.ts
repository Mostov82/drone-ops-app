import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/hello", (_req, res) => {
    res.json({
      message: "Drone Operations App server is alive",
      time: new Date().toISOString(),
    });
  });

  return app;
}
