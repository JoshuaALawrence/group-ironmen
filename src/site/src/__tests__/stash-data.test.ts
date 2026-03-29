import { describe, expect, it } from "vitest";
import { DIFFICULTIES, DIFFICULTY_COLORS, STASHES, getStashesByDifficulty } from "../stash-page/stash-data";

describe("stash data", () => {
  it("exposes difficulty labels, colors, and stash filtering", () => {
    expect(DIFFICULTIES).toEqual(["Beginner", "Easy", "Medium", "Hard", "Elite", "Master"]);
    expect(DIFFICULTY_COLORS.Beginner).toBe("#9e9e9e");
    expect(DIFFICULTY_COLORS.Master).toBe("#f44336");
    expect(STASHES.some((stash) => stash.enumName === "BOB_AXES_ENTRANCE")).toBe(true);
    expect(getStashesByDifficulty("Beginner")).toEqual(
      expect.arrayContaining([expect.objectContaining({ enumName: "BOB_AXES_ENTRANCE" })])
    );
    expect(getStashesByDifficulty("Easy").length).toBeGreaterThan(0);
  });
});