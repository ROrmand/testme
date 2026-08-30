import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { linkSkill } from "./agents/shared.js";
import { buildGitignorePlan, GITIGNORE_MARKER, hookConfigHasNonTestmeContent } from "./gitignore.js";
import { initProjectSync } from "./init.js";
import { migrateProject } from "./migrate.js";

describe("gitignore planning", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("includes skill and hook paths for installed agents when local-only", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-gitignore-"));
    const plan = buildGitignorePlan(tempDir, ["cursor", "claude"], true);
    expect(plan.lines).toContain(".testme/");
    expect(plan.lines).toContain(".cursor/skills/testme/");
    expect(plan.lines).toContain(".cursor/skills/testing/");
    expect(plan.lines).toContain(".claude/skills/testme/");
    expect(plan.lines).toContain(".cursor/hooks.json");
  });

  it("omits skill paths when not local-only", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-gitignore-"));
    const plan = buildGitignorePlan(tempDir, ["cursor", "claude"], false);
    expect(plan.lines).toEqual([".testme/"]);
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
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium", localOnly: true, summaryMode: "blank" },
    });

    expect(created.some((item) => item.includes(".cursor/hooks.json"))).toBe(true);
    expect(existsSync(path.join(tempDir, "testme", "hooks", "block-push.sh"))).toBe(true);
    expect(existsSync(path.join(tempDir, "testme", "skills", "testme", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testme", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testing", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(tempDir, "testme", "hooks", "statusline.sh"))).toBe(true);

    const gitignore = readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(GITIGNORE_MARKER);
    expect(gitignore).toContain(".cursor/skills/testme/");
    expect(gitignore).toContain(".cursor/skills/testing/");
  });

  it("installs agents-md section", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-init-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    initProjectSync(tempDir, {
      agents: ["agents-md"],
      wizard: { questions: { min: 2, max: 2 }, difficulty: "easy", localOnly: true, summaryMode: "blank" },
    });

    const agentsMd = readFileSync(path.join(tempDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("testme comprehension gate");
    expect(agentsMd).toContain("<!-- testme:start -->");
  });

  it("skips skill gitignore when local-only is false", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-init-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    initProjectSync(tempDir, {
      agents: ["cursor"],
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium", localOnly: false, summaryMode: "blank" },
    });

    const gitignore = readFileSync(path.join(tempDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(GITIGNORE_MARKER);
    expect(gitignore).toContain(".testme/");
    expect(gitignore).not.toContain(".cursor/skills/testme/");
    expect(gitignore).not.toContain(".cursor/hooks.json");
  });

  it("generates testme/SUMMARY.md when summaryMode is generate", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-init-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });
    mkdirSync(path.join(tempDir, "src"));
    writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "demo", scripts: { test: "vitest" }, dependencies: { react: "^19.0.0" } }),
      "utf8",
    );

    const created = initProjectSync(tempDir, {
      agents: ["cursor"],
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium", localOnly: true, summaryMode: "generate" },
    });

    expect(created.some((item) => item.includes("SUMMARY.md (generated"))).toBe(true);
    const summary = readFileSync(path.join(tempDir, "testme", "SUMMARY.md"), "utf8");
    expect(summary).toContain("## Stack");
    expect(summary).toContain("React");
  });
});

describe("linkSkill", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates symlinks from agent skill paths to testme/skills", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-link-"));
    const source = path.join(tempDir, "testme", "skills", "testme");
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, "SKILL.md"), "# testme", "utf8");

    const created: string[] = [];
    linkSkill("cursor", tempDir, created);

    const target = path.join(tempDir, ".cursor", "skills", "testme");
    expect(existsSync(target)).toBe(true);
    expect(lstatSync(target).isSymbolicLink()).toBe(true);
    expect(readFileSync(path.join(target, "SKILL.md"), "utf8")).toBe("# testme");
  });
});

describe("migrateProject", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("moves legacy root files into testme/", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-migrate-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });
    writeFileSync(path.join(tempDir, "SUMMARY.md"), "# legacy summary", "utf8");
    writeFileSync(path.join(tempDir, "PROMPTS.md"), "# legacy prompts", "utf8");
    writeFileSync(path.join(tempDir, "testme.config.json"), '{"gateCommits":true}', "utf8");

    const changes = migrateProject(tempDir);

    expect(existsSync(path.join(tempDir, "testme", "SUMMARY.md"))).toBe(true);
    expect(existsSync(path.join(tempDir, "testme", "PROMPTS.md"))).toBe(true);
    expect(existsSync(path.join(tempDir, "testme", "config.json"))).toBe(true);
    expect(existsSync(path.join(tempDir, "SUMMARY.md"))).toBe(false);
    expect(changes.some((item) => item.includes("SUMMARY.md"))).toBe(true);
  });
});
