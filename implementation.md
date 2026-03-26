# V1 Implementation Guide: Multi-Vendor Delivery Backend

## 1) Repo and Service Bootstrap Plan

Use a Bun + TypeScript monorepo with service-local runtime packages and a shared contracts package.

Suggested layout:

```text
/apps
  /order-api
  /orchestrator
  /vendor-agent
  /report-aggregator
  /route-planner
  /dispatch
  /ops-fallback
/packages
  /contracts          # shared types, queue names, schema validators
  /queue              # BullMQ producers/consumers, retry helpers
  /telemetry          # logging, tracing, metrics wrappers
```

Common service baseline (all services):

- HTTP health endpoint (`/health`).
- Structured logs with `orderId`, `merchantId`, `traceId`.
- Redis connection and queue worker registration.
- Idempotency guard on event handling.

## 2) Public API Contracts (V1)

### `POST /api/v1/orders`

Purpose: create a multi-merchant order and trigger orchestration.

Request (shape):

```json
{
  "userId": "usr_123",
  "deliveryLocation": { "lat": 12.9716, "lng": 77.5946, "address": "..." },
  "items": [
    {
      "itemId": "itm_1",
      "name": "Milk",
      "category": "grocery",
      "merchantId": "m_grocery_1",
      "quantity": 2
    }
  ]
}
```

Response:

- `201 Created` with `orderId`, `status=created`, `merchantTaskCount`, `createdAt`.

### `GET /api/v1/orders/:orderId`

Purpose: fetch orchestration state.

Response includes:

- order status,
- per-merchant task status,
- latest vendor reports,
- active route plan reference (if available),
- ops fallback tickets (if any).

### `POST /api/v1/orders/:orderId/cancel`

Purpose: cancel full order (or partial lines when already split by merchant task).

Behavior:

- if dispatch not started: mark canceled and stop future tasks.
- if dispatch started: best-effort cancel unresolved merchant tasks, preserve audit trail.

### `GET /api/v1/orders/:orderId/route`

Purpose: return latest route guidance snapshot.

Response includes:

- ordered waypoints,
- ETA per stop,
- recommended next stop,
- route version and update timestamp.

## 3) Internal Contracts (Types and Events)

### Core Types in `packages/contracts`

- `Order`
  - `id`, `userId`, `status`, `deliveryLocation`, `createdAt`, `updatedAt`.
- `OrderItem`
  - `id`, `orderId`, `merchantId`, `category`, `quantity`, `status`.
- `MerchantTask`
  - `id`, `orderId`, `merchantId`, `taskStatus`, `attemptCount`, `deadlineAt`.
- `VendorReport`
  - `orderId`, `merchantId`, `availability`, `etaReadyAt`, `confidence`, `source`, `reportedAt`.
- `RoutePlan`
  - `orderId`, `version`, `stops`, `estimatedCompletionAt`, `objectiveScore`, `generatedAt`.
- `DispatchInstruction`
  - `orderId`, `routeVersion`, `nextStop`, `pickupNotes`, `etaToNextStop`, `issuedAt`.
- `OpsTicket`
  - `id`, `orderId`, `merchantId`, `reason`, `priority`, `status`, `createdAt`, `resolvedAt`.

### BullMQ Queue/Event Contracts

- `order.created`
  - producer: `order-api`
  - consumer: `orchestrator`

- `vendor.check.requested`
  - producer: `orchestrator`
  - consumer: `vendor-agent`

- `vendor.report.ready`
  - producer: `vendor-agent`
  - consumer: `report-aggregator`

- `route.plan.requested`
  - producer: `report-aggregator`
  - consumer: `route-planner`

- `route.plan.updated`
  - producer: `route-planner`
  - consumer: `dispatch`

- `ops.ticket.created`
  - producer: `vendor-agent` or `orchestrator`
  - consumer: `ops-fallback`

Queue policy defaults:

- retries: exponential backoff, max 3 attempts.
- dead-letter queue for terminal failures.
- idempotency key: `eventName + orderId + merchantId + routeVersion?`.

## 4) Routing and Vendor Confirmation Policy

### Route Optimization Policy

Objective function:

`minimize(total_travel_time + waiting_time + lateness_penalty)`

Inputs:

- merchant coordinates,
- readiness windows (`etaReadyAt`),
- rider current location,
- delivery location,
- GraphHopper route/travel estimates.

Replan triggers:

- vendor reports prep delay beyond threshold,
- traffic spike increases ETA beyond threshold,
- no-response vendor reaches timeout and changes task state.

Output requirement:

- deterministic stop sequence with versioning (`routePlan.version`).

### AI Vendor Confirmation Policy

Flow per merchant task:

1. Attempt automated AI confirmation (call/chat/API adapter).
2. Parse and normalize outcome into `VendorReport`.
3. If confidence below threshold or explicit failure:
   - retry with exponential backoff (max 3),
   - if still unresolved, emit `ops.ticket.created`.

Rules:

- low-confidence reports are never silently accepted.
- human ops resolution can overwrite vendor report and trigger replan.
- orchestration continues for other merchants while one merchant is under ops review.

## 5) Milestone Execution Order

1. Shared contracts + queue/event skeleton
   - Define all types/events.
   - Implement queue clients, producers, consumers, retry/dead-letter.

2. Order API + orchestrator
   - Create order endpoints and persistence.
   - Emit `order.created`; fan out `vendor.check.requested`.

3. Vendor agent + report aggregator
   - Build AI confirmation adapters and normalization.
   - Aggregate reports, maintain readiness snapshot, emit `route.plan.requested`.

4. GraphHopper route planner + dynamic replan
   - Integrate GraphHopper matrix/route calls.
   - Produce route versions and publish `route.plan.updated`.

5. Ops fallback + observability + KPI dashboards
   - Implement `ops.ticket.created` workflow and manual resolution endpoints.
   - Add metrics panels for KPI targets from `plan.md`.

## 6) Test Plan and Acceptance Criteria

### Contract Tests

- Validate request/response schemas for all public APIs.
- Validate event payload schema compatibility across producers/consumers.

### Workflow Integration Tests

- all vendors ready quickly -> one stable route produced.
- one vendor delayed -> route replan produced with incremented version.
- AI confirmation fails -> `OpsTicket` created and order remains active.
- one item unavailable -> partial-order handling reflected in route and status.

### Routing Behavior Tests

- food prep window is used productively (other ready stops first).
- planner avoids early-arrival idle waiting when alternative sequence exists.

### Reliability Tests

- duplicate event delivery does not duplicate state transitions.
- retries/backoff work and dead-letter receives terminal failures.

### Acceptance Criteria

- `plan.md` and `implementation.md` are decision-complete.
- Engineering can begin service scaffolding without additional architecture decisions.
- Fallback and failure policies are explicit and testable.

## 7) Assumptions and Defaults

- Runtime remains Bun + TypeScript.
- GraphHopper is the route/travel estimation provider for v1.
- AI vendor confirmation is mandatory in v1, with human fallback mandatory.
- Missing decision default: deterministic routing/dispatch behavior over autonomous AI control.

