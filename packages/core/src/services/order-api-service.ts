import type {
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryPerson,
  GeoPoint,
  OrderSnapshot,
  RoutePlan,
  UserOrderRouteSummary,
} from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";

export class OrderApiService {
  constructor(
    private readonly store: OrderStore,
    private readonly queue: QueueBroker,
  ) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    validateCreateOrder(request);

    const order = await this.store.createOrder(request);
    await this.store.updateOrderStatus(order.id, "orchestrating");

    await this.queue.publish("order.created", { orderId: order.id });

    const savedOrder = await this.store.getOrder(order.id);
    const merchantTasks = await this.store.getMerchantTasks(order.id);

    return {
      orderId: order.id,
      status: savedOrder?.status ?? "created",
      merchantTaskCount: merchantTasks.length,
      createdAt: order.createdAt,
    };
  }

  async getOrderSnapshot(orderId: string): Promise<OrderSnapshot | undefined> {
    return this.store.getSnapshot(orderId);
  }

  async getUserOrderRouteSummaries(userId: string): Promise<UserOrderRouteSummary[]> {
    if (!userId) {
      throw new Error("userId is required");
    }

    const orderIds = await this.store.listOrderIdsByUser(userId);
    const snapshots = await Promise.all(orderIds.map((orderId) => this.store.getSnapshot(orderId)));

    return snapshots
      .filter((snapshot): snapshot is OrderSnapshot => Boolean(snapshot))
      .map((snapshot) => ({
        orderId: snapshot.order.id,
        status: snapshot.order.status,
        deliveryLocation: snapshot.order.deliveryLocation,
        merchantLocations: snapshot.merchantTasks.map((task) => ({
          merchantId: task.merchantId,
          taskStatus: task.taskStatus,
          location: task.merchantLocation,
        })),
        routePlan: snapshot.routePlan,
        dispatchInstruction: snapshot.dispatchInstruction,
        deliveryPerson: snapshot.deliveryPerson,
      }));
  }

  async cancelOrder(orderId: string): Promise<{ orderId: string; status: string } | undefined> {
    const order = await this.store.cancelOrder(orderId);
    if (!order) {
      return undefined;
    }

    return {
      orderId: order.id,
      status: order.status,
    };
  }

  async getRoute(orderId: string): Promise<RoutePlan | undefined> {
    return this.store.getRoutePlan(orderId);
  }

  async getDeliveryPerson(orderId: string): Promise<DeliveryPerson | undefined> {
    return this.store.getDeliveryPerson(orderId);
  }

  async updateDeliveryPerson(orderId: string, location: GeoPoint): Promise<DeliveryPerson> {
    validateGeoPoint(location);
    await this.store.upsertDeliveryPerson(orderId, location);
    const updated = await this.store.getDeliveryPerson(orderId);
    if (!updated) {
      throw new Error("Failed to update delivery person");
    }
    return updated;
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

function validateGeoPoint(point: GeoPoint): void {
  if (Number.isNaN(point.lat) || Number.isNaN(point.lng)) {
    throw new Error("Invalid coordinates");
  }
  if (point.lat < -90 || point.lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (point.lng < -180 || point.lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
}


