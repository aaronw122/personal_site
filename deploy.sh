#!/usr/bin/env bash
set -euo pipefail

# Deploys awill.co to BOTH boxes so the Cloudflare-tunnel HA pair stays in sync:
#   - homeserver (primary)  : docker-compose.yml            via `home` context
#   - Hetzner   (hot backup): docker-compose.hetzner.yml    via `hetzner` context
# Both run a cloudflared replica of the same tunnel; Cloudflare fails over between
# them automatically. If they serve different builds, visitors get random versions —
# so always deploy to both. The Hetzner step is non-fatal: if the backup is
# unreachable, the primary still deploys (and you can re-run later to resync).

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
