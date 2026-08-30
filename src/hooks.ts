import { execFileSync } from "node:child_process";
import { loadConfig } from "./config.js";
import { resetPromptsAfterPush } from "./init.js";
import { isPassValid } from "./verify.js";

export interface HookResult {
  permission: "allow" | "deny";
  user_message?: string;
  agent_message?: string;
}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

export function normalizeBranchRef(ref: string): string {
  const withoutRefs = ref.replace(/^refs\/heads\//, "");
  const slash = withoutRefs.lastIndexOf("/");
  if (slash >= 0) {
    return withoutRefs.slice(slash + 1);
  }
  return withoutRefs;
}

function normalizeBranch(ref: string): string {
  return normalizeBranchRef(ref);
}

export function getCurrentBranch(cwd: string): string | null {
  const head = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (!head || head === "HEAD") {
    return null;
  }
  return normalizeBranch(head);
}

/** Branch used for diff analysis and pass validation. */
export function resolveWorkingBranch(cwd: string, cliBranch?: string): string {
  if (cliBranch) {
    return cliBranch;
  }

  const config = loadConfig(cwd);
  if (config.autoProtectCurrentBranch) {
    const current = getCurrentBranch(cwd);
    if (current) {
      return current;
    }
  }

  return config.protectedBranches[0] ?? "main";
}

/** Protected push targets: config list + current branch (when enabled). */
export function resolveProtectedBranches(cwd: string, cliBranch?: string): string[] {
  const config = loadConfig(cwd);
  const branches = [...config.protectedBranches];

  if (config.autoProtectCurrentBranch) {
    const current = getCurrentBranch(cwd);
    if (current) {
      branches.push(current);
    }
  }

  if (cliBranch) {
    branches.push(cliBranch);
  }

  return [...new Set(branches)];
}

function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;

  for (const match of command.matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }

  return tokens;
}

export function parsePushBranch(command: string, cwd?: string): string | null {
  const trimmed = command.trim();
  if (!/^git\s+push\b/.test(trimmed)) {
    return null;
  }

  if (/(?:^|\s)--dry-run(?:\s|$)/.test(trimmed) || /(?:^|\s)-n(?:\s|$)/.test(trimmed)) {
    return null;
  }

  const tokens = tokenizeShell(trimmed);
  const positional: string[] = [];

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--") {
      positional.push(...tokens.slice(i + 1));
      break;
    }
    if (token.startsWith("-")) {
      continue;
    }
    positional.push(token);
  }

  if (positional.length >= 2) {
    const refspec = positional[1];
    if (refspec.toUpperCase() === "HEAD" && cwd) {
      const head = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
      return head ? normalizeBranch(head) : null;
    }
    if (refspec.includes(":")) {
      const remotePart = refspec.split(":").at(-1);
      return remotePart ? normalizeBranch(remotePart) : null;
    }
    return normalizeBranch(refspec);
  }

  if (cwd) {
    const pushRef = runGit(["rev-parse", "--abbrev-ref", "@{push}"], cwd);
    if (pushRef) {
      return normalizeBranch(pushRef);
    }
  }

  if (positional.length === 1 && cwd) {
    const head = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    return head ? normalizeBranch(head) : null;
  }

  return null;
}

/** @deprecated Use parsePushBranch instead */
export function isPushToMain(command: string): boolean {
  const branch = parsePushBranch(command);
  return branch === "main";
}

export function pushBlockedMessage(branch: string): string {
  return `You must run the /testme skill before pushing to '${branch}'.`;
}

export function commitBlockedMessage(): string {
  return "You must run the /testme skill before committing.";
}

export function beforeCommitHook(
  cwd: string,
  command: string,
  cliBranch?: string,
): HookResult {
  if (!/^git\s+commit\b/.test(command.trim())) {
    return { permission: "allow" };
  }

  const config = loadConfig(cwd);
  if (config.gateEnabled === false) {
    return { permission: "allow" };
  }

  if (!config.gateCommits) {
    return { permission: "allow" };
  }

  const branch = resolveWorkingBranch(cwd, cliBranch);
  if (isPassValid(cwd, branch)) {
    return { permission: "allow" };
  }

  const message = commitBlockedMessage();
  return {
    permission: "deny",
    user_message: message,
    agent_message: message,
  };
}

export function parseRemoteRef(remoteRef: string): string | null {
  const match = remoteRef.match(/^refs\/heads\/(.+)$/);
  return match?.[1] ?? null;
}

function evaluateProtectedPush(
  cwd: string,
  targetBranch: string,
  cliBranch?: string,
): HookResult {
  const config = loadConfig(cwd);
  if (config.gateEnabled === false) {
    return { permission: "allow" };
  }

  const protectedBranches = resolveProtectedBranches(cwd, cliBranch);

  if (!protectedBranches.includes(targetBranch)) {
    return { permission: "allow" };
  }

  const passBranch = resolveWorkingBranch(cwd, cliBranch);
  if (isPassValid(cwd, passBranch)) {
    return { permission: "allow" };
  }

  const message = pushBlockedMessage(targetBranch);
  return {
    permission: "deny",
    user_message: message,
    agent_message: message,
  };
}

export function beforePushRefHook(
  cwd: string,
  remoteRef: string,
  cliBranch?: string,
): HookResult {
  const targetBranch = parseRemoteRef(remoteRef);
  if (!targetBranch) {
    return { permission: "allow" };
  }

  return evaluateProtectedPush(cwd, targetBranch, cliBranch);
}

export function beforePushHook(
  cwd: string,
  command: string,
  cliBranch?: string,
): HookResult {
  const targetBranch = parsePushBranch(command, cwd);
  if (!targetBranch) {
    return { permission: "allow" };
  }

  return evaluateProtectedPush(cwd, targetBranch, cliBranch);
}

export function afterPushHook(cwd: string, command: string, cliBranch?: string): void {
  const targetBranch = parsePushBranch(command, cwd);
  if (!targetBranch) {
    return;
  }

  const protectedBranches = resolveProtectedBranches(cwd, cliBranch);

  if (!protectedBranches.includes(targetBranch)) {
    return;
  }

  resetPromptsAfterPush(cwd);
}
