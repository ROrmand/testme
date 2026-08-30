---
name: testme
description: Generate and verify codebase comprehension tests before committing or pushing. Use when the user runs /testme, asks to commit or push, or when a hook blocks git commit/push.
disable-model-invocation: true
---

# testme

Use the shared workflow in the project `SKILL.md` template. Run `npx comp-gate generate`, quiz the user in chat, grade semantically, then `npx comp-gate verify` before commit/push.
