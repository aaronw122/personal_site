#!/usr/bin/env bash
set -euo pipefail

CF_ZONE_ID="f9abae8896117e31be1e349d390fe109"
SITE_ROOT="/srv/awill"
KEEP_RELEASES=5
RELEASE="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
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
    echo "❌ Cloudflare cache purge failed. Run Caching → Configuration → Purge Everything now: edge HTML references replaced assets."
    purge_failed=1
  fi
}

publish_release() {
  local host="$1"
  local link_dest=()
  ssh "$host" "[ -w $SITE_ROOT ] || sudo install -d -o \"\$(id -un)\" $SITE_ROOT; mkdir -p $SITE_ROOT/releases" || return 1
  if ssh "$host" "test -d $SITE_ROOT/current/"; then
    link_dest=(--link-dest="$SITE_ROOT/current/")
  fi
  rsync -rlc --delete --stats ${link_dest[@]+"${link_dest[@]}"} dist/ "$host:$SITE_ROOT/releases/$RELEASE/" \
    | grep -E '^(Number of regular files transferred|Total transferred file size)' || return 1
  ssh "$host" "cd $SITE_ROOT && ln -sfn releases/$RELEASE current.next && mv -Tf current.next current \
    && ls -1d releases/* | sort | head -n -$KEEP_RELEASES | xargs -r rm -rf" || return 1
  echo "→ $host now serving release $RELEASE"
}

echo "→ Building React app..."
bun run build
echo "→ Done. Output in dist/"

echo "→ [primary] Publishing to homeserver"
publish_release homeserver
docker --context home compose up -d --build --remove-orphans
docker --context home compose ps
purge_edge_cache

echo "→ [backup] Publishing to Hetzner"
if publish_release root@hetzner \
  && docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner up -d --build --remove-orphans; then
  docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner ps
else
  echo "⚠️  Hetzner backup deploy failed (box down?). Primary is live; re-run deploy.sh to resync the backup."
fi
purge_edge_cache

echo "→ Done. Both replicas updated."
exit "$purge_failed"
