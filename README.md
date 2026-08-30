# comp-gate

Comprehension gate for desktop coding agents. Blocks `git commit` (when enabled) and `git push` to protected branches until you pass a comprehension test.

Published on npm as [`comp-gate`](https://www.npmjs.com/package/comp-gate). Install and run with `npx comp-gate`.

## Table of contents

- [Description](#description)
- [Skills](#skills)
- [Quick setup](#quick-setup)
  - [What gets installed](#what-gets-installed)
- [Using with your agent](#using-with-your-agent)
  - [Cursor](#cursor)
  - [Claude Code](#claude-code)
  - [Windsurf](#windsurf)
  - [AGENTS.md](#agentsmd)
- [Toggle gating with `/testing`](#toggle-gating-with-testing)
- [Daily workflow](#daily-workflow)
- [Commands](#commands)
- [Configuration](#configuration)
- [Adopting an existing repository](#adopting-an-existing-repository)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)

## Description

comp-gate sits between your coding agent and `git commit` / `git push`. Before changes land on a protected branch, you answer comprehension questions about what you changed. The agent grades answers by conceptual alignment — not keyword matching — so the gate checks understanding, not memorization.

**How it works:**

- You document session changes in `testme/PROMPTS.md` as you work.
- `npx comp-gate generate` builds questions from your git diff, `testme/SUMMARY.md`, and `testme/PROMPTS.md`.
- You answer questions in chat via the `/testme` skill.
- `npx comp-gate verify` scores your answers; on PASS, commit and push are allowed.
- After a successful push, `testme/PROMPTS.md` resets automatically.

Git hooks and agent integrations block operations until you pass. Gate state is per-developer (`.testme/`), so one person can pause gating locally without affecting team config.

## Skills

After `init`, two agent skills are available in chat:

| Skill | Purpose |
|-------|---------|
| `/testme` | Run the comp-gate comprehension workflow before commit or push |
| `/testing` | Toggle the gate on or off locally |

Equivalent CLI commands:

| Command | Purpose |
|---------|---------|
| `npx comp-gate testing on` | Enable gating |
| `npx comp-gate testing off` | Disable gating |
| `npx comp-gate testing status` | Show current gate state |

Gate state is stored in `.testme/config.json` (gitignored). `/testme` only runs the full workflow when the gate is on.

## Quick setup

```bash
npx comp-gate init
```

The wizard detects your agent (Cursor, Claude Code, Windsurf), configures question count and difficulty, and installs everything into a single `testme/` folder.

Non-interactive:

```bash
npx comp-gate init --agent cursor --questions 3 --difficulty medium --local-only true --summary blank --yes
```

**Migrating from v0.1.x?** Run `npx comp-gate migrate` to move root-level `SUMMARY.md`, `PROMPTS.md`, and `testme.config.json` into `testme/`.

### What gets installed

```
testme/                          # committed (team-shared)
├── SUMMARY.md                   # project map
├── PROMPTS.md                   # session change log
├── config.json                  # question count, difficulty, protected branches
├── hooks/                       # shell hook scripts
└── skills/
    ├── testme/SKILL.md          # /testme workflow
    └── testing/SKILL.md         # /testing toggle

.testme/                         # gitignored (session state per developer)
├── session.json
├── answers.json
└── config.json                  # local gate toggle overrides
```

**Per machine (not in git):** `.git/hooks/pre-commit` and `pre-push` wrappers, plus agent bridge files (`.cursor/hooks.json`, skill symlinks) when `localOnly` is enabled.

## Using with your agent

### Cursor

After `init`, `/testme` and `/testing` are available in chat.

Cursor hooks in `.cursor/hooks.json` block `git commit` and `git push` in the integrated terminal. Git hooks in `.git/hooks/` cover all other terminals.

**Status line** — add to `~/.cursor/cli-config.json` for a persistent on/off indicator:

```json
{
  "statusLine": {
    "type": "command",
    "command": "sh -c 'cd \"$PWD\" && testme/hooks/statusline.sh'",
    "padding": 2
  }
}
```

### Claude Code

`init` merges PreToolUse hooks into `.claude/settings.json` and symlinks skills into `.claude/skills/testme/` and `.claude/skills/testing/`.

### Windsurf

`init` merges `pre_run_command` hooks into `.windsurf/hooks.json` and symlinks skills into `.windsurf/skills/`.

### AGENTS.md

Select `agents-md` during init (or `--agent agents-md`) to inject a portable workflow section into `AGENTS.md`. Git hooks remain the universal safety net.

## Toggle gating with `/testing`

| Skill / command | Purpose |
|-----------------|---------|
| `/testing` | Toggle gate on/off (default) |
| `npx comp-gate testing on` | Enable gating |
| `npx comp-gate testing off` | Disable gating |
| `npx comp-gate testing status` | Show current state |
| `/testme` | Run comprehension workflow (only when gate is on) |

## Daily workflow

```mermaid
flowchart TD
    work[Make changes] --> prompts[Update testme/PROMPTS.md]
    prompts --> gen[npx comp-gate generate]
    gen --> answer[Answer questions in chat via /testme]
    answer --> verify[npx comp-gate verify]
    verify -->|PASS| push[git push]
    verify -->|FAIL| fix[Fix answers or PROMPTS.md]
    push --> reset[testme/PROMPTS.md resets via hook]
```

1. **Document changes** in `testme/PROMPTS.md` as you work.
2. **Generate** — `npx comp-gate generate` (reads `testme/SUMMARY.md`, `testme/PROMPTS.md`, git diff).
3. **Answer** — run `/testme` in chat; reply to each question.
4. **Verify** — agent grades semantically, then `npx comp-gate verify`.
5. **Push** — after PASS, `git push` is allowed. `testme/PROMPTS.md` resets on successful push.

## Commands

| Command | Description |
|---------|-------------|
| `comp-gate init` | Interactive setup wizard |
| `comp-gate init --agent all --yes` | Install all agent integrations |
| `comp-gate migrate` | Move legacy root files into `testme/` |
| `comp-gate uninstall` | Remove hooks, skills, and integration (`--yes` to confirm) |
| `comp-gate uninstall --keep-data --yes` | Remove integration but keep `testme/` folder |
| `comp-gate generate` | Generate questions from diff + md files |
| `comp-gate verify` | Score answers in `.testme/answers.json` |
| `comp-gate testing` | Toggle gate on/off |
| `comp-gate status` | Check pass validity and gate state |
| `comp-gate detect` | Show auto-detected domain categories |
| `comp-gate config init` | Create `testme/config.json` |
| `comp-gate config show` | Print merged config |
| `comp-gate reset` | Clear `.testme/` session state |
| `comp-gate hook install-git` | Re-install git hooks only |

## Configuration

Edit `testme/config.json`:

```json
{
  "protectedBranches": ["main"],
  "gateCommits": true,
  "autoProtectCurrentBranch": true,
  "questions": { "min": 2, "max": 5 },
  "difficulty": "medium",
  "passThreshold": 70
}
```

| Difficulty | Pass threshold | Alignment required |
|------------|----------------|--------------------|
| easy | 60% | low+ |
| medium | 70% | medium+ |
| hard | 85% | high only |

Run `npx comp-gate detect` to see auto-suggested domain categories. Local overrides go in `.testme/config.json`.

## Adopting an existing repository

See [adopting existing repos](docs/adopting-existing-repos.md) for blank vs generated `testme/SUMMARY.md`, large-repo guidance, and migration from v0.1.x.

```bash
npx comp-gate init --summary blank     # default
npx comp-gate init --summary generate  # draft from README + manifests
npx comp-gate migrate                  # upgrade from root-level layout
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Push blocked | Run `/testme` or `generate` → answer → `verify` |
| Commit blocked | `gateCommits` is on — run `/testme` first |
| Session stale | Re-run `generate` after new edits |
| Missing terms | Add clearer bullets to `testme/PROMPTS.md` |
| Pass invalid | `npx comp-gate status` — diff changed since verify |
| Gate disabled | Run `/testing` or `npx comp-gate testing on` |
| Legacy paths | Run `npx comp-gate migrate` |
| Uninstall | `npx comp-gate uninstall --yes` (add `--keep-data` to preserve `testme/`) |

## Contributing

Contributions are welcome. This is the comp-gate source repository — the npm package and CLI are both named `comp-gate`.

1. **Fork and clone** the repo from [github.com/ROrmand/comp-gate](https://github.com/ROrmand/comp-gate).
2. **Install dependencies** and run the test suite:
   ```bash
   npm install
   npm run build
   npm test
   ```
3. **Make your changes.** Match existing TypeScript style and conventions in `src/`. If you change CLI behavior or install layout, update this README and any relevant docs under `docs/`.
4. **Add or update tests** in `src/*.test.ts` when changing behavior.
5. **Open a pull request** with a clear description of what changed and why. Link any related [issues](https://github.com/ROrmand/comp-gate/issues).

**Areas where help is especially useful:**

- New agent integrations beyond Cursor, Claude Code, and Windsurf
- Better question generation and rubric quality
- Documentation and adoption guides for large or monorepo setups
- Bug reports and reproduction steps for hook or verify edge cases

For questions or feature ideas, open an [issue](https://github.com/ROrmand/comp-gate/issues) before starting large changes.
