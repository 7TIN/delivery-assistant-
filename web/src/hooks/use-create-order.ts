import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createOrder } from "@/api/orders";
import type { CreateOrderRequest } from "@/types/contracts";

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrderRequest) => createOrder(payload),
    onSuccess: (response, request) => {
      void queryClient.invalidateQueries({
        queryKey: ["user-routes", request.userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["order", response.orderId],
      });
    },
  });
}
