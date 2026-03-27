import {
  merchantCatalogById,
  type MerchantCatalogItem,
  type MerchantKind,
} from "@/data/catalog";
import type {
  DispatchInstruction,
  MerchantTask,
  MerchantTaskStatus,
  OrderItem,
  OrderSnapshot,
  OrderStatus,
  RoutePlan,
  RouteStop,
  UserOrderRouteSummary,
  VendorReport,
} from "@/types/contracts";

export interface MerchantPresentation {
  merchantId: string;
  merchantName: string;
  merchantKind: MerchantKind;
  items: OrderItem[];
  task?: MerchantTask;
  report?: VendorReport;
  routeStop?: RouteStop;
  routeIndex?: number;
}

export interface DisplayRouteStop extends RouteStop {
  merchantName: string;
  merchantKind: MerchantKind;
  state: "pending" | "active" | "complete";
}

export interface DashboardMetrics {
  total: number;
  awaitingOps: number;
  activeRoutes: number;
  dispatching: number;
}

const ORDER_FLOW: OrderStatus[] = [
  "created",
  "orchestrating",
  "awaiting_ops",
  "route_ready",
  "dispatching",
  "completed",
  "canceled",
];

export function getOrderFlow(): OrderStatus[] {
  return ORDER_FLOW;
}

export function getOrderStageIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status);
}

export function statusTone(status: OrderStatus): "neutral" | "accent" | "warning" | "success" | "danger" {
  if (status === "completed") {
    return "success";
  }

  if (status === "canceled") {
    return "danger";
  }

  if (status === "awaiting_ops") {
    return "warning";
  }

  if (status === "dispatching") {
    return "accent";
  }

  return "neutral";
}

export function merchantTaskTone(
  status: MerchantTaskStatus,
): "neutral" | "accent" | "warning" | "success" | "danger" {
  switch (status) {
    case "confirmed":
      return "success";
    case "checking_vendor":
      return "accent";
    case "failed":
      return "danger";
    case "canceled":
      return "warning";
    default:
      return "neutral";
  }
}

export function resolveMerchantCatalogItem(merchantId: string):
  | {
      merchantId: string;
      merchantName: string;
      merchantKind: MerchantKind;
      merchantLocation: MerchantCatalogItem["merchantLocation"];
    }
  | undefined {
  return merchantCatalogById.get(merchantId);
}

export function resolveMerchantName(merchantId: string): string {
  return resolveMerchantCatalogItem(merchantId)?.merchantName ?? `Merchant ${merchantId}`;
}

export function resolveMerchantKind(merchantId: string): MerchantKind {
  return resolveMerchantCatalogItem(merchantId)?.merchantKind ?? "other";
}

export function buildMerchantPresentations(snapshot: OrderSnapshot): MerchantPresentation[] {
  const itemsByMerchant = new Map<string, OrderItem[]>();
  for (const item of snapshot.items) {
    const current = itemsByMerchant.get(item.merchantId) ?? [];
    current.push(item);
    itemsByMerchant.set(item.merchantId, current);
  }

  const reportByMerchant = new Map(snapshot.vendorReports.map((report) => [report.merchantId, report]));
  const routeIndexByMerchant = new Map(
    (snapshot.routePlan?.stops ?? []).map((stop, index) => [stop.merchantId, index]),
  );
  const routeStopByMerchant = new Map(
    (snapshot.routePlan?.stops ?? []).map((stop) => [stop.merchantId, stop]),
  );

  return snapshot.merchantTasks
    .map((task) => ({
      merchantId: task.merchantId,
      merchantName: resolveMerchantName(task.merchantId),
      merchantKind: resolveMerchantKind(task.merchantId),
      items: itemsByMerchant.get(task.merchantId) ?? [],
      task,
      report: reportByMerchant.get(task.merchantId),
      routeStop: routeStopByMerchant.get(task.merchantId),
      routeIndex: routeIndexByMerchant.get(task.merchantId),
    }))
    .sort((left, right) => {
      const leftIndex = left.routeIndex ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = right.routeIndex ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.merchantName.localeCompare(right.merchantName);
    });
}

export function buildDisplayRouteStops(
  routePlan?: RoutePlan,
  dispatchInstruction?: DispatchInstruction,
  orderStatus?: OrderStatus,
): DisplayRouteStop[] {
  if (!routePlan) {
    return [];
  }

  const activeMerchantId = dispatchInstruction?.nextStop?.merchantId;
  const activeIndex = routePlan.stops.findIndex((stop) => stop.merchantId === activeMerchantId);

  return routePlan.stops.map((stop, index) => {
    let state: DisplayRouteStop["state"] = "pending";

    if (orderStatus === "completed") {
      state = "complete";
    } else if (activeIndex >= 0 && index < activeIndex) {
      state = "complete";
    } else if (stop.merchantId === activeMerchantId) {
      state = "active";
    }

    return {
      ...stop,
      merchantName: resolveMerchantName(stop.merchantId),
      merchantKind: resolveMerchantKind(stop.merchantId),
      state,
    };
  });
}

export function buildDashboardMetrics(orders: UserOrderRouteSummary[]): DashboardMetrics {
  return {
    total: orders.length,
    awaitingOps: orders.filter((order) => order.status === "awaiting_ops").length,
    activeRoutes: orders.filter((order) => Boolean(order.routePlan)).length,
    dispatching: orders.filter((order) => order.status === "dispatching").length,
  };
}
