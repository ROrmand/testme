import { readFileSync, existsSync } from "node:fs";
import { PROMPTS_PATH, SUMMARY_PATH } from "./paths.js";
import { extractTerms } from "./diff.js";
import type { PromptsSection } from "./types.js";

export function readTextFile(path: string): string {
  if (!existsSync(path)) {
    return "";
  }
  return readFileSync(path, "utf8");
}

export function parsePrompts(content: string): PromptsSection[] {
  const sections: PromptsSection[] = [];
  let current: PromptsSection | null = null;

  for (const line of content.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) {
        sections.push(current);
      }
      current = { file: heading[1].trim(), bullets: [] };
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet && current) {
      current.bullets.push(bullet[1].trim());
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

export function loadPromptsSections(): PromptsSection[] {
  return parsePrompts(readTextFile(PROMPTS_PATH));
}

export function loadSummary(): string {
  return readTextFile(SUMMARY_PATH);
}

export function termsForFile(sections: PromptsSection[], filePath: string): string[] {
  const normalized = filePath.replace(/^\.\//, "");
  const section = sections.find(
    (item) =>
      item.file === normalized ||
      item.file.endsWith(`/${normalized}`) ||
      normalized.endsWith(item.file),
  );

  if (!section || section.bullets.length === 0) {
    return [];
  }

  const terms = new Set<string>();
  for (const bullet of section.bullets) {
    for (const term of extractTerms(bullet)) {
      terms.add(term);
    }
  }
  return [...terms];
}

const GENERIC_HEADINGS = new Set([
  "stack",
  "architecture",
  "conventions",
  "runtime",
  "runtime notes",
  "session changes",
  "overview",
]);

export function summaryArchitectureTerms(summary: string): string[] {
  const terms = new Set<string>();

  for (const line of summary.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      const headingText = heading[1].trim();
      if (!GENERIC_HEADINGS.has(headingText.toLowerCase())) {
        for (const term of extractTerms(headingText)) {
          terms.add(term);
        }
      }
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      for (const term of extractTerms(bullet[1])) {
        terms.add(term);
      }
    }
  }

  return [...terms].slice(0, 6);
}

export function promptsHasContent(): boolean {
  const sections = loadPromptsSections();
  return sections.some((section) => section.bullets.length > 0);
}
