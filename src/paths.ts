import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = process.cwd();
export const TESTME_INSTALL_DIR = path.join(ROOT, "testme");
export const TESTME_DIR = path.join(ROOT, ".testme");
export const SESSION_PATH = path.join(TESTME_DIR, "session.json");
export const ANSWERS_PATH = path.join(TESTME_DIR, "answers.json");
export const REFERENCES_PATH = path.join(TESTME_DIR, "references.json");
export const JUDGMENTS_PATH = path.join(TESTME_DIR, "judgments.json");
export const PASS_PATH = path.join(TESTME_DIR, "pass.json");
export const HOOKS_DIR = path.join(TESTME_INSTALL_DIR, "hooks");
export const SKILLS_DIR = path.join(TESTME_INSTALL_DIR, "skills");
export const LOCAL_CONFIG_PATH = path.join(TESTME_DIR, "config.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, "src", "templates");
export const TESTME_TEMPLATES_DIR = path.join(TEMPLATES_DIR, "testme");

let legacyPathWarningShown = false;

function warnLegacyPaths(): void {
  if (legacyPathWarningShown) {
    return;
  }
  legacyPathWarningShown = true;
  console.warn(
    "Warning: using legacy root-level testme files (SUMMARY.md, PROMPTS.md, testme.config.json). Run `npx comp-gate migrate` to move them into testme/.",
  );
}

export function installDir(cwd: string = ROOT): string {
  return path.join(cwd, "testme");
}

export function summaryPath(cwd: string = ROOT): string {
  const newPath = path.join(cwd, "testme", "SUMMARY.md");
  const legacyPath = path.join(cwd, "SUMMARY.md");
  if (existsSync(newPath) || !existsSync(legacyPath)) {
    return newPath;
  }
  warnLegacyPaths();
  return legacyPath;
}

export function promptsPath(cwd: string = ROOT): string {
  const newPath = path.join(cwd, "testme", "PROMPTS.md");
  const legacyPath = path.join(cwd, "PROMPTS.md");
  if (existsSync(newPath) || !existsSync(legacyPath)) {
    return newPath;
  }
  warnLegacyPaths();
  return legacyPath;
}

export function repoConfigPath(cwd: string = ROOT): string {
  const newPath = path.join(cwd, "testme", "config.json");
  const legacyPath = path.join(cwd, "testme.config.json");
  if (existsSync(newPath) || !existsSync(legacyPath)) {
    return newPath;
  }
  warnLegacyPaths();
  return legacyPath;
}

export function hooksDir(cwd: string = ROOT): string {
  const newPath = path.join(cwd, "testme", "hooks");
  const legacyPath = path.join(cwd, ".testme", "hooks");
  if (existsSync(newPath) || !existsSync(legacyPath)) {
    return newPath;
  }
  return legacyPath;
}

/** @deprecated Use summaryPath() for legacy-aware resolution */
export const SUMMARY_PATH = summaryPath();
/** @deprecated Use promptsPath() for legacy-aware resolution */
export const PROMPTS_PATH = promptsPath();
/** @deprecated Use repoConfigPath() for legacy-aware resolution */
export const REPO_CONFIG_PATH = repoConfigPath();
