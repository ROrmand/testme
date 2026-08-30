import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "../paths.js";

export function copyIfMissing(source: string, target: string): boolean {
  if (existsSync(target)) {
    return false;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return true;
}

export function copyAlways(source: string, target: string): void {
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}

export function agentTemplatesDir(agent: string): string {
  return path.join(TEMPLATES_DIR, "agents", agent);
}

export function mergeJsonArraysByKey<T extends Record<string, unknown>>(
  existing: T[],
  incoming: T[],
  key: keyof T,
): T[] {
  const merged = [...existing];
  const seen = new Set(existing.map((item) => String(item[key] ?? "")));

  for (const item of incoming) {
    const value = String(item[key] ?? "");
    if (!seen.has(value)) {
      merged.push(item);
      seen.add(value);
    }
  }

  return merged;
}

export function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function copySkill(agent: string, cwd: string, created: string[]): void {
  const testmeSource = path.join(agentTemplatesDir(agent), "SKILL.md");
  const testmeFallback = path.join(TEMPLATES_DIR, "SKILL.md");
  const testmeSkillSource = existsSync(testmeSource) ? testmeSource : testmeFallback;

  const testingSource = path.join(agentTemplatesDir(agent), "testing-SKILL.md");
  const testingFallback = path.join(TEMPLATES_DIR, "testing-SKILL.md");
  const testingSkillSource = existsSync(testingSource) ? testingSource : testingFallback;

  const skillTargets: Record<string, Record<string, string>> = {
    cursor: {
      testme: path.join(cwd, ".cursor", "skills", "testme", "SKILL.md"),
      testing: path.join(cwd, ".cursor", "skills", "testing", "SKILL.md"),
    },
    claude: {
      testme: path.join(cwd, ".claude", "skills", "testme", "SKILL.md"),
      testing: path.join(cwd, ".claude", "skills", "testing", "SKILL.md"),
    },
    windsurf: {
      testme: path.join(cwd, ".windsurf", "skills", "testme", "SKILL.md"),
      testing: path.join(cwd, ".windsurf", "skills", "testing", "SKILL.md"),
    },
  };

  const targets = skillTargets[agent];
  if (!targets) {
    return;
  }

  copyAlways(testmeSkillSource, targets.testme);
  created.push(targets.testme.replace(`${cwd}/`, ""));

  if (existsSync(testingSkillSource)) {
    copyAlways(testingSkillSource, targets.testing);
    created.push(targets.testing.replace(`${cwd}/`, ""));
  }
}

export function chmodScripts(dir: string): void {
  if (!existsSync(dir)) {
    return;
  }

  for (const file of readdirSync(dir)) {
    if (file.endsWith(".sh")) {
      chmodSync(path.join(dir, file), 0o755);
    }
  }
}
