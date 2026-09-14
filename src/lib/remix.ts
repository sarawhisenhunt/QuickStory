import type { MediaClip, StoryTemplate } from "../types";

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function sourceClips(clips: MediaClip[]) {
  const sources = new Map<string, MediaClip>();
  clips.forEach((clip) => {
    const key = clip.sourceId || clip.objectUrl || clip.id;
    if (!sources.has(key)) sources.set(key, clip);
  });
  return [...sources.values()];
}

export function mediaCounts(clips: MediaClip[]) {
  const sources = sourceClips(clips);
  return {
    videos: sources.filter((clip) => clip.type === "video").length,
    photos: sources.filter((clip) => clip.type === "image").length
  };
}

function videoMoment(source: MediaClip, momentIndex: number, momentCount: number, template: StoryTemplate, random: () => number) {
  const length = Math.max(0.8, source.sourceDuration);
  const targetLength = template.pace === "quick" ? 1.9 : template.pace === "calm" ? 3.4 : 2.6;
  const sectionLength = length / momentCount;
  const duration = Math.min(targetLength, Math.max(0.8, sectionLength * 0.78), length);
  const sectionStart = sectionLength * momentIndex;
  const trimStart = Math.min(length - duration, sectionStart + Math.max(0, sectionLength - duration) * random());
  return {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name.replace(/ · moment \d+$/, "")} · moment ${momentIndex + 1}`,
    edits: {
      ...source.edits,
      trimStart,
      trimEnd: Math.min(length, trimStart + duration),
      speed: template.pace === "quick" && random() > 0.76 ? 1.2 : 1,
      text: ""
    }
  };
}

function makeVideoMoments(videos: MediaClip[], requestedBeats: number, template: StoryTemplate, random: () => number) {
  if (!videos.length || !requestedBeats) return [];
  const beatCount = Math.max(videos.length, requestedBeats);
  const momentsPerSource = videos.map((_, sourceIndex) => {
    let count = 0;
    for (let beat = sourceIndex; beat < beatCount; beat += videos.length) count += 1;
    return count;
  });
  const used = new Array(videos.length).fill(0);
  const result: MediaClip[] = [];
  for (let beat = 0; beat < beatCount; beat += 1) {
    const sourceIndex = beat % videos.length;
    result.push(videoMoment(videos[sourceIndex], used[sourceIndex], momentsPerSource[sourceIndex], template, random));
    used[sourceIndex] += 1;
  }
  return result;
}

function weave(images: MediaClip[], videos: MediaClip[]) {
  if (!images.length) return videos;
  if (!videos.length) return images;
  const total = images.length + videos.length;
  const videoPositions = new Set(videos.map((_, index) => Math.min(total - 1, Math.round(index * (total - 1) / Math.max(1, videos.length - 1)))));
  const result: MediaClip[] = [];
  let imageIndex = 0;
  let videoIndex = 0;
  for (let index = 0; index < total; index += 1) {
    if (videoPositions.has(index) && videoIndex < videos.length) result.push(videos[videoIndex++]);
    else if (imageIndex < images.length) result.push(images[imageIndex++]);
    else if (videoIndex < videos.length) result.push(videos[videoIndex++]);
  }
  return result;
}

export function buildTemplateStory(clips: MediaClip[], template: StoryTemplate, random = Math.random) {
  const sources = sourceClips(clips);
  const videos = shuffled(sources.filter((clip) => clip.type === "video"), random);
  const photos = shuffled(sources.filter((clip) => clip.type === "image"), random).map((source) => ({
    ...source,
    id: crypto.randomUUID(),
    edits: { ...source.edits, duration: template.imageDuration, text: "" }
  }));
  const requestedBeats = videos.length
    ? Math.max(videos.length, template.id === "clean-cut" ? Math.min(template.videoBeats, videos.length * 2) : template.videoBeats)
    : 0;
  return weave(photos, makeVideoMoments(videos, requestedBeats, template, random));
}

export const remixStory = buildTemplateStory;
