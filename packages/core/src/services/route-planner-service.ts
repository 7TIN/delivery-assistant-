import type { RoutePlan, RouteStop, VendorReport } from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";
import type { TravelEstimator } from "../routing/travel-estimator";
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

      await this.queue.publish("route.plan.updated", {
        orderId,
        routePlan: plan,
      });
    });
  }
}

function buildCandidateStops(
  merchantTasks: Array<{ merchantId: string; merchantLocation: { lat: number; lng: number } }>,
  vendorReports: VendorReport[],
): CandidateStop[] {
  const reportByMerchant = new Map<string, VendorReport>();
  for (const report of vendorReports) {
    reportByMerchant.set(report.merchantId, report);
  }

  const candidates: CandidateStop[] = [];
  for (const task of merchantTasks) {
    const report = reportByMerchant.get(task.merchantId);
    if (!report) {
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
