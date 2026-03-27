import { useQuery } from "@tanstack/react-query";

import { getUserRoutes } from "@/api/orders";

export function useUserRoutes(userId: string) {
  return useQuery({
    queryKey: ["user-routes", userId],
    queryFn: () => getUserRoutes(userId),
    enabled: userId.trim().length > 0,
    refetchInterval: 6_000,
    refetchOnWindowFocus: false,
  });
}
