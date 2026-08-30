#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e 'const i=JSON.parse(process.argv[1]); process.stdout.write(i.command||"")' "$input")

if ! echo "$command" | grep -qE '^git[[:space:]]+push'; then
  echo '{"permission":"allow"}'
  exit 0
fi

response=$(npx --yes comp-gate hook before-push --command "$command" --json 2>/dev/null || true)

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
  "user_message": "You must run the /testme skill before pushing.",
  "agent_message": "You must run the /testme skill before pushing."
}
EOF
exit 2
