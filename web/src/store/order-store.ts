import { create } from "zustand";
import type { Order, MerchantItem, OrderStatus } from "@/types/contracts";
import { seedOrders, createDemoOrder, demoDeliveryLocation } from "./demo-data";

interface OrderStore {
  orders: Order[];
  activeOrderId: string | null;
  setActiveOrder: (id: string | null) => void;
  createOrder: (items: MerchantItem[]) => Order;
  advanceStatus: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  getOrder: (orderId: string) => Order | undefined;
}

const STATUS_FLOW: OrderStatus[] = [
  "created",
  "orchestrating",
  "awaiting_ops",
  "route_ready",
  "dispatching",
  "completed",
];

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: seedOrders,
  activeOrderId: null,

  setActiveOrder: (id) => set({ activeOrderId: id }),

  createOrder: (items) => {
    const order = createDemoOrder(items);
    set((s) => ({ orders: [order, ...s.orders], activeOrderId: order.id }));

    // Simulate orchestration progression
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const nextStatus = STATUS_FLOW[step];
      if (!nextStatus || step >= STATUS_FLOW.length) {
        clearInterval(interval);
        return;
      }
      set((s) => ({
        orders: s.orders.map((o) => {
          if (o.id !== order.id) return o;
          const updated = { ...o, status: nextStatus, updatedAt: new Date().toISOString() };
          if (nextStatus === "route_ready" || nextStatus === "dispatching") {
            const now = new Date();
            updated.routePlan = {
              orderId: o.id,
              version: 1,
              stops: o.items.map((item, i) => ({
                merchantId: item.merchantId,
                merchantName: item.merchantName,
                merchantType: item.merchantType,
                location: item.location,
                etaArrivalAt: new Date(now.getTime() + (i + 1) * 8 * 60000).toISOString(),
                etaReadyAt: new Date(now.getTime() + (i + 1) * 6 * 60000).toISOString(),
                status: "pending" as const,
              })),
              estimatedCompletionAt: new Date(now.getTime() + o.items.length * 10 * 60000).toISOString(),
              objectiveScore: 0.87,
              generatedAt: now.toISOString(),
            };
          }
          if (nextStatus === "dispatching" && updated.routePlan) {
            updated.dispatchInstruction = {
              orderId: o.id,
              routeVersion: 1,
              nextStop: updated.routePlan.stops[0],
              pickupNotes: `Head to ${updated.routePlan.stops[0].merchantName} first — shortest wait time.`,
              etaToNextStopMinutes: 4,
              issuedAt: new Date().toISOString(),
            };
          }
          return updated;
        }),
      }));
    }, 2500);

    return order;
  },

  advanceStatus: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const idx = STATUS_FLOW.indexOf(o.status);
        if (idx < 0 || idx >= STATUS_FLOW.length - 1) return o;
        return { ...o, status: STATUS_FLOW[idx + 1], updatedAt: new Date().toISOString() };
      }),
    })),

  cancelOrder: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: "canceled", updatedAt: new Date().toISOString() } : o
      ),
    })),

  getOrder: (orderId) => get().orders.find((o) => o.id === orderId),
}));
