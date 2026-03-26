# V1 Multi-Vendor Delivery Backend Plan

## 1) Vision and V1 Goal

Build a backend-core MVP that lets one rider pick up items from multiple merchants (grocery, food, electronics) in one order and deliver in a single trip.

The system must:

- split one user order into merchant-specific tasks,
- run vendor confirmations in parallel,
- aggregate readiness/location/ETA signals,
- produce a dynamic pickup sequence,
- continuously update rider guidance when conditions change.

V1 is backend only. Customer and rider app UI implementation is out of scope.

## 2) Finalized Decisions

| Area | Final Decision | Why |
| --- | --- | --- |
| Scope | Backend core only | Fastest path to prove orchestration and routing quality |
| Architecture | Microservices | Clear ownership and independent scaling for orchestration-heavy workloads |
| Queue/Event Backbone | Redis + BullMQ | Mature TypeScript ecosystem and quick MVP setup |
| Routing Provider | GraphHopper | Open-source-aligned routing stack with production-ready APIs |
| Vendor Confirmation | AI calls/chats from day 1 + human ops fallback | Enables coverage for non-API merchants while preserving reliability |

## 3) Service Map and Responsibilities

- `order-api`
  - Accept and validate order creation/cancel requests.
  - Persist initial order state.
  - Emit `order.created` event.

- `orchestrator`
  - Convert order into merchant tasks.
  - Fan out vendor checks in parallel.
  - Coordinate state transitions and retries.

- `vendor-agent`
  - Execute AI-driven vendor confirmations (chat/call/API bridge).
  - Return availability, prep time, confidence, and reservation status.
  - Trigger ops fallback for low-confidence/failure paths.

- `report-aggregator`
  - Collect merchant reports for each order.
  - Compute readiness snapshot for route planning.
  - Emit `route.plan.requested`.

- `route-planner`
  - Build and re-build pickup sequences using GraphHopper travel estimates.
  - Optimize for total completion time with waiting/lateness penalties.
  - Emit `route.plan.updated`.

- `dispatch`
  - Assign rider after minimum route confidence.
  - Publish waypoint guidance updates to rider systems.

- `ops-fallback`
  - Create and track manual intervention tasks.
  - Allow human confirmation and correction of vendor outcomes.
  - Push corrected report signals back to aggregation/routing pipeline.

## 4) End-to-End Flow

1. `order-api` stores order, emits `order.created`.
2. `orchestrator` creates one merchant task per vendor and emits parallel `vendor.check.requested`.
3. `vendor-agent` workers execute checks simultaneously and emit `vendor.report.ready`.
4. `report-aggregator` updates order readiness snapshot; once threshold reached, emits `route.plan.requested`.
5. `route-planner` computes optimal pickup order and emits `route.plan.updated`.
6. `dispatch` sends rider guidance (`next stop`, `pickup instructions`, `ETA to user`).
7. Any delay/no-response/traffic spike triggers replan and fresh `route.plan.updated`.
8. Failed AI confirmations create `ops.ticket.created`; human updates feed back into planning loop.

## 5) KPI Targets (V1)

- On-time delivery rate (`delivered_before_promised / total_delivered`): target >= 92%.
- Rider idle wait per order (minutes spent waiting at pickup): target <= 6 min median.
- Vendor confirmation latency (order creation to initial vendor response): target <= 90 sec p50.
- Cancellation rate (full + partial due to vendor failure): target <= 5%.

These KPIs are tracked per city/zone and by merchant category.

## 6) Non-Goals (V1)

- Building full customer app UI and rider app UI.
- Advanced split-delivery optimization (multiple riders on one order).
- Dynamic pricing, surge logic, and promotions engine.
- Fully autonomous AI dispatch decisions without deterministic constraints.

