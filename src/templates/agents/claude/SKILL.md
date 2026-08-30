---
name: testme
description: Generate and verify codebase comprehension tests before committing or pushing. Use when the user asks to commit or push, or when a hook blocks git commit/push.
---

# testme

Use the shared workflow: update PROMPTS.md, run `npx comp-gate generate`, quiz the user in chat, grade semantically, then `npx comp-gate verify` before commit/push.
