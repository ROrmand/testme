import { describe, expect, it } from "vitest";
import { detectAgents, parseAgentList } from "./detect.js";

describe("detectAgents", () => {
  it("detects cursor from repo signals", () => {
    const result = detectAgents("/home/strive/Documents/Projects/testme");
    expect(result.suggested).toContain("cursor");
    expect(result.signals.some((s) => s.id === "cursor")).toBe(true);
  });

  it("returns ambiguous when multiple agents are present", () => {
    const result = detectAgents("/home/strive/Documents/Projects/testme");
    if (result.suggested.length > 1) {
      expect(result.ambiguous).toBe(true);
    }
  });

  it("parses agent lists", () => {
    expect(parseAgentList("cursor,claude")).toEqual(["cursor", "claude"]);
    expect(parseAgentList("all")).toEqual(["cursor", "claude", "windsurf", "agents-md"]);
  });
});
