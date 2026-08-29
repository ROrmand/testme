#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(node -e 'const i=JSON.parse(process.argv[1]); process.stdout.write(i.command||"")' "$input")

if ! echo "$command" | grep -qE '^git[[:space:]]+push'; then
  echo '{"permission":"allow"}'
  exit 0
fi

if ! echo "$command" | grep -qE '(HEAD:main|origin[[:space:]]+main|\bmain\b|refs/heads/main)'; then
  echo '{"permission":"allow"}'
  exit 0
fi

response=$(npx --yes testme hook before-push --command "$command" --json 2>/dev/null || true)

if [ -n "$response" ]; then
  echo "$response"
  if echo "$response" | grep -q '"permission"[[:space:]]*:[[:space:]]*"deny"'; then
    exit 2
  fi
  exit 0
fi

if [ -f .testme/pass.json ]; then
  echo '{"permission":"allow"}'
  exit 0
fi

cat <<'EOF'
{
  "permission": "deny",
  "user_message": "Push to main blocked: run /testme before pushing.",
  "agent_message": "Push to main requires passing testme verification. Run /testme or npx testme generate, write .testme/answers.json, then npx testme verify."
}
EOF
exit 2
