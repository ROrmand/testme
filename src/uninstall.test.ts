import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GIT_HOOK_MARKER } from "./constants.js";
import { initProjectSync } from "./init.js";
import { planUninstall, uninstallProject } from "./uninstall.js";

describe("uninstallProject", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("removes testme integration installed by init", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-uninstall-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    initProjectSync(tempDir, {
      agents: ["cursor", "agents-md"],
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium", localOnly: true, summaryMode: "blank" },
    });

    expect(existsSync(path.join(tempDir, "testme", "config.json"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testme"))).toBe(true);

    const removed = uninstallProject(tempDir);

    expect(existsSync(path.join(tempDir, "testme"))).toBe(false);
    expect(existsSync(path.join(tempDir, ".testme"))).toBe(false);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testme"))).toBe(false);
    expect(existsSync(path.join(tempDir, ".git", "hooks", "pre-push"))).toBe(false);
    expect(removed.some((item) => item.includes("testme"))).toBe(true);

    const agentsMd = readFileSync(path.join(tempDir, "AGENTS.md"), "utf8");
    expect(agentsMd).not.toContain("<!-- testme:start -->");
  });

  it("keeps testme/ data when keepData is set", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-uninstall-"));
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });

    initProjectSync(tempDir, {
      agents: ["cursor"],
      wizard: { questions: { min: 2, max: 3 }, difficulty: "medium", localOnly: true, summaryMode: "blank" },
    });

    uninstallProject(tempDir, { keepData: true });

    expect(existsSync(path.join(tempDir, "testme", "config.json"))).toBe(true);
    expect(existsSync(path.join(tempDir, ".cursor", "skills", "testme"))).toBe(false);
  });

  it("strips only testme hook entries from mixed cursor hooks.json", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-uninstall-"));
    mkdirSync(path.join(tempDir, ".cursor"), { recursive: true });
    writeFileSync(
      path.join(tempDir, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeShellExecution: [
            { command: "./custom-hook.sh", matcher: "git\\s+status" },
            { command: "testme/hooks/block-commit.sh", matcher: "git\\s+commit", failClosed: true },
          ],
        },
      }),
      "utf8",
    );

    uninstallProject(tempDir);

    const hooks = JSON.parse(readFileSync(path.join(tempDir, ".cursor", "hooks.json"), "utf8"));
    expect(hooks.hooks.beforeShellExecution).toHaveLength(1);
    expect(hooks.hooks.beforeShellExecution[0].command).toBe("./custom-hook.sh");
  });

  it("planUninstall lists paths without removing them", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "testme-uninstall-"));
    mkdirSync(path.join(tempDir, "testme"), { recursive: true });
    writeFileSync(path.join(tempDir, "testme", "config.json"), "{}", "utf8");
    mkdirSync(path.join(tempDir, ".git", "hooks"), { recursive: true });
    writeFileSync(
      path.join(tempDir, ".git", "hooks", "pre-commit"),
      `#!/bin/sh\n# ${GIT_HOOK_MARKER}\n`,
      "utf8",
    );

    const planned = planUninstall(tempDir);
    expect(planned).toContain("testme/");
    expect(planned).toContain(".git/hooks/pre-commit");
    expect(existsSync(path.join(tempDir, "testme", "config.json"))).toBe(true);
  });
});
