import type { StoryTemplate } from "./types";

export const TEMPLATES: StoryTemplate[] = [
  {
    id: "day-pop",
    name: "One Video Story",
    description: "One video becomes four moments between your photos",
    mood: "Fast recap",
    previewClass: "template-pop",
    accent: "#ff4d67",
    transition: "smoothleft",
    transitionKind: "pop",
    transitionLabel: "Snap pop",
    effectKind: "punch",
    effectLabel: "Punch zoom",
    imageDuration: 1.8,
    pace: "quick",
    videoRange: [1, 1], photoRange: [5, 15], videoBeats: 4,
    fitLabel: "1 video · 5–15 photos"
  },
  {
    id: "soft-story",
    name: "Two Video Memories",
    description: "Two videos anchor a warm, photo-led story",
    mood: "Memory recap",
    previewClass: "template-soft",
    accent: "#f6b980",
    transition: "fade",
    transitionKind: "dissolve",
    transitionLabel: "Soft dissolve",
    effectKind: "ken-burns",
    effectLabel: "Slow drift",
    imageDuration: 3.2,
    pace: "calm",
    videoRange: [2, 2], photoRange: [4, 15], videoBeats: 4,
    fitLabel: "2 videos · 4–15 photos"
  },
  {
    id: "big-news",
    name: "Three Video Highlight",
    description: "Three videos and photo bursts with bold reveals",
    mood: "Big recap",
    previewClass: "template-news",
    accent: "#f7d84a",
    transition: "wipeleft",
    transitionKind: "wipe",
    transitionLabel: "Headline wipe",
    effectKind: "bold",
    effectLabel: "Bold reveal",
    imageDuration: 2.2,
    pace: "steady",
    videoRange: [3, 3], photoRange: [4, 15], videoBeats: 6,
    fitLabel: "3 videos · 4–15 photos"
  },
  {
    id: "film-roll",
    name: "Three Video Rush",
    description: "Nine quick moments pulled from three videos",
    mood: "All video",
    previewClass: "template-film",
    accent: "#ff8f3d",
    transition: "fadeblack",
    transitionKind: "flash",
    transitionLabel: "Film flash",
    effectKind: "film",
    effectLabel: "Grain + warmth",
    imageDuration: 2.8,
    pace: "quick",
    videoRange: [3, 3], photoRange: [0, 0], videoBeats: 9,
    fitLabel: "3 videos · no photos"
  },
  {
    id: "color-block",
    name: "Photo Pop",
    description: "A fast photo-only recap with rhythmic motion",
    mood: "Photo recap",
    previewClass: "template-block",
    accent: "#9b7bff",
    transition: "slideleft",
    transitionKind: "slide",
    transitionLabel: "Color slide",
    effectKind: "color-sweep",
    effectLabel: "Rhythmic motion",
    imageDuration: 1.7,
    pace: "quick",
    videoRange: [0, 0], photoRange: [5, 20], videoBeats: 0,
    fitLabel: "5–20 photos · no video"
  },
  {
    id: "clean-cut",
    name: "Anything Goes",
    description: "A flexible clean edit for any media combination",
    mood: "Flexible recap",
    previewClass: "template-clean",
    accent: "#66e2c4",
    transition: "fade",
    transitionKind: "clean",
    transitionLabel: "Clean fade",
    effectKind: "subtle",
    effectLabel: "Gentle push",
    imageDuration: 2.4,
    pace: "steady",
    videoRange: [0, 20], photoRange: [0, 30], videoBeats: 5,
    fitLabel: "Any mix of photos + video"
  }
];

export function getTemplate(id: string) {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}

function rangeDistance(value: number, [minimum, maximum]: [number, number]) {
  if (value < minimum) return minimum - value;
  if (value > maximum) return value - maximum;
  return 0;
}

export function recommendTemplate(videoCount: number, photoCount: number) {
  if (!videoCount && !photoCount) return TEMPLATES[0];
  return TEMPLATES.reduce((best, candidate) => {
    const score = rangeDistance(videoCount, candidate.videoRange) * 12
      + rangeDistance(photoCount, candidate.photoRange) * 4
      + (candidate.id === "clean-cut" ? 3 : 0);
    const bestScore = rangeDistance(videoCount, best.videoRange) * 12
      + rangeDistance(photoCount, best.photoRange) * 4
      + (best.id === "clean-cut" ? 3 : 0);
    return score < bestScore ? candidate : best;
  }, TEMPLATES[0]);
}
