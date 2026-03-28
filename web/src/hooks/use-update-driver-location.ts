import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDriverLocation } from "@/api/orders";
import type { GeoPoint } from "@/types/contracts";

export function useUpdateDriverLocation(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (location: GeoPoint) => updateDriverLocation(orderId, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["user-routes"] });
    },
  });
}
