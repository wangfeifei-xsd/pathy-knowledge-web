#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "$0")/service.sh"

port=${PORT:-5173}
prepare_start

if [[ ! -x node_modules/.bin/vite ]]; then
    npm ci --include=dev
fi

# Run Vite directly so the recorded PID belongs to the listening process.
launch_service node_modules/.bin/vite --host "${HOST:-127.0.0.1}" --port "$port" --strictPort
