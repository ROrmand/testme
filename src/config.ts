import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOCAL_CONFIG_PATH, REPO_CONFIG_PATH } from "./paths.js";
import type {
  CategoryKey,
  GenerateOptions,
  TestmeConfig,
  TestmeConfigInput,
} from "./types.js";
import { ALL_CATEGORY_KEYS } from "./types.js";

export const DEFAULT_CONFIG: TestmeConfig = {
  questions: { min: 2, max: 5 },
  categories: {
    changeRationale: true,
    symbols: true,
    architecture: true,
    runtime: false,
    dataStructures: false,
    dependencies: false,
    testing: false,
    errorHandling: false,
    apiContracts: false,
    security: false,
    performance: false,
    database: false,
    machineLearning: false,
    cybersecurity: false,
    frontend: false,
    backend: false,
    devops: false,
    mobile: false,
    dataEngineering: false,
  },
  autoDetect: true,
  domain: null,
};

function readJsonFile(filePath: string): TestmeConfigInput | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as TestmeConfigInput;
  } catch {
    return null;
  }
}

function mergeCategories(
  base: Record<CategoryKey, boolean>,
  patch?: Partial<Record<CategoryKey, boolean>>,
): Record<CategoryKey, boolean> {
  if (!patch) {
    return { ...base };
  }

  return { ...base, ...patch };
}

export function mergeConfig(
  base: TestmeConfig,
  patch?: TestmeConfigInput | null,
): TestmeConfig {
  if (!patch) {
    return { ...base, categories: { ...base.categories } };
  }

  return {
    questions: {
      min: patch.questions?.min ?? base.questions.min,
      max: patch.questions?.max ?? base.questions.max,
    },
    categories: mergeCategories(base.categories, patch.categories),
    autoDetect: patch.autoDetect ?? base.autoDetect,
    domain: patch.domain !== undefined ? patch.domain : base.domain,
    _detected: patch._detected ?? base._detected,
  };
}

export function normalizeConfig(config: TestmeConfig): TestmeConfig {
  const min = Math.max(1, config.questions.min);
  const max = Math.max(min, config.questions.max);

  return {
    ...config,
    questions: { min, max },
    categories: mergeCategories(DEFAULT_CONFIG.categories, config.categories),
  };
}

export function loadConfig(cwd: string = process.cwd()): TestmeConfig {
  const repoPath = path.join(cwd, "testme.config.json");
  const localPath = path.join(cwd, ".testme", "config.json");

  let config = mergeConfig(DEFAULT_CONFIG, readJsonFile(repoPath));
  config = mergeConfig(config, readJsonFile(localPath));

  return normalizeConfig(config);
}

export function stripDetected(config: TestmeConfig): TestmeConfig {
  const { _detected, ...rest } = config;
  return rest;
}

export function applyGenerateOptions(
  config: TestmeConfig,
  options: GenerateOptions = {},
): TestmeConfig {
  const next = { ...config, categories: { ...config.categories } };

  if (options.maxQuestions !== undefined) {
    next.questions = { ...next.questions, max: options.maxQuestions };
  }

  if (options.minQuestions !== undefined) {
    next.questions = { ...next.questions, min: options.minQuestions };
  }

  if (options.categories && options.categories.length > 0) {
    for (const key of ALL_CATEGORY_KEYS) {
      next.categories[key] = options.categories.includes(key);
    }
  }

  return normalizeConfig(next);
}

export function enabledCategories(config: TestmeConfig): CategoryKey[] {
  return ALL_CATEGORY_KEYS.filter((key) => config.categories[key]);
}

export function writeConfigFile(filePath: string, config: TestmeConfig): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(stripDetected(config), null, 2)}\n`, "utf8");
}
