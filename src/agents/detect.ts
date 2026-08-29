import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AgentDetectionResult, AgentId, AgentSignal } from "./types.js";

function addSignal(signals: AgentSignal[], signal: AgentSignal): void {
  const existing = signals.find((s) => s.id === signal.id);
  if (!existing || (existing.confidence === "medium" && signal.confidence === "high")) {
    if (existing) {
      signals.splice(signals.indexOf(existing), 1);
    }
    signals.push(signal);
  }
}

function hasRepoSignal(cwd: string, relativePath: string): boolean {
  return existsSync(path.join(cwd, relativePath));
}

function agentsMdMentionsTestme(cwd: string): boolean {
  const agentsPath = path.join(cwd, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    return false;
  }
  const content = readFileSync(agentsPath, "utf8").toLowerCase();
  return content.includes("testme") || content.includes("npx testme");
}

export function detectAgents(cwd: string, env: NodeJS.ProcessEnv = process.env): AgentDetectionResult {
  const signals: AgentSignal[] = [];

  if (
    hasRepoSignal(cwd, ".cursor/hooks.json") ||
    hasRepoSignal(cwd, ".cursor/skills") ||
    hasRepoSignal(cwd, ".cursor")
  ) {
    addSignal(signals, {
      id: "cursor",
      confidence: hasRepoSignal(cwd, ".cursor/hooks.json") ? "high" : "medium",
      reason: ".cursor/ configuration found in repo",
    });
  }

  if (
    hasRepoSignal(cwd, ".claude/settings.json") ||
    hasRepoSignal(cwd, ".claude/skills") ||
    hasRepoSignal(cwd, ".claude")
  ) {
    addSignal(signals, {
      id: "claude",
      confidence: hasRepoSignal(cwd, ".claude/settings.json") ? "high" : "medium",
      reason: ".claude/ configuration found in repo",
    });
  }

  if (hasRepoSignal(cwd, ".windsurf/hooks.json") || hasRepoSignal(cwd, ".windsurf")) {
    addSignal(signals, {
      id: "windsurf",
      confidence: hasRepoSignal(cwd, ".windsurf/hooks.json") ? "high" : "medium",
      reason: ".windsurf/ configuration found in repo",
    });
  }

  if (agentsMdMentionsTestme(cwd)) {
    addSignal(signals, {
      id: "agents-md",
      confidence: "high",
      reason: "AGENTS.md already references testme",
    });
  }

  if (env.CURSOR_TRACE_ID || env.CURSOR_SESSION_ID) {
    addSignal(signals, {
      id: "cursor",
      confidence: "medium",
      reason: "Cursor environment detected",
    });
  }

  if (env.CLAUDE_CODE || env.CLAUDE_SESSION) {
    addSignal(signals, {
      id: "claude",
      confidence: "medium",
      reason: "Claude Code environment detected",
    });
  }

  const suggested = [...new Set(signals.map((s) => s.id))];
  const highConfidence = new Set(
    signals.filter((s) => s.confidence === "high").map((s) => s.id),
  );
  const ambiguous = suggested.length !== 1 && !(suggested.length === 0 && highConfidence.size === 0);

  return {
    signals,
    suggested: suggested.length > 0 ? suggested : [],
    ambiguous: suggested.length === 0 || suggested.length > 1,
  };
}

export function parseAgentList(value: string): AgentId[] {
  if (value === "all") {
    return ["cursor", "claude", "windsurf", "agents-md"];
  }

  const ids = value.split(",").map((part) => part.trim()) as AgentId[];
  const valid: AgentId[] = ["cursor", "claude", "windsurf", "agents-md"];
  for (const id of ids) {
    if (!valid.includes(id)) {
      throw new Error(`Unknown agent: ${id}. Use cursor, claude, windsurf, agents-md, or all.`);
    }
  }
  return ids;
}
