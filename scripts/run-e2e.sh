#!/usr/bin/env bash
set -e
npx playwright install --with-deps chromium >/tmp/pw.log 2>&1 || { tail -40 /tmp/pw.log; exit 1; }
npm run dev >/tmp/vite.log 2>&1 &
DEV_PID=$!
timeout 40 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done' || { cat /tmp/vite.log; exit 1; }
node scripts/smoke-test.mjs
CODE=$?
kill $DEV_PID 2>/dev/null || true
exit $CODE
