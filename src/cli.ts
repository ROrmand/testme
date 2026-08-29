#!/usr/bin/env node

import { Command } from "commander";
import { generateSession } from "./generate.js";
import { beforePushHook } from "./hooks.js";
import { initProject, resetPromptsAfterPush, resetTestmeState } from "./init.js";
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
  .action((_, cmd) => {
    const branch = cmd.parent?.opts().branch ?? "main";

    if (!promptsHasContent()) {
      console.warn("Warning: PROMPTS.md has no change bullets yet. Add session notes for better rubrics.");
    }

    const session = generateSession(process.cwd(), branch);
    console.log(`Generated ${session.questions.length} question(s).`);
    console.log(`Session written to .testme/session.json`);
    console.log(`Diff base: ${session.baseRef}`);
    for (const question of session.questions) {
      console.log(`  - ${question.id}: ${question.prompt}`);
    }
  });

program
  .command("verify")
  .description("Verify answers in .testme/answers.json against the current session")
  .action((_, cmd) => {
    const branch = cmd.parent?.opts().branch ?? "main";
    const result = verifySession(process.cwd(), branch);

    if (result.passed) {
      console.log(`PASS (${result.score}%) — push to ${branch} is allowed.`);
      process.exit(0);
    }

    console.error(`FAIL (${result.score}%) — fix answers and re-run verify.`);
    for (const failure of result.failures) {
      console.error(`  ${failure.id}: ${failure.prompt}`);
      if (failure.missingTerms.length > 0) {
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
  .command("before-push")
  .description("Check whether a git push to main should be allowed")
  .requiredOption("-c, --command <cmd>", "shell command to evaluate")
  .option("--json", "output hook JSON response")
  .action((options, cmd) => {
    const branch = cmd.parent?.parent?.opts().branch ?? "main";
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
  .description("Reset PROMPTS.md and session state after successful push to main")
  .action(() => {
    resetPromptsAfterPush(process.cwd());
    process.exit(0);
  });

program.parse();
