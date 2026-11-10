#!/usr/bin/env bash
set -euo pipefail

CF_ZONE_ID="f9abae8896117e31be1e349d390fe109"
purge_failed=0

purge_edge_cache() {
  local token
  token=$(set -a; . ./.env; printf '%s' "${CLOUDFLARE_API_TOKEN:-}")
  if curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' | grep -q '"success":true'; then
    echo "→ Purged Cloudflare edge cache"
  else
    echo "❌ Cloudflare cache purge failed. Run Caching → Configuration → Purge Everything now: edge HTML references deleted assets."
    purge_failed=1
  fi
}

echo "→ Building React app..."
bun run build
echo "→ Done. Output in dist/"

echo "→ [primary] Building and starting stack on homeserver"
docker --context home compose up -d --build --remove-orphans
docker --context home compose ps
purge_edge_cache

echo "→ [backup] Building and starting stack on Hetzner"
if docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner up -d --build --remove-orphans; then
  docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner ps
else
  echo "⚠️  Hetzner backup deploy failed (box down?). Primary is live; re-run deploy.sh to resync the backup."
fi
purge_edge_cache

echo "→ Done. Both replicas updated."
exit "$purge_failed"
