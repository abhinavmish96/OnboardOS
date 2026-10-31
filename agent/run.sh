#!/bin/bash
# Onboardy agent service on :8002. Needs OPENAI_API_KEY in agent/.env (never committed).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
[ -f .env ] && { set -a; . ./.env; set +a; }
exec .venv/bin/uvicorn main:app --port "${PORT:-8002}"
