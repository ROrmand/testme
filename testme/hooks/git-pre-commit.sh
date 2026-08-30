#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

run_comp_gate() {
  if [ -x "$root/node_modules/.bin/comp-gate" ]; then
    "$root/node_modules/.bin/comp-gate" "$@"
  elif command -v comp-gate >/dev/null 2>&1; then
    comp-gate "$@"
  elif [ -x "$root/node_modules/.bin/testme" ]; then
    "$root/node_modules/.bin/testme" "$@"
  elif command -v testme >/dev/null 2>&1; then
    testme "$@"
  else
    npx --yes comp-gate "$@"
  fi
}

result=$(run_comp_gate hook before-commit --command "git commit" --json 2>/dev/null || true)

if [ -n "$result" ]; then
  if echo "$result" | grep -q '"permission"[[:space:]]*:[[:space:]]*"deny"'; then
    echo "$result" | node -e '
      const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
      console.error(input.user_message ?? input.agent_message ?? "Commit blocked by testme.");
    '
    exit 1
  fi
  exit 0
fi

echo "You must run the /testme skill before committing." >&2
exit 1
