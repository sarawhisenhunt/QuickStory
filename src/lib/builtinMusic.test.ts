import { describe, expect, it } from "vitest";
import { BUILTIN_TRACKS, createBuiltinMusicFile } from "./builtinMusic";

describe("built-in music", () => {
  it("creates original WAV files that can be saved with a project", async () => {
    const file = createBuiltinMusicFile(BUILTIN_TRACKS[0]);
    expect(file.type).toBe("audio/wav");
    expect(file.size).toBeGreaterThan(500_000);
    expect(await file.slice(0, 4).text()).toBe("RIFF");
  });
});
