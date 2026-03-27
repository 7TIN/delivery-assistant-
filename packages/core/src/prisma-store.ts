import type {
  CreateOrderRequest,
  DispatchInstruction,
  MerchantTask,
  OpsTicket,
  Order,
  OrderItem,
  OrderSnapshot,
  OrderStatus,
  RoutePlan,
  RouteStop,
  VendorReport,
} from "../../contracts/src";
import type { PrismaClient } from "../../../generated/prisma/client";
import { addMinutes, isoNow, pseudoMerchantLocation } from "./utils";
import type { OrderStore } from "./store";

export class PrismaStore implements OrderStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createOrder(request: CreateOrderRequest): Promise<Order> {
    const now = new Date();
    const orderId = crypto.randomUUID();

    // Nested relation create inherits parent order id automatically.
    const items = request.items.map((item) => ({
      id: crypto.randomUUID(),
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      merchantId: item.merchantId,
      quantity: item.quantity,
      status: "created",
    }));

    // Nested relation create inherits parent order id automatically.
    const merchantTasks = buildMerchantTasks(orderId, request).map((task) => ({
      id: task.id,
      merchantId: task.merchantId,
      merchantLat: task.merchantLocation.lat,
      merchantLng: task.merchantLocation.lng,
      taskStatus: task.taskStatus,
      attemptCount: task.attemptCount,
      deadlineAt: new Date(task.deadlineAt),
    }));

    const created = await this.prisma.order.create({
      data: {
        id: orderId,
        userId: request.userId,
        status: "created",
        deliveryLat: request.deliveryLocation.lat,
        deliveryLng: request.deliveryLocation.lng,
        deliveryAddress: request.deliveryLocation.address,
        createdAt: now,
        updatedAt: now,
        items: {
          create: items,
        },
        merchantTasks: {
          create: merchantTasks,
        },
      },
    });

    return mapOrder(created);
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    const row = await this.prisma.order.findUnique({ where: { id: orderId } });
    return row ? mapOrder(row) : undefined;
  }

  async listOrderIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.prisma.order.updateMany({
      where: { id: orderId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  async cancelOrder(orderId: string): Promise<Order | undefined> {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return undefined;
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "canceled",
          canceledAt: now,
          updatedAt: now,
        },
      }),
      this.prisma.merchantTask.updateMany({
        where: { orderId },
        data: {
          taskStatus: "canceled",
        },
      }),
    ]);

    const canceled = await this.prisma.order.findUnique({ where: { id: orderId } });
    return canceled ? mapOrder(canceled) : undefined;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const rows = await this.prisma.orderItem.findMany({ where: { orderId } });
    return rows.map(mapOrderItem);
  }

  async getOrderItemsByMerchant(orderId: string, merchantId: string): Promise<OrderItem[]> {
    const rows = await this.prisma.orderItem.findMany({ where: { orderId, merchantId } });
    return rows.map(mapOrderItem);
  }

  async getMerchantTasks(orderId: string): Promise<MerchantTask[]> {
    const rows = await this.prisma.merchantTask.findMany({ where: { orderId } });
    return rows.map(mapMerchantTask);
  }

  async upsertMerchantTask(_orderId: string, updatedTask: MerchantTask): Promise<void> {
    await this.prisma.merchantTask.upsert({
      where: { id: updatedTask.id },
      update: {
        merchantId: updatedTask.merchantId,
        merchantLat: updatedTask.merchantLocation.lat,
        merchantLng: updatedTask.merchantLocation.lng,
        taskStatus: updatedTask.taskStatus,
        attemptCount: updatedTask.attemptCount,
        deadlineAt: new Date(updatedTask.deadlineAt),
      },
      create: {
        id: updatedTask.id,
        orderId: updatedTask.orderId,
        merchantId: updatedTask.merchantId,
        merchantLat: updatedTask.merchantLocation.lat,
        merchantLng: updatedTask.merchantLocation.lng,
        taskStatus: updatedTask.taskStatus,
        attemptCount: updatedTask.attemptCount,
        deadlineAt: new Date(updatedTask.deadlineAt),
      },
    });
  }

  async setMerchantTaskStatus(
    orderId: string,
    merchantTaskId: string,
    status: MerchantTask["taskStatus"],
  ): Promise<void> {
    await this.prisma.merchantTask.updateMany({
      where: {
        id: merchantTaskId,
        orderId,
      },
      data: {
        taskStatus: status,
      },
    });
  }

  async getVendorReports(orderId: string): Promise<VendorReport[]> {
    const rows = await this.prisma.vendorReport.findMany({ where: { orderId } });
    return rows.map(mapVendorReport);
  }

  async upsertVendorReport(report: VendorReport): Promise<void> {
    await this.prisma.vendorReport.upsert({
      where: {
        orderId_merchantId: {
          orderId: report.orderId,
          merchantId: report.merchantId,
        },
      },
      update: {
        availability: report.availability,
        etaReadyAt: new Date(report.etaReadyAt),
        confidence: report.confidence,
        source: report.source,
        reportedAt: new Date(report.reportedAt),
        notes: report.notes,
      },
      create: {
        id: crypto.randomUUID(),
        orderId: report.orderId,
        merchantId: report.merchantId,
        availability: report.availability,
        etaReadyAt: new Date(report.etaReadyAt),
        confidence: report.confidence,
        source: report.source,
        reportedAt: new Date(report.reportedAt),
        notes: report.notes,
      },
    });
  }

  async getRoutePlan(orderId: string): Promise<RoutePlan | undefined> {
    const row = await this.prisma.routePlan.findFirst({
      where: { orderId },
      orderBy: { version: "desc" },
    });

    return row ? mapRoutePlan(row) : undefined;
  }

  async saveRoutePlan(routePlan: RoutePlan): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.routePlan.upsert({
        where: {
          orderId_version: {
            orderId: routePlan.orderId,
            version: routePlan.version,
          },
        },
        update: {
          stops: routePlan.stops as any,
          estimatedCompletionAt: new Date(routePlan.estimatedCompletionAt),
          objectiveScore: routePlan.objectiveScore,
          generatedAt: new Date(routePlan.generatedAt),
        },
        create: {
          id: crypto.randomUUID(),
          orderId: routePlan.orderId,
          version: routePlan.version,
          stops: routePlan.stops as any,
          estimatedCompletionAt: new Date(routePlan.estimatedCompletionAt),
          objectiveScore: routePlan.objectiveScore,
          generatedAt: new Date(routePlan.generatedAt),
        },
      }),
      this.prisma.order.updateMany({
        where: { id: routePlan.orderId },
        data: {
          status: "route_ready",
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async getDispatchInstruction(orderId: string): Promise<DispatchInstruction | undefined> {
    const row = await this.prisma.dispatchInstruction.findFirst({
      where: { orderId },
      orderBy: { issuedAt: "desc" },
    });

    return row ? mapDispatchInstruction(row) : undefined;
  }

  async saveDispatchInstruction(instruction: DispatchInstruction): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.dispatchInstruction.create({
        data: {
          id: crypto.randomUUID(),
          orderId: instruction.orderId,
          routeVersion: instruction.routeVersion,
          nextStop: instruction.nextStop ? (instruction.nextStop as any) : undefined,
          pickupNotes: instruction.pickupNotes,
          etaToNextStopMinutes: instruction.etaToNextStopMinutes,
          issuedAt: new Date(instruction.issuedAt),
        },
      }),
      this.prisma.order.updateMany({
        where: { id: instruction.orderId },
        data: {
          status: "dispatching",
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async addOpsTicket(ticket: OpsTicket): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.opsTicket.create({
        data: {
          id: ticket.id,
          orderId: ticket.orderId,
          merchantId: ticket.merchantId,
          reason: ticket.reason,
          priority: ticket.priority,
          status: ticket.status,
          createdAt: new Date(ticket.createdAt),
          resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
        },
      }),
      this.prisma.order.updateMany({
        where: { id: ticket.orderId },
        data: {
          status: "awaiting_ops",
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  async getOpsTickets(orderId: string): Promise<OpsTicket[]> {
    const rows = await this.prisma.opsTicket.findMany({ where: { orderId } });
    return rows.map(mapOpsTicket);
  }

  async getSnapshot(orderId: string): Promise<OrderSnapshot | undefined> {
    const order = await this.getOrder(orderId);
    if (!order) {
      return undefined;
    }

    const [items, merchantTasks, vendorReports, routePlan, dispatchInstruction, opsTickets] =
      await Promise.all([
        this.getOrderItems(orderId),
        this.getMerchantTasks(orderId),
        this.getVendorReports(orderId),
        this.getRoutePlan(orderId),
        this.getDispatchInstruction(orderId),
        this.getOpsTickets(orderId),
      ]);

    return {
      order,
      items,
      merchantTasks,
      vendorReports,
      routePlan,
      dispatchInstruction,
      opsTickets,
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    deliveryLocation: {
      lat: row.deliveryLat,
      lng: row.deliveryLng,
      address: row.deliveryAddress,
    },
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    canceledAt: row.canceledAt ? toIso(row.canceledAt) : undefined,
  };
}

function mapOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    itemId: row.itemId,
    name: row.name,
    category: row.category,
    merchantId: row.merchantId,
    quantity: row.quantity,
    status: row.status,
  };
}

function mapMerchantTask(row: any): MerchantTask {
  return {
    id: row.id,
    orderId: row.orderId,
    merchantId: row.merchantId,
    merchantLocation: {
      lat: row.merchantLat,
      lng: row.merchantLng,
    },
    taskStatus: row.taskStatus,
    attemptCount: row.attemptCount,
    deadlineAt: toIso(row.deadlineAt),
  };
}

function mapVendorReport(row: any): VendorReport {
  return {
    orderId: row.orderId,
    merchantId: row.merchantId,
    availability: row.availability,
    etaReadyAt: toIso(row.etaReadyAt),
    confidence: row.confidence,
    source: row.source,
    reportedAt: toIso(row.reportedAt),
    notes: row.notes ?? undefined,
  };
}

function mapRoutePlan(row: any): RoutePlan {
  return {
    orderId: row.orderId,
    version: row.version,
    stops: parseRouteStops(row.stops),
    estimatedCompletionAt: toIso(row.estimatedCompletionAt),
    objectiveScore: row.objectiveScore,
    generatedAt: toIso(row.generatedAt),
  };
}

function mapDispatchInstruction(row: any): DispatchInstruction {
  return {
    orderId: row.orderId,
    routeVersion: row.routeVersion,
    nextStop: parseNextStop(row.nextStop),
    pickupNotes: row.pickupNotes,
    etaToNextStopMinutes: row.etaToNextStopMinutes,
    issuedAt: toIso(row.issuedAt),
  };
}

function mapOpsTicket(row: any): OpsTicket {
  return {
    id: row.id,
    orderId: row.orderId,
    merchantId: row.merchantId,
    reason: row.reason,
    priority: row.priority,
    status: row.status,
    createdAt: toIso(row.createdAt),
    resolvedAt: row.resolvedAt ? toIso(row.resolvedAt) : undefined,
  };
}

function parseRouteStops(value: unknown): RouteStop[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as RouteStop[];
}

function parseNextStop(value: unknown): RouteStop | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as RouteStop;
}

function toIso(value: Date | string): string {
  if (typeof value === "string") {
    return value;
  }
  return value.toISOString();
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


