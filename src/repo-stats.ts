import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const LARGE_REPO_FILE_THRESHOLD = 500;

const IGNORED_TOP_LEVEL = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".testme",
  ".next",
  ".turbo",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
]);

export interface RepoStats {
  trackedFiles: number;
  topLevelDirs: string[];
  isLarge: boolean;
  source: "git" | "filesystem";
}

function countGitTrackedFiles(cwd: string): number | null {
  const gitDir = path.join(cwd, ".git");
  if (!existsSync(gitDir)) {
    return null;
  }

  try {
    const output = execSync("git ls-files", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = output.split("\n").filter((line) => line.trim().length > 0);
    return lines.length;
  } catch {
    return null;
  }
}

function countFilesystemFiles(cwd: string, maxDepth = 4): number {
  let count = 0;

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_TOP_LEVEL.has(entry)) {
        continue;
      }

      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (stat.isFile()) {
        count += 1;
      }
    }
  }

  walk(cwd, 0);
  return count;
}

export function listTopLevelDirs(cwd: string, max = 12): string[] {
  const dirs: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(cwd);
  } catch {
    return dirs;
  }

  for (const entry of entries) {
    if (entry.startsWith(".") || IGNORED_TOP_LEVEL.has(entry)) {
      continue;
    }

    const fullPath = path.join(cwd, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        dirs.push(entry);
      }
    } catch {
      continue;
    }
  }

  return dirs.sort().slice(0, max);
}

export function measureRepo(cwd: string): RepoStats {
  const gitCount = countGitTrackedFiles(cwd);
  const topLevelDirs = listTopLevelDirs(cwd);

  if (gitCount !== null) {
    return {
      trackedFiles: gitCount,
      topLevelDirs,
      isLarge: gitCount >= LARGE_REPO_FILE_THRESHOLD,
      source: "git",
    };
  }

  const fsCount = countFilesystemFiles(cwd);
  return {
    trackedFiles: fsCount,
    topLevelDirs,
    isLarge: fsCount >= LARGE_REPO_FILE_THRESHOLD,
    source: "filesystem",
  };
}
