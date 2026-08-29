#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

run_testme() {
  if [ -x "$root/node_modules/.bin/testme" ]; then
    "$root/node_modules/.bin/testme" "$@"
  elif command -v testme >/dev/null 2>&1; then
    testme "$@"
  else
    npx --yes testme "$@"
  fi
}

zero="0000000000000000000000000000000000000000"

while read -r local_ref local_sha remote_ref remote_sha; do
  if [ -z "${local_ref:-}" ]; then
    continue
  fi

  if [ "$local_sha" = "$zero" ]; then
    continue
  fi

  case "$remote_ref" in
    refs/heads/*) ;;
    *) continue ;;
  esac

  result=$(run_testme hook before-push-ref --remote-ref "$remote_ref" --json 2>/dev/null || true)

  if [ -z "$result" ]; then
    echo "You must run the /testme skill before pushing." >&2
    exit 1
  fi

  if echo "$result" | grep -q '"permission"[[:space:]]*:[[:space:]]*"deny"'; then
    echo "$result" | node -e '
      const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
      console.error(input.user_message ?? input.agent_message ?? "Push blocked by testme.");
    '
    exit 1
  fi
done

exit 0
