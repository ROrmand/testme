import { existsSync } from "node:fs";
import { repoConfigPath } from "./paths.js";
import { DEFAULT_CONFIG, loadConfig, mergeConfig, normalizeConfig, stripDetected, writeConfigFile } from "./config.js";
import { analyzeDiff } from "./diff.js";
import { applyDetectionToConfig, detectProject } from "./detect.js";
import type { TestmeConfig } from "./types.js";

export function createInitialConfig(cwd: string): TestmeConfig {
  const analysis = analyzeDiff(cwd);
  let config = mergeConfig(DEFAULT_CONFIG, null);
  const detection = detectProject(cwd, analysis);
  config = applyDetectionToConfig(config, detection);
  config.gateCommits = true;
  return normalizeConfig(config);
}

export function initConfig(cwd: string, force = false): { created: boolean; path: string; config: TestmeConfig } {
  const configPath = repoConfigPath(cwd);

  if (existsSync(configPath) && !force) {
    return { created: false, path: configPath, config: loadConfig(cwd) };
  }

  const config = createInitialConfig(cwd);
  writeConfigFile(configPath, config);

  return { created: true, path: configPath, config };
}

export function initConfigWithWizard(
  cwd: string,
  config: TestmeConfig,
  applyWizard = true,
): { created: boolean; updated: boolean; path: string; config: TestmeConfig } {
  const configPath = repoConfigPath(cwd);
  const exists = existsSync(configPath);

  if (exists && !applyWizard) {
    return { created: false, updated: false, path: configPath, config: loadConfig(cwd) };
  }

  if (exists) {
    const existing = loadConfig(cwd);
    const merged = normalizeConfig({
      ...existing,
      questions: config.questions,
      passThreshold: config.passThreshold,
      minAlignment: config.minAlignment,
      difficulty: config.difficulty,
      categories: config.categories,
      autoDetect: config.autoDetect,
      gateCommits: config.gateCommits,
    });
    writeConfigFile(configPath, merged);
    return { created: false, updated: true, path: configPath, config: merged };
  }

  writeConfigFile(configPath, config);
  return { created: true, updated: false, path: configPath, config };
}

export function showConfig(cwd: string): TestmeConfig {
  return loadConfig(cwd);
}

export function formatConfigForDisplay(config: TestmeConfig): string {
  return JSON.stringify(stripDetected(config), null, 2);
}
