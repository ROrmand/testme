import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { LARGE_REPO_FILE_THRESHOLD, listTopLevelDirs, measureRepo } from "./repo-stats.js";

describe("repo-stats", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lists top-level directories excluding dot dirs and vendor dirs", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-stats-"));
    mkdirSync(path.join(tempDir, "src"));
    mkdirSync(path.join(tempDir, "node_modules"));
    mkdirSync(path.join(tempDir, ".git"));
    mkdirSync(path.join(tempDir, "apps"));

    expect(listTopLevelDirs(tempDir)).toEqual(["apps", "src"]);
  });

  it("measures small repo via filesystem when not a git repo", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-stats-"));
    mkdirSync(path.join(tempDir, "src"));
    writeFileSync(path.join(tempDir, "src", "index.ts"), "export {};\n", "utf8");
    writeFileSync(path.join(tempDir, "package.json"), "{}", "utf8");

    const stats = measureRepo(tempDir);
    expect(stats.source).toBe("filesystem");
    expect(stats.trackedFiles).toBeGreaterThan(0);
    expect(stats.isLarge).toBe(false);
    expect(stats.topLevelDirs).toContain("src");
  });

  it("marks repo as large when git tracked files exceed threshold", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-stats-"));
    execSync("git init", { cwd: tempDir, stdio: "ignore" });

    for (let i = 0; i < LARGE_REPO_FILE_THRESHOLD; i += 1) {
      writeFileSync(path.join(tempDir, `file-${i}.txt`), "x\n", "utf8");
    }

    execSync("git add .", { cwd: tempDir, stdio: "ignore" });
    execSync('git -c user.email="t@example.com" -c user.name="Test" commit -m "init"', {
      cwd: tempDir,
      stdio: "ignore",
    });

    const stats = measureRepo(tempDir);
    expect(stats.source).toBe("git");
    expect(stats.trackedFiles).toBeGreaterThanOrEqual(LARGE_REPO_FILE_THRESHOLD);
    expect(stats.isLarge).toBe(true);
  });
});
