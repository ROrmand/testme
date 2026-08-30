import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

const SKILL_LINK_TARGETS: Record<string, Record<string, string>> = {
  cursor: {
    testme: ".cursor/skills/testme",
    testing: ".cursor/skills/testing",
  },
  claude: {
    testme: ".claude/skills/testme",
    testing: ".claude/skills/testing",
  },
  windsurf: {
    testme: ".windsurf/skills/testme",
    testing: ".windsurf/skills/testing",
  },
};

function removeIfExists(targetPath: string): void {
  if (!existsSync(targetPath)) {
    return;
  }

  const stat = lstatSync(targetPath);
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    rmSync(targetPath, { recursive: true, force: true });
    return;
  }

  rmSync(targetPath, { recursive: true, force: true });
}

function linkOrCopySkill(cwd: string, source: string, target: string, created: string[]): void {
  const relativeSource = path.relative(path.dirname(target), source);
  removeIfExists(target);

  try {
    mkdirSync(path.dirname(target), { recursive: true });
    symlinkSync(relativeSource, target, "dir");
    created.push(`${path.relative(cwd, target)} → ${relativeSource}`);
  } catch {
    copySkillDirectory(source, target);
    created.push(`${path.relative(cwd, target)} (copied — symlink unavailable)`);
  }
}

function copySkillDirectory(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    if (existsSync(sourcePath) && lstatSync(sourcePath).isDirectory()) {
      copySkillDirectory(sourcePath, targetPath);
    } else {
      copyAlways(sourcePath, targetPath);
    }
  }
}

export function linkSkill(agent: string, cwd: string, created: string[]): void {
  const targets = SKILL_LINK_TARGETS[agent];
  if (!targets) {
    return;
  }

  for (const [skillName, relativeTarget] of Object.entries(targets)) {
    const source = path.join(cwd, "testme", "skills", skillName);
    const target = path.join(cwd, relativeTarget);

    if (!existsSync(source)) {
      continue;
    }

    linkOrCopySkill(cwd, source, target, created);
  }
}

/** @deprecated Use linkSkill */
export function copySkill(agent: string, cwd: string, created: string[]): void {
  linkSkill(agent, cwd, created);
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
