#!/usr/bin/env bash
set -euo pipefail

echo "→ Building React app..."
bun run build

echo "→ Done. Output in dist/"
