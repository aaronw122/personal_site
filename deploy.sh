#!/usr/bin/env bash
set -euo pipefail

CONTEXT="home"

echo "→ Building React app..."
bun run build
echo "→ Done. Output in dist/"

echo "→ Building and starting stack on remote server"
docker --context "$CONTEXT" compose up -d --build --remove-orphans

echo "→ Done. Remote containers:"
docker --context "$CONTEXT" compose ps
