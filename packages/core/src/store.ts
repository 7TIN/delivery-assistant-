import {
  type CreateOrderRequest,
  type DispatchInstruction,
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

export class InMemoryStore {
  private readonly orders = new Map<string, Order>();
  private readonly orderItems = new Map<string, OrderItem[]>();
  private readonly merchantTasks = new Map<string, MerchantTask[]>();
  private readonly vendorReports = new Map<string, Map<string, VendorReport>>();
  private readonly routePlans = new Map<string, RoutePlan>();
  private readonly dispatchInstructions = new Map<string, DispatchInstruction>();
  private readonly opsTickets = new Map<string, OpsTicket[]>();

  createOrder(request: CreateOrderRequest): Order {
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

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  updateOrderStatus(orderId: string, status: OrderStatus): void {
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

  cancelOrder(orderId: string): Order | undefined {
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

  getOrderItems(orderId: string): OrderItem[] {
    return this.orderItems.get(orderId) ?? [];
  }

  getOrderItemsByMerchant(orderId: string, merchantId: string): OrderItem[] {
    return this.getOrderItems(orderId).filter((item) => item.merchantId === merchantId);
  }

  getMerchantTasks(orderId: string): MerchantTask[] {
    return this.merchantTasks.get(orderId) ?? [];
  }

  upsertMerchantTask(orderId: string, updatedTask: MerchantTask): void {
    const tasks = this.merchantTasks.get(orderId) ?? [];
    const index = tasks.findIndex((task) => task.id === updatedTask.id);

    if (index >= 0) {
      tasks[index] = updatedTask;
      this.merchantTasks.set(orderId, tasks);
      return;
    }

    this.merchantTasks.set(orderId, [...tasks, updatedTask]);
  }

  setMerchantTaskStatus(orderId: string, merchantTaskId: string, status: MerchantTask["taskStatus"]): void {
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

  getVendorReports(orderId: string): VendorReport[] {
    const reportsMap = this.vendorReports.get(orderId);
    if (!reportsMap) {
      return [];
    }

    return [...reportsMap.values()];
  }

  upsertVendorReport(report: VendorReport): void {
    const reports = this.vendorReports.get(report.orderId) ?? new Map<string, VendorReport>();
    reports.set(report.merchantId, report);
    this.vendorReports.set(report.orderId, reports);
  }

  getRoutePlan(orderId: string): RoutePlan | undefined {
    return this.routePlans.get(orderId);
  }

  saveRoutePlan(routePlan: RoutePlan): void {
    this.routePlans.set(routePlan.orderId, routePlan);
    this.updateOrderStatus(routePlan.orderId, "route_ready");
  }

  getDispatchInstruction(orderId: string): DispatchInstruction | undefined {
    return this.dispatchInstructions.get(orderId);
  }

  saveDispatchInstruction(instruction: DispatchInstruction): void {
    this.dispatchInstructions.set(instruction.orderId, instruction);
    this.updateOrderStatus(instruction.orderId, "dispatching");
  }

  addOpsTicket(ticket: OpsTicket): void {
    const existing = this.opsTickets.get(ticket.orderId) ?? [];
    this.opsTickets.set(ticket.orderId, [...existing, ticket]);
    this.updateOrderStatus(ticket.orderId, "awaiting_ops");
  }

  getOpsTickets(orderId: string): OpsTicket[] {
    return this.opsTickets.get(orderId) ?? [];
  }

  getSnapshot(orderId: string): OrderSnapshot | undefined {
    const order = this.orders.get(orderId);
    if (!order) {
      return undefined;
    }

    return {
      order,
      items: this.getOrderItems(orderId),
      merchantTasks: this.getMerchantTasks(orderId),
      vendorReports: this.getVendorReports(orderId),
      routePlan: this.getRoutePlan(orderId),
      dispatchInstruction: this.getDispatchInstruction(orderId),
      opsTickets: this.getOpsTickets(orderId),
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
