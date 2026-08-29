import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { agentTemplatesDir } from "./shared.js";

const SECTION_START = "<!-- testme:start -->";
const SECTION_END = "<!-- testme:end -->";

export function installAgentsMd(cwd: string, created: string[]): void {
  const sectionPath = path.join(agentTemplatesDir("agents-md"), "section.md");
  const section = readFileSync(sectionPath, "utf8").trim();
  const wrapped = `${SECTION_START}\n${section}\n${SECTION_END}`;

  const targetPath = path.join(cwd, "AGENTS.md");
  const existing = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";

  if (existing.includes(SECTION_START) && existing.includes(SECTION_END)) {
    const start = existing.indexOf(SECTION_START);
    const end = existing.indexOf(SECTION_END) + SECTION_END.length;
    const updated = `${existing.slice(0, start)}${wrapped}${existing.slice(end)}`;
    writeFileSync(targetPath, updated.endsWith("\n") ? updated : `${updated}\n`, "utf8");
    created.push("AGENTS.md (testme section updated)");
    return;
  }

  const header = existing.length > 0 ? "\n\n" : "# Agent Instructions\n\n";
  const content = existing.length > 0 ? `${existing.replace(/\s*$/, "")}${header}${wrapped}\n` : `${header}${wrapped}\n`;
  writeFileSync(targetPath, content, "utf8");
  created.push("AGENTS.md (testme section added)");
}
