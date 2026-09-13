import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import type { StoryProject } from "../src/types";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  RENDERER: DurableObjectNamespace<RenderContainer>;
}

type Variables = { requestId: string };

export class RenderContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "2m";
  enableInternet = true;
  pingEndpoint = "/ping";
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/api/*", cors({ origin: (origin) => origin, allowMethods: ["GET", "POST", "PUT", "OPTIONS"] }));
app.use("/api/*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header("X-Request-Id", c.get("requestId"));
  c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true, service: "quickstory", rendering: "container" }));

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120) || "media";
}

function isAllowedMedia(mimeType: string) {
  return /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm))$/i.test(mimeType);
}

app.post("/api/uploads", async (c) => {
  const body = await c.req.json<{ projectId?: string; name?: string; mimeType?: string; size?: number }>();
  if (!body.projectId || !body.name || !body.mimeType || !Number.isFinite(body.size)) {
    return c.json({ error: "Upload details are incomplete." }, 400);
  }
  if (!isAllowedMedia(body.mimeType)) return c.json({ error: "That file type is not supported." }, 415);
  if ((body.size ?? 0) > 2_000_000_000) return c.json({ error: "Each file must be smaller than 2 GB." }, 413);

  const mediaId = crypto.randomUUID();
  const key = `projects/${body.projectId}/source/${mediaId}-${safeFileName(body.name)}`;
  const multipart = await c.env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: body.mimeType } });
  await c.env.DB.prepare(
    "INSERT INTO media (id, project_id, object_key, original_name, mime_type, size_bytes, upload_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', datetime('now'))"
  ).bind(mediaId, body.projectId, key, body.name, body.mimeType, body.size, multipart.uploadId).run();
  return c.json({ mediaId, key, partSize: 8 * 1024 * 1024 });
});

app.put("/api/uploads/:id/parts/:partNumber", async (c) => {
  const partNumber = Number(c.req.param("partNumber"));
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) return c.json({ error: "Invalid upload part." }, 400);
  const row = await c.env.DB.prepare(
    "SELECT object_key, upload_id, status FROM media WHERE id = ?"
  ).bind(c.req.param("id")).first<{ object_key: string; upload_id: string; status: string }>();
  if (!row || row.status !== "uploading") return c.json({ error: "Upload session not found." }, 404);
  if (!c.req.raw.body) return c.json({ error: "Upload part is empty." }, 400);
  const multipart = c.env.MEDIA.resumeMultipartUpload(row.object_key, row.upload_id);
  const uploaded = await multipart.uploadPart(partNumber, c.req.raw.body);
  return c.json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
});

app.post("/api/uploads/:id/complete", async (c) => {
  const body = await c.req.json<{ parts?: Array<{ partNumber: number; etag: string }> }>();
  if (!body.parts?.length) return c.json({ error: "No uploaded parts were supplied." }, 400);
  const parts = body.parts
    .filter((part) => Number.isInteger(part.partNumber) && part.partNumber > 0 && typeof part.etag === "string")
    .sort((a, b) => a.partNumber - b.partNumber);
  if (parts.length !== body.parts.length || new Set(parts.map((part) => part.partNumber)).size !== parts.length) {
    return c.json({ error: "Upload part list is invalid." }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT object_key, upload_id, status FROM media WHERE id = ?"
  ).bind(c.req.param("id")).first<{ object_key: string; upload_id: string; status: string }>();
  if (!row || row.status !== "uploading") return c.json({ error: "Upload session not found." }, 404);
  const multipart = c.env.MEDIA.resumeMultipartUpload(row.object_key, row.upload_id);
  const object = await multipart.complete(parts);
  await c.env.DB.prepare("UPDATE media SET status = 'complete', uploaded_at = datetime('now') WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true, key: object.key, size: object.size });
});

app.put("/api/projects", async (c) => {
  const project = await c.req.json<StoryProject>();
  if (!project.id || !project.templateId || !Array.isArray(project.clips)) {
    return c.json({ error: "Project data is incomplete." }, 400);
  }
  if (project.clips.length > 80) return c.json({ error: "A story can contain up to 80 clips." }, 400);
  await c.env.DB.prepare(`
    INSERT INTO projects (id, title, template_id, aspect_ratio, project_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      template_id = excluded.template_id,
      aspect_ratio = excluded.aspect_ratio,
      project_json = excluded.project_json,
      updated_at = datetime('now')
  `).bind(project.id, project.title, project.templateId, project.aspectRatio, JSON.stringify(project)).run();
  return c.json({ ok: true, id: project.id });
});

app.get("/api/projects/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT project_json FROM projects WHERE id = ?").bind(c.req.param("id")).first<{ project_json: string }>();
  if (!row) return c.json({ error: "Project not found." }, 404);
  return c.json(JSON.parse(row.project_json));
});

app.post("/api/renders", async (c) => {
  const project = await c.req.json<StoryProject>();
  if (!project.id || !project.clips?.length) return c.json({ error: "Add at least one clip before exporting." }, 400);
  if (project.clips.some((clip) => !clip.remoteKey)) return c.json({ error: "One or more clips have not finished uploading." }, 400);

  const jobId = crypto.randomUUID();
  const accessToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const outputKey = `projects/${project.id}/renders/${jobId}.mp4`;
  await c.env.DB.prepare(
    "INSERT INTO render_jobs (id, project_id, status, output_key, access_token, created_at, updated_at) VALUES (?, ?, 'rendering', ?, ?, datetime('now'), datetime('now'))"
  ).bind(jobId, project.id, outputKey, accessToken).run();

  try {
    const origin = new URL(c.req.url).origin;
    const media = project.clips.map((clip) => ({
      ...clip,
      file: undefined,
      objectUrl: undefined,
      sourceUrl: `${origin}/api/render-assets/${jobId}/source?token=${accessToken}&key=${encodeURIComponent(clip.remoteKey!)}`
    }));
    const outputPutUrl = `${origin}/api/render-assets/${jobId}/output?token=${accessToken}`;
    const renderer = getContainer(c.env.RENDERER, jobId);
    const response = await renderer.fetch(new Request("http://container/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, project: { ...project, clips: media }, outputPutUrl })
    }));
    const result = await response.json<{ ok?: boolean; error?: string; bytes?: number }>();
    if (!response.ok || !result.ok) throw new Error(result.error || "The renderer did not finish successfully.");

    await c.env.DB.prepare(
      "UPDATE render_jobs SET status = 'complete', output_bytes = ?, access_token = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(result.bytes ?? null, jobId).run();
    const downloadUrl = `${origin}/api/renders/${jobId}/download`;
    return c.json({ jobId, downloadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video rendering failed.";
    await c.env.DB.prepare(
      "UPDATE render_jobs SET status = 'failed', error_message = ?, access_token = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(message.slice(0, 1000), jobId).run();
    return c.json({ error: message, jobId }, 500);
  }
});

app.get("/api/renders/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, status, output_key, error_message, created_at, updated_at FROM render_jobs WHERE id = ?"
  ).bind(c.req.param("id")).first<{ id: string; status: string; output_key: string; error_message?: string; created_at: string; updated_at: string }>();
  if (!row) return c.json({ error: "Render not found." }, 404);
  const downloadUrl = row.status === "complete" ? `${new URL(c.req.url).origin}/api/renders/${row.id}/download` : undefined;
  return c.json({ ...row, downloadUrl });
});

app.get("/api/renders/:id/download", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT output_key, status FROM render_jobs WHERE id = ?"
  ).bind(c.req.param("id")).first<{ output_key: string; status: string }>();
  if (!row || row.status !== "complete") return c.json({ error: "Finished video not found." }, 404);
  const object = await c.env.MEDIA.get(row.output_key);
  if (!object) return c.json({ error: "Finished video is unavailable." }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename="quickstory-${c.req.param("id")}.mp4"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
});

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

async function authorizedRenderJob(c: AppContext) {
  const token = c.req.query("token");
  if (!token) return null;
  return c.env.DB.prepare(
    "SELECT project_id, output_key FROM render_jobs WHERE id = ? AND access_token = ? AND status = 'rendering'"
  ).bind(c.req.param("id"), token).first<{ project_id: string; output_key: string }>();
}

app.get("/api/render-assets/:id/source", async (c) => {
  const job = await authorizedRenderJob(c);
  const key = c.req.query("key");
  if (!job || !key || !key.startsWith(`projects/${job.project_id}/source/`)) return c.json({ error: "Not authorized." }, 403);
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ error: "Source media not found." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.body, { headers });
});

app.put("/api/render-assets/:id/output", async (c) => {
  const job = await authorizedRenderJob(c);
  if (!job || !c.req.raw.body) return c.json({ error: "Not authorized." }, 403);
  const object = await c.env.MEDIA.put(job.output_key, c.req.raw.body, { httpMetadata: { contentType: "video/mp4" } });
  return c.json({ ok: true, size: object.size });
});

app.onError((error, c) => {
  console.error(JSON.stringify({ requestId: c.get("requestId"), error: error.message, stack: error.stack }));
  return c.json({ error: error.message || "Something went wrong.", requestId: c.get("requestId") }, 500);
});

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
