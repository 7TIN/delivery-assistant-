# delivery

Backend MVP scaffold for multi-vendor, single-rider orchestration.

## Prerequisites

- Bun 1.2+
- PowerShell (for smoke test script)
- Redis (only if running BullMQ mode)

## Environment

Copy `.env.example` to `.env` and update values.

```bash
cp .env.example .env
```

Important values:

- `ORDER_API_PORT=3000`
- `QUEUE_DRIVER=in-memory` or `QUEUE_DRIVER=bullmq`
- `OSRM_ENABLED=true`
- `OSRM_BASE_URL=https://router.project-osrm.org`
- `OSRM_TIMEOUT_MS=2500`
- `REDIS_URL=redis://localhost:6379` (required for BullMQ mode)
- `VENDOR_MIN_CONFIDENCE=0.65`

## Run (in-memory mode)

```bash
bun install
bun run dev
```

## Run (BullMQ mode)

1. Start Redis.
2. Set `QUEUE_DRIVER=bullmq`.
3. Run:

```bash
bun run dev
```

## Startup logs you now get

- Which queue driver is active (`bullmq` or `in-memory`).
- Redis connection status (`connected`, `ping success`, reconnect/error/closed).
- OSRM API availability (`reachable` or fallback warning).

## Endpoints

- `GET /health`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/route`
- `POST /api/v1/orders/:orderId/cancel`

## Smoke Test (one command)

```bash
bun run smoke:test
```

This starts the API in background, runs full flow checks, and prints JSON results.
