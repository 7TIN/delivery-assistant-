import { apiRequest, ApiError } from "@/api/client";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderSnapshot,
  RoutePlan,
  UserRoutesResponse,
} from "@/types/contracts";

export async function getHealth(): Promise<{ status: string; service: string }> {
  return apiRequest("/health");
}

export async function createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  return apiRequest("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getOrderSnapshot(orderId: string): Promise<OrderSnapshot> {
  return apiRequest(`/api/v1/orders/${orderId}`);
}

export async function getOrderRoute(orderId: string): Promise<RoutePlan | null> {
  try {
    return await apiRequest(`/api/v1/orders/${orderId}/route`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function cancelOrder(orderId: string): Promise<{ orderId: string; status: string }> {
  return apiRequest(`/api/v1/orders/${orderId}/cancel`, {
    method: "POST",
  });
}

export async function getUserRoutes(userId: string): Promise<UserRoutesResponse> {
  return apiRequest(`/api/v1/users/${userId}/routes`);
}
