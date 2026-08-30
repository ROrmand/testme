#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { formatConfigForDisplay, initConfig, showConfig } from "./config-init.js";
import { detectProject } from "./detect.js";
import { analyzeDiff } from "./diff.js";
import { generateSession, parseCategoryList, warnIfBelowMin } from "./generate.js";
import { resolveConfig } from "./generate.js";
import { afterPushHook, beforeCommitHook, beforePushHook, beforePushRefHook, resolveProtectedBranches, resolveWorkingBranch } from "./hooks.js";
import { copyHookScripts, installGitHooks, resetTestmeState } from "./init.js";
import { migrateProject } from "./migrate.js";
import { planUninstall, uninstallProject } from "./uninstall.js";
import { promptsHasContent } from "./prompts.js";
import { repoConfigPath } from "./paths.js";
import { isPassValid, loadPassFile, loadSession, verifySession } from "./verify.js";
import {
  formatGateBanner,
  formatStatusline,
  isGateEnabled,
  setGateEnabled,
  toggleGateEnabled,
} from "./testing.js";

const program = new Command();

program
  .name("comp-gate")
  .description("Comprehension gate for desktop coding agents (testme workflow)")
  .option("-b, --branch <name>", "override working branch for diff and pass validation");

program
  .command("init")
  .description("Install testme templates, hooks, and skill into the current repo")
  .option("--agent <agents>", "comma-separated agents: cursor,claude,windsurf,agents-md,all")
  .option("--questions <n>", "number of questions per session (1-5)")
  .option("--difficulty <level>", "easy, medium, or hard")
  .option("--local-only <bool>", "gitignore agent skills (true/false); default true")
  .option("--summary <mode>", "testme/SUMMARY.md setup: blank (default) or generate")
  .option("--yes", "skip interactive prompts")
  .option("--force", "re-run wizard and overwrite config preferences")
  .action(async (options) => {
    const { initProject } = await import("./init.js");
    const { parseAgentList } = await import("./agents/detect.js");
    const { parseDifficultyOption, parseLocalOnlyOption, parseQuestionsOption, parseSummaryModeOption } = await import(
      "./setup-wizard.js"
    );

    const initOptions: import("./init.js").InitOptions = {
      yes: Boolean(options.yes),
      force: Boolean(options.force),
    };

    if (options.agent) {
      initOptions.agents = parseAgentList(options.agent);
    }

    if (
      options.questions ||
      options.difficulty ||
      options.localOnly !== undefined ||
      options.summary
    ) {
      if (options.force || !existsSync(repoConfigPath(process.cwd()))) {
        initOptions.wizard = {
          questions: options.questions
            ? parseQuestionsOption(options.questions)
            : { min: 2, max: 3 },
          difficulty: options.difficulty ? parseDifficultyOption(options.difficulty) : "medium",
          localOnly:
            options.localOnly !== undefined ? parseLocalOnlyOption(options.localOnly) : true,
          summaryMode: options.summary ? parseSummaryModeOption(options.summary) : "blank",
        };
      }
      initOptions.skipWizard = true;
    }

    if (options.summary) {
      initOptions.summaryMode = parseSummaryModeOption(options.summary);
    }

    const created = await initProject(process.cwd(), initOptions);
    console.log("comp-gate initialized.");
    for (const item of created) {
      console.log(`  + ${item}`);
    }
  });

program
  .command("generate")
  .description("Generate comprehension questions from testme/SUMMARY.md, testme/PROMPTS.md, and git diff")
  .option("--max-questions <n>", "override max question count", (v) => Number.parseInt(v, 10))
  .option("--min-questions <n>", "override min question count", (v) => Number.parseInt(v, 10))
  .option("--category <list>", "comma-separated category keys to enable for this run")
  .action((options, cmd) => {
    const branch = resolveWorkingBranch(process.cwd(), cmd.parent?.opts().branch);
    const cwd = process.cwd();

    if (!promptsHasContent()) {
      console.warn("Warning: testme/PROMPTS.md has no change bullets yet. Add session notes for better rubrics.");
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
    const analysis = analyzeDiff(cwd, resolveWorkingBranch(cwd, cmd.parent?.opts().branch));
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
  .description("Create testme/config.json with auto-detected category defaults")
  .option("--force", "overwrite existing testme/config.json")
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
    const branch = resolveWorkingBranch(process.cwd(), cmd.parent?.opts().branch);
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
    const cwd = process.cwd();
    const cliBranch = cmd.parent?.opts().branch;
    const branch = resolveWorkingBranch(cwd, cliBranch);
    const pass = loadPassFile();
    const valid = isPassValid(cwd, branch);

    console.log(`Working branch: ${branch}`);
    console.log(
      `Protected branches: ${resolveProtectedBranches(cwd, cliBranch).join(", ")}`,
    );
    console.log(`Pass valid: ${valid ? "yes" : "no"}`);
    console.log(`Gate enabled: ${isGateEnabled(cwd) ? "yes" : "no"}`);

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
      console.log("testme/PROMPTS.md is empty — document changes before generate.");
    }
  });

const testingCmd = program
  .command("testing")
  .description("Toggle the testme comprehension gate on or off (local per developer)");

testingCmd
  .command("status")
  .description("Show whether the gate is enabled")
  .action(() => {
    const cwd = process.cwd();
    const enabled = isGateEnabled(cwd);
    console.log(formatGateBanner(enabled));
    console.log(`gateEnabled: ${enabled}`);
  });

testingCmd
  .command("on")
  .description("Enable the comprehension gate")
  .action(() => {
    const cwd = process.cwd();
    setGateEnabled(cwd, true);
    console.log(formatGateBanner(true));
    console.log("gateEnabled: true");
  });

testingCmd
  .command("off")
  .description("Disable the comprehension gate")
  .action(() => {
    const cwd = process.cwd();
    setGateEnabled(cwd, false);
    console.log(formatGateBanner(false));
    console.log("gateEnabled: false");
    console.warn("Warning: commit and push will no longer require /testme until re-enabled.");
  });

testingCmd
  .command("toggle")
  .description("Flip the gate on or off")
  .action(() => {
    const cwd = process.cwd();
    const enabled = toggleGateEnabled(cwd);
    console.log(formatGateBanner(enabled));
    console.log(`gateEnabled: ${enabled}`);
    if (!enabled) {
      console.warn("Warning: commit and push will no longer require /testme until re-enabled.");
    }
  });

testingCmd.action(() => {
  const cwd = process.cwd();
  const enabled = toggleGateEnabled(cwd);
  console.log(formatGateBanner(enabled));
  console.log(`gateEnabled: ${enabled}`);
  if (!enabled) {
    console.warn("Warning: commit and push will no longer require /testme until re-enabled.");
  }
});

program
  .command("statusline")
  .description("One-line gate status for Cursor status line integration")
  .action(() => {
    console.log(formatStatusline(isGateEnabled(process.cwd())));
  });

program
  .command("reset")
  .description("Clear .testme session state without touching testme/PROMPTS.md")
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
  .action((options, cmd) => {
    const branch = cmd.parent?.parent?.opts().branch;
    const result = beforeCommitHook(process.cwd(), options.command, branch);

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
  .command("before-push-ref")
  .description("Check whether a git pre-push ref should be allowed")
  .requiredOption("-r, --remote-ref <ref>", "remote ref being pushed (e.g. refs/heads/main)")
  .option("--json", "output hook JSON response")
  .action((options, cmd) => {
    const branch = cmd.parent?.parent?.opts().branch ?? undefined;
    const result = beforePushRefHook(process.cwd(), options.remoteRef, branch);

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
  .command("install-git")
  .description("Install git pre-commit and pre-push hooks into .git/hooks")
  .action(() => {
    copyHookScripts(process.cwd());
    const installed = installGitHooks(process.cwd());
    if (installed.length === 0) {
      console.log("No git hooks installed (not a git repo or hooks already managed elsewhere).");
      return;
    }
    for (const item of installed) {
      console.log(`  + ${item}`);
    }
  });

hook
  .command("after-push")
  .description("Reset testme/PROMPTS.md and session state after successful push to a protected branch")
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

program
  .command("migrate")
  .description("Move legacy root-level testme files into testme/ and refresh hooks/skills")
  .action(() => {
    const changes = migrateProject(process.cwd());
    console.log("comp-gate migration complete.");
    for (const item of changes) {
      console.log(`  + ${item}`);
    }
  });

program
  .command("uninstall")
  .description("Remove testme hooks, skills, and integration from the current repo")
  .option("--yes", "confirm removal without prompting")
  .option("--keep-data", "keep testme/ (SUMMARY.md, PROMPTS.md, config.json)")
  .action((options) => {
    const cwd = process.cwd();
    const planned = planUninstall(cwd, { keepData: Boolean(options.keepData) });

    if (planned.length === 0) {
      console.log("No testme integration found in this repository.");
      return;
    }

    if (!options.yes) {
      console.log("The following will be removed:");
      for (const item of planned) {
        console.log(`  - ${item}`);
      }
      console.log("\nRe-run with --yes to confirm.");
      if (!options.keepData) {
        console.log("Use --keep-data to preserve testme/ while removing hooks and skills.");
      }
      return;
    }

    const removed = uninstallProject(cwd, { keepData: Boolean(options.keepData), yes: true });
    console.log("comp-gate uninstalled.");
    for (const item of removed) {
      console.log(`  - ${item}`);
    }
  });

program.parse();
