#!/usr/bin/env bash
set -e
npx playwright install --with-deps chromium >/tmp/pw.log 2>&1 || { tail -40 /tmp/pw.log; exit 1; }
npm run preview -- --host --port 4173 >/tmp/preview.log 2>&1 &
PREVIEW_PID=$!
timeout 30 bash -c 'until curl -sf http://localhost:4173 >/dev/null; do sleep 1; done' || { cat /tmp/preview.log; exit 1; }
node scripts/test-preview.mjs
CODE=$?
kill $PREVIEW_PID 2>/dev/null || true
exit $CODE
