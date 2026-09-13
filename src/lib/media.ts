import { DEFAULT_EDITS } from "./project";
import type { MediaClip, StoryTemplate } from "../types";

function readVideoDuration(url: string) {
  return new Promise<number>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : 5);
    video.onerror = () => resolve(5);
    video.src = url;
  });
}

export async function fileToClip(file: File, template: StoryTemplate): Promise<MediaClip | null> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) return null;
  const objectUrl = URL.createObjectURL(file);
  const sourceDuration = isVideo ? await readVideoDuration(objectUrl) : template.imageDuration;
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    type: isVideo ? "video" : "image",
    mimeType: file.type,
    objectUrl,
    sourceDuration,
    edits: {
      ...DEFAULT_EDITS,
      trimEnd: isVideo ? sourceDuration : 0,
      duration: template.imageDuration
    }
  };
}
