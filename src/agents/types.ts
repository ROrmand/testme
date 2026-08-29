export type AgentId = "cursor" | "claude" | "windsurf" | "agents-md";

export const ALL_AGENT_IDS: AgentId[] = ["cursor", "claude", "windsurf", "agents-md"];

export interface AgentSignal {
  id: AgentId;
  confidence: "high" | "medium";
  reason: string;
}

export interface AgentDetectionResult {
  signals: AgentSignal[];
  suggested: AgentId[];
  ambiguous: boolean;
}

export const AGENT_LABELS: Record<AgentId, string> = {
  cursor: "Cursor",
  claude: "Claude Code",
  windsurf: "Windsurf",
  "agents-md": "AGENTS.md (portable fallback)",
};
