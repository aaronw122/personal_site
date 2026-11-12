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

stage_release() {
  local host="$1"
  local link_dest=()
  ssh "$host" "[ -w $SITE_ROOT ] || sudo install -d -o \"\$(id -un)\" $SITE_ROOT; mkdir -p $SITE_ROOT/releases $SITE_ROOT/assets" || return 1
  rsync -rlc dist/assets/ "$host:$SITE_ROOT/assets/" || return 1
  if ssh "$host" "test -d $SITE_ROOT/current/"; then
    link_dest=(--link-dest="$SITE_ROOT/current/")
  fi
  rsync -rlc --delete --stats ${link_dest[@]+"${link_dest[@]}"} dist/ "$host:$SITE_ROOT/releases/$RELEASE/" \
    | grep -E '^(Number of regular files transferred|Total transferred file size)' || return 1
  echo "→ $host staged release $RELEASE"
}

activate_release() {
  local host="$1"
  ssh "$host" "cd $SITE_ROOT && ln -sfn releases/$RELEASE current.next && mv -Tf current.next current \
    && ls -1d releases/* | sort | head -n -$KEEP_RELEASES | xargs -r rm -rf \
    && cd assets && for f in *; do ls ../releases/*/assets/\"\$f\" >/dev/null 2>&1 || rm -f -- \"\$f\"; done" || return 1
  echo "→ $host now serving release $RELEASE"
}

HOME_COMPOSE=(docker --context home compose)
HETZNER_COMPOSE=(docker --context hetzner compose -f docker-compose.hetzner.yml --env-file .env.hetzner)

echo "→ Building React app..."
bun run build
echo "→ Done. Output in dist/"

echo "→ Staging on both replicas before switching either"
stage_release homeserver
hetzner_ok=1
if ! stage_release root@hetzner; then
  hetzner_ok=0
  echo "⚠️  Hetzner staging failed (box down?). Deploying primary only; re-run deploy.sh to resync the backup."
fi

echo "→ Activating"
activate_release homeserver
"${HOME_COMPOSE[@]}" up -d --build --remove-orphans
"${HOME_COMPOSE[@]}" ps
if [ "$hetzner_ok" = 1 ]; then
  if activate_release root@hetzner && "${HETZNER_COMPOSE[@]}" up -d --build --remove-orphans; then
    "${HETZNER_COMPOSE[@]}" ps
  else
    hetzner_ok=0
    echo "⚠️  Hetzner activation failed. Primary is live; re-run deploy.sh to resync the backup."
  fi
fi

purge_edge_cache

if [ "$hetzner_ok" = 1 ]; then echo "→ Done. Both replicas updated."; else echo "→ Done. Primary only."; fi
exit "$purge_failed"
