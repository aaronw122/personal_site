#!/usr/bin/env sh

echo "→ Building MkDocs lists..."
mkdocs build -f mkdocs-lists.yml

echo "→ Building React app..."
bun run build

echo "→ Done. Output in dist/"
