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
