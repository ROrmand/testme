import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectAgents, parseAgentList } from "./detect.js";

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function fixtureDir(): string {
  tempDir = mkdtempSync(path.join(tmpdir(), "testme-detect-"));
  return tempDir;
}

describe("detectAgents", () => {
  it("detects cursor from repo signals", () => {
    const cwd = fixtureDir();
    mkdirSync(path.join(cwd, ".cursor"), { recursive: true });
    writeFileSync(path.join(cwd, ".cursor", "hooks.json"), "{}");

    const result = detectAgents(cwd);
    expect(result.suggested).toContain("cursor");
    expect(result.signals.some((s) => s.id === "cursor")).toBe(true);
  });

  it("returns ambiguous when multiple agents are present", () => {
    const cwd = fixtureDir();
    mkdirSync(path.join(cwd, ".cursor"), { recursive: true });
    mkdirSync(path.join(cwd, ".claude"), { recursive: true });
    writeFileSync(path.join(cwd, ".cursor", "hooks.json"), "{}");
    writeFileSync(path.join(cwd, ".claude", "settings.json"), "{}");

    const result = detectAgents(cwd);
    expect(result.suggested.length).toBeGreaterThan(1);
    expect(result.ambiguous).toBe(true);
  });

  it("parses agent lists", () => {
    expect(parseAgentList("cursor,claude")).toEqual(["cursor", "claude"]);
    expect(parseAgentList("all")).toEqual(["cursor", "claude", "windsurf", "agents-md"]);
  });
});
