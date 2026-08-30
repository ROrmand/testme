#!/bin/sh
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
npx comp-gate statusline 2>/dev/null || true
