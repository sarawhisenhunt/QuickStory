import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 8080);
const FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

function respond(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10_000_000) request.destroy(new Error("Render request is too large."));
      else chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("Invalid render request.")); }
    });
    request.on("error", reject);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-12000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stderr) : reject(new Error(`${command} exited with ${code}: ${stderr.slice(-3000)}`)));
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited with ${code}: ${stderr}`)));
  });
}

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Source download failed (${response.status}).`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

async function upload(url, source) {
  const details = await stat(source);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(details.size) },
    body: createReadStream(source),
    duplex: "half"
  });
  if (!response.ok) throw new Error(`Finished video upload failed (${response.status}).`);
  return details.size;
}

async function hasAudio(source) {
  try {
    const output = await runCapture("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", source]);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function dimensions(aspectRatio) {
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  if (aspectRatio === "16:9") return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

function rotationFilters(rotation) {
  if (rotation === 90) return ["transpose=1"];
  if (rotation === 180) return ["hflip", "vflip"];
  if (rotation === 270) return ["transpose=2"];
  return [];
}

function visualFilters(clip, width, height, textFile) {
  const edit = clip.edits;
  const filters = [...rotationFilters(edit.rotation)];
  const px = Math.max(0, Math.min(1, Number(edit.positionX ?? 0.5)));
  const py = Math.max(0, Math.min(1, Number(edit.positionY ?? 0.5)));
  const zoom = Math.max(1, Math.min(2, Number(edit.zoom ?? 1)));
  if (edit.crop === "fit") {
    filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`);
    filters.push(`pad=${width}:${height}:(ow-iw)*${px}:(oh-ih)*${py}:color=black`);
    if (zoom > 1) filters.push(`scale=iw*${zoom}:ih*${zoom},crop=${width}:${height}:(iw-ow)*${px}:(ih-oh)*${py}`);
  } else {
    filters.push(`scale=${Math.round(width * zoom)}:${Math.round(height * zoom)}:force_original_aspect_ratio=increase`);
    filters.push(`crop=${width}:${height}:(iw-ow)*${px}:(ih-oh)*${py}`);
  }
  filters.push(`eq=brightness=${Number(edit.brightness ?? 0) / 100}:contrast=${Number(edit.contrast ?? 100) / 100}:saturation=${Number(edit.saturation ?? 100) / 100}`);
  filters.push("setsar=1", "fps=30", "format=yuv420p");
  if (clip.type === "video" && Number(edit.speed ?? 1) !== 1) filters.push(`setpts=PTS/${Number(edit.speed)}`);
  if (clip.edits.text && textFile) {
    filters.push(`drawbox=x=iw*0.06:y=ih*0.78:w=iw*0.88:h=ih*0.13:color=black@0.48:t=fill`);
    filters.push(`drawtext=fontfile=${FONT_BOLD}:textfile=${textFile}:fontcolor=white:fontsize=${Math.round(width * .055)}:x=w*0.09:y=h*0.815`);
  }
  return filters.join(",");
}

function clipDuration(clip) {
  if (clip.type === "image") return Math.max(.8, Number(clip.edits.duration ?? 2.2));
  return Math.max(.25, (Number(clip.edits.trimEnd) - Number(clip.edits.trimStart)) / Number(clip.edits.speed || 1));
}

async function normalizeClip(clip, index, folder, width, height) {
  const extension = path.extname(clip.name || "") || (clip.type === "image" ? ".jpg" : ".mp4");
  const source = path.join(folder, `source-${index}${extension}`);
  const output = path.join(folder, `clip-${index}.mp4`);
  const textFile = path.join(folder, `clip-text-${index}.txt`);
  await Promise.all([download(clip.sourceUrl, source), writeFile(textFile, clip.edits.text || "", "utf8")]);
  const duration = clipDuration(clip);
  const filters = visualFilters(clip, width, height, textFile);
  const common = ["-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart"];

  if (clip.type === "image") {
    await run("ffmpeg", ["-y", "-loop", "1", "-i", source, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(duration), "-filter_complex", `[0:v]${filters}[v]`, "-map", "[v]", "-map", "1:a", ...common, "-shortest", output]);
  } else {
    const audio = await hasAudio(source);
    const start = Math.max(0, Number(clip.edits.trimStart || 0));
    const sourceLength = Math.max(.25, Number(clip.edits.trimEnd) - start);
    const speed = Number(clip.edits.speed || 1);
    const volume = Math.max(0, Math.min(1, Number(clip.edits.volume ?? 100) / 100));
    if (audio) {
      const graph = `[0:v]${filters}[v];[0:a]atempo=${speed},volume=${volume},aresample=44100[a]`;
      await run("ffmpeg", ["-y", "-ss", String(start), "-t", String(sourceLength), "-i", source, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", String(duration), ...common, output]);
    } else {
      await run("ffmpeg", ["-y", "-ss", String(start), "-t", String(sourceLength), "-i", source, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `[0:v]${filters}[v]`, "-map", "[v]", "-map", "1:a", "-t", String(duration), ...common, "-shortest", output]);
    }
  }
  return { output, duration };
}

const TRANSITIONS = {
  "day-pop": "smoothleft",
  "soft-story": "fade",
  "big-news": "wipeleft",
  "film-roll": "fadeblack",
  "color-block": "slideleft",
  "clean-cut": "fade"
};

async function joinClips(normalized, templateId, folder) {
  const joined = path.join(folder, "joined.mp4");
  if (normalized.length === 1) {
    await run("ffmpeg", ["-y", "-i", normalized[0].output, "-c", "copy", joined]);
    return joined;
  }
  const transition = TRANSITIONS[templateId] || "fade";
  const transitionDuration = .35;
  const inputs = normalized.flatMap((clip) => ["-i", clip.output]);
  const graph = [];
  let cumulative = normalized[0].duration;
  let videoOut = "0:v";
  let audioOut = "0:a";
  for (let index = 1; index < normalized.length; index += 1) {
    const nextVideo = `v${index}`;
    const nextAudio = `a${index}`;
    const offset = Math.max(.01, cumulative - transitionDuration);
    graph.push(`[${videoOut}][${index}:v]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${nextVideo}]`);
    graph.push(`[${audioOut}][${index}:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${nextAudio}]`);
    cumulative += normalized[index].duration - transitionDuration;
    videoOut = nextVideo;
    audioOut = nextAudio;
  }
  await run("ffmpeg", ["-y", ...inputs, "-filter_complex", graph.join(";"), "-map", `[${videoOut}]`, "-map", `[${audioOut}]`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", joined]);
  return joined;
}

async function addStoryTitles(joined, project, folder, width, height) {
  const output = path.join(folder, "quickstory.mp4");
  const headline = path.join(folder, "headline.txt");
  const subtitle = path.join(folder, "subtitle.txt");
  await Promise.all([writeFile(headline, project.title || "", "utf8"), writeFile(subtitle, project.subtitle || "", "utf8")]);
  const accent = /^#[0-9a-f]{6}$/i.test(project.accent || "") ? project.accent : "#ff4d67";
  const filter = [
    `drawbox=x=iw*0.055:y=ih*0.68:w=iw*0.89:h=ih*0.235:color=black@0.42:t=fill:enable='between(t,0,3.3)'`,
    `drawbox=x=iw*0.055:y=ih*0.665:w=iw*0.20:h=ih*0.009:color=${accent}:t=fill:enable='between(t,0,3.3)'`,
    `drawtext=fontfile=${FONT_BOLD}:textfile=${headline}:fontcolor=white:fontsize=${Math.round(width * .066)}:x=w*0.085:y=h*0.72:enable='between(t,0,3.3)'`,
    `drawtext=fontfile=${FONT_REGULAR}:textfile=${subtitle}:fontcolor=white@0.88:fontsize=${Math.round(width * .027)}:x=w*0.087:y=h*0.82:enable='between(t,0,3.3)'`
  ].join(",");
  await run("ffmpeg", ["-y", "-i", joined, "-vf", filter, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", output]);
  return output;
}

async function render(payload) {
  const { jobId, project, outputPutUrl } = payload;
  if (!jobId || !project?.clips?.length || !outputPutUrl) throw new Error("Render details are incomplete.");
  const folder = path.join("/tmp", `quickstory-${jobId.replace(/[^a-zA-Z0-9-]/g, "")}`);
  await mkdir(folder, { recursive: true });
  try {
    const { width, height } = dimensions(project.aspectRatio);
    const normalized = [];
    for (let index = 0; index < project.clips.length; index += 1) {
      normalized.push(await normalizeClip(project.clips[index], index, folder, width, height));
    }
    const joined = await joinClips(normalized, project.templateId, folder);
    const output = await addStoryTitles(joined, project, folder, width, height);
    const bytes = await upload(outputPutUrl, output);
    return { ok: true, bytes };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && (request.url === "/ping" || request.url === "/health")) return respond(response, 200, { ok: true });
  if (request.method !== "POST" || request.url !== "/render") return respond(response, 404, { error: "Not found." });
  try {
    const payload = await parseBody(request);
    const result = await render(payload);
    respond(response, 200, result);
  } catch (error) {
    console.error(error);
    respond(response, 500, { ok: false, error: error instanceof Error ? error.message : "Render failed." });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`QuickStory renderer listening on ${PORT}`));
