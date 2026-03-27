import type { DeliveryLocation, RouteStop } from "../../../contracts/src";
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

    const instruction = {
      orderId,
      routeVersion: routePlan.version,
      nextStop,
      pickupNotes: nextStop
        ? `Proceed to merchant ${nextStop.merchantId} and collect confirmed items.`
        : "No pickup stop available yet.",
      etaToNextStopMinutes: nextStop ? diffMinutes(now, nextStop.etaArrivalAt) : 0,
      issuedAt: now,
    };

    await this.store.saveDispatchInstruction(instruction);

    const deliveryPartnerView = {
      orderId,
      userId: order.userId,
      routeVersion: routePlan.version,
      status: "dispatching",
      nextStop,
      remainingStops: routePlan.stops,
      etaToNextStopMinutes: instruction.etaToNextStopMinutes,
      estimatedCompletionAt: routePlan.estimatedCompletionAt,
      pickupNotes: instruction.pickupNotes,
      nextHopMapUrl: buildNextHopMapUrl(nextStop, order.deliveryLocation),
    };

    console.info(`[dispatch] rider-guidance orderId=${orderId} payload=${JSON.stringify(deliveryPartnerView)}`);
  }
}

function buildNextHopMapUrl(nextStop: RouteStop | undefined, deliveryLocation: DeliveryLocation): string | undefined {
  if (!nextStop) {
    return undefined;
  }

  const params = new URLSearchParams({
    api: "1",
    origin: `${nextStop.location.lat},${nextStop.location.lng}`,
    destination: `${deliveryLocation.lat},${deliveryLocation.lng}`,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
