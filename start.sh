#!/bin/bash
set -e

# Free port 3001 in case a previous run left it occupied
fuser -k 3001/tcp 2>/dev/null || true
sleep 0.2

# Start backend in background and track its PID
node server/index.js &
BACKEND_PID=$!

# When this script exits (SIGTERM on workflow restart, Ctrl-C, etc.)
# kill the background backend so port 3001 is freed for the next run
trap "kill $BACKEND_PID 2>/dev/null; wait $BACKEND_PID 2>/dev/null" EXIT SIGTERM SIGINT

# Run Vite in the foreground — workflow stays alive as long as Vite runs
npm run dev
