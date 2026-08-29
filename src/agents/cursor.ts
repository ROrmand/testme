import path from "node:path";
import {
  agentTemplatesDir,
  copySkill,
  mergeJsonArraysByKey,
  readJson,
  writeJson,
} from "./shared.js";

interface CursorHooksConfig {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

export function installCursor(cwd: string, created: string[]): void {
  const templatePath = path.join(agentTemplatesDir("cursor"), "hooks.json");
  const targetPath = path.join(cwd, ".cursor", "hooks.json");
  const template = readJson<CursorHooksConfig>(templatePath);

  if (!template) {
    throw new Error("Missing Cursor hooks template.");
  }

  const existing = readJson<CursorHooksConfig>(targetPath);

  if (!existing) {
    writeJson(targetPath, template);
    created.push(".cursor/hooks.json");
  } else {
    const merged: CursorHooksConfig = {
      version: existing.version ?? template.version ?? 1,
      hooks: { ...existing.hooks },
    };

    for (const [event, hooks] of Object.entries(template.hooks)) {
      merged.hooks[event] = mergeJsonArraysByKey(
        merged.hooks[event] ?? [],
        hooks,
        "command",
      );
    }

    writeJson(targetPath, merged);
    created.push(".cursor/hooks.json (merged)");
  }

  copySkill("cursor", cwd, created);
}
