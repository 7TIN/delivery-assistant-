import {
  type CreateOrderRequest,
  type DispatchInstruction,
  type DeliveryPerson,
  type GeoPoint,
  type MerchantTask,
  type OpsTicket,
  type Order,
  type OrderItem,
  type OrderSnapshot,
  type OrderStatus,
  type RoutePlan,
  type VendorReport,
} from "../../contracts/src";
import { addMinutes, isoNow, pseudoMerchantLocation } from "./utils";

export interface OrderStore {
  createOrder(request: CreateOrderRequest): Promise<Order>;
  getOrder(orderId: string): Promise<Order | undefined>;
  listOrderIdsByUser(userId: string): Promise<string[]>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  cancelOrder(orderId: string): Promise<Order | undefined>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  getOrderItemsByMerchant(orderId: string, merchantId: string): Promise<OrderItem[]>;
  getMerchantTasks(orderId: string): Promise<MerchantTask[]>;
  upsertMerchantTask(orderId: string, updatedTask: MerchantTask): Promise<void>;
  setMerchantTaskStatus(
    orderId: string,
    merchantTaskId: string,
    status: MerchantTask["taskStatus"],
  ): Promise<void>;
  getVendorReports(orderId: string): Promise<VendorReport[]>;
  upsertVendorReport(report: VendorReport): Promise<void>;
  getRoutePlan(orderId: string): Promise<RoutePlan | undefined>;
  saveRoutePlan(routePlan: RoutePlan): Promise<void>;
  getDispatchInstruction(orderId: string): Promise<DispatchInstruction | undefined>;
  saveDispatchInstruction(instruction: DispatchInstruction): Promise<void>;
  addOpsTicket(ticket: OpsTicket): Promise<void>;
  getOpsTickets(orderId: string): Promise<OpsTicket[]>;
  getDeliveryPerson(orderId: string): Promise<DeliveryPerson | undefined>;
  upsertDeliveryPerson(orderId: string, location: GeoPoint): Promise<void>;
  getSnapshot(orderId: string): Promise<OrderSnapshot | undefined>;
  close?(): Promise<void>;
}

export class InMemoryStore implements OrderStore {
  private readonly orders = new Map<string, Order>();
  private readonly orderItems = new Map<string, OrderItem[]>();
  private readonly merchantTasks = new Map<string, MerchantTask[]>();
  private readonly vendorReports = new Map<string, Map<string, VendorReport>>();
  private readonly routePlans = new Map<string, RoutePlan>();
  private readonly dispatchInstructions = new Map<string, DispatchInstruction>();
  private readonly opsTickets = new Map<string, OpsTicket[]>();
  private readonly deliveryPersons = new Map<string, DeliveryPerson>();

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const now = isoNow();
    const orderId = crypto.randomUUID();

    const order: Order = {
      id: orderId,
      userId: request.userId,
      status: "created",
      deliveryLocation: request.deliveryLocation,
      createdAt: now,
      updatedAt: now,
    };

    const items: OrderItem[] = request.items.map((item) => ({
      id: crypto.randomUUID(),
      orderId,
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      merchantId: item.merchantId,
      quantity: item.quantity,
      status: "created",
    }));

    const merchantTasks = buildMerchantTasks(orderId, request);

    this.orders.set(orderId, order);
    this.orderItems.set(orderId, items);
    this.merchantTasks.set(orderId, merchantTasks);
    this.vendorReports.set(orderId, new Map<string, VendorReport>());
    this.opsTickets.set(orderId, []);

    return order;
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  async listOrderIdsByUser(userId: string): Promise<string[]> {
    return [...this.orders.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((order) => order.id);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const existing = this.orders.get(orderId);
    if (!existing) {
      return;
    }

    this.orders.set(orderId, {
      ...existing,
      status,
      updatedAt: isoNow(),
    });
  }

  async cancelOrder(orderId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) {
      return undefined;
    }

    const now = isoNow();
    const canceledOrder: Order = {
      ...order,
      status: "canceled",
      canceledAt: now,
      updatedAt: now,
    };

    this.orders.set(orderId, canceledOrder);

    const tasks = this.merchantTasks.get(orderId) ?? [];
    this.merchantTasks.set(
      orderId,
      tasks.map((task) => ({
        ...task,
        taskStatus: "canceled",
      })),
    );

    return canceledOrder;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.orderItems.get(orderId) ?? [];
  }

  async getOrderItemsByMerchant(orderId: string, merchantId: string): Promise<OrderItem[]> {
    return (await this.getOrderItems(orderId)).filter((item) => item.merchantId === merchantId);
  }

  async getMerchantTasks(orderId: string): Promise<MerchantTask[]> {
    return this.merchantTasks.get(orderId) ?? [];
  }

  async upsertMerchantTask(orderId: string, updatedTask: MerchantTask): Promise<void> {
    const tasks = this.merchantTasks.get(orderId) ?? [];
    const index = tasks.findIndex((task) => task.id === updatedTask.id);

    if (index >= 0) {
      tasks[index] = updatedTask;
      this.merchantTasks.set(orderId, tasks);
      return;
    }

    this.merchantTasks.set(orderId, [...tasks, updatedTask]);
  }

  async setMerchantTaskStatus(
    orderId: string,
    merchantTaskId: string,
    status: MerchantTask["taskStatus"],
  ): Promise<void> {
    const tasks = this.merchantTasks.get(orderId) ?? [];
    const next = tasks.map((task) =>
      task.id === merchantTaskId
        ? {
            ...task,
            taskStatus: status,
          }
        : task,
    );
    this.merchantTasks.set(orderId, next);
  }

  async getVendorReports(orderId: string): Promise<VendorReport[]> {
    const reportsMap = this.vendorReports.get(orderId);
    if (!reportsMap) {
      return [];
    }

    return [...reportsMap.values()];
  }

  async upsertVendorReport(report: VendorReport): Promise<void> {
    const reports = this.vendorReports.get(report.orderId) ?? new Map<string, VendorReport>();
    reports.set(report.merchantId, report);
    this.vendorReports.set(report.orderId, reports);
  }

  async getRoutePlan(orderId: string): Promise<RoutePlan | undefined> {
    return this.routePlans.get(orderId);
  }

  async saveRoutePlan(routePlan: RoutePlan): Promise<void> {
    this.routePlans.set(routePlan.orderId, routePlan);
    await this.updateOrderStatus(routePlan.orderId, "route_ready");
  }

  async getDispatchInstruction(orderId: string): Promise<DispatchInstruction | undefined> {
    return this.dispatchInstructions.get(orderId);
  }

  async saveDispatchInstruction(instruction: DispatchInstruction): Promise<void> {
    this.dispatchInstructions.set(instruction.orderId, instruction);
    await this.updateOrderStatus(instruction.orderId, "dispatching");
  }

  async addOpsTicket(ticket: OpsTicket): Promise<void> {
    const existing = this.opsTickets.get(ticket.orderId) ?? [];
    this.opsTickets.set(ticket.orderId, [...existing, ticket]);
    await this.updateOrderStatus(ticket.orderId, "awaiting_ops");
  }

  async getOpsTickets(orderId: string): Promise<OpsTicket[]> {
    return this.opsTickets.get(orderId) ?? [];
  }

  async getDeliveryPerson(orderId: string): Promise<DeliveryPerson | undefined> {
    return this.deliveryPersons.get(orderId);
  }

  async upsertDeliveryPerson(orderId: string, location: GeoPoint): Promise<void> {
    const existing = this.deliveryPersons.get(orderId);
    const deliveryPerson: DeliveryPerson = {
      orderId,
      location,
      updatedAt: existing?.updatedAt ?? isoNow(),
    };
    deliveryPerson.updatedAt = isoNow();
    this.deliveryPersons.set(orderId, deliveryPerson);
  }

  async getSnapshot(orderId: string): Promise<OrderSnapshot | undefined> {
    const order = this.orders.get(orderId);
    if (!order) {
      return undefined;
    }

    return {
      order,
      items: await this.getOrderItems(orderId),
      merchantTasks: await this.getMerchantTasks(orderId),
      vendorReports: await this.getVendorReports(orderId),
      routePlan: await this.getRoutePlan(orderId),
      dispatchInstruction: await this.getDispatchInstruction(orderId),
      opsTickets: await this.getOpsTickets(orderId),
      deliveryPerson: await this.getDeliveryPerson(orderId),
    };
  }
}

function buildMerchantTasks(orderId: string, request: CreateOrderRequest): MerchantTask[] {
  const seen = new Set<string>();
  const tasks: MerchantTask[] = [];

  for (const item of request.items) {
    if (seen.has(item.merchantId)) {
      continue;
    }

    seen.add(item.merchantId);

    tasks.push({
      id: crypto.randomUUID(),
      orderId,
      merchantId: item.merchantId,
      merchantLocation: item.merchantLocation ?? pseudoMerchantLocation(request.deliveryLocation, item.merchantId),
      taskStatus: "pending",
      attemptCount: 0,
      deadlineAt: addMinutes(isoNow(), 30),
    });
  }

  return tasks;
}


