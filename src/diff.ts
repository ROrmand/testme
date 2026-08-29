import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { DiffAnalysis, FileChange } from "./types.js";

const SYMBOL_PATTERNS = [
  /^\+\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  /^\+\s*(?:export\s+)?class\s+(\w+)/,
  /^\+\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
  /^\+\s*def\s+(\w+)\s*\(/,
  /^\+\s*func\s+(\w+)\s*\(/,
  /^\+\s*type\s+(\w+)\s+/,
  /^\+\s*interface\s+(\w+)\s*/,
  /^\+\s*enum\s+(\w+)\s*/,
];

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

export function resolveBaseRef(cwd: string, branch = "main"): string {
  const upstream = runGit(["rev-parse", "--abbrev-ref", `${branch}@{upstream}`], cwd);
  if (upstream) {
    const remoteBranch = upstream.replace(/^[^/]+\//, "");
    if (remoteBranch) {
      return `origin/${remoteBranch}`;
    }
  }

  if (runGit(["rev-parse", "--verify", `origin/${branch}`], cwd)) {
    return `origin/${branch}`;
  }

  if (runGit(["rev-parse", "--verify", branch], cwd)) {
    return branch;
  }

  if (runGit(["rev-parse", "--verify", "master"], cwd)) {
    return "master";
  }

  return branch;
}

export function getDiffText(cwd: string, baseRef: string, branch = "main"): string {
  const rangeCandidates = new Set<string>();
  if (baseRef && baseRef !== "HEAD") {
    rangeCandidates.add(`${baseRef}...HEAD`);
  }
  rangeCandidates.add(`origin/${branch}...HEAD`);
  rangeCandidates.add(`${branch}...HEAD`);
  rangeCandidates.add("main...HEAD");
  rangeCandidates.add("master...HEAD");

  for (const range of rangeCandidates) {
    const rangeDiff = runGit(["diff", range], cwd);
    if (rangeDiff) {
      return rangeDiff;
    }
  }

  const staged = runGit(["diff", "--cached"], cwd);
  const unstaged = runGit(["diff"], cwd);
  const working = [staged, unstaged].filter(Boolean).join("\n");
  if (working) {
    return working;
  }

  const rootDiff = runGit(["diff", "--root", "HEAD"], cwd);
  if (rootDiff) {
    return rootDiff;
  }

  const showDiff = runGit(["show", "HEAD", "--format=", "-p"], cwd);
  if (showDiff) {
    return showDiff;
  }

  return "";
}

export function hashDiff(diffText: string): string {
  return createHash("sha256").update(diffText).digest("hex");
}

function extractSymbolsFromHunk(line: string): string | null {
  for (const pattern of SYMBOL_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function parseDiff(diffText: string, baseRef: string): DiffAnalysis {
  const files = new Map<string, Set<string>>();
  let currentFile: string | null = null;

  for (const line of diffText.split("\n")) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      if (!files.has(currentFile)) {
        files.set(currentFile, new Set());
      }
      continue;
    }

    if (!currentFile || !line.startsWith("+")) {
      continue;
    }

    const symbol = extractSymbolsFromHunk(line);
    if (symbol) {
      files.get(currentFile)?.add(symbol);
    }
  }

  const fileChanges: FileChange[] = [...files.entries()].map(([filePath, symbols]) => ({
    path: filePath,
    symbols: [...symbols],
  }));

  return {
    diffHash: hashDiff(diffText),
    baseRef,
    rawDiff: diffText,
    files: fileChanges,
  };
}

export function analyzeDiff(cwd: string, branch = "main"): DiffAnalysis {
  const baseRef = resolveBaseRef(cwd, branch);
  const rawDiff = getDiffText(cwd, baseRef, branch);
  return parseDiff(rawDiff, baseRef);
}

export function extractTerms(text: string): string[] {
  const terms = new Set<string>();

  for (const match of text.matchAll(/`([^`]+)`|\b[A-Za-z][A-Za-z0-9_]{2,}\b/g)) {
    const term = (match[1] ?? match[0]).trim();
    if (term.length < 3) {
      continue;
    }
    const lower = term.toLowerCase();
    if (STOP_WORDS.has(lower)) {
      continue;
    }
    terms.add(term);
  }

  return [...terms].slice(0, 8);
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "added",
  "updated",
  "changed",
  "removed",
  "file",
  "files",
  "function",
  "class",
  "const",
  "let",
  "var",
  "import",
  "export",
  "return",
  "session",
  "changes",
  "change",
  "using",
  "when",
  "what",
  "why",
  "how",
  "new",
  "fix",
  "bug",
]);
