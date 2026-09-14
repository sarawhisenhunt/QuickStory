import type { StoryTemplate } from "./types";

export const TEMPLATES: StoryTemplate[] = [
  {
    id: "day-pop",
    name: "Day Pop",
    description: "Punchy cuts, playful type, bright color",
    mood: "Recap",
    previewClass: "template-pop",
    accent: "#ff4d67",
    transition: "smoothleft",
    transitionKind: "pop",
    transitionLabel: "Snap pop",
    effectKind: "punch",
    effectLabel: "Punch zoom",
    imageDuration: 1.8,
    pace: "quick"
  },
  {
    id: "soft-story",
    name: "Soft Story",
    description: "Gentle movement and warm paper texture",
    mood: "Slideshow",
    previewClass: "template-soft",
    accent: "#f6b980",
    transition: "fade",
    transitionKind: "dissolve",
    transitionLabel: "Soft dissolve",
    effectKind: "ken-burns",
    effectLabel: "Slow drift",
    imageDuration: 3.2,
    pace: "calm"
  },
  {
    id: "big-news",
    name: "Big News",
    description: "Oversized headlines and bold reveals",
    mood: "Promo",
    previewClass: "template-news",
    accent: "#f7d84a",
    transition: "wipeleft",
    transitionKind: "wipe",
    transitionLabel: "Headline wipe",
    effectKind: "bold",
    effectLabel: "Bold reveal",
    imageDuration: 2.2,
    pace: "steady"
  },
  {
    id: "film-roll",
    name: "Film Roll",
    description: "A nostalgic reel with imperfect edges",
    mood: "Memory",
    previewClass: "template-film",
    accent: "#ff8f3d",
    transition: "fadeblack",
    transitionKind: "flash",
    transitionLabel: "Film flash",
    effectKind: "film",
    effectLabel: "Grain + warmth",
    imageDuration: 2.8,
    pace: "calm"
  },
  {
    id: "color-block",
    name: "Color Block",
    description: "Graphic panels, rhythmic crops and motion",
    mood: "Energetic",
    previewClass: "template-block",
    accent: "#9b7bff",
    transition: "slideleft",
    transitionKind: "slide",
    transitionLabel: "Color slide",
    effectKind: "color-sweep",
    effectLabel: "Rhythmic motion",
    imageDuration: 1.7,
    pace: "quick"
  },
  {
    id: "clean-cut",
    name: "Clean Cut",
    description: "Minimal polish that lets footage lead",
    mood: "Everyday",
    previewClass: "template-clean",
    accent: "#66e2c4",
    transition: "fade",
    transitionKind: "clean",
    transitionLabel: "Clean fade",
    effectKind: "subtle",
    effectLabel: "Gentle push",
    imageDuration: 2.4,
    pace: "steady"
  }
];

export function getTemplate(id: string) {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
