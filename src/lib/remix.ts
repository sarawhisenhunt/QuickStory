import type { MediaClip, StoryTemplate } from "../types";

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function remixStory(clips: MediaClip[], template: StoryTemplate, random = Math.random) {
  const sources = new Map<string, MediaClip>();
  clips.forEach((clip) => {
    const key = clip.sourceId || clip.objectUrl || clip.id;
    if (!sources.has(key)) sources.set(key, clip);
  });

  const moments: MediaClip[] = [];
  sources.forEach((source) => {
    if (source.type === "image") {
      moments.push({
        ...source,
        id: crypto.randomUUID(),
        edits: { ...source.edits, duration: template.imageDuration }
      });
      return;
    }

    const length = source.sourceDuration;
    const targetLength = template.pace === "quick" ? 2.2 : template.pace === "calm" ? 4 : 3;
    const count = length >= 15 ? (template.pace === "quick" ? 4 : 3) : length >= 7 ? 2 : 1;
    const slotSize = length / count;
    for (let index = 0; index < count; index += 1) {
      const usableLength = Math.min(targetLength, Math.max(0.8, slotSize * 0.72), length);
      const slotStart = index * slotSize;
      const available = Math.max(0, slotSize - usableLength);
      const trimStart = Math.min(Math.max(0, length - usableLength), slotStart + random() * available);
      moments.push({
        ...source,
        id: crypto.randomUUID(),
        name: count > 1 ? `${source.name.replace(/ · moment \d+$/, "")} · moment ${index + 1}` : source.name,
        edits: {
          ...source.edits,
          trimStart,
          trimEnd: Math.min(length, trimStart + usableLength),
          speed: template.pace === "quick" && random() > 0.72 ? 1.25 : 1,
          text: ""
        }
      });
    }
  });

  return shuffled(moments, random);
}
