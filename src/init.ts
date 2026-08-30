import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { installAgentsMd } from "./agents/agents-md.js";
import { installClaude } from "./agents/claude.js";
import { installCursor } from "./agents/cursor.js";
import { ALL_AGENT_IDS, type AgentId } from "./agents/types.js";
import { installWindsurf } from "./agents/windsurf.js";
import { detectAgents, parseAgentList } from "./agents/detect.js";
import { chmodScripts } from "./agents/shared.js";
import { createInitialConfig, initConfigWithWizard } from "./config-init.js";
import { ensureTestmeGitignore } from "./gitignore.js";
import { installDir, promptsPath, summaryPath, TESTME_TEMPLATES_DIR } from "./paths.js";
import { bootstrapSummary } from "./bootstrap-summary.js";
import { GIT_HOOK_MARKER } from "./constants.js";
import {
  DEFAULT_WIZARD_CHOICES,
  type WizardChoices,
  applyWizardToConfig,
  promptAgentSelection,
  promptWizardChoices,
} from "./setup-wizard.js";
import type { TestmeConfig } from "./types.js";
import type { SummaryMode } from "./setup-wizard.js";

export interface InitOptions {
  agents?: AgentId[];
  wizard?: WizardChoices;
  summaryMode?: SummaryMode;
  force?: boolean;
  yes?: boolean;
  skipWizard?: boolean;
}

function copyIfMissing(source: string, target: string): boolean {
  if (existsSync(target)) {
    return false;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return true;
}

export function copyHookScripts(cwd: string): void {
  const hooksDir = path.join(TESTME_TEMPLATES_DIR, "hooks");
  const targetDir = path.join(installDir(cwd), "hooks");
  mkdirSync(targetDir, { recursive: true });

  for (const file of readdirSync(hooksDir)) {
    if (!file.endsWith(".sh")) {
      continue;
    }
    const target = path.join(targetDir, file);
    copyFileSync(path.join(hooksDir, file), target);
    chmodSync(target, 0o755);
  }
}

function installGitHookFile(
  cwd: string,
  hookName: string,
  scriptName: string,
): "installed" | "skipped" | "missing-git" {
  const gitDir = path.join(cwd, ".git");
  if (!existsSync(gitDir)) {
    return "missing-git";
  }

  const hookPath = path.join(gitDir, "hooks", hookName);
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!existing.includes(GIT_HOOK_MARKER)) {
      return "skipped";
    }
  }

  const scriptPath = `testme/hooks/${scriptName}`;
  const content = `#!/bin/sh
# ${GIT_HOOK_MARKER} — re-run npx comp-gate init to refresh
exec "$(git rev-parse --show-toplevel)/${scriptPath}" "$@"
`;

  mkdirSync(path.dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, content, "utf8");
  chmodSync(hookPath, 0o755);

  return "installed";
}

export function installGitHooks(cwd: string): string[] {
  const results: string[] = [];
  const push = installGitHookFile(cwd, "pre-push", "git-pre-push.sh");
  const commit = installGitHookFile(cwd, "pre-commit", "git-pre-commit.sh");

  if (push === "installed") {
    results.push(".git/hooks/pre-push");
  } else if (push === "skipped") {
    results.push(".git/hooks/pre-push (skipped — existing non-testme hook)");
  }

  if (commit === "installed") {
    results.push(".git/hooks/pre-commit");
  } else if (commit === "skipped") {
    results.push(".git/hooks/pre-commit (skipped — existing non-testme hook)");
  }

  return results;
}

function installAgent(cwd: string, agent: AgentId, created: string[]): void {
  switch (agent) {
    case "cursor":
      installCursor(cwd, created);
      break;
    case "claude":
      installClaude(cwd, created);
      break;
    case "windsurf":
      installWindsurf(cwd, created);
      break;
    case "agents-md":
      installAgentsMd(cwd, created);
      break;
  }
}

function installSkills(cwd: string, created: string[]): void {
  const skillsTemplateDir = path.join(TESTME_TEMPLATES_DIR, "skills");
  const skillsTargetDir = path.join(installDir(cwd), "skills");
  mkdirSync(skillsTargetDir, { recursive: true });

  for (const skillName of readdirSync(skillsTemplateDir)) {
    const source = path.join(skillsTemplateDir, skillName, "SKILL.md");
    if (!existsSync(source)) {
      continue;
    }
    const target = path.join(skillsTargetDir, skillName, "SKILL.md");
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    created.push(path.relative(cwd, target));
  }
}

export function initShared(
  cwd: string,
  config: TestmeConfig,
  applyWizard = true,
  wizard: WizardChoices = DEFAULT_WIZARD_CHOICES,
): string[] {
  const created: string[] = [];
  const testmeRoot = installDir(cwd);
  mkdirSync(testmeRoot, { recursive: true });

  const summaryTarget = summaryPath(cwd);
  if (existsSync(summaryTarget)) {
    created.push(`${path.relative(cwd, summaryTarget)} (existing, unchanged)`);
  } else if (wizard.summaryMode === "generate") {
    mkdirSync(path.dirname(summaryTarget), { recursive: true });
    writeFileSync(summaryTarget, bootstrapSummary(cwd), "utf8");
    created.push(`${path.relative(cwd, summaryTarget)} (generated from project metadata)`);
  } else if (copyIfMissing(path.join(TESTME_TEMPLATES_DIR, "SUMMARY.md"), summaryTarget)) {
    created.push(path.relative(cwd, summaryTarget));
  }

  const promptsTarget = promptsPath(cwd);
  if (copyIfMissing(path.join(TESTME_TEMPLATES_DIR, "PROMPTS.md"), promptsTarget)) {
    created.push(path.relative(cwd, promptsTarget));
  }

  const configResult = initConfigWithWizard(cwd, config, applyWizard);
  if (configResult.created) {
    created.push(path.relative(cwd, configResult.path));
  } else if (configResult.updated) {
    created.push(`${path.relative(cwd, configResult.path)} (updated)`);
  }

  installSkills(cwd, created);
  copyHookScripts(cwd);
  chmodScripts(path.join(testmeRoot, "hooks"));
  created.push("testme/hooks/");

  for (const item of installGitHooks(cwd)) {
    created.push(item);
  }

  return created;
}

export async function resolveInitAgents(
  cwd: string,
  options: InitOptions,
): Promise<AgentId[]> {
  if (options.agents && options.agents.length > 0) {
    return options.agents;
  }

  const detection = detectAgents(cwd);

  if (!options.yes && detection.ambiguous) {
    return promptAgentSelection(detection.signals, detection.suggested);
  }

  if (detection.suggested.length > 0) {
    return detection.suggested;
  }

  return ALL_AGENT_IDS;
}

export async function resolveWizardChoices(
  cwd: string,
  options: InitOptions,
): Promise<WizardChoices | null> {
  if (options.wizard) {
    return options.wizard;
  }

  const configPath = path.join(cwd, "testme", "config.json");
  const legacyConfigPath = path.join(cwd, "testme.config.json");
  if ((existsSync(configPath) || existsSync(legacyConfigPath)) && !options.force) {
    return null;
  }

  if (options.yes || options.skipWizard) {
    return DEFAULT_WIZARD_CHOICES;
  }

  return promptWizardChoices(cwd);
}

export async function initProject(cwd: string, options: InitOptions = {}): Promise<string[]> {
  const agents = await resolveInitAgents(cwd, options);
  const wizard = await resolveWizardChoices(cwd, options);

  let config = createInitialConfig(cwd);
  if (wizard) {
    config = applyWizardToConfig(config, wizard);
  }
  config.gateCommits = true;

  const wizardChoices: WizardChoices = {
    ...(wizard ?? DEFAULT_WIZARD_CHOICES),
    ...(options.summaryMode ? { summaryMode: options.summaryMode } : {}),
  };

  const created = initShared(cwd, config, wizard !== null, wizardChoices);

  for (const agent of agents) {
    installAgent(cwd, agent, created);
  }

  const localOnly = wizard?.localOnly ?? true;
  created.push(...ensureTestmeGitignore(cwd, agents, localOnly));

  return created;
}

export function initProjectSync(cwd: string, options: InitOptions = {}): string[] {
  const agents =
    options.agents && options.agents.length > 0
      ? options.agents
      : detectAgents(cwd).suggested.length > 0
        ? detectAgents(cwd).suggested
        : ALL_AGENT_IDS;

  const wizard = options.wizard ?? DEFAULT_WIZARD_CHOICES;
  const wizardChoices: WizardChoices = {
    ...wizard,
    ...(options.summaryMode ? { summaryMode: options.summaryMode } : {}),
  };
  let config = createInitialConfig(cwd);
  config = applyWizardToConfig(config, wizardChoices);
  config.gateCommits = true;

  const created = initShared(cwd, config, true, wizardChoices);

  for (const agent of agents) {
    installAgent(cwd, agent, created);
  }

  const localOnly = wizardChoices.localOnly;
  created.push(...ensureTestmeGitignore(cwd, agents, localOnly));
  return created;
}

export function resetTestmeState(cwd: string, resetPrompts = false): void {
  const testmeDir = path.join(cwd, ".testme");

  if (existsSync(testmeDir)) {
    for (const entry of readdirSync(testmeDir)) {
      rmSync(path.join(testmeDir, entry), { recursive: true, force: true });
    }
  }

  if (resetPrompts) {
    const promptsTemplate = path.join(TESTME_TEMPLATES_DIR, "PROMPTS.md");
    writeFileSync(promptsPath(cwd), readFileSync(promptsTemplate, "utf8"), "utf8");
  }
}

export function resetPromptsAfterPush(cwd: string): void {
  const promptsTemplate = path.join(TESTME_TEMPLATES_DIR, "PROMPTS.md");
  writeFileSync(promptsPath(cwd), readFileSync(promptsTemplate, "utf8"), "utf8");
  resetTestmeState(cwd, false);
}

export { parseAgentList };
