import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { installClaude } from "./agents/claude.js";
import { installCursor } from "./agents/cursor.js";
import { detectAgents } from "./agents/detect.js";
import { installWindsurf } from "./agents/windsurf.js";
import { copyHookScripts, installGitHooks } from "./init.js";
import { installDir } from "./paths.js";

function rewriteHookPaths(content: string): string {
  return content.replaceAll(".testme/hooks/", "testme/hooks/");
}

function migrateFile(
  cwd: string,
  source: string,
  target: string,
  moved: string[],
): void {
  if (!existsSync(source) || existsSync(target)) {
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  renameSync(source, target);
  moved.push(`${path.relative(cwd, source)} → ${path.relative(cwd, target)}`);
}

function migrateHookScripts(cwd: string, moved: string[]): void {
  const legacyHooks = path.join(cwd, ".testme", "hooks");
  const targetHooks = path.join(installDir(cwd), "hooks");

  if (!existsSync(legacyHooks)) {
    return;
  }

  mkdirSync(targetHooks, { recursive: true });

  for (const file of readdirSync(legacyHooks)) {
    if (!file.endsWith(".sh")) {
      continue;
    }
    const source = path.join(legacyHooks, file);
    const target = path.join(targetHooks, file);
    if (existsSync(target)) {
      continue;
    }
    renameSync(source, target);
    moved.push(`.testme/hooks/${file} → testme/hooks/${file}`);
  }

  if (readdirSync(legacyHooks).length === 0) {
    rmSync(legacyHooks, { recursive: true, force: true });
  }
}

function migrateHookConfig(cwd: string, relativePath: string, updated: string[]): void {
  const filePath = path.join(cwd, relativePath);
  if (!existsSync(filePath)) {
    return;
  }

  const original = readFileSync(filePath, "utf8");
  const rewritten = rewriteHookPaths(original);
  if (rewritten === original) {
    return;
  }

  writeFileSync(filePath, rewritten, "utf8");
  updated.push(`${relativePath} (hook paths updated)`);
}

export function migrateProject(cwd: string): string[] {
  const changes: string[] = [];
  const testmeRoot = installDir(cwd);
  mkdirSync(testmeRoot, { recursive: true });

  migrateFile(cwd, path.join(cwd, "SUMMARY.md"), path.join(testmeRoot, "SUMMARY.md"), changes);
  migrateFile(cwd, path.join(cwd, "PROMPTS.md"), path.join(testmeRoot, "PROMPTS.md"), changes);
  migrateFile(
    cwd,
    path.join(cwd, "testme.config.json"),
    path.join(testmeRoot, "config.json"),
    changes,
  );

  migrateHookScripts(cwd, changes);

  const hookConfigs = [
    ".cursor/hooks.json",
    ".claude/settings.json",
    ".windsurf/hooks.json",
  ];
  for (const hookConfig of hookConfigs) {
    migrateHookConfig(cwd, hookConfig, changes);
  }

  copyHookScripts(cwd);
  changes.push(...installGitHooks(cwd));

  const detection = detectAgents(cwd);
  const agents = detection.suggested.length > 0 ? detection.suggested : ["cursor"];
  const created: string[] = [];

  for (const agent of agents) {
    switch (agent) {
      case "cursor":
        installCursor(cwd, created);
        break;
      case "claude":
        installClaude(cwd, created);
        break;
      case "windsurf":
        installWindsurf(cwd, created);
        break;
    }
  }

  changes.push(...created);

  if (changes.length === 0) {
    changes.push("(nothing to migrate — already using testme/ layout)");
  }

  return changes;
}
