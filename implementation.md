# V1 Implementation Guide: Multi-Vendor Delivery Backend

## 1) Repo and Service Bootstrap Plan

Use a Bun + TypeScript monorepo with one service per app and shared contracts.

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
  /contracts
  /queue
  /core
```

Common baseline for each service:

- `GET /health`
- structured logs with `orderId`, `merchantId`, `traceId`
- queue registration (BullMQ or in-memory)
- idempotent event handlers

## 2) Public API Contracts (V1)

### `POST /api/v1/orders`

Creates a multi-merchant order and starts orchestration.

Response: `201` with `orderId`, `status`, `merchantTaskCount`, `createdAt`.

### `GET /api/v1/orders/:orderId`

Returns orchestration snapshot:

- order status
- merchant task statuses
- vendor reports
- latest route plan
- dispatch instruction
- ops tickets

### `POST /api/v1/orders/:orderId/cancel`

Cancels the order.

### `GET /api/v1/orders/:orderId/route`

Returns latest route plan for an order.

### `GET /api/v1/users/:userId/routes`

Returns all orders for one user with delivery location, merchant task locations, route plan, and dispatch instruction.

## 3) Internal Contracts (Types and Events)

### Core Types in `packages/contracts`

- `Order`
- `OrderItem`
- `MerchantTask`
- `VendorReport`
- `RoutePlan`
- `DispatchInstruction`
- `OpsTicket`
- `UserOrderRouteSummary`

### BullMQ Queue/Event Contracts

- `order.created`
- `vendor.check.requested`
- `vendor.report.ready`
- `route.plan.requested`
- `route.plan.updated`
- `ops.ticket.created`

Queue defaults:

- retry policy: exponential backoff, 3 attempts
- dead-letter handling for terminal failure
- idempotency key pattern: `eventName + orderId + merchantId + routeVersion?`

## 4) Routing and Vendor Confirmation Policy

### Route Optimization Policy

Objective:

`minimize(travel_time + wait_time + lateness_penalty)`

Inputs:

- merchant coordinates
- readiness windows (`etaReadyAt`)
- rider position approximation
- delivery location
- OSRM travel estimates (with local fallback)

Replan triggers:

- delayed prep window
- traffic/ETA spike
- no-response vendor

### AI Vendor Confirmation Policy

Per merchant task:

1. attempt AI call/chat/API confirmation
2. normalize into `VendorReport`
3. if low confidence/failure:
   - retry with backoff
   - emit `ops.ticket.created` after max retries

Rules:

- low-confidence reports are not silently accepted
- ops can override report and trigger replan
- orchestration of other merchants continues in parallel

## 5) Milestone Execution Order

1. Shared contracts + queue/event skeleton
2. Order API + orchestrator
3. Vendor agent + report aggregator
4. OSRM route planner + dynamic replan
5. Ops fallback + observability + KPI dashboards

## 6) Test Plan and Acceptance Criteria

### Contract Tests

- validate request/response schema for all public APIs
- validate event payload compatibility across services

### Workflow Integration Tests

- all vendors ready quickly
- one vendor delayed and route replans
- AI confirmation fails and ops ticket is created
- one item unavailable and partial path is handled

### Routing Behavior Tests

- food prep window is used by scheduling other pickups first
- planner avoids early idle waiting when alternatives exist

### Reliability Tests

- duplicate event delivery stays idempotent
- retries and dead-letter handling work

### Acceptance Criteria

- docs are executable without extra architecture decisions
- route + fallback behavior is deterministic and testable

## 7) Assumptions and Defaults

- runtime: Bun + TypeScript
- routing provider: OSRM APIs for v1
- AI vendor confirmation enabled in v1
- human ops fallback mandatory
- if unclear, use deterministic dispatch/routing over autonomous AI behavior
git 