import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, patchLocalConfig } from "./config.js";
import {
  formatGateBanner,
  formatStatusline,
  isGateEnabled,
  setGateEnabled,
  toggleGateEnabled,
} from "./testing.js";

let tempDir: string;

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function freshProject(): string {
  tempDir = mkdtempSync(path.join(tmpdir(), "testme-testing-"));
  return tempDir;
}

describe("isGateEnabled", () => {
  it("defaults to true when unset", () => {
    expect(isGateEnabled(freshProject())).toBe(true);
  });

  it("reads gateEnabled from local config", () => {
    const cwd = freshProject();
    patchLocalConfig(cwd, { gateEnabled: false });
    expect(isGateEnabled(cwd)).toBe(false);
    expect(loadConfig(cwd).gateEnabled).toBe(false);
  });
});

describe("setGateEnabled and toggleGateEnabled", () => {
  it("persists enabled state in .testme/config.json", () => {
    const cwd = freshProject();
    setGateEnabled(cwd, false);
    const raw = JSON.parse(readFileSync(path.join(cwd, ".testme", "config.json"), "utf8"));
    expect(raw.gateEnabled).toBe(false);
  });

  it("toggles between on and off", () => {
    const cwd = freshProject();
    expect(toggleGateEnabled(cwd)).toBe(false);
    expect(toggleGateEnabled(cwd)).toBe(true);
  });
});

describe("formatGateBanner", () => {
  it("shows ON and OFF states", () => {
    expect(formatGateBanner(true)).toContain("ON");
    expect(formatGateBanner(true)).toContain("🟢");
    expect(formatGateBanner(false)).toContain("OFF");
    expect(formatGateBanner(false)).toContain("🔴");
  });
});

describe("formatStatusline", () => {
  it("returns compact one-line status", () => {
    expect(formatStatusline(true)).toBe("🟢 testme");
    expect(formatStatusline(false)).toBe("🔴 testme off");
  });
});
