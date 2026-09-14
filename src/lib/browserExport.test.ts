import { describe, expect, it } from "vitest";
import { exportDimensions, supportedRecordingType } from "./browserExport";

describe("browser export helpers", () => {
  it("uses practical HD dimensions for every aspect ratio", () => {
    expect(exportDimensions("9:16")).toEqual({ width: 720, height: 1280 });
    expect(exportDimensions("1:1")).toEqual({ width: 720, height: 720 });
    expect(exportDimensions("16:9")).toEqual({ width: 1280, height: 720 });
  });

  it("prefers MP4 when the browser supports it", () => {
    expect(supportedRecordingType((type) => type === "video/mp4")).toBe("video/mp4");
  });

  it("falls back to WebM when MP4 is unavailable", () => {
    expect(supportedRecordingType((type) => type === "video/webm;codecs=vp8,opus"))
      .toBe("video/webm;codecs=vp8,opus");
  });

  it("reports an empty type when recording is unavailable", () => {
    expect(supportedRecordingType(() => false)).toBe("");
  });
});
