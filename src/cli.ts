#!/usr/bin/env node

import { Command } from "commander";
import { formatConfigForDisplay, initConfig, showConfig } from "./config-init.js";
import { detectProject } from "./detect.js";
import { analyzeDiff } from "./diff.js";
import { generateSession, parseCategoryList, warnIfBelowMin } from "./generate.js";
import { resolveConfig } from "./generate.js";
import { afterPushHook, beforeCommitHook, beforePushHook } from "./hooks.js";
import { initProject, resetTestmeState } from "./init.js";
import { promptsHasContent } from "./prompts.js";
import { isPassValid, loadPassFile, loadSession, verifySession } from "./verify.js";

const program = new Command();

program
  .name("testme")
  .description("Comprehension gate for desktop coding agents")
  .option("-b, --branch <name>", "protected branch", "main");

program
  .command("init")
  .description("Install testme templates, hooks, and skill into the current repo")
  .action(() => {
    const created = initProject(process.cwd());
    console.log("testme initialized.");
    for (const item of created) {
      console.log(`  + ${item}`);
    }
  });

program
  .command("generate")
  .description("Generate comprehension questions from SUMMARY.md, PROMPTS.md, and git diff")
  .option("--max-questions <n>", "override max question count", (v) => Number.parseInt(v, 10))
  .option("--min-questions <n>", "override min question count", (v) => Number.parseInt(v, 10))
  .option("--category <list>", "comma-separated category keys to enable for this run")
  .action((options, cmd) => {
    const branch = cmd.parent?.opts().branch ?? "main";
    const cwd = process.cwd();

    if (!promptsHasContent()) {
      console.warn("Warning: PROMPTS.md has no change bullets yet. Add session notes for better rubrics.");
    }

    const generateOptions = {
      maxQuestions: options.maxQuestions,
      minQuestions: options.minQuestions,
      categories: options.category ? parseCategoryList(options.category) : undefined,
    };

    const config = resolveConfig(cwd, generateOptions);
    const session = generateSession(cwd, branch, generateOptions);
    const warning = warnIfBelowMin(session, config);

    console.log(`Generated ${session.questions.length} question(s).`);
    if (warning) {
      console.warn(warning);
    }
    console.log(`Session written to .testme/session.json`);
    console.log(`Diff base: ${session.baseRef}`);
    for (const question of session.questions) {
      console.log(`  - ${question.id} [${question.category}]: ${question.prompt}`);
    }
  });

program
  .command("detect")
  .description("Show project-aware category suggestions")
  .action((_, cmd) => {
    const cwd = process.cwd();
    const analysis = analyzeDiff(cwd, cmd.parent?.opts().branch ?? "main");
    const detection = detectProject(cwd, analysis);

    console.log(`Domain: ${detection.domain ?? "(not set)"}`);
    const entries = Object.entries(detection.suggestedCategories);
    if (entries.length === 0) {
      console.log("No domain categories detected.");
      return;
    }

    for (const [key, suggestion] of entries) {
      console.log(
        `  ${key}: ${suggestion.enabled ? "on" : "off"} (${Math.round(suggestion.confidence * 100)}%) — ${suggestion.reason}`,
      );
    }
  });

const configCmd = program.command("config").description("Manage testme configuration");

configCmd
  .command("init")
  .description("Create testme.config.json with auto-detected category defaults")
  .option("--force", "overwrite existing testme.config.json")
  .action((options) => {
    const result = initConfig(process.cwd(), Boolean(options.force));
    if (result.created) {
      console.log(`Created ${result.path}`);
    } else {
      console.log(`${result.path} already exists (use --force to overwrite)`);
    }
  });

configCmd
  .command("show")
  .description("Print merged config (defaults + repo + local overrides)")
  .action(() => {
    console.log(formatConfigForDisplay(showConfig(process.cwd())));
  });

program
  .command("verify")
  .description("Verify answers in .testme/answers.json against the current session")
  .action((_, cmd) => {
    const branch = cmd.parent?.opts().branch ?? "main";
    const result = verifySession(process.cwd(), branch);

    if (result.questionScores && result.questionScores.length > 0) {
      console.log("Scores:");
      for (const item of result.questionScores) {
        const status = item.passed ? "pass" : "fail";
        console.log(
          `  ${item.id}: ${item.accuracy}% accuracy · ${item.alignment} alignment · ${status}`,
        );
        console.log(`    summary: ${item.userSummary}`);
      }
      if (result.passThreshold !== undefined) {
        console.log(`Pass threshold: ${result.passThreshold}% accuracy`);
      }
    }

    if (result.passed) {
      console.log(`PASS (${result.score}% overall accuracy) — push to ${branch} is allowed.`);
      process.exit(0);
    }

    console.error(`FAIL (${result.score}% overall accuracy) — fix answers and re-run verify.`);
    for (const failure of result.failures) {
      console.error(`  ${failure.id}: ${failure.prompt}`);
      if (failure.accuracy !== undefined) {
        console.error(`    accuracy: ${failure.accuracy}%`);
      }
      if (failure.feedback) {
        console.error(`    feedback: ${failure.feedback}`);
      }
      if (failure.alignment) {
        console.error(`    alignment: ${failure.alignment}`);
      }
      if (failure.userSummary) {
        console.error(`    summary: ${failure.userSummary}`);
      }
      if (failure.missingTerms && failure.missingTerms.length > 0) {
        console.error(`    missing terms: ${failure.missingTerms.join(", ")}`);
      }
      if (failure.tooShort) {
        console.error("    answer too short");
      }
      if (failure.missingSymbol) {
        console.error(`    missing symbol: ${failure.missingSymbol}`);
      }
    }
    process.exit(1);
  });

program
  .command("status")
  .description("Show whether the current pass is valid for the diff")
  .action((_, cmd) => {
    const branch = cmd.parent?.opts().branch ?? "main";
    const cwd = process.cwd();
    const pass = loadPassFile();
    const valid = isPassValid(cwd, branch);

    console.log(`Protected branch: ${branch}`);
    console.log(`Pass valid: ${valid ? "yes" : "no"}`);

    if (pass) {
      console.log(`Last verified: ${pass.verifiedAt}`);
      console.log(`Questions answered: ${pass.questionsAnswered}`);
    } else {
      console.log("No pass file found.");
    }

    try {
      const session = loadSession();
      console.log(`Pending session questions: ${session.questions.length}`);
    } catch {
      console.log("No active session.");
    }

    if (!promptsHasContent()) {
      console.log("PROMPTS.md is empty — document changes before generate.");
    }
  });

program
  .command("reset")
  .description("Clear .testme session state without touching PROMPTS.md")
  .action(() => {
    resetTestmeState(process.cwd(), false);
    console.log("Cleared .testme/ session state.");
  });

const hook = program.command("hook").description("Cursor hook helpers");

hook
  .command("before-commit")
  .description("Check whether a git commit should be allowed")
  .requiredOption("-c, --command <cmd>", "shell command to evaluate")
  .option("--json", "output hook JSON response")
  .action((options) => {
    const result = beforeCommitHook(process.cwd(), options.command);

    if (options.json) {
      console.log(JSON.stringify(result));
      process.exit(result.permission === "allow" ? 0 : 2);
    }

    if (result.permission === "allow") {
      process.exit(0);
    }

    console.error(result.agent_message ?? "Commit blocked by testme.");
    process.exit(2);
  });

hook
  .command("before-push")
  .description("Check whether a git push to a protected branch should be allowed")
  .requiredOption("-c, --command <cmd>", "shell command to evaluate")
  .option("--json", "output hook JSON response")
  .action((options, cmd) => {
    const branch = cmd.parent?.parent?.opts().branch ?? undefined;
    const result = beforePushHook(process.cwd(), options.command, branch);

    if (options.json) {
      console.log(JSON.stringify(result));
      process.exit(result.permission === "allow" ? 0 : 2);
    }

    if (result.permission === "allow") {
      process.exit(0);
    }

    console.error(result.agent_message ?? "Push blocked by testme.");
    process.exit(2);
  });

hook
  .command("after-push")
  .description("Reset PROMPTS.md and session state after successful push to a protected branch")
  .option("-c, --command <cmd>", "shell command that was executed")
  .action((options, cmd) => {
    const branch = cmd.parent?.parent?.opts().branch ?? undefined;
    if (options.command) {
      afterPushHook(process.cwd(), options.command, branch);
    } else {
      afterPushHook(process.cwd(), "git push origin main", branch);
    }
    process.exit(0);
  });

program.parse();
