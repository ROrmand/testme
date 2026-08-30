import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AgentId } from "./agents/types.js";

export const GITIGNORE_MARKER = "# testme local setup";

const AGENT_SKILL_DIRS: Record<string, string[]> = {
  cursor: [".cursor/skills/testme/", ".cursor/skills/testing/"],
  claude: [".claude/skills/testme/", ".claude/skills/testing/"],
  windsurf: [".windsurf/skills/testme/", ".windsurf/skills/testing/"],
  "agents-md": [],
};

const HOOK_CONFIG_PATHS: Record<Exclude<AgentId, "agents-md">, string> = {
  cursor: ".cursor/hooks.json",
  claude: ".claude/settings.json",
  windsurf: ".windsurf/hooks.json",
};

export function isTestmeHookReference(value: string): boolean {
  return value.includes("testme/hooks/") || value.includes(".testme/hooks/");
}

function collectCommandsFromJson(value: unknown, commands: string[]): void {
  if (typeof value === "string") {
    if (value.includes("/hooks/") || value.endsWith(".sh")) {
      commands.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCommandsFromJson(item, commands);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key === "command" || key === "powershell") {
        if (typeof nested === "string") {
          commands.push(nested);
        }
      } else {
        collectCommandsFromJson(nested, commands);
      }
    }
  }
}

export function hookConfigHasNonTestmeContent(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const commands: string[] = [];
    collectCommandsFromJson(parsed, commands);

    if (commands.length === 0) {
      return false;
    }

    return commands.some((command) => !isTestmeHookReference(command));
  } catch {
    return true;
  }
}

export interface GitignorePlan {
  lines: string[];
  gitignoreHookConfigs: boolean;
  warnings: string[];
}

export function buildGitignorePlan(
  cwd: string,
  agents: AgentId[],
  localOnly = true,
): GitignorePlan {
  const lines = [".testme/"];
  const warnings: string[] = [];
  let gitignoreHookConfigs = true;

  if (localOnly) {
    for (const agent of agents) {
      for (const skillPath of AGENT_SKILL_DIRS[agent] ?? []) {
        lines.push(skillPath);
      }
    }

    for (const agent of agents) {
      if (agent === "agents-md") {
        continue;
      }

      const hookPath = path.join(cwd, HOOK_CONFIG_PATHS[agent]);
      if (hookConfigHasNonTestmeContent(hookPath)) {
        gitignoreHookConfigs = false;
        warnings.push(
          `${HOOK_CONFIG_PATHS[agent]} contains non-testme hooks — add testme entries manually or keep them local.`,
        );
      } else {
        lines.push(HOOK_CONFIG_PATHS[agent]);
      }
    }
  }

  if (!gitignoreHookConfigs) {
    return { lines, gitignoreHookConfigs: false, warnings };
  }

  return { lines, gitignoreHookConfigs: true, warnings };
}

export function ensureTestmeGitignore(
  cwd: string,
  agents: AgentId[],
  localOnly = true,
): string[] {
  const gitignorePath = path.join(cwd, ".gitignore");
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";

  if (content.includes(GITIGNORE_MARKER)) {
    return [];
  }

  const plan = buildGitignorePlan(cwd, agents, localOnly);
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  const block = `${separator}\n${GITIGNORE_MARKER} — run npx comp-gate init (do not commit)\n${plan.lines.join("\n")}\n`;

  writeFileSync(gitignorePath, content + block, "utf8");

  const created = [".gitignore (testme local setup)"];

  for (const warning of plan.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  return created;
}

export function removeTestmeGitignore(cwd: string): string[] {
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [];
  }

  const content = readFileSync(gitignorePath, "utf8");
  const markerIndex = content.indexOf(GITIGNORE_MARKER);
  if (markerIndex < 0) {
    return [];
  }

  let blockStart = markerIndex;
  if (blockStart > 0 && content[blockStart - 1] === "\n") {
    blockStart -= 1;
  }
  if (blockStart > 0 && content[blockStart - 1] === "\n") {
    blockStart -= 1;
  }

  const updated = `${content.slice(0, blockStart).replace(/\n+$/, "")}\n`;
  writeFileSync(gitignorePath, updated.length > 1 ? updated : "", "utf8");
  return [".gitignore (testme block removed)"];
}
