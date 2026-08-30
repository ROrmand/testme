import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  beforeCommitHook,
  beforePushHook,
  beforePushRefHook,
  commitBlockedMessage,
  getCurrentBranch,
  isPushToMain,
  parsePushBranch,
  parseRemoteRef,
  pushBlockedMessage,
  resolveProtectedBranches,
} from "./hooks.js";

let isolatedCwd: string;

afterEach(() => {
  if (isolatedCwd) {
    rmSync(isolatedCwd, { recursive: true, force: true });
    isolatedCwd = "";
  }
});

function emptyProjectDir(): string {
  isolatedCwd = mkdtempSync(path.join(tmpdir(), "testme-hooks-"));
  return isolatedCwd;
}

function projectWithGateDisabled(): string {
  const cwd = emptyProjectDir();
  mkdirSync(path.join(cwd, ".testme"), { recursive: true });
  mkdirSync(path.join(cwd, "testme"), { recursive: true });
  writeFileSync(
    path.join(cwd, "testme", "config.json"),
    JSON.stringify({ gateCommits: true, protectedBranches: ["main"] }),
    "utf8",
  );
  writeFileSync(
    path.join(cwd, ".testme", "config.json"),
    JSON.stringify({ gateEnabled: false }),
    "utf8",
  );
  return cwd;
}

describe("parsePushBranch", () => {
  it("extracts branch from explicit push commands", () => {
    expect(parsePushBranch("git push origin main")).toBe("main");
    expect(parsePushBranch("git push origin feature")).toBe("feature");
    expect(parsePushBranch("git push origin HEAD:main")).toBe("main");
    expect(parsePushBranch("git push origin feature:main")).toBe("main");
    expect(parsePushBranch("git push origin refs/heads/main")).toBe("main");
    expect(parsePushBranch("git push origin origin/main")).toBe("main");
  });

  it("returns null for non-push commands", () => {
    expect(parsePushBranch("git status")).toBeNull();
    expect(parsePushBranch("git commit -m test")).toBeNull();
  });

  it("returns null for dry-run pushes", () => {
    expect(parsePushBranch("git push --dry-run origin main")).toBeNull();
  });

  it("resolves bare git push and origin-only pushes to the upstream branch", () => {
    const cwd = process.cwd();
    expect(parsePushBranch("git push", cwd)).toBe("main");
    expect(parsePushBranch("git push origin", cwd)).toBe("main");
    expect(parsePushBranch("git push -u origin HEAD", cwd)).toBe("main");
  });
});

describe("isPushToMain", () => {
  it("detects main push commands", () => {
    expect(isPushToMain("git push origin main")).toBe(true);
    expect(isPushToMain("git push origin feature")).toBe(false);
    expect(isPushToMain("git status")).toBe(false);
  });
});

describe("blocked messages", () => {
  it("includes branch name for push blocks", () => {
    expect(pushBlockedMessage("main")).toBe(
      "You must run the /testme skill before pushing to 'main'.",
    );
    expect(pushBlockedMessage("release")).toBe(
      "You must run the /testme skill before pushing to 'release'.",
    );
  });

  it("uses a commit-specific message", () => {
    expect(commitBlockedMessage()).toBe("You must run the /testme skill before committing.");
  });
});

describe("parseRemoteRef", () => {
  it("extracts branch names from git pre-push refs", () => {
    expect(parseRemoteRef("refs/heads/main")).toBe("main");
    expect(parseRemoteRef("refs/heads/feature/auth")).toBe("feature/auth");
    expect(parseRemoteRef("refs/tags/v1")).toBeNull();
  });
});

describe("beforePushRefHook", () => {
  it("denies protected branch refs without a valid pass", () => {
    const result = beforePushRefHook(emptyProjectDir(), "refs/heads/main");
    expect(result.permission).toBe("deny");
    expect(result.user_message).toBe(pushBlockedMessage("main"));
  });

  it("allows protected branch refs when gate is disabled", () => {
    const result = beforePushRefHook(projectWithGateDisabled(), "refs/heads/main");
    expect(result.permission).toBe("allow");
  });
});

describe("resolveProtectedBranches", () => {
  it("includes configured branches and the current checkout", () => {
    const cwd = process.cwd();
    const current = getCurrentBranch(cwd);
    const protectedBranches = resolveProtectedBranches(cwd);

    expect(protectedBranches).toContain("main");
    if (current) {
      expect(protectedBranches).toContain(current);
    }
  });
});

describe("beforePushHook", () => {
  it("allows non-protected branch pushes", () => {
    const result = beforePushHook(emptyProjectDir(), "git push origin feature");
    expect(result.permission).toBe("allow");
  });

  it("denies protected branch pushes without a valid pass", () => {
    const result = beforePushHook(emptyProjectDir(), "git push origin main");
    expect(result.permission).toBe("deny");
    expect(result.user_message).toBe(pushBlockedMessage("main"));
  });

  it("allows protected branch pushes when gate is disabled", () => {
    const result = beforePushHook(projectWithGateDisabled(), "git push origin main");
    expect(result.permission).toBe("allow");
  });
});

describe("beforeCommitHook", () => {
  it("allows commits when gateCommits is disabled", () => {
    const result = beforeCommitHook(emptyProjectDir(), "git commit -m test");
    expect(result.permission).toBe("allow");
  });

  it("allows commits when gate is disabled", () => {
    const result = beforeCommitHook(projectWithGateDisabled(), "git commit -m test");
    expect(result.permission).toBe("allow");
  });
});
