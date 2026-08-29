import path from "node:path";
import { agentTemplatesDir, copySkill, mergeJsonArraysByKey, readJson, writeJson } from "./shared.js";

interface WindsurfHooksConfig {
  hooks: Record<string, Array<Record<string, unknown>>>;
}

export function installWindsurf(cwd: string, created: string[]): void {
  const templatePath = path.join(agentTemplatesDir("windsurf"), "hooks.json");
  const targetPath = path.join(cwd, ".windsurf", "hooks.json");
  const template = readJson<WindsurfHooksConfig>(templatePath);

  if (!template) {
    throw new Error("Missing Windsurf hooks template.");
  }

  const existing = readJson<WindsurfHooksConfig>(targetPath);

  if (!existing) {
    writeJson(targetPath, template);
    created.push(".windsurf/hooks.json");
  } else {
    const merged: WindsurfHooksConfig = {
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
    created.push(".windsurf/hooks.json (merged)");
  }

  copySkill("windsurf", cwd, created);
}
