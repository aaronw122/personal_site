#!/usr/bin/env bash
set -euo pipefail

echo "→ Building React app..."
bun run build
echo "→ Done. Output in dist/"

echo "→ [primary] Building and starting stack on homeserver"
docker --context home compose up -d --build --remove-orphans
docker --context home compose ps

echo "→ [backup] Building and starting stack on Hetzner"
if docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner up -d --build --remove-orphans; then
  docker --context hetzner compose -f docker-compose.hetzner.yml ps
else
  echo "⚠️  Hetzner backup deploy failed (box down?). Primary is live; re-run deploy.sh to resync the backup."
fi

echo "→ Done. Both replicas updated."
