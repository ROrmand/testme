import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { analyzeDiff, getHeadSha, hasUncommittedChanges, isGitAncestor } from "./diff.js";
import {
  ANSWERS_PATH,
  JUDGMENTS_PATH,
  PASS_PATH,
  REFERENCES_PATH,
  SESSION_PATH,
  TESTME_DIR,
} from "./paths.js";
import type {
  GradingMode,
  JudgmentsFile,
  PassFile,
  Question,
  ReferencesFile,
  Session,
  VerifyResult,
  AlignmentLevel,
} from "./types.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(answer: string, term: string): boolean {
  if (term.includes("/") || term.includes(".")) {
    return answer.toLowerCase().includes(term.toLowerCase());
  }

  const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  return pattern.test(answer);
}

export function scoreAnswer(answer: string, question: Question): {
  passed: boolean;
  missingTerms: string[];
  tooShort: boolean;
  missingSymbol?: string;
} {
  const trimmed = answer.trim();
  const missingTerms = question.rubric.requiredTerms.filter(
    (term) => !hasTerm(trimmed, term),
  );
  const tooShort = trimmed.length < question.rubric.minLength;
  let missingSymbol: string | undefined;

  if (question.rubric.requiredSymbol && !hasTerm(trimmed, question.rubric.requiredSymbol)) {
    missingSymbol = question.rubric.requiredSymbol;
  }

  const passed = missingTerms.length === 0 && !tooShort && !missingSymbol;

  return { passed, missingTerms, tooShort, missingSymbol };
}

export function verifyAnswersKeywords(
  session: Session,
  answers: Record<string, string>,
): VerifyResult {
  const failures: VerifyResult["failures"] = [];
  let passedCount = 0;

  for (const question of session.questions) {
    const answer = answers[question.id] ?? "";
    const result = scoreAnswer(answer, question);

    if (result.passed) {
      passedCount += 1;
      continue;
    }

    failures.push({
      id: question.id,
      prompt: question.prompt,
      missingTerms: result.missingTerms,
      tooShort: result.tooShort,
      missingSymbol: result.missingSymbol,
    });
  }

  const total = session.questions.length;
  const passed = failures.length === 0 && total > 0;

  return {
    passed,
    score: total === 0 ? 0 : Math.round((passedCount / total) * 100),
    total,
    grading: "keywords",
    failures,
  };
}

const ALIGNMENT_SCORE: Record<string, number> = {
  high: 100,
  medium: 75,
  low: 0,
};

function clampAccuracy(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeJudgment(judgment: {
  passed: boolean;
  accuracy?: number;
  alignment: "low" | "medium" | "high";
}): number {
  if (judgment.accuracy !== undefined) {
    return clampAccuracy(judgment.accuracy);
  }

  return ALIGNMENT_SCORE[judgment.alignment] ?? 0;
}

const ALIGNMENT_RANK: Record<AlignmentLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function alignmentMeetsMinimum(
  alignment: "low" | "medium" | "high",
  minAlignment: AlignmentLevel = "medium",
): boolean {
  return ALIGNMENT_RANK[alignment] >= ALIGNMENT_RANK[minAlignment];
}

export function isQuestionPassing(
  judgment: {
    passed: boolean;
    accuracy?: number;
    alignment: "low" | "medium" | "high";
  },
  passThreshold: number,
  minAlignment: AlignmentLevel = "medium",
): boolean {
  const accuracy = normalizeJudgment(judgment);
  return (
    judgment.passed &&
    accuracy >= passThreshold &&
    alignmentMeetsMinimum(judgment.alignment, minAlignment)
  );
}

export function verifyAnswersSemantic(
  session: Session,
  judgments: JudgmentsFile,
  passThreshold = 70,
  minAlignment: AlignmentLevel = "medium",
): VerifyResult {
  const failures: VerifyResult["failures"] = [];
  const questionScores: NonNullable<VerifyResult["questionScores"]> = [];
  let accuracySum = 0;

  for (const question of session.questions) {
    const judgment = judgments.judgments[question.id];

    if (!judgment) {
      failures.push({
        id: question.id,
        prompt: question.prompt,
        feedback: "No semantic judgment recorded for this question.",
      });
      continue;
    }

    const accuracy = normalizeJudgment(judgment);
    const passed = isQuestionPassing(judgment, passThreshold, minAlignment);

    questionScores.push({
      id: question.id,
      prompt: question.prompt,
      accuracy,
      alignment: judgment.alignment,
      passed,
      userSummary: judgment.userSummary,
      feedback: judgment.feedback,
    });

    accuracySum += accuracy;

    if (passed) {
      continue;
    }

    failures.push({
      id: question.id,
      prompt: question.prompt,
      feedback: judgment.feedback,
      alignment: judgment.alignment,
      userSummary: judgment.userSummary,
      accuracy,
    });
  }

  const total = session.questions.length;
  const passed = failures.length === 0 && total > 0;

  return {
    passed,
    score: total === 0 ? 0 : Math.round(accuracySum / total),
    total,
    grading: "semantic",
    passThreshold,
    questionScores,
    failures,
  };
}

export function loadSession(): Session {
  if (!existsSync(SESSION_PATH)) {
    throw new Error("No session found. Run `npx comp-gate generate` first.");
  }

  return JSON.parse(readFileSync(SESSION_PATH, "utf8")) as Session;
}

export function loadAnswers(): Record<string, string> {
  if (!existsSync(ANSWERS_PATH)) {
    throw new Error("No answers found. Collect answers in chat first.");
  }

  return JSON.parse(readFileSync(ANSWERS_PATH, "utf8")) as Record<string, string>;
}

export function loadReferences(): ReferencesFile | null {
  if (!existsSync(REFERENCES_PATH)) {
    return null;
  }

  return JSON.parse(readFileSync(REFERENCES_PATH, "utf8")) as ReferencesFile;
}

export function loadJudgments(): JudgmentsFile {
  if (!existsSync(JUDGMENTS_PATH)) {
    throw new Error(
      "No judgments found. The agent must grade answers semantically and write .testme/judgments.json before verify.",
    );
  }

  return JSON.parse(readFileSync(JUDGMENTS_PATH, "utf8")) as JudgmentsFile;
}

export function writeJudgments(judgments: JudgmentsFile): void {
  mkdirSync(TESTME_DIR, { recursive: true });
  writeFileSync(JUDGMENTS_PATH, `${JSON.stringify(judgments, null, 2)}\n`, "utf8");
}

export function writeReferences(references: ReferencesFile): void {
  mkdirSync(TESTME_DIR, { recursive: true });
  writeFileSync(REFERENCES_PATH, `${JSON.stringify(references, null, 2)}\n`, "utf8");
}

export function verifySession(cwd: string, branch = "main"): VerifyResult {
  const session = loadSession();
  const answers = loadAnswers();
  const config = loadConfig(cwd);
  const current = analyzeDiff(cwd, branch);

  if (session.diffHash !== current.diffHash) {
    throw new Error(
      "Session is stale. The diff changed since generate — run `npx comp-gate generate` again.",
    );
  }

  const answerIds = new Set(Object.keys(answers));
  for (const question of session.questions) {
    if (!answerIds.has(question.id) || !answers[question.id]?.trim()) {
      throw new Error(`Missing answer for ${question.id}.`);
    }
  }

  let result: VerifyResult;

  if (config.grading === "keywords") {
    result = verifyAnswersKeywords(session, answers);
  } else {
    const judgments = loadJudgments();
    if (judgments.diffHash !== session.diffHash) {
      throw new Error(
        "Judgments are stale. Re-grade answers against the current session.",
      );
    }
    result = verifyAnswersSemantic(
      session,
      judgments,
      config.passThreshold,
      config.minAlignment ?? "medium",
    );
  }

  if (result.passed) {
    const pass: PassFile = {
      diffHash: session.diffHash,
      score: result.score,
      verifiedAt: new Date().toISOString(),
      questionsAnswered: session.questions.length,
      headSha: getHeadSha(cwd),
      hadUncommitted: hasUncommittedChanges(cwd),
    };

    mkdirSync(TESTME_DIR, { recursive: true });
    writeFileSync(PASS_PATH, `${JSON.stringify(pass, null, 2)}\n`, "utf8");
  }

  return result;
}

export function loadPassFile(): PassFile | null {
  if (!existsSync(PASS_PATH)) {
    return null;
  }

  return JSON.parse(readFileSync(PASS_PATH, "utf8")) as PassFile;
}

export function passStillValid(options: {
  pass: PassFile;
  currentDiffHash: string;
  headSha: string;
  hasUncommitted: boolean;
  verifiedHeadIsAncestor: boolean;
}): boolean {
  const { pass, currentDiffHash, headSha, hasUncommitted, verifiedHeadIsAncestor } =
    options;

  if (pass.diffHash === currentDiffHash) {
    return true;
  }

  if (!pass.headSha) {
    return false;
  }

  if (
    pass.hadUncommitted &&
    !hasUncommitted &&
    headSha !== pass.headSha &&
    verifiedHeadIsAncestor
  ) {
    return true;
  }

  if (pass.headSha === headSha && !hasUncommitted) {
    return true;
  }

  return false;
}

export function evaluatePassValidity(
  pass: PassFile,
  cwd: string,
  branch = "main",
): boolean {
  const headSha = getHeadSha(cwd);
  return passStillValid({
    pass,
    currentDiffHash: analyzeDiff(cwd, branch).diffHash,
    headSha,
    hasUncommitted: hasUncommittedChanges(cwd),
    verifiedHeadIsAncestor: pass.headSha
      ? isGitAncestor(pass.headSha, headSha, cwd)
      : false,
  });
}

export function isPassValid(cwd: string, branch = "main"): boolean {
  const pass = loadPassFile();
  if (!pass) {
    return false;
  }

  return evaluatePassValidity(pass, cwd, branch);
}

// Backwards-compatible export used in tests
export function verifyAnswers(
  session: Session,
  answers: Record<string, string>,
): VerifyResult {
  return verifyAnswersKeywords(session, answers);
}
