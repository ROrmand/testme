import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = process.cwd();
export const TESTME_DIR = path.join(ROOT, ".testme");
export const SESSION_PATH = path.join(TESTME_DIR, "session.json");
export const ANSWERS_PATH = path.join(TESTME_DIR, "answers.json");
export const PASS_PATH = path.join(TESTME_DIR, "pass.json");
export const SUMMARY_PATH = path.join(ROOT, "SUMMARY.md");
export const PROMPTS_PATH = path.join(ROOT, "PROMPTS.md");
export const REPO_CONFIG_PATH = path.join(ROOT, "testme.config.json");
export const LOCAL_CONFIG_PATH = path.join(TESTME_DIR, "config.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, "src", "templates");
