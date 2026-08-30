# Adopting comp-gate in an existing repository

This guide explains how to set up **comp-gate** (the `testme` workflow) when adding it to a project that already has code, history, and possibly many files.

See the main [README](https://github.com/ROrmand/comp-gate#readme) for installation and daily workflow.

## Install layout

All team-shared files live in one folder:

```
testme/
├── SUMMARY.md       # stable project map
├── PROMPTS.md       # session change log
├── config.json      # team config
├── hooks/           # hook scripts
└── skills/          # agent skills (/testme, /testing)
```

Session state (`.testme/`) and agent bridge files (`.cursor/skills/` symlinks) are local per developer.

## Two markdown files, two jobs

| File | Purpose | When to update |
|------|---------|----------------|
| `testme/SUMMARY.md` | Stable project map — stack, layout, conventions, domain | When architecture or major conventions change |
| `testme/PROMPTS.md` | Session change log — what you changed and why | Every working session; resets after push to a protected branch |

comp-gate generates comprehension questions from **git diff + these two files only**. It does not scan your entire codebase on every run.

## Init choice: blank or generate?

When you run `npx comp-gate init`, the setup wizard asks how to create `testme/SUMMARY.md`:

### Start blank (default, recommended for large repos)

- Installs an empty template with section headings (Stack, Architecture, Conventions, Runtime Notes, Domain).
- You fill it in once at the **right altitude** — packages, layers, or top-level directories, not individual source files.
- Best for monorepos, mature codebases, and teams that already have architecture docs elsewhere.

```bash
npx comp-gate init --summary blank
```

### Generate from project metadata

- Drafts `testme/SUMMARY.md` from a **shallow** pass over:
  - `README.md` and `CONTRIBUTING.md` (first paragraph only)
  - Manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`)
  - Top-level directories (up to ~12 folders)
- Does **not** read every source file or produce per-file summaries.
- Useful for small or medium repos where you want a quick starting point to edit.

```bash
npx comp-gate init --summary generate
```

`testme/PROMPTS.md` is always installed as a blank session template — it is never auto-generated.

## When not to generate a summary

The wizard warns you when the repository has **500+ tracked files** (large). Consider starting blank if:

- **Repository size** — Large monorepos cannot be meaningfully captured by README + top-level folders alone. Auto-generated output will be shallow.
- **Existing docs** — You already have architecture docs, ADRs, or a detailed README. Copy or link from those into `testme/SUMMARY.md` manually instead.
- **Staleness** — Generated summaries reflect a snapshot at init time. They go stale as the repo evolves unless someone maintains them.

On large repos, the wizard asks you to type `generate` to confirm if you choose auto-generation.

## Recommended workflow for large repositories

1. **Init with blank summary**
   ```bash
   npx comp-gate init --summary blank
   ```
2. **Draft `testme/SUMMARY.md` once** — In one agent session or team doc pass, describe:
   - Stack and runtime (how to run, test, deploy)
   - Top-level layout (packages, services, layers)
   - Conventions the team follows
   - Domain focus (ML, security, frontend, etc.)
3. **Use `testme/PROMPTS.md` per session** — As you work, add bullets only for files you changed:
   ```markdown
   ## src/auth.ts
   - Added validateToken middleware; checks JWT expiry before route handlers
   ```
4. **Run `/testme` before push** — Generate, answer in chat, verify.
5. **Tune config** — Run `npx comp-gate detect` and adjust `testme/config.json` categories for your domain.

## Migrating from v0.1.x

If you installed an older version that placed files at the repo root:

```bash
npx comp-gate migrate
```

This moves `SUMMARY.md`, `PROMPTS.md`, and `testme.config.json` into `testme/`, relocates hook scripts, and refreshes agent symlinks.

## What init does not do

- No overwrite of an existing `testme/SUMMARY.md` (existing file is left unchanged)
- No full-repo scan or per-file summary generation
- No modification of non-testme git hooks (existing hooks are skipped with a message)

## Uninstalling

To remove testme from a repository:

```bash
npx comp-gate uninstall          # preview what will be removed
npx comp-gate uninstall --yes    # remove hooks, skills, session state, and testme/
```

Preserve your `testme/SUMMARY.md` and `testme/PROMPTS.md` while removing hooks and agent integration:

```bash
npx comp-gate uninstall --keep-data --yes
```

## See also

- [README quick start](https://github.com/ROrmand/comp-gate#quick-start)
- [Using with your agent](https://github.com/ROrmand/comp-gate#using-with-your-agent)
