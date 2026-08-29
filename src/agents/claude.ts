import path from "node:path";
import { agentTemplatesDir, copySkill, readJson, writeJson } from "./shared.js";

interface ClaudeHookCommand {
  type: string;
  command: string;
  timeout?: number;
}

interface ClaudeHookMatcher {
  matcher?: string;
  hooks: ClaudeHookCommand[];
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: ClaudeHookMatcher[];
  };
}

function mergeHookCommands(
  existing: ClaudeHookCommand[],
  incoming: ClaudeHookCommand[],
): ClaudeHookCommand[] {
  const merged = [...existing];
  const seen = new Set(existing.map((hook) => hook.command));

  for (const hook of incoming) {
    if (!seen.has(hook.command)) {
      merged.push(hook);
      seen.add(hook.command);
    }
  }

  return merged;
}

export function installClaude(cwd: string, created: string[]): void {
  const fragmentPath = path.join(agentTemplatesDir("claude"), "settings.fragment.json");
  const targetPath = path.join(cwd, ".claude", "settings.json");
  const fragment = readJson<ClaudeSettings>(fragmentPath);

  if (!fragment?.hooks?.PreToolUse) {
    throw new Error("Missing Claude settings template.");
  }

  const existing = readJson<ClaudeSettings>(targetPath) ?? { hooks: {} };
  const preToolUse = [...(existing.hooks?.PreToolUse ?? [])];

  for (const incoming of fragment.hooks.PreToolUse) {
    const idx = preToolUse.findIndex((item) => item.matcher === incoming.matcher);
    if (idx < 0) {
      preToolUse.push(incoming);
      continue;
    }

    preToolUse[idx] = {
      ...preToolUse[idx],
      hooks: mergeHookCommands(preToolUse[idx].hooks, incoming.hooks),
    };
  }

  const merged: ClaudeSettings = {
    ...existing,
    hooks: {
      ...existing.hooks,
      PreToolUse: preToolUse,
    },
  };

  writeJson(targetPath, merged);
  created.push(".claude/settings.json (merged)");
  copySkill("claude", cwd, created);
}
