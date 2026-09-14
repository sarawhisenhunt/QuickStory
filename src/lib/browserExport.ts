import { clipDuration } from "./project";
import { getTemplate } from "../templates";
import type { AspectRatio, MediaClip, StoryProject } from "../types";

export interface BrowserExportResult {
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  formatLabel: "MP4" | "WebM";
}

const FRAME_RATE = 30;

export function exportDimensions(ratio: AspectRatio) {
  if (ratio === "1:1") return { width: 720, height: 720 };
  if (ratio === "16:9") return { width: 1280, height: 720 };
  return { width: 720, height: 1280 };
}

export function supportedRecordingType(isSupported = (type: string) => MediaRecorder.isTypeSupported(type)) {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return candidates.find(isSupported) ?? "";
}

function waitFor(target: EventTarget, eventName: string, errorName = "error") {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("A source clip could not be opened by this browser.")); };
    const cleanup = () => {
      target.removeEventListener(eventName, done);
      target.removeEventListener(errorName, failed);
    };
    target.addEventListener(eventName, done, { once: true });
    target.addEventListener(errorName, failed, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.04) return;
  const ready = waitFor(video, "seeked");
  video.currentTime = time;
  await ready;
}

function sourceUrl(clip: MediaClip) {
  if (clip.objectUrl) return clip.objectUrl;
  if (clip.file) return URL.createObjectURL(clip.file);
  throw new Error(`The original file for ${clip.name} is no longer available. Add it again before exporting.`);
}

function loadImage(clip: MediaClip) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${clip.name} could not be decoded by this browser.`));
    image.src = sourceUrl(clip);
  });
}

async function loadVideo(clip: MediaClip) {
  const video = document.createElement("video");
  video.src = sourceUrl(clip);
  video.preload = "auto";
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.muted = false;
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitFor(video, "loadedmetadata");
  await seekVideo(video, clip.edits.trimStart);
  return video;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  clip: MediaClip,
  width: number,
  height: number
) {
  const { edits } = clip;
  const baseScale = edits.crop === "fill"
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * baseScale;
  const drawHeight = sourceHeight * baseScale;
  const overflowX = Math.max(0, drawWidth - width);
  const overflowY = Math.max(0, drawHeight - height);
  const x = -drawWidth / 2 + (0.5 - edits.positionX) * overflowX;
  const y = -drawHeight / 2 + (0.5 - edits.positionY) * overflowY;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(edits.rotation * Math.PI / 180);
  ctx.scale(edits.zoom, edits.zoom);
  ctx.filter = `brightness(${100 + edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%)`;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
  ctx.restore();
  ctx.filter = "none";
}

function drawOverlay(ctx: CanvasRenderingContext2D, project: StoryProject, clip: MediaClip, width: number, height: number, elapsed: number, duration: number) {
  const template = getTemplate(project.templateId);
  const shortSide = Math.min(width, height);
  const padding = Math.round(shortSide * 0.065);
  const title = clip.edits.text || project.title;
  const titleSize = Math.round(shortSide * (project.templateId === "big-news" ? 0.105 : 0.078));
  const subtitleSize = Math.round(shortSide * 0.033);

  const shade = ctx.createLinearGradient(0, height * 0.38, 0, height);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, project.templateId === "soft-story" ? "rgba(43,26,18,.72)" : "rgba(0,0,0,.78)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  if (project.templateId === "color-block") {
    ctx.fillStyle = `${project.accent}dd`;
    ctx.fillRect(0, 0, Math.round(width * 0.07), height);
    ctx.fillRect(Math.round(width * 0.92), 0, Math.round(width * 0.08), height);
  } else if (project.templateId === "film-roll") {
    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = Math.max(2, shortSide * 0.006);
    ctx.strokeRect(padding * 0.45, padding * 0.45, width - padding * 0.9, height - padding * 0.9);
  } else if (project.templateId === "big-news") {
    ctx.fillStyle = project.accent;
    ctx.fillRect(0, height * 0.69, width, Math.max(9, height * 0.012));
  }

  ctx.textBaseline = "top";
  ctx.fillStyle = project.accent;
  ctx.font = `800 ${Math.round(shortSide * 0.027)}px Arial, sans-serif`;
  ctx.fillText(template.mood.toUpperCase(), padding, height * 0.69);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${titleSize}px Arial, sans-serif`;
  const lines = wrapText(ctx, title, width - padding * 2, 3);
  const lineHeight = titleSize * 1.02;
  const titleY = height * 0.735;
  lines.forEach((line, index) => ctx.fillText(line, padding, titleY + index * lineHeight));

  if (!clip.edits.text && project.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = `500 ${subtitleSize}px Arial, sans-serif`;
    const subtitleY = Math.min(height - padding - subtitleSize, titleY + lines.length * lineHeight + subtitleSize * 0.55);
    ctx.fillText(project.subtitle, padding, subtitleY, width - padding * 2);
  }

  if (project.templateId === "day-pop" || project.templateId === "clean-cut") {
    ctx.fillStyle = project.accent;
    roundedRect(ctx, padding, height - padding * 0.55, width - padding * 2, Math.max(7, shortSide * 0.012), shortSide * 0.01);
    ctx.fill();
  }

  const fadeWindow = Math.min(0.18, duration / 5);
  const fade = Math.min(1, elapsed / fadeWindow, (duration - elapsed) / fadeWindow);
  if (fade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function nextFrame() {
  return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

function safeProjectName(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "quickstory";
}

export async function exportInBrowser(project: StoryProject, onProgress: (percent: number) => void): Promise<BrowserExportResult> {
  if (!project.clips.length) throw new Error("Add at least one photo or video before exporting.");
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser cannot make videos locally. Try the latest Chrome, Edge, or Safari.");
  }

  const mimeType = supportedRecordingType();
  if (!mimeType) throw new Error("This browser does not offer a supported video recording format.");
  const { width, height } = exportDimensions(project.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("QuickStory could not start the browser renderer.");

  const canvasStream = canvas.captureStream(FRAME_RATE);
  const audioContext = new AudioContext();
  const audioOutput = audioContext.createMediaStreamDestination();
  const outputStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioOutput.stream.getAudioTracks()]);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: project.aspectRatio === "1:1" ? 5_000_000 : 7_000_000,
    audioBitsPerSecond: 128_000
  });
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("The browser stopped recording unexpectedly."));
  });

  const durations = project.clips.map(clipDuration);
  const total = durations.reduce((sum, value) => sum + value, 0);
  let completed = 0;
  await audioContext.resume();
  recorder.start(1000);

  try {
    for (let index = 0; index < project.clips.length; index += 1) {
      const clip = project.clips[index];
      const duration = durations[index];
      let media: HTMLImageElement | HTMLVideoElement;
      let gain: GainNode | undefined;

      if (clip.type === "image") {
        media = await loadImage(clip);
      } else {
        media = await loadVideo(clip);
        media.playbackRate = clip.edits.speed;
        gain = audioContext.createGain();
        gain.gain.value = Math.max(0, Math.min(1, clip.edits.volume / 100));
        const source = audioContext.createMediaElementSource(media);
        source.connect(gain).connect(audioOutput);
        await media.play();
      }

      const started = performance.now();
      let elapsed = 0;
      while (elapsed < duration) {
        ctx.fillStyle = "#0d0d0f";
        ctx.fillRect(0, 0, width, height);
        const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
        const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
        drawMedia(ctx, media, sourceWidth, sourceHeight, clip, width, height);
        drawOverlay(ctx, project, clip, width, height, elapsed, duration);
        onProgress(Math.min(99, ((completed + elapsed) / total) * 100));
        await nextFrame();
        elapsed = (performance.now() - started) / 1000;
      }

      if (media instanceof HTMLVideoElement) {
        media.pause();
        media.removeAttribute("src");
        media.load();
        gain?.disconnect();
      }
      completed += duration;
    }
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    await stopped.catch(() => undefined);
    throw error;
  } finally {
    if (recorder.state !== "inactive") recorder.stop();
  }

  await stopped;
  outputStream.getTracks().forEach((track) => track.stop());
  await audioContext.close();
  if (!chunks.length) throw new Error("The browser finished without producing a video file.");

  const blob = new Blob(chunks, { type: mimeType });
  const isMp4 = mimeType.startsWith("video/mp4");
  onProgress(100);
  return {
    downloadUrl: URL.createObjectURL(blob),
    fileName: `${safeProjectName(project.title)}.${isMp4 ? "mp4" : "webm"}`,
    mimeType,
    formatLabel: isMp4 ? "MP4" : "WebM"
  };
}
