import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import categoryRoutes from "./routes/categories.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API routes
app.route("/api/auth", auth);
app.route("/api/tasks", taskRoutes);
app.route("/api/categories", categoryRoutes);

// Serve frontend in production
app.use(
  "/*",
  serveStatic({
    root: "./public",
    index: "index.html",
  })
);

const port = Number(process.env.PORT) || 3001;

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 Server running on http://localhost:${port}`);
