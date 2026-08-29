import { describe, expect, it } from "vitest";
import type { JudgmentsFile, PassFile, Session } from "./types.js";
import {
  isQuestionPassing,
  normalizeJudgment,
  passStillValid,
  verifyAnswersSemantic,
} from "./verify.js";

const session: Session = {
  diffHash: "abc",
  baseRef: "origin/main",
  generatedAt: "",
  questions: [
    {
      id: "q1",
      type: "change_rationale",
      category: "changeRationale",
      prompt: "What changed?",
      files: ["src/a.ts"],
      rubric: { requiredTerms: [], minLength: 10 },
    },
    {
      id: "q2",
      type: "architecture",
      category: "architecture",
      prompt: "How does it fit?",
      files: ["src/a.ts"],
      rubric: { requiredTerms: [], minLength: 10 },
    },
  ],
};

describe("normalizeJudgment", () => {
  it("uses explicit accuracy when provided", () => {
    expect(
      normalizeJudgment({ passed: true, accuracy: 88, alignment: "high" }),
    ).toBe(88);
  });

  it("falls back to alignment when accuracy omitted", () => {
    expect(normalizeJudgment({ passed: true, alignment: "medium" })).toBe(75);
  });
});

describe("isQuestionPassing", () => {
  it("requires accuracy at or above threshold", () => {
    expect(
      isQuestionPassing(
        { passed: true, accuracy: 65, alignment: "high" },
        70,
      ),
    ).toBe(false);
    expect(
      isQuestionPassing(
        { passed: true, accuracy: 72, alignment: "medium" },
        70,
      ),
    ).toBe(true);
  });
});

describe("passStillValid", () => {
  const basePass: PassFile = {
    diffHash: "verified-hash",
    score: 100,
    verifiedAt: "",
    questionsAnswered: 2,
    headSha: "commit-before",
    hadUncommitted: true,
  };

  it("accepts when diff hash still matches", () => {
    expect(
      passStillValid({
        pass: basePass,
        currentDiffHash: "verified-hash",
        headSha: "commit-before",
        hasUncommitted: true,
        verifiedHeadIsAncestor: true,
      }),
    ).toBe(true);
  });

  it("accepts after committing verified uncommitted work", () => {
    expect(
      passStillValid({
        pass: basePass,
        currentDiffHash: "new-hash-after-commit",
        headSha: "commit-after",
        hasUncommitted: false,
        verifiedHeadIsAncestor: true,
      }),
    ).toBe(true);
  });

  it("accepts same commit with clean tree when hash drifted", () => {
    expect(
      passStillValid({
        pass: { ...basePass, hadUncommitted: false },
        currentDiffHash: "different-hash",
        headSha: "commit-before",
        hasUncommitted: false,
        verifiedHeadIsAncestor: true,
      }),
    ).toBe(true);
  });

  it("rejects new uncommitted edits after verify", () => {
    expect(
      passStillValid({
        pass: basePass,
        currentDiffHash: "different-hash",
        headSha: "commit-before",
        hasUncommitted: true,
        verifiedHeadIsAncestor: true,
      }),
    ).toBe(false);
  });
});

describe("verifyAnswersSemantic", () => {
  it("passes when all judgments meet accuracy threshold", () => {
    const judgments: JudgmentsFile = {
      diffHash: "abc",
      gradedAt: new Date().toISOString(),
      judgments: {
        q1: {
          passed: true,
          accuracy: 90,
          userSummary: "User described the README expansion.",
          alignment: "high",
          feedback: "Good understanding.",
        },
        q2: {
          passed: true,
          accuracy: 75,
          userSummary: "User linked changes to project architecture.",
          alignment: "medium",
          feedback: "Mostly correct.",
        },
      },
    };

    const result = verifyAnswersSemantic(session, judgments, 70);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(83);
    expect(result.questionScores).toHaveLength(2);
    expect(result.questionScores?.[0].accuracy).toBe(90);
  });

  it("fails when accuracy is below threshold", () => {
    const judgments: JudgmentsFile = {
      diffHash: "abc",
      gradedAt: new Date().toISOString(),
      judgments: {
        q1: {
          passed: true,
          accuracy: 55,
          userSummary: "Partial understanding.",
          alignment: "medium",
          feedback: "Missing key concepts.",
        },
        q2: {
          passed: true,
          accuracy: 85,
          userSummary: "Okay answer.",
          alignment: "high",
          feedback: "Good.",
        },
      },
    };

    const result = verifyAnswersSemantic(session, judgments, 70);
    expect(result.passed).toBe(false);
    expect(result.failures[0].accuracy).toBe(55);
  });

  it("fails when alignment is low", () => {
    const judgments: JudgmentsFile = {
      diffHash: "abc",
      gradedAt: new Date().toISOString(),
      judgments: {
        q1: {
          passed: false,
          accuracy: 30,
          userSummary: "Vague answer.",
          alignment: "low",
          feedback: "Does not demonstrate understanding.",
        },
        q2: {
          passed: true,
          accuracy: 90,
          userSummary: "Okay answer.",
          alignment: "high",
          feedback: "Good.",
        },
      },
    };

    const result = verifyAnswersSemantic(session, judgments, 70);
    expect(result.passed).toBe(false);
    expect(result.failures[0].id).toBe("q1");
  });

  it("fails when a judgment is missing", () => {
    const judgments: JudgmentsFile = {
      diffHash: "abc",
      gradedAt: new Date().toISOString(),
      judgments: {
        q1: {
          passed: true,
          accuracy: 90,
          userSummary: "Good.",
          alignment: "high",
          feedback: "Good.",
        },
      },
    };

    const result = verifyAnswersSemantic(session, judgments, 70);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.id === "q2")).toBe(true);
  });
});
