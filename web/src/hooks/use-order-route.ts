import { useQuery } from "@tanstack/react-query";

import { getOrderRoute } from "@/api/orders";
import type { OrderStatus, RoutePlan } from "@/types/contracts";

const ROUTE_READY_STATUSES = new Set<OrderStatus>(["route_ready", "dispatching", "completed"]);

export function useOrderRoute(orderId: string, status?: OrderStatus, existingRoute?: RoutePlan) {
  return useQuery({
    queryKey: ["order-route", orderId],
    queryFn: () => getOrderRoute(orderId),
    enabled: orderId.length > 0 && Boolean(status && ROUTE_READY_STATUSES.has(status)) && !existingRoute,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}
