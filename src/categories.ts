import { extractTerms } from "./diff.js";
import {
  loadPromptsSections,
  loadSummary,
  summaryArchitectureTerms,
  termsForFile,
} from "./prompts.js";
import type {
  CategoryKey,
  DiffAnalysis,
  FileChange,
  QuestionCandidate,
  QuestionType,
} from "./types.js";

export interface CategoryContext {
  analysis: DiffAnalysis;
  files: FileChange[];
  summary: string;
  promptsSections: ReturnType<typeof loadPromptsSections>;
  rawDiff: string;
}

const DATA_STRUCTURE_TERMS = [
  "array",
  "list",
  "queue",
  "stack",
  "map",
  "set",
  "tree",
  "graph",
  "heap",
  "hash",
  "matrix",
  "vector",
  "sort",
  "search",
  "complexity",
  "big-o",
  "O(n)",
];

const ERROR_TERMS = ["throw", "catch", "error", "exception", "try", "finally", "Result", "reject"];

const SECURITY_TERMS = ["auth", "token", "encrypt", "sanitize", "secret", "password", "jwt", "csrf", "xss"];

const PERFORMANCE_TERMS = ["cache", "memo", "optimize", "latency", "throughput", "complexity", "batch"];

function questionTypeForCategory(category: CategoryKey): QuestionType {
  if (category === "changeRationale") {
    return "change_rationale";
  }
  if (category === "symbols") {
    return "symbol";
  }
  if (category === "architecture") {
    return "architecture";
  }
  return "category";
}

function isBoilerplatePath(filePath: string): boolean {
  return (
    filePath.startsWith(".cursor/") ||
    filePath.startsWith(".claude/") ||
    filePath.startsWith(".windsurf/") ||
    filePath === "AGENTS.md" ||
    filePath === ".gitignore" ||
    filePath === "PROMPTS.md" ||
    filePath === "SUMMARY.md" ||
    filePath === "testme.config.json"
  );
}

export function relevantFiles(files: FileChange[]): FileChange[] {
  const filtered = files.filter((file) => !isBoilerplatePath(file.path));
  return filtered.length > 0 ? filtered : files;
}

function matchesPath(files: FileChange[], pattern: RegExp): FileChange[] {
  return files.filter((file) => pattern.test(file.path));
}

function termsFromDiffKeywords(rawDiff: string, keywords: string[]): string[] {
  const terms = new Set<string>();
  const lower = rawDiff.toLowerCase();

  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      terms.add(keyword);
    }
  }

  return [...terms];
}

function runtimeTerms(summary: string): string[] {
  const terms = new Set<string>(["run", "test"]);
  let inRuntime = false;

  for (const line of summary.split("\n")) {
    if (/^##\s+Runtime Notes\s*$/i.test(line)) {
      inRuntime = true;
      continue;
    }
    if (inRuntime && /^##\s+/.test(line)) {
      break;
    }
    if (inRuntime) {
      for (const term of extractTerms(line)) {
        terms.add(term);
      }
    }
  }

  return [...terms].slice(0, 5);
}

function domainTerms(category: CategoryKey): string[] {
  const map: Partial<Record<CategoryKey, string[]>> = {
    machineLearning: ["training", "inference", "model", "metrics", "dataset", "pipeline"],
    cybersecurity: ["threat", "attack", "mitigation", "vulnerability", "encrypt", "auth"],
    frontend: ["component", "state", "render", "accessibility", "props"],
    backend: ["route", "middleware", "handler", "service", "request"],
    devops: ["deploy", "pipeline", "container", "workflow", "environment"],
    mobile: ["platform", "native", "screen", "navigation", "device"],
    dataEngineering: ["pipeline", "etl", "warehouse", "transform", "lineage"],
  };

  return map[category] ?? [];
}

export function buildCandidates(
  category: CategoryKey,
  ctx: CategoryContext,
): QuestionCandidate[] {
  const candidates: QuestionCandidate[] = [];
  const type = questionTypeForCategory(category);

  switch (category) {
    case "changeRationale": {
      for (const file of ctx.files) {
        const promptTerms = termsForFile(ctx.promptsSections, file.path);
        const symbolTerms = file.symbols.slice(0, 4);
        const requiredTerms = [...new Set([...promptTerms, ...symbolTerms])].slice(0, 6);
        if (requiredTerms.length === 0) {
          continue;
        }

        candidates.push({
          category,
          type,
          prompt: `What changed in ${file.path} and why?`,
          files: [file.path],
          rubric: { requiredTerms, minLength: 40 },
          priority: 100,
        });
      }
      break;
    }

    case "symbols": {
      for (const file of ctx.files) {
        for (const symbol of file.symbols) {
          const promptTerms = termsForFile(ctx.promptsSections, file.path);
          candidates.push({
            category,
            type,
            prompt: `What does ${symbol} in ${file.path} do after your changes?`,
            files: [file.path],
            rubric: {
              requiredTerms: [...new Set([symbol, ...promptTerms.slice(0, 3)])],
              minLength: 30,
              requiredSymbol: symbol,
            },
            priority: 80,
          });
        }
      }
      break;
    }

    case "architecture": {
      const archTerms = summaryArchitectureTerms(ctx.summary);
      if (archTerms.length > 0 && ctx.files.length > 0) {
        candidates.push({
          category,
          type,
          prompt: "How do these changes fit into the project architecture described in SUMMARY.md?",
          files: ctx.files.map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: archTerms.slice(0, 4), minLength: 50 },
          priority: 70,
        });
      }
      break;
    }

    case "runtime": {
      const runtimeFiles = matchesPath(
        ctx.files,
        /(Dockerfile|docker-compose|Makefile|package\.json|pyproject\.toml|\.github\/workflows\/)/i,
      );
      const terms = [...runtimeTerms(ctx.summary), ...runtimeFiles.map((f) => f.path).slice(0, 2)].slice(0, 5);
      if (terms.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "How do you run, test, or deploy the project after these changes?",
          files: (runtimeFiles.length > 0 ? runtimeFiles : ctx.files).map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: terms, minLength: 45 },
          priority: 60,
        });
      }
      break;
    }

    case "dataStructures": {
      const terms = [
        ...termsFromDiffKeywords(ctx.rawDiff, DATA_STRUCTURE_TERMS),
        ...termsForFile(ctx.promptsSections, ctx.files[0]?.path ?? ""),
      ].slice(0, 5);
      if (terms.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What data structures or algorithms did these changes use, and why?",
          files: ctx.files.map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: terms, minLength: 45 },
          priority: 55,
        });
      }
      break;
    }

    case "dependencies": {
      const depFiles = matchesPath(ctx.files, /(package\.json|package-lock\.json|pyproject\.toml|requirements\.txt|go\.mod)/i);
      if (depFiles.length > 0) {
        const terms = [
          ...depFiles.map((f) => f.path),
          ...termsForFile(ctx.promptsSections, depFiles[0].path),
        ].slice(0, 5);
        candidates.push({
          category,
          type: "category",
          prompt: "Why were dependencies added or changed in this push?",
          files: depFiles.map((f) => f.path),
          rubric: { requiredTerms: terms, minLength: 40 },
          priority: 50,
        });
      }
      break;
    }

    case "testing": {
      const testFiles = matchesPath(ctx.files, /(test|spec)\./i);
      if (testFiles.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What tests cover these changes and what behavior do they assert?",
          files: testFiles.map((f) => f.path).slice(0, 3),
          rubric: {
            requiredTerms: [...testFiles.map((f) => f.path), "test"].slice(0, 5),
            minLength: 40,
          },
          priority: 65,
        });
      }
      break;
    }

    case "errorHandling": {
      const terms = termsFromDiffKeywords(ctx.rawDiff, ERROR_TERMS);
      if (terms.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "How are errors and edge cases handled in these changes?",
          files: ctx.files.map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: terms.slice(0, 4), minLength: 40 },
          priority: 45,
        });
      }
      break;
    }

    case "apiContracts": {
      const apiFiles = matchesPath(ctx.files, /(route|api|schema|openapi|proto|types?)\./i);
      if (apiFiles.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What API, schema, or interface contracts changed?",
          files: apiFiles.map((f) => f.path).slice(0, 3),
          rubric: {
            requiredTerms: [...apiFiles.map((f) => f.path), "interface", "api"].slice(0, 5),
            minLength: 40,
          },
          priority: 55,
        });
      }
      break;
    }

    case "security": {
      const terms = [
        ...termsFromDiffKeywords(ctx.rawDiff, SECURITY_TERMS),
        ...termsForFile(ctx.promptsSections, ctx.files[0]?.path ?? ""),
      ].slice(0, 5);
      if (terms.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What security implications do these changes have?",
          files: ctx.files.map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: terms, minLength: 45 },
          priority: 50,
        });
      }
      break;
    }

    case "performance": {
      const terms = termsFromDiffKeywords(ctx.rawDiff, PERFORMANCE_TERMS);
      if (terms.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What performance tradeoffs or optimizations are involved?",
          files: ctx.files.map((f) => f.path).slice(0, 3),
          rubric: { requiredTerms: terms.slice(0, 4), minLength: 40 },
          priority: 40,
        });
      }
      break;
    }

    case "database": {
      const dbFiles = matchesPath(ctx.files, /(migration|schema|\.sql$|prisma|drizzle)/i);
      if (dbFiles.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: "What database schema or query changes were made?",
          files: dbFiles.map((f) => f.path).slice(0, 3),
          rubric: {
            requiredTerms: [...dbFiles.map((f) => f.path), "schema", "query"].slice(0, 5),
            minLength: 40,
          },
          priority: 55,
        });
      }
      break;
    }

    case "machineLearning":
    case "cybersecurity":
    case "frontend":
    case "backend":
    case "devops":
    case "mobile":
    case "dataEngineering": {
      const terms = domainTerms(category);
      const related = ctx.files.filter((file) => {
        const lower = file.path.toLowerCase();
        return terms.some((term) => lower.includes(term.toLowerCase()));
      });

      const targetFiles = related.length > 0 ? related : ctx.files;
      if (targetFiles.length > 0) {
        candidates.push({
          category,
          type: "category",
          prompt: `From a ${category.replace(/([A-Z])/g, " $1").trim().toLowerCase()} perspective, what is the impact of these changes?`,
          files: targetFiles.map((f) => f.path).slice(0, 3),
          rubric: {
            requiredTerms: [...terms.slice(0, 3), ...termsForFile(ctx.promptsSections, targetFiles[0].path).slice(0, 2)],
            minLength: 50,
          },
          priority: 35,
        });
      }
      break;
    }
  }

  return candidates;
}

export function allocateQuestions(
  candidates: QuestionCandidate[],
  maxQuestions: number,
  minQuestions: number,
): QuestionCandidate[] {
  const selected: QuestionCandidate[] = [];
  const usedCategories = new Set<CategoryKey>();
  const usedPrompts = new Set<string>();

  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);

  const required = sorted.filter((c) => c.category === "changeRationale");
  for (const candidate of required) {
    if (selected.length >= maxQuestions) {
      break;
    }
    if (usedPrompts.has(candidate.prompt)) {
      continue;
    }
    selected.push(candidate);
    usedCategories.add(candidate.category);
    usedPrompts.add(candidate.prompt);
  }

  for (const candidate of sorted) {
    if (selected.length >= maxQuestions) {
      break;
    }
    if (usedPrompts.has(candidate.prompt)) {
      continue;
    }

    const isDomain = [
      "machineLearning",
      "cybersecurity",
      "frontend",
      "backend",
      "devops",
      "mobile",
      "dataEngineering",
    ].includes(candidate.category);

    if (isDomain && usedCategories.has(candidate.category)) {
      continue;
    }

    selected.push(candidate);
    usedCategories.add(candidate.category);
    usedPrompts.add(candidate.prompt);
  }

  if (selected.length === 0 && sorted.length > 0) {
    selected.push(sorted[0]);
  }

  while (selected.length < minQuestions && selected.length < sorted.length) {
    const next = sorted.find((c) => !usedPrompts.has(c.prompt));
    if (!next) {
      break;
    }
    selected.push(next);
    usedPrompts.add(next.prompt);
  }

  return selected.slice(0, maxQuestions);
}
