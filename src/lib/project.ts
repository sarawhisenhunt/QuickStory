import type { AspectRatio, ClipEdits, MediaClip, StoryProject } from "../types";

export const DEFAULT_EDITS: ClipEdits = {
  trimStart: 0,
  trimEnd: 0,
  duration: 2.2,
  speed: 1,
  crop: "fill",
  positionX: 0.5,
  positionY: 0.5,
  zoom: 1,
  rotation: 0,
  brightness: 0,
  contrast: 100,
  saturation: 100,
  volume: 100,
  text: ""
};

export function createProject(): StoryProject {
  return {
    id: crypto.randomUUID(),
    title: "Today in a minute",
    subtitle: "Little moments. One good story.",
    templateId: "day-pop",
    aspectRatio: "9:16",
    accent: "#ff4d67",
    clips: [],
    updatedAt: new Date().toISOString()
  };
}

export function aspectDimensions(ratio: AspectRatio) {
  if (ratio === "1:1") return { width: 1080, height: 1080 };
  if (ratio === "16:9") return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

export function clipDuration(clip: MediaClip) {
  if (clip.type === "image") return clip.edits.duration;
  const trimmed = Math.max(0.25, clip.edits.trimEnd - clip.edits.trimStart);
  return trimmed / clip.edits.speed;
}

export function totalDuration(clips: MediaClip[], transitionDuration = 0.35) {
  if (!clips.length) return 0;
  const raw = clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
  return Math.max(0, raw - transitionDuration * (clips.length - 1));
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function serializableProject(project: StoryProject) {
  return {
    ...project,
    clips: project.clips.map(({ file: _file, objectUrl: _objectUrl, thumbnailUrl: _thumb, ...clip }) => clip),
    updatedAt: new Date().toISOString()
  };
}

export function constrain(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
