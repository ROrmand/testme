import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildGitignorePlan, GITIGNORE_MARKER, hookConfigHasNonTestmeContent } from "./gitignore.js";
import { initProjectSync } from "./init.js";

describe("gitignore planning", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("includes skill and hook paths for installed agents", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-gitignore-"));
    const plan = buildGitignorePlan(tempDir, ["cursor", "claude"]);
    expect(plan.lines).toContain(".testme/");
    expect(plan.lines).toContain(".cursor/skills/testme/");
    expect(plan.lines).toContain(".claude/skills/testme/");
    expect(plan.lines).toContain(".cursor/hooks.json");
  });

  it("skips hook config gitignore when mixed hooks exist", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-gitignore-"));
    mkdirSync(path.join(tempDir, ".cursor"), { recursive: true });
    writeFileSync(
      path.join(tempDir, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeShellExecution: [{ command: "./custom-hook.sh" }],
        },
      }),
      "utf8",
    );

    expect(hookConfigHasNonTestmeContent(path.join(tempDir, ".cursor", "hooks.json"))).toBe(true);
    const plan = buildGitignorePlan(tempDir, ["cursor"]);
    expect(plan.lines).not.toContain(".cursor/hooks.json");
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe("initProjectSync", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("installs cursor integration and gitignore block", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-init-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    const created = initProjectSync(tempDir, {
      agents: ["cursor"],
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium" },
    });

    expect(created.some((item) => item.includes(".cursor/hooks.json"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".testme", "hooks", "block-push.sh"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testme", "SKILL.md"))).toBe(true);

    const gitignore = readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(GITIGNORE_MARKER);
    expect(gitignore).toContain(".cursor/skills/testme/");
  });

  it("installs agents-md section", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-init-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    initProjectSync(tempDir, {
      agents: ["agents-md"],
      wizard: { questions: { min: 2, max: 2 }, difficulty: "easy" },
    });

    const agentsMd = readFileSync(path.join(tempDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("testme comprehension gate");
    expect(agentsMd).toContain("<!-- testme:start -->");
  });
});
