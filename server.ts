import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

// .env.local first so it wins, matching how Vite resolves the same files.
// In production Vercel injects the environment directly and neither exists.
dotenv.config({ path: ".env.local" });
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Attached documents travel as base64 inside the JSON body, so the default
  // 100kb cap is far too small. 6mb matches the ceiling Vercel allows.
  app.use(express.json({ limit: "6mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // The same model proxy Vercel serves from api/generate.ts, mounted here so
  // local development exercises exactly the production path.
  app.post("/api/generate", async (req, res) => {
    const { default: handler } = await import("./api/generate.ts");
    await handler(req as any, res as any);
  });

  // Live-update manifest, same handler Vercel serves.
  app.post("/api/updates", async (req, res) => {
    const { default: handler } = await import("./api/updates.ts");
    await handler(req as any, res as any);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
