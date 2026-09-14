import { describe, expect, it } from "vitest";
import { buildTemplateStory, mediaCounts } from "./remix";
import { TEMPLATES } from "../templates";
import { recommendTemplate } from "../templates";
import { DEFAULT_EDITS } from "./project";
import type { MediaClip } from "../types";

function video(duration: number): MediaClip {
  return {
    id: "clip",
    sourceId: "source",
    name: "long-day.mov",
    type: "video",
    mimeType: "video/quicktime",
    objectUrl: "blob:test",
    sourceDuration: duration,
    edits: { ...DEFAULT_EDITS, trimEnd: duration }
  };
}

describe("story remix", () => {
  it("pulls several distinct moments from a long video", () => {
    const result = buildTemplateStory([video(20)], TEMPLATES[0], () => 0.4);
    expect(result).toHaveLength(4);
    expect(new Set(result.map((clip) => clip.sourceId))).toEqual(new Set(["source"]));
    expect(result.every((clip) => clip.edits.trimEnd > clip.edits.trimStart)).toBe(true);
    expect(new Set(result.map((clip) => clip.edits.trimStart)).size).toBe(4);
  });

  it("does not multiply an already remixed source", () => {
    const original = video(12);
    const duplicate = { ...original, id: "duplicate", edits: { ...original.edits, trimStart: 4, trimEnd: 7 } };
    const result = buildTemplateStory([original, duplicate], TEMPLATES[1], () => 0.3);
    expect(result).toHaveLength(4);
    expect(mediaCounts(result)).toEqual({ videos: 1, photos: 0 });
  });

  it("picks storyboards from the number of original media files", () => {
    expect(recommendTemplate(1, 8).id).toBe("day-pop");
    expect(recommendTemplate(2, 8).id).toBe("soft-story");
    expect(recommendTemplate(3, 8).id).toBe("big-news");
    expect(recommendTemplate(3, 0).id).toBe("film-roll");
    expect(recommendTemplate(0, 12).id).toBe("color-block");
  });
});
