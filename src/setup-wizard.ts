import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { TestmeConfig } from "./types.js";
import { ALL_CATEGORY_KEYS } from "./types.js";
import { AGENT_LABELS, type AgentId } from "./agents/types.js";
import type { AgentSignal } from "./agents/types.js";

export type Difficulty = "easy" | "medium" | "hard";
export type AlignmentLevel = "low" | "medium" | "high";

export interface WizardChoices {
  questions: { min: number; max: number };
  difficulty: Difficulty;
}

export function questionsFromCount(count: number): { min: number; max: number } {
  const n = Math.min(5, Math.max(1, count));
  if (n <= 2) {
    return { min: 2, max: 2 };
  }
  if (n === 3) {
    return { min: 2, max: 3 };
  }
  if (n === 4) {
    return { min: 3, max: 4 };
  }
  return { min: 3, max: 5 };
}

export function parseQuestionsOption(value: string): { min: number; max: number } {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 5) {
    throw new Error("Questions must be a number between 1 and 5.");
  }
  return questionsFromCount(n);
}

export function parseDifficultyOption(value: string): Difficulty {
  if (value !== "easy" && value !== "medium" && value !== "hard") {
    throw new Error("Difficulty must be easy, medium, or hard.");
  }
  return value;
}

export function minAlignmentForDifficulty(difficulty: Difficulty): AlignmentLevel {
  if (difficulty === "easy") {
    return "low";
  }
  if (difficulty === "hard") {
    return "high";
  }
  return "medium";
}

export function applyWizardToConfig(config: TestmeConfig, wizard: WizardChoices): TestmeConfig {
  const next: TestmeConfig = {
    ...config,
    questions: { ...wizard.questions },
    difficulty: wizard.difficulty,
    minAlignment: minAlignmentForDifficulty(wizard.difficulty),
    categories: { ...config.categories },
  };

  if (wizard.difficulty === "easy") {
    for (const key of ALL_CATEGORY_KEYS) {
      next.categories[key] = key === "changeRationale" || key === "symbols";
    }
    next.autoDetect = false;
    next.passThreshold = 60;
  } else if (wizard.difficulty === "medium") {
    next.autoDetect = true;
    next.passThreshold = 70;
  } else {
    next.autoDetect = true;
    next.passThreshold = 85;
    next.categories.architecture = true;
    next.categories.runtime = true;
    next.categories.security = true;
  }

  return next;
}

export const DEFAULT_WIZARD_CHOICES: WizardChoices = {
  questions: { min: 2, max: 3 },
  difficulty: "medium",
};

async function ask(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

export async function promptAgentSelection(
  signals: AgentSignal[],
  suggested: AgentId[],
): Promise<AgentId[]> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("\nWhich desktop agent(s) should testme configure?");
    if (signals.length > 0) {
      console.log("Detected signals:");
      for (const signal of signals) {
        console.log(`  - ${AGENT_LABELS[signal.id]} (${signal.confidence}): ${signal.reason}`);
      }
    }

    const options: AgentId[] = ["cursor", "claude", "windsurf", "agents-md"];
    options.forEach((id, index) => {
      const mark = suggested.includes(id) ? " *" : "";
      console.log(`  ${index + 1}. ${AGENT_LABELS[id]}${mark}`);
    });
    console.log("  5. All of the above");
    console.log("Enter numbers separated by commas (e.g. 1,3), or press Enter for detected/all:");

    const raw = await ask(rl, "> ");
    if (!raw) {
      return suggested.length > 0 ? suggested : options;
    }

    if (raw === "5" || raw.toLowerCase() === "all") {
      return options;
    }

    const picks = raw
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 4);

    if (picks.length === 0) {
      return suggested.length > 0 ? suggested : options;
    }

    return [...new Set(picks.map((n) => options[n - 1]).filter(Boolean))];
  } finally {
    rl.close();
  }
}

export async function promptWizardChoices(): Promise<WizardChoices> {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("\nHow many questions per session?");
    console.log("  1. 2 (quick)");
    console.log("  2. 3 (balanced)");
    console.log("  3. 5 (thorough)");
    console.log("  4. Custom (1-5)");

    const countRaw = await ask(rl, "> ");
    let questions: { min: number; max: number };

    switch (countRaw) {
      case "1":
      case "2":
        questions = { min: 2, max: 2 };
        break;
      case "3":
        questions = { min: 2, max: 3 };
        break;
      case "5":
        questions = { min: 3, max: 5 };
        break;
      case "4": {
        const custom = await ask(rl, "Enter number of questions (1-5): ");
        questions = parseQuestionsOption(custom);
        break;
      }
      default:
        questions = countRaw === "" ? DEFAULT_WIZARD_CHOICES.questions : parseQuestionsOption(countRaw);
    }

    console.log("\nHow difficult should the questions be?");
    console.log("  1. Easy   (60% pass, basic categories)");
    console.log("  2. Medium (70% pass, balanced)");
    console.log("  3. Hard   (85% pass, strict alignment)");

    const diffRaw = await ask(rl, "> ");
    let difficulty: Difficulty;
    switch (diffRaw) {
      case "1":
        difficulty = "easy";
        break;
      case "3":
        difficulty = "hard";
        break;
      case "2":
      case "":
        difficulty = "medium";
        break;
      default:
        difficulty = parseDifficultyOption(diffRaw);
    }

    return { questions, difficulty };
  } finally {
    rl.close();
  }
}
