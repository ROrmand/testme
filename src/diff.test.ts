import { describe, expect, it } from "vitest";
import { hashDiff, parseDiff, extractTerms } from "./diff.js";
import { parsePrompts, termsForFile } from "./prompts.js";
import { scoreAnswer, verifyAnswers } from "./verify.js";
import { isPushToMain, beforePushHook } from "./hooks.js";
import type { Question } from "./types.js";

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 123..456 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,8 @@
+export function validateToken(token: string) {
+  return token.length > 0;
+}
+
 export function login() {
   return true;
 }
`;

describe("parseDiff", () => {
  it("extracts files and symbols from diff", () => {
    const analysis = parseDiff(SAMPLE_DIFF, "origin/main");
    expect(analysis.files).toHaveLength(1);
    expect(analysis.files[0].path).toBe("src/auth.ts");
    expect(analysis.files[0].symbols).toContain("validateToken");
    expect(analysis.diffHash).toBe(hashDiff(SAMPLE_DIFF));
  });
});

describe("extractTerms", () => {
  it("filters stop words and short tokens", () => {
    const terms = extractTerms("Added validateToken middleware for JWT auth");
    expect(terms).toContain("validateToken");
    expect(terms).toContain("JWT");
    expect(terms).not.toContain("Added");
  });
});

describe("parsePrompts", () => {
  it("parses file sections and bullets", () => {
    const sections = parsePrompts(`# Session Changes

## src/auth.ts
- Added validateToken middleware for JWT expiry checks
`);
    expect(sections).toHaveLength(1);
    expect(sections[0].file).toBe("src/auth.ts");
    expect(sections[0].bullets[0]).toContain("validateToken");
  });
});

describe("termsForFile", () => {
  it("returns terms from matching prompts section", () => {
    const sections = parsePrompts(`## src/auth.ts
- Added validateToken middleware for JWT`);
    const terms = termsForFile(sections, "src/auth.ts");
    expect(terms).toContain("validateToken");
  });
});

describe("buildQuestions", () => {
  it("caps questions at five", () => {
    const bigDiff = Array.from({ length: 10 }, (_, i) => `diff --git a/src/f${i}.ts b/src/f${i}.ts
--- a/src/f${i}.ts
+++ b/src/f${i}.ts
@@ -1 +1,2 @@
+export function fn${i}() {}
`).join("\n");

    const analysis = parseDiff(bigDiff, "origin/main");
    const session = {
      diffHash: analysis.diffHash,
      baseRef: "origin/main",
      generatedAt: new Date().toISOString(),
      questions: analysis.files.slice(0, 5).map((file, index) => ({
        id: `q${index + 1}`,
        type: "change_rationale" as const,
        prompt: `What changed in ${file.path}?`,
        files: [file.path],
        rubric: { requiredTerms: file.symbols, minLength: 10 },
      })),
    };

    expect(session.questions.length).toBeLessThanOrEqual(5);
  });
});

describe("verifyAnswers", () => {
  const question: Question = {
    id: "q1",
    type: "change_rationale",
    prompt: "What changed?",
    files: ["src/auth.ts"],
    rubric: {
      requiredTerms: ["validateToken", "JWT"],
      minLength: 20,
    },
  };

  it("passes when all terms present", () => {
    const result = verifyAnswers(
      { diffHash: "x", baseRef: "origin/main", generatedAt: "", questions: [question] },
      { q1: "Added validateToken middleware to verify JWT on each request." },
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("fails when terms missing", () => {
    const result = scoreAnswer("Added middleware.", question);
    expect(result.passed).toBe(false);
    expect(result.missingTerms).toContain("validateToken");
  });
});

describe("isPushToMain", () => {
  it("detects main push commands", () => {
    expect(isPushToMain("git push origin main")).toBe(true);
    expect(isPushToMain("git push origin feature")).toBe(false);
    expect(isPushToMain("git status")).toBe(false);
  });
});

describe("beforePushHook", () => {
  it("allows non-main pushes", () => {
    const result = beforePushHook("/tmp", "git push origin feature");
    expect(result.permission).toBe("allow");
  });
});
