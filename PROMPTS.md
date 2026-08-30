# Session Changes

## src/constants.ts
- Added ADOPTING_EXISTING_REPOS_URL constant for wizard and docs links

## src/repo-stats.ts
- Added measureRepo() with git ls-files count and filesystem fallback; LARGE_REPO_FILE_THRESHOLD at 500 files

## src/bootstrap-summary.ts
- Added heuristic SUMMARY.md bootstrap from README, manifests, top-level dirs, and detectProject signals

## src/setup-wizard.ts
- Added summaryMode blank|generate to WizardChoices; wizard step with large-repo warnings and terminal hyperlinks
- Added parseSummaryModeOption and terminalLink helpers

## src/init.ts
- initShared branches on summaryMode: blank template, generate bootstrap, or skip if SUMMARY.md exists
- Added summaryMode to InitOptions for CLI override

## src/cli.ts
- Added --summary blank|generate flag to init command

## docs/adopting-existing-repos.md
- Added guide for blank vs generate SUMMARY.md when adopting into existing repos

## README.md
- Added Adopting an existing repository section with size trade-offs and doc link

## src/repo-stats.test.ts
## src/bootstrap-summary.test.ts
## src/setup-wizard.test.ts
## src/init.test.ts
- Added tests for repo stats, bootstrap summary, wizard parsing, and init with summaryMode generate
