# delivery

Backend MVP scaffold for multi-vendor, single-rider orchestration.

## Prerequisites

- Bun 1.2+
- PowerShell (for smoke test script)
- Redis (only if running BullMQ mode)
- PostgreSQL (only if running Prisma repository mode)

## Environment

Copy `.env.example` to `.env` and update values.

```bash
cp .env.example .env
```

Important values:

- `ORDER_API_PORT=3000`
- `QUEUE_DRIVER=in-memory` or `QUEUE_DRIVER=bullmq`
- `REPOSITORY_DRIVER=memory` or `REPOSITORY_DRIVER=prisma`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/delivery`
- `OSRM_ENABLED=true`
- `OSRM_BASE_URL=https://router.project-osrm.org`
- `OSRM_TIMEOUT_MS=10000`\n- `OSRM_HEALTH_RETRIES=3`\n- `OSRM_HEALTH_RETRY_DELAY_MS=600`
- `REDIS_URL=redis://localhost:6379` (required for BullMQ mode)
- `VENDOR_MIN_CONFIDENCE=0.65`

## Prisma commands

- Generate client:

```bash
bun run prisma:generate
```

- Run migration:

```bash
bun run prisma:migrate
```

## Run (in-memory repository mode)

```bash
bun install
bun run dev
```

## Run (Prisma/Postgres repository mode)

1. Start PostgreSQL.
2. Set `REPOSITORY_DRIVER=prisma` and `DATABASE_URL`.
3. Run Prisma generate + migrate.
4. Start API:

```bash
bun run dev
```

## Run (BullMQ queue mode)

1. Start Redis.
2. Set `QUEUE_DRIVER=bullmq`.
3. Start API:

```bash
bun run dev
```

## Startup logs you now get

- Queue driver (`bullmq` or `in-memory`).
- Repository driver (`prisma` or `memory`).
- Redis connection status (connected/ping/reconnect/error/closed).
- OSRM API availability (reachable or fallback warning).

## Endpoints

- `GET /health`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/route`
- `POST /api/v1/orders/:orderId/cancel`

## Smoke test

```bash
bun run smoke:test
```

This starts the API in background, runs full flow checks, and prints JSON results.

