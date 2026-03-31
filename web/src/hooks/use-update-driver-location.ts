import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDeliveryPerson } from "@/api/orders";
import type { GeoPoint } from "@/types/contracts";

export function useUpdateDeliveryPerson(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (location: GeoPoint) => updateDeliveryPerson(orderId, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["user-routes"] });
    },
  });
}
