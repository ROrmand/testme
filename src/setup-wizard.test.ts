import { describe, expect, it } from "vitest";
import {
  applyWizardToConfig,
  minAlignmentForDifficulty,
  parseDifficultyOption,
  parseQuestionsOption,
  questionsFromCount,
} from "./setup-wizard.js";
import { DEFAULT_CONFIG } from "./config.js";

describe("setup wizard mapping", () => {
  it("maps question counts", () => {
    expect(questionsFromCount(2)).toEqual({ min: 2, max: 2 });
    expect(questionsFromCount(3)).toEqual({ min: 2, max: 3 });
    expect(questionsFromCount(5)).toEqual({ min: 3, max: 5 });
  });

  it("parses question option", () => {
    expect(parseQuestionsOption("4")).toEqual({ min: 3, max: 4 });
  });

  it("maps difficulty to alignment", () => {
    expect(minAlignmentForDifficulty("easy")).toBe("low");
    expect(minAlignmentForDifficulty("hard")).toBe("high");
  });

  it("applies easy difficulty settings", () => {
    const config = applyWizardToConfig(DEFAULT_CONFIG, {
      questions: { min: 2, max: 2 },
      difficulty: "easy",
    });

    expect(config.passThreshold).toBe(60);
    expect(config.minAlignment).toBe("low");
    expect(config.categories.changeRationale).toBe(true);
    expect(config.categories.architecture).toBe(false);
  });

  it("applies hard difficulty settings", () => {
    const config = applyWizardToConfig(DEFAULT_CONFIG, {
      questions: { min: 3, max: 5 },
      difficulty: "hard",
    });

    expect(config.passThreshold).toBe(85);
    expect(config.minAlignment).toBe("high");
    expect(config.categories.architecture).toBe(true);
    expect(config.categories.security).toBe(true);
  });

  it("parses difficulty option", () => {
    expect(parseDifficultyOption("medium")).toBe("medium");
    expect(() => parseDifficultyOption("extreme")).toThrow();
  });
});
