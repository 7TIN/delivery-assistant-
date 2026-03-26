import type { OrderStore } from "../store";
import { diffMinutes, isoNow } from "../utils";

export class DispatchService {
  constructor(private readonly store: OrderStore) {}

  async handleRouteUpdate(orderId: string): Promise<void> {
    const order = await this.store.getOrder(orderId);
    if (!order || order.status === "canceled") {
      return;
    }

    const routePlan = await this.store.getRoutePlan(orderId);
    if (!routePlan) {
      return;
    }

    const now = isoNow();
    const nextStop = routePlan.stops[0];

    await this.store.saveDispatchInstruction({
      orderId,
      routeVersion: routePlan.version,
      nextStop,
      pickupNotes: nextStop
        ? `Proceed to merchant ${nextStop.merchantId} and collect confirmed items.`
        : "No pickup stop available yet.",
      etaToNextStopMinutes: nextStop ? diffMinutes(now, nextStop.etaArrivalAt) : 0,
      issuedAt: now,
    });
  }
}
