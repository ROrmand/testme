# Adopting comp-gate in an existing repository

This guide explains how to set up **comp-gate** (the `testme` workflow) when adding it to a project that already has code, history, and possibly many files.

See the main [README](https://github.com/ROrmand/comp-gate#readme) for installation and daily workflow.

## Two markdown files, two jobs

| File | Purpose | When to update |
|------|---------|----------------|
| `SUMMARY.md` | Stable project map — stack, layout, conventions, domain | When architecture or major conventions change |
| `PROMPTS.md` | Session change log — what you changed and why | Every working session; resets after push to a protected branch |

comp-gate generates comprehension questions from **git diff + these two files only**. It does not scan your entire codebase on every run.

## Init choice: blank or generate?

When you run `npx comp-gate init`, the setup wizard asks how to create `SUMMARY.md`:

### Start blank (default, recommended for large repos)

- Installs an empty template with section headings (Stack, Architecture, Conventions, Runtime Notes, Domain).
- You fill it in once at the **right altitude** — packages, layers, or top-level directories, not individual source files.
- Best for monorepos, mature codebases, and teams that already have architecture docs elsewhere.

```bash
npx comp-gate init --summary blank
```

### Generate from project metadata

- Drafts `SUMMARY.md` from a **shallow** pass over:
  - `README.md` and `CONTRIBUTING.md` (first paragraph only)
  - Manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`)
  - Top-level directories (up to ~12 folders)
- Does **not** read every source file or produce per-file summaries.
- Useful for small or medium repos where you want a quick starting point to edit.

```bash
npx comp-gate init --summary generate
```

`PROMPTS.md` is always installed as a blank session template — it is never auto-generated.

## When not to generate a summary

The wizard warns you when the repository has **500+ tracked files** (large). Consider starting blank if:

- **Repository size** — Large monorepos cannot be meaningfully captured by README + top-level folders alone. Auto-generated output will be shallow.
- **Existing docs** — You already have architecture docs, ADRs, or a detailed README. Copy or link from those into `SUMMARY.md` manually instead.
- **Token efficiency** — A bloated or inaccurate `SUMMARY.md` misleads architecture questions and wastes context. A short, accurate map beats a long auto-draft.
- **Staleness** — Generated summaries reflect a snapshot at init time. They go stale as the repo evolves unless someone maintains them.

On large repos, the wizard asks you to type `generate` to confirm if you choose auto-generation.

## Recommended workflow for large repositories

1. **Init with blank summary**
   ```bash
   npx comp-gate init --summary blank
   ```

2. **Draft `SUMMARY.md` once** — In one agent session or team doc pass, describe:
   - Stack and runtime
   - Each major package or service (`apps/web/`, `packages/api/`, etc.)
   - Conventions your team follows
   - A `## Domain` section if you want category auto-detection (e.g. machine learning, frontend)

3. **Use `PROMPTS.md` per session** — As you work, add bullets only for files you changed:
   ```markdown
   ## src/auth/middleware.ts
   - Added validateToken; checks JWT expiry before route handlers
   ```

4. **Run `/testme` before commit/push** — Questions target your diff and session notes, not the whole tree.

5. **Tune config** — Run `npx comp-gate detect` and adjust `testme.config.json` categories for your domain.

## What generation does not do

- No full-tree file walk
- No per-file summaries
- No LLM calls during `init` (heuristic only)
- No overwrite of an existing `SUMMARY.md` (existing file is left unchanged)

## Further reading

- [comp-gate README](https://github.com/ROrmand/comp-gate#readme) — commands, hooks, and workflow
- [Why PROMPTS.md matters](https://github.com/ROrmand/comp-gate#why-promptsmd-matters) — session bullets as the answer rubric
