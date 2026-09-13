export type AspectRatio = "9:16" | "1:1" | "16:9";
export type CropMode = "fill" | "fit";
export type MediaKind = "image" | "video";

export interface ClipEdits {
  trimStart: number;
  trimEnd: number;
  duration: number;
  speed: number;
  crop: CropMode;
  positionX: number;
  positionY: number;
  zoom: number;
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  volume: number;
  text: string;
}

export interface MediaClip {
  id: string;
  file?: File;
  remoteKey?: string;
  name: string;
  type: MediaKind;
  mimeType: string;
  objectUrl: string;
  thumbnailUrl?: string;
  sourceDuration: number;
  edits: ClipEdits;
}

export interface StoryProject {
  id: string;
  title: string;
  subtitle: string;
  templateId: string;
  aspectRatio: AspectRatio;
  accent: string;
  clips: MediaClip[];
  updatedAt: string;
}

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  mood: string;
  previewClass: string;
  accent: string;
  transition: string;
  imageDuration: number;
  pace: "calm" | "steady" | "quick";
}

export type RenderStatus = "idle" | "uploading" | "rendering" | "complete" | "error";
