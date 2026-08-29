---
name: testme
description: Generate and verify codebase comprehension tests before pushing to main. Use when the user runs /testme, asks to push to main, or before git push.
disable-model-invocation: true
---

# testme

Gate `git push` to `main` behind a comprehension check. The agent generates reference answers, quizzes you in chat, then grades your replies by **conceptual alignment** — not keyword matching.

## When to use

- User runs `/testme`
- User asks to push to `main`
- Hook blocks a push and asks for verification

## Workflow

**Use conversational Q&A in chat.** Do not ask the user to manually edit `.testme/` JSON files.

```
Task Progress:
- [ ] Step 1: Update PROMPTS.md with session changes
- [ ] Step 2: Run npx testme generate
- [ ] Step 3: Read referenced files; write .testme/references.json
- [ ] Step 4: Ask each question in chat; collect answers from user replies
- [ ] Step 5: Grade semantically; write .testme/judgments.json; run npx testme verify
- [ ] Step 6: Push to main only after PASS
```

### Step 1: Update PROMPTS.md

Before generating questions, ensure `PROMPTS.md` documents what changed:

```markdown
# Session Changes

## src/auth.ts
- Added validateToken middleware; checks JWT expiry before route handlers
```

Write bullets as you work. If empty, update from `git diff --stat` first.

### Step 2: Generate questions

```bash
npx testme generate
```

Reads `SUMMARY.md`, `PROMPTS.md`, and git diff. Writes `.testme/session.json`.

Announce how many questions were generated and list their ids/categories.

### Step 3: Generate reference answers

Read `.testme/session.json`. For each question, read **only** files in `files[]`.

Write `.testme/references.json`:

```json
{
  "diffHash": "<same as session.json>",
  "generatedAt": "<ISO timestamp>",
  "references": {
    "q1": "A complete reference answer explaining what changed and why, based on the code and PROMPTS.md.",
    "q2": "A reference answer describing how the change fits the project architecture."
  }
}
```

Reference answers are the **gold standard** you will compare user replies against. Write them from your understanding of the code — not by copying PROMPTS.md bullets verbatim.

### Step 4: Conversational Q&A (in chat)

Ask questions **one at a time**. Wait for the user's reply before asking the next.

**Format each question:**

```
**Question 1 of N** · `q1` · changeRationale

What changed in src/auth.ts and why?

_Files: src/auth.ts_
```

Rules:
- Show progress, question id, category, prompt verbatim, and referenced files
- Do **not** show reference answers or rubric terms to the user
- Nudge once if an answer is too vague: "Can you explain what changed and why?"
- Store each answer keyed by question id (`q1`, `q2`, …)

### Step 5: Semantic grading and verify

For each question, compare the user's answer to the reference in `.testme/references.json`:

1. **Summarize** the user's answer in 1–2 sentences (`userSummary`)
2. **Score accuracy** from 0–100 (`accuracy`) — how well they understand what changed vs the reference
3. **Judge alignment**: `high` (core concepts correct), `medium` (mostly right, minor gaps), `low` (wrong or too vague)
4. **Pass** a question if `passed: true`, `accuracy >= passThreshold` (default 70 from config), and alignment is `high` or `medium`
5. Do **not** fail answers for missing specific keywords — judge meaning, not wording

Write `.testme/answers.json` and `.testme/judgments.json`:

```json
{
  "diffHash": "<same as session.json>",
  "gradedAt": "<ISO timestamp>",
  "judgments": {
    "q1": {
      "passed": true,
      "accuracy": 88,
      "userSummary": "User explained the README now documents setup and the chat-based workflow.",
      "alignment": "high",
      "feedback": "Strong understanding of the documentation changes; minor detail on troubleshooting missing."
    }
  }
}
```

Share grading feedback in chat for each question:
- accuracy score (0–100)
- alignment (`low` / `medium` / `high`)
- brief summary of what they got right or wrong

Then run:

```bash
npx testme verify
```

**On PASS:** push to `main` is allowed.

**On FAIL:** re-ask only failed questions in chat, update answers + judgments, run `verify` again. Do not re-run `generate`.

### Step 6: Push

Only after verify passes:

```bash
git push origin main
```

## Token efficiency rules

- Never scan the full repo for this workflow
- Read only files referenced in session questions
- Re-run verify after any last-minute edits (pass invalidates on diff change)

## Grading mode

Default is **semantic** (`grading: "semantic"` in `testme.config.json`). Set `passThreshold` (default `70`) for minimum accuracy % per question. Legacy keyword mode: `"grading": "keywords"`.

## SUMMARY.md

Update only when architecture, stack, or major conventions change — not every commit.

Add a `## Domain` section to steer auto-detection:

```markdown
## Domain

- Primary: machine learning
- Focus areas: model training, evaluation metrics, inference API
```

## Configure categories

Question count and knowledge areas are configured in `testme.config.json` (team defaults) with optional local overrides in `.testme/config.json`.

### Checkbox-style categories

Set booleans in `categories` — `true` enables, `false` disables:

```json
{
  "questions": { "min": 2, "max": 5 },
  "categories": {
    "changeRationale": true,
    "symbols": true,
    "architecture": true,
    "runtime": false,
    "dataStructures": false,
    "testing": true,
    "machineLearning": false,
    "cybersecurity": false
  },
  "autoDetect": true
}
```

### Core categories

`changeRationale`, `symbols`, `architecture`, `runtime`, `dataStructures`, `dependencies`, `testing`, `errorHandling`, `apiContracts`, `security`, `performance`, `database`

### Domain categories (auto-suggested)

`machineLearning`, `cybersecurity`, `frontend`, `backend`, `devops`, `mobile`, `dataEngineering`

Run detection before editing config:

```bash
npx testme detect
npx testme config init
npx testme config show
```

### One-off overrides

```bash
npx testme generate --max-questions 3 --category changeRationale,runtime,testing
```

### Examples

**Machine learning project** — enable `machineLearning`, `dataStructures`; disable `cybersecurity`.

**Security tooling project** — enable `cybersecurity`, `security`; disable `machineLearning`.

Ask the user which categories matter if unclear, then update `testme.config.json`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Session stale | Re-run `npx testme generate` |
| Missing terms | Add clearer bullets to `PROMPTS.md` |
| Pass invalid | `npx testme status` — verify then push |
| Reset session | `npx testme reset` |
| Verify failed | Re-ask failed questions; re-grade and update judgments.json |
| Missing judgments | Agent must grade semantically before running verify |
