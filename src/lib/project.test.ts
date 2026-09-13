import { describe, expect, it } from "vitest";
import { aspectDimensions, clipDuration, constrain, formatTime, totalDuration } from "./project";
import type { MediaClip } from "../types";

function clip(type: "image" | "video", overrides: Partial<MediaClip["edits"]> = {}): MediaClip {
  return {
    id: crypto.randomUUID(),
    name: "test",
    type,
    mimeType: type === "image" ? "image/jpeg" : "video/mp4",
    objectUrl: "blob:test",
    sourceDuration: 10,
    edits: {
      trimStart: 0,
      trimEnd: 10,
      duration: 2.5,
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
      text: "",
      ...overrides
    }
  };
}

describe("project timing", () => {
  it("uses the chosen photo duration", () => {
    expect(clipDuration(clip("image", { duration: 3.4 }))).toBe(3.4);
  });

  it("accounts for video trims and speed", () => {
    expect(clipDuration(clip("video", { trimStart: 2, trimEnd: 8, speed: 2 }))).toBe(3);
  });

  it("subtracts transition overlap from story duration", () => {
    expect(totalDuration([clip("image"), clip("image")], 0.5)).toBe(4.5);
  });
});

describe("project formatting", () => {
  it("returns social aspect dimensions", () => {
    expect(aspectDimensions("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(aspectDimensions("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(aspectDimensions("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("formats time and constrains values", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(constrain(12, 0, 10)).toBe(10);
  });
});
