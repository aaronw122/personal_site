#!/usr/bin/env bash
set -uo pipefail

# On-demand health check for the Hetzner awill.co backup replica.
# Verifies: both containers up, nginx serves the real site, the tunnel replica is
# connected, and the backup isn't serving a STALE build vs the homeserver (drift).
# Run anytime:  ./check-backup.sh

COMPOSE="docker-compose.hetzner.yml"
fail=0

echo "→ Hetzner containers:"
docker --context hetzner compose -f "$COMPOSE" ps || fail=1

echo "→ Hetzner nginx serving locally:"
title=$(docker --context hetzner run --rm --network host curlimages/curl:latest -s http://localhost:80 2>/dev/null | grep -i -o '<title>[^<]*</title>')
if [ -n "$title" ]; then echo "  ✓ $title"; else echo "  ✗ nginx not serving"; fail=1; fi

echo "→ Tunnel replica connections (should be >0):"
conns=$(docker --context hetzner logs personal_site-cloudflared-1 2>&1 | grep -c "Registered tunnel connection")
echo "  registered connections seen in logs: $conns"
[ "$conns" -gt 0 ] || fail=1

echo "→ Drift check (Hetzner build vs homeserver build):"
het=$(docker --context hetzner exec personal_site-personal_site-1 sha256sum /usr/share/nginx/html/index.html 2>/dev/null | awk '{print $1}')
home=$(docker --context home    exec personal_site-personal_site-1 sha256sum /usr/share/nginx/html/index.html 2>/dev/null | awk '{print $1}')
if [ -n "$het" ] && [ "$het" = "$home" ]; then
  echo "  ✓ in sync ($het)"
else
  echo "  ⚠️  DRIFT — hetzner=$het home=$home  (run ./deploy.sh to resync)"; fail=1
fi

echo
[ "$fail" -eq 0 ] && echo "✅ backup healthy" || echo "❌ backup needs attention (see above)"
exit "$fail"
