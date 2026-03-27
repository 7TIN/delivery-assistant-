import { useQuery } from "@tanstack/react-query";

import { getHealth } from "@/api/orders";

export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
}
