import type { GeoPoint } from "../../../contracts/src";
import { estimateTravelMinutes, haversineKm } from "../utils";

export interface TravelEstimator {
  estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number>;
}

export class LocalTravelEstimator implements TravelEstimator {
  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const distanceKm = haversineKm(from, to);
    return estimateTravelMinutes(distanceKm);
  }
}

export class GraphHopperTravelEstimator implements TravelEstimator {
  private readonly fallback = new LocalTravelEstimator();

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://graphhopper.com/api/1/route",
  ) {}

  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const params = new URLSearchParams({
      vehicle: "car",
      points_encoded: "false",
      key: this.apiKey,
    });

    params.append("point", `${from.lat},${from.lng}`);
    params.append("point", `${to.lat},${to.lng}`);

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`GraphHopper request failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        paths?: Array<{ time?: number }>;
      };

      const timeMs = data.paths?.[0]?.time;
      if (!timeMs || Number.isNaN(timeMs)) {
        throw new Error("GraphHopper response missing path time");
      }

      return Math.max(1, Math.round(timeMs / 60_000));
    } catch (error) {
      console.warn("GraphHopper estimate failed, using local fallback", error);
      return this.fallback.estimateMinutes(from, to);
    }
  }
}

export function createTravelEstimator(): TravelEstimator {
  const apiKey = Bun.env.GRAPH_HOPPER_API_KEY;
  if (apiKey) {
    return new GraphHopperTravelEstimator(apiKey);
  }

  return new LocalTravelEstimator();
}
