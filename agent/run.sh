#!/bin/bash
# Onboardy agent service on :8002. Needs OPENAI_API_KEY in agent/.env (never committed).
set -e
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
[ -f ../.env.supabase ] && { set -a; . ../.env.supabase; set +a; }   # shared Supabase settings
[ -f .env ] && { set -a; . ./.env; set +a; }                         # OPENAI_API_KEY
exec .venv/bin/uvicorn main:app --port "${PORT:-8002}"
