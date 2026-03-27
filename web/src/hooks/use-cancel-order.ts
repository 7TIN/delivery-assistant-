import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cancelOrder } from "@/api/orders";

export function useCancelOrder(orderId: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["order-route", orderId] });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ["user-routes", userId] });
      }
    },
  });
}
