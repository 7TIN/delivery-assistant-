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
- `OSRM_TIMEOUT_MS=10000` (`0` disables timeout)
- `OSRM_DISABLE_TIMEOUT=false`
- `OSRM_HEALTH_RETRIES=3`
- `OSRM_HEALTH_RETRY_DELAY_MS=600`
- `OSRM_FAILURE_THRESHOLD=3`
- `OSRM_COOLDOWN_MS=60000`
- `OSRM_CACHE_TTL_MS=300000`
- `OSRM_MAX_CONCURRENT_REQUESTS=4`
- `OSRM_LOG_FAILED_ROUTE_URL=true`
- `OSRM_LOG_SUCCESS_ROUTE_URL=true`
- `REDIS_URL=redis://localhost:6379` (required for BullMQ mode)
- `VENDOR_MIN_CONFIDENCE=0.65`

## Run

```bash
bun install
bun run dev
```

## Startup logs

- Queue driver (`bullmq` or `in-memory`)
- Repository driver (`prisma` or `memory`)
- Redis connection status (connected/ping/reconnect/error/closed)
- OSRM API availability
- OSRM route request logs (success/failure URL, coords, timeout, minutes/reason)
- Route planner logs (final stop sequence + rider map URL)
- Dispatch logs (final rider guidance payload)

## Endpoints

- `GET /health`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/route`
- `POST /api/v1/orders/:orderId/cancel`
- `GET /api/v1/users/:userId/routes`

## Notes on OSRM timeouts

If you run many concurrent orders against the public endpoint (`router.project-osrm.org`), you can hit timeouts/rate limits.
This project throttles and caches OSRM estimates, logs route URLs, and falls back to local estimation during cooldown.
For heavy load tests, prefer your own OSRM server and set `OSRM_BASE_URL` to that instance.

## Smoke test

```bash
bun run smoke:test
```
