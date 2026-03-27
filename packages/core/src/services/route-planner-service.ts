import type { DeliveryLocation, MerchantTask, RoutePlan, RouteStop, VendorReport } from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import type { TravelEstimator } from "../routing/travel-estimator";
import type { OrderStore } from "../store";
import { estimateTravelMinutes, haversineKm, isoNow } from "../utils";

interface CandidateStop {
  merchantId: string;
  location: { lat: number; lng: number };
  report: VendorReport;
}

export class RoutePlannerService {
  constructor(
    private readonly store: OrderStore,
    private readonly queue: QueueBroker,
    private readonly travelEstimator: TravelEstimator,
  ) {}

  register(): void {
    this.queue.subscribe("route.plan.requested", async ({ orderId }) => {
      const snapshot = await this.store.getSnapshot(orderId);
      if (!snapshot || snapshot.order.status === "canceled") {
        return;
      }

      const candidateStops = buildCandidateStops(snapshot.merchantTasks, snapshot.vendorReports);
      if (candidateStops.length === 0) {
        console.warn(`[route-planner] orderId=${orderId} no candidate stops available`);
        return;
      }

      const plan = await buildRoutePlan({
        orderId,
        deliveryLocation: snapshot.order.deliveryLocation,
        candidateStops,
        previousVersion: snapshot.routePlan?.version ?? 0,
        travelEstimator: this.travelEstimator,
      });

      await this.store.saveRoutePlan(plan);

      const riderMapUrl = buildGoogleMapsDirectionsUrl(snapshot.order.deliveryLocation, plan.stops);
      console.info(
        `[route-planner] orderId=${orderId} version=${plan.version} stops=${plan.stops.length} objectiveScore=${plan.objectiveScore} completionAt=${plan.estimatedCompletionAt}`,
      );
      console.info(`[route-planner] orderId=${orderId} plannedStops=${JSON.stringify(plan.stops)}`);
      if (riderMapUrl) {
        console.info(`[route-planner] orderId=${orderId} riderMapUrl=${riderMapUrl}`);
      }

      await this.queue.publish("route.plan.updated", {
        orderId,
        routePlan: plan,
      });
    });
  }
}

function buildCandidateStops(
  merchantTasks: MerchantTask[],
  vendorReports: VendorReport[],
): CandidateStop[] {
  const reportByMerchant = new Map<string, VendorReport>();
  for (const report of vendorReports) {
    reportByMerchant.set(report.merchantId, report);
  }

  const candidates: CandidateStop[] = [];
  for (const task of merchantTasks) {
    if (task.taskStatus === "failed" || task.taskStatus === "canceled") {
      continue;
    }

    const report = reportByMerchant.get(task.merchantId);
    if (!report || report.availability === "unavailable") {
      continue;
    }

    candidates.push({
      merchantId: task.merchantId,
      location: task.merchantLocation,
      report,
    });
  }

  return candidates;
}

async function buildRoutePlan(input: {
  orderId: string;
  deliveryLocation: { lat: number; lng: number };
  candidateStops: CandidateStop[];
  previousVersion: number;
  travelEstimator: TravelEstimator;
}): Promise<RoutePlan> {
  const routeStops: RouteStop[] = [];
  const remaining = [...input.candidateStops];

  let currentLocation = input.deliveryLocation;
  let currentTime = Date.now();
  let totalTravel = 0;
  let totalWait = 0;
  let totalLateness = 0;

  while (remaining.length > 0) {
    const scored = await Promise.all(
      remaining.map(async (candidate) => {
        const travelMinutes = await input.travelEstimator.estimateMinutes(currentLocation, candidate.location);
        const arrivalTs = currentTime + travelMinutes * 60_000;
        const readyTs = new Date(candidate.report.etaReadyAt).getTime();
        const waitMinutes = Math.max(0, Math.round((readyTs - arrivalTs) / 60_000));
        const latenessMinutes = Math.max(0, Math.round((arrivalTs - readyTs) / 60_000));
        const score = travelMinutes + waitMinutes + latenessMinutes * 0.5;

        return {
          candidate,
          travelMinutes,
          arrivalTs,
          waitMinutes,
          latenessMinutes,
          score,
        };
      }),
    );

    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];
    if (!best) {
      break;
    }

    routeStops.push({
      merchantId: best.candidate.merchantId,
      location: best.candidate.location,
      etaArrivalAt: new Date(best.arrivalTs).toISOString(),
      etaReadyAt: best.candidate.report.etaReadyAt,
    });

    totalTravel += best.travelMinutes;
    totalWait += best.waitMinutes;
    totalLateness += best.latenessMinutes;

    currentTime = best.arrivalTs + best.waitMinutes * 60_000;
    currentLocation = best.candidate.location;

    const index = remaining.findIndex((entry) => entry.merchantId === best.candidate.merchantId);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }

  const finalLegDistance = haversineKm(currentLocation, input.deliveryLocation);
  const finalLegMinutes = estimateTravelMinutes(finalLegDistance);
  totalTravel += finalLegMinutes;

  const estimatedCompletionAt = new Date(currentTime + finalLegMinutes * 60_000).toISOString();
  const objectiveScore = Number((totalTravel + totalWait + totalLateness).toFixed(2));

  return {
    orderId: input.orderId,
    version: input.previousVersion + 1,
    stops: routeStops,
    estimatedCompletionAt,
    objectiveScore,
    generatedAt: isoNow(),
  };
}

function buildGoogleMapsDirectionsUrl(
  deliveryLocation: DeliveryLocation,
  stops: RouteStop[],
): string | undefined {
  if (stops.length === 0) {
    return undefined;
  }

  const origin = `${deliveryLocation.lat},${deliveryLocation.lng}`;
  const destination = origin;
  const waypoints = stops.map((stop) => `${stop.location.lat},${stop.location.lng}`).join("|");

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
