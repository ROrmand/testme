#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e 'const i=JSON.parse(process.argv[1]); process.stdout.write(i.command||"")' "$input")

if ! echo "$command" | grep -qE '^git[[:space:]]+commit'; then
  echo '{"permission":"allow"}'
  exit 0
fi

response=$(npx --yes testme hook before-commit --command "$command" --json 2>/dev/null || true)

if [ -n "$response" ]; then
  echo "$response"
  if echo "$response" | grep -q '"permission"[[:space:]]*:[[:space:]]*"deny"'; then
    exit 2
  fi
  exit 0
fi

cat <<'EOF'
{
  "permission": "deny",
  "user_message": "You must run the /testme skill before committing.",
  "agent_message": "You must run the /testme skill before committing."
}
EOF
exit 2
