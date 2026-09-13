import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

function command(name, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(name, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-5000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${name} failed (${code}): ${stderr}`)));
  });
}

function waitFor(url, attempts = 40) {
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch { /* server is starting */ }
      if (attempts-- <= 0) return reject(new Error("Renderer did not start."));
      setTimeout(tryOnce, 150);
    };
    tryOnce();
  });
}

const folder = await mkdtemp(path.join(os.tmpdir(), "quickstory-smoke-"));
const photo = path.join(folder, "photo.png");
const clip = path.join(folder, "clip.mp4");
const output = path.join(folder, "output.mp4");

await command("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0xff4d67:s=360x640:d=1", "-frames:v", "1", "-update", "1", photo]);
await command("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=1.5", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", clip]);

const assetServer = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/photo.png") return createReadStream(photo).pipe(response);
  if (request.method === "GET" && request.url === "/clip.mp4") return createReadStream(clip).pipe(response);
  if (request.method === "PUT" && request.url === "/output.mp4") {
    await pipeline(request, createWriteStream(output));
    response.writeHead(200);
    return response.end();
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve) => assetServer.listen(8092, "127.0.0.1", resolve));

const renderer = spawn("node", ["render-service/server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: "8091" },
  stdio: ["ignore", "pipe", "pipe"]
});
let rendererError = "";
renderer.stderr.on("data", (chunk) => { rendererError = (rendererError + chunk).slice(-5000); });

try {
  await waitFor("http://127.0.0.1:8091/ping");
  const baseEdits = {
    trimStart: 0, trimEnd: 1.5, duration: 1.2, speed: 1, crop: "fill",
    positionX: .5, positionY: .5, zoom: 1, rotation: 0,
    brightness: 0, contrast: 100, saturation: 100, volume: 100, text: ""
  };
  const response = await fetch("http://127.0.0.1:8091/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: "smoke-test",
      outputPutUrl: "http://127.0.0.1:8092/output.mp4",
      project: {
        id: "smoke-test", title: "A very good day", subtitle: "QuickStory renderer check",
        templateId: "day-pop", aspectRatio: "9:16", accent: "#ff4d67",
        clips: [
          { id: "one", name: "photo.png", type: "image", sourceUrl: "http://127.0.0.1:8092/photo.png", edits: { ...baseEdits, duration: 1.2, trimEnd: 0 } },
          { id: "two", name: "clip.mp4", type: "video", sourceUrl: "http://127.0.0.1:8092/clip.mp4", edits: { ...baseEdits, text: "The best moment" } }
        ]
      }
    })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || `Render returned ${response.status}`);
  const details = await stat(output);
  if (details.size < 10_000) throw new Error("Rendered file is unexpectedly small.");
  const probe = await command("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", output]);
  if (!probe.includes("h264,1080,1920")) throw new Error(`Unexpected output: ${probe.trim()}`);
  console.log(`Renderer smoke test passed: ${probe.trim()}, ${details.size} bytes`);
} catch (error) {
  if (rendererError) console.error(rendererError);
  throw error;
} finally {
  renderer.kill("SIGTERM");
  await new Promise((resolve) => assetServer.close(resolve));
  await rm(folder, { recursive: true, force: true });
}
