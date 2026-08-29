---
name: testme
description: Generate and verify codebase comprehension tests before pushing to main. Use when the user runs /testme, asks to push to main, or before git push.
disable-model-invocation: true
---

# testme

Gate `git push` to `main` behind a deterministic comprehension check. No LLM judge — verification is keyword matching against `PROMPTS.md` and git diff metadata.

## When to use

- User runs `/testme`
- User asks to push to `main`
- Hook blocks a push and asks for verification

## Workflow

```
Task Progress:
- [ ] Step 1: Update PROMPTS.md with session changes
- [ ] Step 2: Run npx testme generate
- [ ] Step 3: Read only files listed in session questions
- [ ] Step 4: Write .testme/answers.json
- [ ] Step 5: Run npx testme verify
- [ ] Step 6: Push to main only after PASS
```

### Step 1: Update PROMPTS.md

Before generating questions, ensure `PROMPTS.md` documents what changed:

```markdown
# Session Changes

## src/auth.ts
- Added validateToken middleware; checks JWT expiry before route handlers

## package.json
- Added jsonwebtoken dependency
```

Write bullets as you work — they become the answer rubric. If empty, update from `git diff --stat` first.

### Step 2: Generate questions

```bash
npx testme generate
```

Reads `SUMMARY.md`, `PROMPTS.md`, and git diff only. Writes `.testme/session.json` with 3–5 targeted questions.

### Step 3: Answer with targeted reads

Read `.testme/session.json`. For each question, read **only** files in `files[]` — not the whole codebase.

### Step 4: Write answers

Create `.testme/answers.json`:

```json
{
  "q1": "In src/auth.ts I added validateToken middleware to check JWT expiry before handlers run.",
  "q2": "validateToken parses the Authorization header and rejects expired tokens with 401."
}
```

Include terms from your `PROMPTS.md` bullets and changed symbol names.

### Step 5: Verify

```bash
npx testme verify
```

On PASS, `.testme/pass.json` is written and push to `main` is allowed. On FAIL, fix answers or enrich `PROMPTS.md`, then re-run generate + verify.

### Step 6: Push

Only after verify passes:

```bash
git push origin main
```

After a successful push, `PROMPTS.md` resets automatically via hook.

## Token efficiency rules

- Never scan the full repo for this workflow
- Use `PROMPTS.md` as the cheap answer key while coding
- Read only files referenced in session questions
- Re-run verify after any last-minute edits (pass invalidates on diff change)

## SUMMARY.md

Update only when architecture, stack, or major conventions change — not every commit.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Session stale | Re-run `npx testme generate` |
| Missing terms | Add clearer bullets to `PROMPTS.md` |
| Pass invalid | `npx testme status` — verify then push |
| Reset session | `npx testme reset` |
