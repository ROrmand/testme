# Session Changes

## package.json
- Added testme npm CLI package with commander, TypeScript build, and vitest test script

## src/cli.ts
- Added CLI commands: init, generate, verify, status, reset, and hook helpers

## src/diff.ts
- Added git diff parsing, symbol extraction via regex, and diffHash for pass invalidation

## src/generate.ts
- Added question builder that reads PROMPTS.md rubrics and caps at 5 questions

## src/verify.ts
- Added deterministic keyword scorer and pass.json writer

## src/init.ts
- Added testme init to install templates, Cursor hooks, and skill into repos

## src/hooks.ts
- Added beforePushHook to gate git push to main until pass is valid

## .cursor/hooks.json
- Added beforeShellExecution and afterShellExecution hooks for push gate and PROMPTS reset

## README.md
- Expanded README with setup, workflow, commands, and troubleshooting docs

## src/hooks.ts
- Added parseRemoteRef and beforePushRefHook for native git pre-push hook integration
- Refactored push gating into evaluateProtectedPush shared by shell and git hook paths

## src/init.ts
- Added installGitHooks to write .git/hooks/pre-commit and pre-push wrappers
- init now installs git hooks alongside Cursor hooks on npx testme init

## src/cli.ts
- Added hook before-push-ref and hook install-git commands

## src/templates/hooks/git-pre-push.sh
- Added git pre-push script that calls testme hook before-push-ref per refs/heads/* ref

## src/templates/hooks/git-pre-commit.sh
- Added git pre-commit script that gates commits when gateCommits is enabled

## README.md (latest)
- Documented that git hooks block pushes/commits in Cursor terminal and external terminals

## src/verify.ts
- Added passStillValid so one /testme pass survives verify-then-commit-then-push without re-testing
- pass.json now stores headSha and hadUncommitted at verify time

## src/diff.ts
- getDiffText now combines commits ahead of base plus staged and unstaged changes
- Added getHeadSha, hasUncommittedChanges, and isGitAncestor helpers for pass validation

## src/types.ts
- Extended PassFile with optional headSha and hadUncommitted fields

## src/verify.test.ts
- Added unit tests for passStillValid commit-after-verify scenarios
