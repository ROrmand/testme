import { isPassValid } from "./verify.js";

const MAIN_PATTERNS = [
  /\bHEAD:main\b/,
  /\borigin\s+main\b/,
  /\bmain\b(?:\s*$)/,
  /refs\/heads\/main/,
];

export function isPushToMain(command: string): boolean {
  const trimmed = command.trim();
  if (!/^git\s+push\b/.test(trimmed)) {
    return false;
  }

  if (/\b(-n|--dry-run)\b/.test(trimmed)) {
    return false;
  }

  return MAIN_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function beforePushHook(cwd: string, command: string, branch = "main"): {
  permission: "allow" | "deny";
  user_message?: string;
  agent_message?: string;
} {
  if (!isPushToMain(command)) {
    return { permission: "allow" };
  }

  if (isPassValid(cwd, branch)) {
    return { permission: "allow" };
  }

  return {
    permission: "deny",
    user_message:
      "Push to main blocked: run /testme (or `npx testme generate` then verify answers) before pushing.",
    agent_message:
      "Push to main requires a valid .testme/pass.json for the current diff. Run /testme or `npx testme generate`, write .testme/answers.json, then `npx testme verify`.",
  };
}
