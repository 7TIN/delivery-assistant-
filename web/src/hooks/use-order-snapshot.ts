import { useQuery } from "@tanstack/react-query";

import { getOrderSnapshot } from "@/api/orders";
import type { OrderStatus } from "@/types/contracts";

const LIVE_STATUSES = new Set<OrderStatus>([
  "created",
  "orchestrating",
  "route_ready",
  "dispatching",
]);

export function useOrderSnapshot(orderId: string) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderSnapshot(orderId),
    enabled: orderId.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.order.status;
      if (!status || LIVE_STATUSES.has(status)) {
        return 3_000;
      }

      return false;
    },
    refetchOnWindowFocus: false,
  });
}
