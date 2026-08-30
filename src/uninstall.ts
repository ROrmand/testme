import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./agents/shared.js";
import { GIT_HOOK_MARKER } from "./constants.js";
import { isTestmeHookReference, removeTestmeGitignore } from "./gitignore.js";
import { installDir } from "./paths.js";

const AGENTS_MD_START = "<!-- testme:start -->";
const AGENTS_MD_END = "<!-- testme:end -->";

const SKILL_PATHS = [
  ".cursor/skills/testme",
  ".cursor/skills/testing",
  ".claude/skills/testme",
  ".claude/skills/testing",
  ".windsurf/skills/testme",
  ".windsurf/skills/testing",
];

const LEGACY_ROOT_FILES = ["SUMMARY.md", "PROMPTS.md", "testme.config.json"];

export interface UninstallOptions {
  yes?: boolean;
  keepData?: boolean;
}

function removePath(cwd: string, relativePath: string, removed: string[]): void {
  const target = path.join(cwd, relativePath);
  if (!existsSync(target)) {
    return;
  }
  rmSync(target, { recursive: true, force: true });
  removed.push(relativePath);
}

function removeGitHook(cwd: string, hookName: string, removed: string[]): void {
  const hookPath = path.join(cwd, ".git", "hooks", hookName);
  if (!existsSync(hookPath)) {
    return;
  }

  const content = readFileSync(hookPath, "utf8");
  if (!content.includes(GIT_HOOK_MARKER)) {
    return;
  }

  rmSync(hookPath, { force: true });
  removed.push(`.git/hooks/${hookName}`);
}

function isTestmeHookEntry(entry: Record<string, unknown>): boolean {
  const command = entry.command;
  return typeof command === "string" && isTestmeHookReference(command);
}

function stripCursorHooks(cwd: string, removed: string[]): void {
  const targetPath = path.join(cwd, ".cursor", "hooks.json");
  const config = readJson<{ version?: number; hooks?: Record<string, Array<Record<string, unknown>>> }>(
    targetPath,
  );
  if (!config?.hooks) {
    return;
  }

  const hooks: Record<string, Array<Record<string, unknown>>> = {};
  let changed = false;

  for (const [event, entries] of Object.entries(config.hooks)) {
    const filtered = entries.filter((entry) => !isTestmeHookEntry(entry));
    if (filtered.length !== entries.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      hooks[event] = filtered;
    }
  }

  if (!changed) {
    return;
  }

  if (Object.keys(hooks).length === 0) {
    rmSync(targetPath, { force: true });
    removed.push(".cursor/hooks.json");
    return;
  }

  writeJson(targetPath, { ...config, hooks });
  removed.push(".cursor/hooks.json (testme entries removed)");
}

function stripWindsurfHooks(cwd: string, removed: string[]): void {
  const targetPath = path.join(cwd, ".windsurf", "hooks.json");
  const config = readJson<{ hooks?: Record<string, Array<Record<string, unknown>>> }>(targetPath);
  if (!config?.hooks) {
    return;
  }

  const hooks: Record<string, Array<Record<string, unknown>>> = {};
  let changed = false;

  for (const [event, entries] of Object.entries(config.hooks)) {
    const filtered = entries.filter((entry) => !isTestmeHookEntry(entry));
    if (filtered.length !== entries.length) {
      changed = true;
    }
    if (filtered.length > 0) {
      hooks[event] = filtered;
    }
  }

  if (!changed) {
    return;
  }

  if (Object.keys(hooks).length === 0) {
    rmSync(targetPath, { force: true });
    removed.push(".windsurf/hooks.json");
    return;
  }

  writeJson(targetPath, { ...config, hooks });
  removed.push(".windsurf/hooks.json (testme entries removed)");
}

function stripClaudeHooks(cwd: string, removed: string[]): void {
  const targetPath = path.join(cwd, ".claude", "settings.json");
  const config = readJson<{
    hooks?: {
      PreToolUse?: Array<{
        matcher?: string;
        hooks: Array<{ type: string; command: string; timeout?: number }>;
      }>;
    };
  }>(targetPath);

  if (!config?.hooks?.PreToolUse) {
    return;
  }

  const preToolUse = config.hooks.PreToolUse
    .map((matcherBlock) => ({
      ...matcherBlock,
      hooks: matcherBlock.hooks.filter((hook) => !isTestmeHookReference(hook.command)),
    }))
    .filter((matcherBlock) => matcherBlock.hooks.length > 0);

  const hadTestme = preToolUse.length !== config.hooks.PreToolUse.length ||
    config.hooks.PreToolUse.some((block) =>
      block.hooks.some((hook) => isTestmeHookReference(hook.command)),
    );

  if (!hadTestme) {
    return;
  }

  const nextHooks = { ...config.hooks };
  if (preToolUse.length === 0) {
    delete nextHooks.PreToolUse;
  } else {
    nextHooks.PreToolUse = preToolUse;
  }

  if (Object.keys(nextHooks).length === 0) {
    rmSync(targetPath, { force: true });
    removed.push(".claude/settings.json");
    return;
  }

  writeJson(targetPath, { ...config, hooks: nextHooks });
  removed.push(".claude/settings.json (testme entries removed)");
}

function removeAgentsMdSection(cwd: string, removed: string[]): void {
  const targetPath = path.join(cwd, "AGENTS.md");
  if (!existsSync(targetPath)) {
    return;
  }

  const content = readFileSync(targetPath, "utf8");
  if (!content.includes(AGENTS_MD_START) || !content.includes(AGENTS_MD_END)) {
    return;
  }

  const start = content.indexOf(AGENTS_MD_START);
  const end = content.indexOf(AGENTS_MD_END) + AGENTS_MD_END.length;
  let updated = `${content.slice(0, start)}${content.slice(end)}`;
  updated = updated.replace(/\n{3,}/g, "\n\n").trimEnd();
  writeFileSync(targetPath, updated.length > 0 ? `${updated}\n` : "", "utf8");
  removed.push("AGENTS.md (testme section removed)");
}

export function planUninstall(cwd: string, options: UninstallOptions = {}): string[] {
  const planned: string[] = [];

  if (!options.keepData) {
    if (existsSync(installDir(cwd))) {
      planned.push("testme/");
    }
    for (const file of LEGACY_ROOT_FILES) {
      if (existsSync(path.join(cwd, file))) {
        planned.push(file);
      }
    }
  }

  if (existsSync(path.join(cwd, ".testme"))) {
    planned.push(".testme/");
  }

  for (const skillPath of SKILL_PATHS) {
    if (existsSync(path.join(cwd, skillPath))) {
      planned.push(skillPath);
    }
  }

  for (const hookName of ["pre-commit", "pre-push"]) {
    const hookPath = path.join(cwd, ".git", "hooks", hookName);
    if (existsSync(hookPath) && readFileSync(hookPath, "utf8").includes(GIT_HOOK_MARKER)) {
      planned.push(`.git/hooks/${hookName}`);
    }
  }

  const hookConfigs = [".cursor/hooks.json", ".claude/settings.json", ".windsurf/hooks.json"];
  for (const hookConfig of hookConfigs) {
    const filePath = path.join(cwd, hookConfig);
    if (!existsSync(filePath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      const commands: string[] = [];
      collectHookCommands(parsed, commands);
      if (commands.some((command) => isTestmeHookReference(command))) {
        planned.push(`${hookConfig} (testme entries)`);
      }
    } catch {
      // ignore malformed configs
    }
  }

  const gitignorePath = path.join(cwd, ".gitignore");
  if (existsSync(gitignorePath) && readFileSync(gitignorePath, "utf8").includes("# testme local setup")) {
    planned.push(".gitignore (testme block)");
  }

  const agentsMdPath = path.join(cwd, "AGENTS.md");
  if (existsSync(agentsMdPath) && readFileSync(agentsMdPath, "utf8").includes(AGENTS_MD_START)) {
    planned.push("AGENTS.md (testme section)");
  }

  return planned;
}

function collectHookCommands(value: unknown, commands: string[]): void {
  if (typeof value === "string") {
    if (value.includes("/hooks/") || value.endsWith(".sh")) {
      commands.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectHookCommands(item, commands);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key === "command" && typeof nested === "string") {
        commands.push(nested);
      } else {
        collectHookCommands(nested, commands);
      }
    }
  }
}

export function uninstallProject(cwd: string, options: UninstallOptions = {}): string[] {
  const removed: string[] = [];

  if (!options.keepData) {
    removePath(cwd, "testme", removed);
    for (const file of LEGACY_ROOT_FILES) {
      removePath(cwd, file, removed);
    }
  }

  removePath(cwd, ".testme", removed);

  for (const skillPath of SKILL_PATHS) {
    removePath(cwd, skillPath, removed);
  }

  removeGitHook(cwd, "pre-commit", removed);
  removeGitHook(cwd, "pre-push", removed);

  stripCursorHooks(cwd, removed);
  stripClaudeHooks(cwd, removed);
  stripWindsurfHooks(cwd, removed);
  removeAgentsMdSection(cwd, removed);
  removed.push(...removeTestmeGitignore(cwd));

  return removed;
}
