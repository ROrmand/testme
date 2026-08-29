import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, mergeConfig, normalizeConfig, applyGenerateOptions } from "./config.js";
import { allocateQuestions } from "./categories.js";
import { detectProject } from "./detect.js";
import { parseDiff } from "./diff.js";
import type { QuestionCandidate } from "./types.js";

describe("mergeConfig", () => {
  it("merges repo and local overrides", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      questions: { max: 3 },
      categories: { runtime: true, machineLearning: true },
    });

    expect(merged.questions.max).toBe(3);
    expect(merged.categories.runtime).toBe(true);
    expect(merged.categories.machineLearning).toBe(true);
    expect(merged.categories.changeRationale).toBe(true);
  });

  it("normalizes min <= max", () => {
    const config = normalizeConfig({
      ...DEFAULT_CONFIG,
      questions: { min: 8, max: 3 },
    });

    expect(config.questions.min).toBe(8);
    expect(config.questions.max).toBe(8);
  });
});

describe("applyGenerateOptions", () => {
  it("filters categories for one-off generate runs", () => {
    const config = applyGenerateOptions(DEFAULT_CONFIG, {
      categories: ["changeRationale", "runtime"],
      maxQuestions: 2,
    });

    expect(config.questions.max).toBe(2);
    expect(config.categories.changeRationale).toBe(true);
    expect(config.categories.runtime).toBe(true);
    expect(config.categories.symbols).toBe(false);
  });
});

describe("allocateQuestions", () => {
  it("respects max and includes change rationale first", () => {
    const candidates: QuestionCandidate[] = [
      {
        category: "architecture",
        type: "architecture",
        prompt: "arch",
        files: ["a.ts"],
        rubric: { requiredTerms: ["a"], minLength: 10 },
        priority: 70,
      },
      {
        category: "changeRationale",
        type: "change_rationale",
        prompt: "change a",
        files: ["a.ts"],
        rubric: { requiredTerms: ["a"], minLength: 10 },
        priority: 100,
      },
      {
        category: "changeRationale",
        type: "change_rationale",
        prompt: "change b",
        files: ["b.ts"],
        rubric: { requiredTerms: ["b"], minLength: 10 },
        priority: 100,
      },
    ];

    const selected = allocateQuestions(candidates, 2, 1);
    expect(selected).toHaveLength(2);
    expect(selected[0].category).toBe("changeRationale");
  });
});

describe("detectProject", () => {
  it("suggests machine learning from models path in diff", () => {
    const analysis = parseDiff(
      `diff --git a/models/train.py b/models/train.py
--- a/models/train.py
+++ b/models/train.py
@@ -1 +1,2 @@
+def train() {}
`,
      "origin/main",
    );

    const detection = detectProject(process.cwd(), analysis);
    expect(detection.suggestedCategories.machineLearning?.enabled).toBe(true);
  });

  it("suggests devops from workflow path in diff", () => {
    const analysis = parseDiff(
      `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1 +1,2 @@
+name: ci
`,
      "origin/main",
    );

    const detection = detectProject(process.cwd(), analysis);
    expect(detection.suggestedCategories.devops?.enabled).toBe(true);
  });
});
