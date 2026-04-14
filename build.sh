#!/usr/bin/env bash
set -euo pipefail

echo "→ Building MkDocs writing..."
mkdocs build

echo "→ Building React app..."
npm run build

echo "→ Done. Output in dist/"
