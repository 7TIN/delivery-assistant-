import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderSnapshot,
  RoutePlan,
} from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import { InMemoryStore } from "../store";

export class OrderApiService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly queue: QueueBroker,
  ) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    validateCreateOrder(request);

    const order = this.store.createOrder(request);
    this.store.updateOrderStatus(order.id, "orchestrating");

    await this.queue.publish("order.created", { orderId: order.id });

    return {
      orderId: order.id,
      status: this.store.getOrder(order.id)?.status ?? "created",
      merchantTaskCount: this.store.getMerchantTasks(order.id).length,
      createdAt: order.createdAt,
    };
  }

  getOrderSnapshot(orderId: string): OrderSnapshot | undefined {
    return this.store.getSnapshot(orderId);
  }

  cancelOrder(orderId: string): { orderId: string; status: string } | undefined {
    const order = this.store.cancelOrder(orderId);
    if (!order) {
      return undefined;
    }

    return {
      orderId: order.id,
      status: order.status,
    };
  }

  getRoute(orderId: string): RoutePlan | undefined {
    return this.store.getRoutePlan(orderId);
  }
}

function validateCreateOrder(request: CreateOrderRequest): void {
  if (!request.userId) {
    throw new Error("userId is required");
  }

  if (!request.deliveryLocation || Number.isNaN(request.deliveryLocation.lat) || Number.isNaN(request.deliveryLocation.lng)) {
    throw new Error("deliveryLocation is invalid");
  }

  if (!Array.isArray(request.items) || request.items.length === 0) {
    throw new Error("items must contain at least one element");
  }

  for (const item of request.items) {
    if (!item.itemId || !item.merchantId || item.quantity <= 0) {
      throw new Error("each item requires itemId, merchantId, and positive quantity");
    }
  }
}
