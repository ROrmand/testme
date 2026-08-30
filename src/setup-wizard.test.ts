import { describe, expect, it } from "vitest";
import {
  applyWizardToConfig,
  DEFAULT_WIZARD_CHOICES,
  minAlignmentForDifficulty,
  parseDifficultyOption,
  parseLocalOnlyOption,
  parseQuestionsOption,
  parseSummaryModeOption,
  questionsFromCount,
  terminalLink,
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
      localOnly: true,
      summaryMode: "blank",
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
      localOnly: true,
      summaryMode: "blank",
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

  it("parses local-only option", () => {
    expect(parseLocalOnlyOption("true")).toBe(true);
    expect(parseLocalOnlyOption("no")).toBe(false);
    expect(() => parseLocalOnlyOption("maybe")).toThrow();
  });

  it("parses summary mode option", () => {
    expect(parseSummaryModeOption("blank")).toBe("blank");
    expect(parseSummaryModeOption("generate")).toBe("generate");
    expect(() => parseSummaryModeOption("auto")).toThrow();
  });

  it("defaults summary mode to blank", () => {
    expect(DEFAULT_WIZARD_CHOICES.summaryMode).toBe("blank");
  });

  it("formats terminal hyperlinks", () => {
    const link = terminalLink("https://example.com", "docs");
    expect(link).toContain("https://example.com");
    expect(link).toContain("docs");
  });
});
