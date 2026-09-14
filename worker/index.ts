import { Hono } from "hono";

interface Env {
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({
  ok: true,
  service: "quickstory",
  rendering: "browser"
}));

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
