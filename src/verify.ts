import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { analyzeDiff } from "./diff.js";
import { ANSWERS_PATH, PASS_PATH, SESSION_PATH, TESTME_DIR } from "./paths.js";
import type { PassFile, Question, Session, VerifyResult } from "./types.js";

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

export function verifyAnswers(
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
    failures,
  };
}

export function loadSession(): Session {
  if (!existsSync(SESSION_PATH)) {
    throw new Error("No session found. Run `npx testme generate` first.");
  }

  return JSON.parse(readFileSync(SESSION_PATH, "utf8")) as Session;
}

export function loadAnswers(): Record<string, string> {
  if (!existsSync(ANSWERS_PATH)) {
    throw new Error("No answers found. Write answers to .testme/answers.json first.");
  }

  return JSON.parse(readFileSync(ANSWERS_PATH, "utf8")) as Record<string, string>;
}

export function verifySession(cwd: string, branch = "main"): VerifyResult {
  const session = loadSession();
  const answers = loadAnswers();
  const current = analyzeDiff(cwd, branch);

  if (session.diffHash !== current.diffHash) {
    throw new Error(
      "Session is stale. The diff changed since generate — run `npx testme generate` again.",
    );
  }

  const result = verifyAnswers(session, answers);

  if (result.passed) {
    const pass: PassFile = {
      diffHash: session.diffHash,
      score: result.score,
      verifiedAt: new Date().toISOString(),
      questionsAnswered: session.questions.length,
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

export function isPassValid(cwd: string, branch = "main"): boolean {
  const pass = loadPassFile();
  if (!pass) {
    return false;
  }

  const current = analyzeDiff(cwd, branch);
  return pass.diffHash === current.diffHash;
}
