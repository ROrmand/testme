import { mkdirSync, writeFileSync } from "node:fs";
import { analyzeDiff } from "./diff.js";
import {
  loadPromptsSections,
  loadSummary,
  summaryArchitectureTerms,
  termsForFile,
} from "./prompts.js";
import { SESSION_PATH, TESTME_DIR } from "./paths.js";
import type { Question, Session } from "./types.js";

const MAX_QUESTIONS = 5;

function isBoilerplatePath(filePath: string): boolean {
  return (
    filePath.startsWith(".cursor/") ||
    filePath === ".gitignore" ||
    filePath === "PROMPTS.md" ||
    filePath === "SUMMARY.md"
  );
}

function relevantFiles(files: Array<{ path: string; symbols: string[] }>) {
  const filtered = files.filter((file) => !isBoilerplatePath(file.path));
  return filtered.length > 0 ? filtered : files;
}

export function buildQuestions(cwd: string, branch = "main"): Session {
  const analysis = analyzeDiff(cwd, branch);
  const promptsSections = loadPromptsSections();
  const summary = loadSummary();
  const questions: Question[] = [];
  const files = relevantFiles(analysis.files);

  for (const file of files) {
    if (questions.length >= MAX_QUESTIONS) {
      break;
    }

    const promptTerms = termsForFile(promptsSections, file.path);
    const symbolTerms = file.symbols.slice(0, 4);
    const requiredTerms = [...new Set([...promptTerms, ...symbolTerms])].slice(0, 6);

    if (requiredTerms.length === 0) {
      continue;
    }

    questions.push({
      id: `q${questions.length + 1}`,
      type: "change_rationale",
      prompt: `What changed in ${file.path} and why?`,
      files: [file.path],
      rubric: {
        requiredTerms,
        minLength: 40,
      },
    });
  }

  for (const file of files) {
    if (questions.length >= MAX_QUESTIONS) {
      break;
    }

    for (const symbol of file.symbols) {
      if (questions.length >= MAX_QUESTIONS) {
        break;
      }

      const alreadyCovered = questions.some((question) =>
        question.rubric.requiredTerms.includes(symbol),
      );
      if (alreadyCovered) {
        continue;
      }

      const promptTerms = termsForFile(promptsSections, file.path);
      const requiredTerms = [...new Set([symbol, ...promptTerms.slice(0, 3)])];

      questions.push({
        id: `q${questions.length + 1}`,
        type: "symbol",
        prompt: `What does ${symbol} in ${file.path} do after your changes?`,
        files: [file.path],
        rubric: {
          requiredTerms,
          minLength: 30,
          requiredSymbol: symbol,
        },
      });
    }
  }

  if (questions.length < MAX_QUESTIONS && summary.trim() && files.length > 0) {
    const archTerms = summaryArchitectureTerms(summary);
    if (archTerms.length > 0) {
      const touchedPaths = files.map((file) => file.path);
      questions.push({
        id: `q${questions.length + 1}`,
        type: "architecture",
        prompt:
          "How do these changes fit into the project architecture described in SUMMARY.md?",
        files: touchedPaths.slice(0, 3),
        rubric: {
          requiredTerms: archTerms.slice(0, 4),
          minLength: 50,
        },
      });
    }
  }

  if (questions.length === 0 && files.length > 0) {
    const firstFile = files[0];
    questions.push({
      id: "q1",
      type: "change_rationale",
      prompt: `Summarize the changes in ${firstFile.path}.`,
      files: [firstFile.path],
      rubric: {
        requiredTerms: firstFile.symbols.length > 0 ? firstFile.symbols.slice(0, 3) : [firstFile.path],
        minLength: 30,
      },
    });
  }

  return {
    diffHash: analysis.diffHash,
    baseRef: analysis.baseRef,
    generatedAt: new Date().toISOString(),
    questions: questions.slice(0, MAX_QUESTIONS),
  };
}

export function generateSession(cwd: string, branch = "main"): Session {
  const session = buildQuestions(cwd, branch);

  if (session.questions.length === 0) {
    throw new Error(
      "No changes detected to generate questions from. Make changes or update PROMPTS.md.",
    );
  }

  mkdirSync(TESTME_DIR, { recursive: true });
  writeFileSync(SESSION_PATH, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}
