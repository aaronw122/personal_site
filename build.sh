#!/usr/bin/env bash
set -euo pipefail

echo "→ Building MkDocs writing..."
mkdocs build

echo "→ Building React app..."
bun run build

echo "→ Done. Output in dist/"
