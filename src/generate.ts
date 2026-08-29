import { mkdirSync, writeFileSync } from "node:fs";
import { allocateQuestions, buildCandidates, relevantFiles } from "./categories.js";
import { applyGenerateOptions, enabledCategories, loadConfig } from "./config.js";
import { analyzeDiff } from "./diff.js";
import { applyDetectionToConfig, detectProject } from "./detect.js";
import { loadPromptsSections, loadSummary } from "./prompts.js";
import { SESSION_PATH, TESTME_DIR } from "./paths.js";
import type { CategoryKey, GenerateOptions, Question, Session, TestmeConfig } from "./types.js";

export function resolveConfig(cwd: string, options: GenerateOptions = {}): TestmeConfig {
  let config = loadConfig(cwd);
  const analysis = analyzeDiff(cwd);

  if (config.autoDetect || config.domain) {
    const detection = detectProject(cwd, analysis);
    config = applyDetectionToConfig(config, detection);
  }

  return applyGenerateOptions(config, options);
}

export function buildQuestions(
  cwd: string,
  branch = "main",
  options: GenerateOptions = {},
): Session {
  const analysis = analyzeDiff(cwd, branch);
  const config = resolveConfig(cwd, options);
  const files = relevantFiles(analysis.files);
  const ctx = {
    analysis,
    files,
    summary: loadSummary(),
    promptsSections: loadPromptsSections(),
    rawDiff: analysis.rawDiff,
  };

  const activeCategories = enabledCategories(config);
  const allCandidates = activeCategories.flatMap((category) => buildCandidates(category, ctx));

  let selected = allocateQuestions(
    allCandidates,
    config.questions.max,
    config.questions.min,
  );

  if (selected.length === 0 && files.length > 0) {
    const fallback = buildCandidates("changeRationale", ctx);
    selected = allocateQuestions(fallback, config.questions.max, 1);
  }

  const questions: Question[] = selected.map((candidate, index) => ({
    id: `q${index + 1}`,
    type: candidate.type,
    category: candidate.category,
    prompt: candidate.prompt,
    files: candidate.files,
    rubric: candidate.rubric,
  }));

  return {
    diffHash: analysis.diffHash,
    baseRef: analysis.baseRef,
    generatedAt: new Date().toISOString(),
    questions,
  };
}

export function generateSession(
  cwd: string,
  branch = "main",
  options: GenerateOptions = {},
): Session {
  const session = buildQuestions(cwd, branch, options);

  if (session.questions.length === 0) {
    throw new Error(
      "No changes detected to generate questions from. Make changes or update PROMPTS.md.",
    );
  }

  mkdirSync(TESTME_DIR, { recursive: true });
  writeFileSync(SESSION_PATH, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}

export function warnIfBelowMin(session: Session, config: TestmeConfig): string | null {
  if (session.questions.length < config.questions.min) {
    return `Warning: only ${session.questions.length} question(s) generated (min ${config.questions.min}). Enrich PROMPTS.md or enable more categories.`;
  }
  return null;
}

export function parseCategoryList(value: string): CategoryKey[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as CategoryKey[];
}
