#!/bin/bash
# Start the Terse durable actor runtime.
# Runs from /tmp to avoid Bun workspace resolution issues with the home directory.
set -e
export PATH="$HOME/.bun/bin:$PATH"

ACTOR_DIR="$(cd "$(dirname "$0")/actors" && pwd)"
WORK_DIR="/tmp/onboardos-actors"

# Sync actor source
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/src"
cp "$ACTOR_DIR/package.json" "$ACTOR_DIR/tsconfig.json" "$ACTOR_DIR/bunfig.toml" "$WORK_DIR/"
cp "$ACTOR_DIR/src/actors.ts" "$WORK_DIR/src/"

cd "$WORK_DIR"
bun install --silent
exec bunx durable-actors dev
