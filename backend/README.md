# OnboardOS Backend

Terse durable actor + Agent Relay backend for the OnboardOS workflow engine.

## Prerequisites

- **Node 22+** (`nvm install 22 && nvm use 22`)
- **Bun 1.4.2+** (`curl -fsSL https://bun.sh/install | bash`)
- **Agent Relay** (`npm install -g agent-relay`)

## First-time setup

### 1. Agent Relay

```bash
# Initialize local relay server
agent-relay init --tools none --port 8787

# Register the three agents
agent-relay agent register finance_agent
agent-relay agent register document_agent
agent-relay agent register compliance_agent
```

The tokens are saved to `~/.agentworkforce/relay/agent-tokens.json` and the backend reads them automatically.

### 2. Install dependencies

```bash
# Backend (Express server)
cd backend
npm install

# Actors (Terse durable actors)
cd backend/actors
bun install
```

### 3. Copy env

```bash
cp .env.example .env
```

## Running (4 terminals)

```bash
# Terminal 1: Agent Relay broker
agent-relay node up

# Terminal 2: Terse actor runtime
cd backend
./start-actors.sh

# Terminal 3: Express API server (port 4000)
cd backend
npx tsx src/index.ts

# Terminal 4: Dashboard (port 3000)
cd web
BACKEND_URL=http://localhost:4000 npm run dev
```

## Agent tokens

Tokens are generated locally per machine. Run the setup commands above and the backend reads them automatically from `~/.agentworkforce/relay/agent-tokens.json`. No need to copy them manually.

## Architecture

```
Dashboard (:3000)  →  Express (:4000)  →  Terse Actor (:7100)
                          ↓
                    Agent Relay (:8787)
                    ├── finance_agent
                    ├── document_agent
                    └── compliance_agent
```

## Acceptance test

```bash
B=http://localhost:4000/api/onboardings
ID=$(curl -s -X POST $B -d '{}' -H 'Content-Type: application/json' | jq -r .id)
sleep 7
# 409 on wrong version
curl -s -X POST $B/$ID/review -H 'Content-Type: application/json' \
  -d '{"documentId":"ledger_mapping","version":2,"decision":"approved","operationId":"x"}'
# Reject v1
curl -s -X POST $B/$ID/review -H 'Content-Type: application/json' \
  -d '{"documentId":"ledger_mapping","version":1,"decision":"rejected","comment":"Refunds must reverse deferred revenue.","operationId":"op1"}' | jq .status
# Approve accounting
curl -s -X POST $B/$ID/review -H 'Content-Type: application/json' \
  -d '{"documentId":"accounting_configuration","version":1,"decision":"approved","operationId":"op2"}'
sleep 7
# Approve v2 → launch_ready
curl -s -X POST $B/$ID/review -H 'Content-Type: application/json' \
  -d '{"documentId":"ledger_mapping","version":2,"decision":"approved","operationId":"op3"}' | jq .status
```
