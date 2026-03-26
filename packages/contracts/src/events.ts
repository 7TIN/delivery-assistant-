import type {
  DispatchInstruction,
  MerchantTask,
  OpsTicket,
  RoutePlan,
  VendorReport,
} from "./types";

export const QUEUE_NAMES = {
  orderCreated: "order.created",
  vendorCheckRequested: "vendor.check.requested",
  vendorReportReady: "vendor.report.ready",
  routePlanRequested: "route.plan.requested",
  routePlanUpdated: "route.plan.updated",
  opsTicketCreated: "ops.ticket.created",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface OrderCreatedEvent {
  orderId: string;
}

export interface VendorCheckRequestedEvent {
  orderId: string;
  merchantTask: MerchantTask;
}

export interface VendorReportReadyEvent {
  orderId: string;
  report: VendorReport;
}

export interface RoutePlanRequestedEvent {
  orderId: string;
}

export interface RoutePlanUpdatedEvent {
  orderId: string;
  routePlan: RoutePlan;
}

export interface OpsTicketCreatedEvent {
  orderId: string;
  ticket: OpsTicket;
}

export interface DispatchInstructionIssuedEvent {
  orderId: string;
  instruction: DispatchInstruction;
}

export interface QueueEventMap {
  "order.created": OrderCreatedEvent;
  "vendor.check.requested": VendorCheckRequestedEvent;
  "vendor.report.ready": VendorReportReadyEvent;
  "route.plan.requested": RoutePlanRequestedEvent;
  "route.plan.updated": RoutePlanUpdatedEvent;
  "ops.ticket.created": OpsTicketCreatedEvent;
}

export type QueueEventName = keyof QueueEventMap;
