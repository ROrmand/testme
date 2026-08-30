## testme comprehension gate

Before committing or pushing to a protected branch, run the testme workflow:

1. Update `PROMPTS.md` with session change bullets per file.
2. Run `npx comp-gate generate` to create questions in `.testme/session.json`.
3. Answer each question in chat; the agent writes `.testme/answers.json` and `.testme/judgments.json`.
4. Run `npx comp-gate verify` — on PASS, `.testme/pass.json` is written and git operations are allowed.
5. After a successful push, `PROMPTS.md` resets automatically via hook.

Do not commit or push until `npx comp-gate verify` passes.
