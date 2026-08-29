import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "./paths.js";
import { initConfig } from "./config-init.js";

interface HooksConfig {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

const GIT_HOOK_MARKER = "testme-managed hook";

function copyIfMissing(source: string, target: string): boolean {
  if (existsSync(target)) {
    return false;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return true;
}

function mergeHooks(existingPath: string, templatePath: string, targetPath: string): void {
  const template = JSON.parse(readFileSync(templatePath, "utf8")) as HooksConfig;

  if (!existsSync(existingPath)) {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(templatePath, targetPath);
    return;
  }

  const existing = JSON.parse(readFileSync(existingPath, "utf8")) as HooksConfig;
  const merged: HooksConfig = {
    version: existing.version ?? template.version ?? 1,
    hooks: { ...existing.hooks },
  };

  for (const [event, hooks] of Object.entries(template.hooks)) {
    const current = merged.hooks[event] ?? [];
    const testmeHooks = hooks.map((hook) => ({
      ...hook,
      command: String(hook.command).replace(/^\.cursor\//, ".cursor/"),
    }));

    const existingCommands = new Set(
      current.map((hook) => String(hook.command ?? "")),
    );

    for (const hook of testmeHooks) {
      if (!existingCommands.has(String(hook.command))) {
        current.push(hook);
      }
    }

    merged.hooks[event] = current;
  }

  writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

function ensureGitignoreEntry(cwd: string): void {
  const gitignorePath = path.join(cwd, ".gitignore");
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";

  if (content.includes(".testme/")) {
    return;
  }

  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  const block = `${separator}\n# testme session state\n.testme/\n`;
  writeFileSync(gitignorePath, content + block, "utf8");
}

export function copyHookScripts(cwd: string): void {
  const hooksDir = path.join(TEMPLATES_DIR, "hooks");
  const targetDir = path.join(cwd, ".cursor", "hooks");
  mkdirSync(targetDir, { recursive: true });

  for (const file of readdirSync(hooksDir)) {
    if (!file.endsWith(".sh")) {
      continue;
    }
    const target = path.join(targetDir, file);
    copyFileSync(path.join(hooksDir, file), target);
    chmodSync(target, 0o755);
  }
}

function installGitHookFile(
  cwd: string,
  hookName: string,
  scriptName: string,
): "installed" | "skipped" | "missing-git" {
  const gitDir = path.join(cwd, ".git");
  if (!existsSync(gitDir)) {
    return "missing-git";
  }

  const hookPath = path.join(gitDir, "hooks", hookName);
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!existing.includes(GIT_HOOK_MARKER)) {
      return "skipped";
    }
  }

  const scriptPath = `.cursor/hooks/${scriptName}`;
  const content = `#!/bin/sh
# ${GIT_HOOK_MARKER} — re-run npx testme init to refresh
exec "$(git rev-parse --show-toplevel)/${scriptPath}" "$@"
`;

  mkdirSync(path.dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, content, "utf8");
  chmodSync(hookPath, 0o755);

  return "installed";
}

export function installGitHooks(cwd: string): string[] {
  const results: string[] = [];
  const push = installGitHookFile(cwd, "pre-push", "git-pre-push.sh");
  const commit = installGitHookFile(cwd, "pre-commit", "git-pre-commit.sh");

  if (push === "installed") {
    results.push(".git/hooks/pre-push");
  } else if (push === "skipped") {
    results.push(".git/hooks/pre-push (skipped — existing non-testme hook)");
  }

  if (commit === "installed") {
    results.push(".git/hooks/pre-commit");
  } else if (commit === "skipped") {
    results.push(".git/hooks/pre-commit (skipped — existing non-testme hook)");
  }

  return results;
}

export function initProject(cwd: string): string[] {
  const created: string[] = [];

  const summaryTarget = path.join(cwd, "SUMMARY.md");
  const promptsTarget = path.join(cwd, "PROMPTS.md");

  if (copyIfMissing(path.join(TEMPLATES_DIR, "SUMMARY.md"), summaryTarget)) {
    created.push("SUMMARY.md");
  }

  if (copyIfMissing(path.join(TEMPLATES_DIR, "PROMPTS.md"), promptsTarget)) {
    created.push("PROMPTS.md");
  }

  const configResult = initConfig(cwd);
  if (configResult.created) {
    created.push("testme.config.json");
  }

  copyHookScripts(cwd);

  const hooksTarget = path.join(cwd, ".cursor", "hooks.json");
  mergeHooks(hooksTarget, path.join(TEMPLATES_DIR, "hooks.json"), hooksTarget);
  created.push(".cursor/hooks.json");

  for (const item of installGitHooks(cwd)) {
    created.push(item);
  }

  const skillTarget = path.join(cwd, ".cursor", "skills", "testme", "SKILL.md");
  if (copyIfMissing(path.join(TEMPLATES_DIR, "SKILL.md"), skillTarget)) {
    created.push(".cursor/skills/testme/SKILL.md");
  }

  ensureGitignoreEntry(cwd);
  created.push(".gitignore (.testme/ entry)");

  return created;
}

export function resetTestmeState(cwd: string, resetPrompts = false): void {
  const testmeDir = path.join(cwd, ".testme");
  if (existsSync(testmeDir)) {
    rmSync(testmeDir, { recursive: true, force: true });
  }

  if (resetPrompts) {
    const promptsTemplate = path.join(TEMPLATES_DIR, "PROMPTS.md");
    writeFileSync(path.join(cwd, "PROMPTS.md"), readFileSync(promptsTemplate, "utf8"), "utf8");
  }
}

export function resetPromptsAfterPush(cwd: string): void {
  const promptsTemplate = path.join(TEMPLATES_DIR, "PROMPTS.md");
  writeFileSync(path.join(cwd, "PROMPTS.md"), readFileSync(promptsTemplate, "utf8"), "utf8");
  resetTestmeState(cwd, false);
}
