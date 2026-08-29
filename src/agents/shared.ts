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
  const source = path.join(agentTemplatesDir(agent), "SKILL.md");
  const fallback = path.join(TEMPLATES_DIR, "SKILL.md");
  const skillSource = existsSync(source) ? source : fallback;

  const targetDirs: Record<string, string> = {
    cursor: path.join(cwd, ".cursor", "skills", "testme", "SKILL.md"),
    claude: path.join(cwd, ".claude", "skills", "testme", "SKILL.md"),
    windsurf: path.join(cwd, ".windsurf", "skills", "testme", "SKILL.md"),
  };

  const target = targetDirs[agent];
  if (!target) {
    return;
  }

  copyAlways(skillSource, target);
  created.push(target.replace(`${cwd}/`, ""));
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
