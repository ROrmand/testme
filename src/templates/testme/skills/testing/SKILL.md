---
name: testing
description: Toggle the testme comprehension gate on or off. Use when the user runs /testing or asks to enable/disable testme gating.
disable-model-invocation: true
---

# testing

Toggle the comprehension gate that enforces `/testme` before commit and push.

## When to use

- User runs `/testing`
- User asks to enable, disable, or check testme gating

## Workflow

1. Determine intent:
   - **Toggle** (default): `npx comp-gate testing toggle`
   - **Turn on**: `npx comp-gate testing on`
   - **Turn off**: `npx comp-gate testing off`
   - **Status only**: `npx comp-gate testing status`
2. Run the matching command and show its output **verbatim** in chat (including the status banner).
3. When turning **off**, warn that commit and push will no longer require `/testme` until re-enabled.

## Status line

For a persistent on/off indicator in Cursor, the user can wire `testme/hooks/statusline.sh` into `~/.cursor/cli-config.json` (see README).

## Notes

- Toggle state is local per developer (`.testme/config.json`, gitignored).
- Re-enable the gate before pushing to protected branches in team workflows.
