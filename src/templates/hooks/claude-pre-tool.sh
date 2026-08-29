#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e '
const data = JSON.parse(process.argv[1]);
const tool = data.tool_name || "";
const toolInput = data.tool_input || {};
const cmd = toolInput.command || toolInput.cmd || "";
process.stdout.write(cmd);
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
  message=$(echo "$response" | node -e '
const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
process.stdout.write(data.agent_message || data.user_message || "Blocked by testme.");
')
  node -e "
const reason = process.argv[1];
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason
  }
}));
" "$message"
  exit 0
fi

if [ -n "$response" ]; then
  exit 0
fi

node -e '
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "You must run the testme workflow before committing or pushing."
  }
}));
'
exit 0
