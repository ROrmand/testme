import { describe, expect, it } from "vitest";
import {
  beforeCommitHook,
  beforePushHook,
  commitBlockedMessage,
  isPushToMain,
  parsePushBranch,
  pushBlockedMessage,
} from "./hooks.js";

describe("parsePushBranch", () => {
  it("extracts branch from explicit push commands", () => {
    expect(parsePushBranch("git push origin main")).toBe("main");
    expect(parsePushBranch("git push origin feature")).toBe("feature");
    expect(parsePushBranch("git push origin HEAD:main")).toBe("main");
    expect(parsePushBranch("git push origin feature:main")).toBe("main");
    expect(parsePushBranch("git push origin refs/heads/main")).toBe("main");
  });

  it("returns null for non-push commands", () => {
    expect(parsePushBranch("git status")).toBeNull();
    expect(parsePushBranch("git commit -m test")).toBeNull();
  });

  it("returns null for dry-run pushes", () => {
    expect(parsePushBranch("git push --dry-run origin main")).toBeNull();
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

describe("beforePushHook", () => {
  it("allows non-protected branch pushes", () => {
    const result = beforePushHook("/tmp", "git push origin feature");
    expect(result.permission).toBe("allow");
  });

  it("denies protected branch pushes without a valid pass", () => {
    const result = beforePushHook("/tmp", "git push origin main");
    expect(result.permission).toBe("deny");
    expect(result.user_message).toBe(pushBlockedMessage("main"));
  });
});

describe("beforeCommitHook", () => {
  it("allows commits when gateCommits is disabled", () => {
    const result = beforeCommitHook("/tmp", "git commit -m test");
    expect(result.permission).toBe("allow");
  });
});
