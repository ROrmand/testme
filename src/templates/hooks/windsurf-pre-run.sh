#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e '
const data = JSON.parse(process.argv[1]);
const toolInfo = data.tool_info || {};
process.stdout.write(toolInfo.command_line || "");
' "$input")

if [ -z "$command" ]; then
  exit 0
fi

hook_kind=""
if echo "$command" | grep -qE '^git[[:space:]]+commit'; then
  hook_kind="before-commit"
elif echo "$command" | grep -qE '^git[[:space:]]+push'; then
  hook_kind="before-push"
else
  exit 0
fi

response=$(npx --yes testme hook "$hook_kind" --command "$command" --json 2>/dev/null || true)

if [ -n "$response" ] && echo "$response" | grep -q '"permission"[[:space:]]*:[[:space:]]*"deny"'; then
  echo "$response" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
console.error(data.user_message || data.agent_message || "Blocked by testme.");
' >&2
  exit 2
fi

if [ -n "$response" ]; then
  exit 0
fi

echo "You must run the testme workflow before committing or pushing." >&2
exit 2
