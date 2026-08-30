#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e 'const i=JSON.parse(process.argv[1]); process.stdout.write(i.command||"")' "$input")
exit_code=$(node -e 'const i=JSON.parse(process.argv[1]); process.stdout.write(String(i.exit_code ?? i.exitCode ?? 1))' "$input")

if [ "$exit_code" != "0" ]; then
  exit 0
fi

if ! echo "$command" | grep -qE '^git[[:space:]]+push'; then
  exit 0
fi

npx --yes comp-gate hook after-push --command "$command" 2>/dev/null || true
exit 0
