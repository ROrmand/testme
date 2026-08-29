import { existsSync } from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, loadConfig, mergeConfig, normalizeConfig, stripDetected, writeConfigFile } from "./config.js";
import { analyzeDiff } from "./diff.js";
import { applyDetectionToConfig, detectProject } from "./detect.js";
import { REPO_CONFIG_PATH } from "./paths.js";
import type { TestmeConfig } from "./types.js";

export function createInitialConfig(cwd: string): TestmeConfig {
  const analysis = analyzeDiff(cwd);
  let config = mergeConfig(DEFAULT_CONFIG, null);
  const detection = detectProject(cwd, analysis);
  config = applyDetectionToConfig(config, detection);
  return normalizeConfig(config);
}

export function initConfig(cwd: string, force = false): { created: boolean; path: string; config: TestmeConfig } {
  const configPath = path.join(cwd, "testme.config.json");

  if (existsSync(configPath) && !force) {
    return { created: false, path: configPath, config: loadConfig(cwd) };
  }

  const config = createInitialConfig(cwd);
  writeConfigFile(configPath, config);

  return { created: true, path: configPath, config };
}

export function showConfig(cwd: string): TestmeConfig {
  return loadConfig(cwd);
}

export function formatConfigForDisplay(config: TestmeConfig): string {
  return JSON.stringify(stripDetected(config), null, 2);
}
