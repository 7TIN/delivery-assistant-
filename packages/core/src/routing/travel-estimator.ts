import type { GeoPoint } from "../../../contracts/src";
import { estimateTravelMinutes, haversineKm } from "../utils";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_TIMEOUT_MS = 2500;

export interface TravelEstimator {
  estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number>;
}

export interface OsrmAvailabilityResult {
  enabled: boolean;
  baseUrl: string;
  reachable: boolean;
  statusCode?: number;
  error?: string;
}

export class LocalTravelEstimator implements TravelEstimator {
  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const distanceKm = haversineKm(from, to);
    return estimateTravelMinutes(distanceKm);
  }
}

export class OsrmTravelEstimator implements TravelEstimator {
  private readonly fallback = new LocalTravelEstimator();

  constructor(
    private readonly baseUrl = getOsrmBaseUrl(),
    private readonly timeoutMs = Number(Bun.env.OSRM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  ) {}

  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const url = buildOsrmRouteUrl(this.baseUrl, from, to);

    try {
      const response = await fetchWithTimeout(url, this.timeoutMs);
      if (!response.ok) {
        throw new Error(`OSRM request failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{ duration?: number }>;
      };

      const durationSec = data.routes?.[0]?.duration;
      if (data.code !== "Ok" || !durationSec || Number.isNaN(durationSec)) {
        throw new Error("OSRM response missing route duration");
      }

      return Math.max(1, Math.round(durationSec / 60));
    } catch (error) {
      console.warn("OSRM estimate failed, using local fallback", error);
      return this.fallback.estimateMinutes(from, to);
    }
  }
}

export function isOsrmEnabled(): boolean {
  const value = (Bun.env.OSRM_ENABLED ?? "true").trim().toLowerCase();
  return value !== "false" && value !== "0";
}

export function getOsrmBaseUrl(): string {
  return (Bun.env.OSRM_BASE_URL ?? DEFAULT_OSRM_BASE_URL).replace(/\/+$/, "");
}

export async function checkOsrmApiAvailability(): Promise<OsrmAvailabilityResult> {
  const baseUrl = getOsrmBaseUrl();

  if (!isOsrmEnabled()) {
    return {
      enabled: false,
      baseUrl,
      reachable: false,
      error: "OSRM disabled by OSRM_ENABLED=false",
    };
  }

  const sampleFrom: GeoPoint = { lat: 12.9716, lng: 77.5946 };
  const sampleTo: GeoPoint = { lat: 12.9728, lng: 77.6022 };
  const url = buildOsrmRouteUrl(baseUrl, sampleFrom, sampleTo);
  const timeoutMs = Number(Bun.env.OSRM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) {
      return {
        enabled: true,
        baseUrl,
        reachable: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ duration?: number }>;
    };

    const reachable = data.code === "Ok" && typeof data.routes?.[0]?.duration === "number";

    return {
      enabled: true,
      baseUrl,
      reachable,
      statusCode: response.status,
      error: reachable ? undefined : "Unexpected OSRM payload",
    };
  } catch (error) {
    return {
      enabled: true,
      baseUrl,
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown OSRM error",
    };
  }
}

export function createTravelEstimator(): TravelEstimator {
  if (isOsrmEnabled()) {
    return new OsrmTravelEstimator();
  }

  return new LocalTravelEstimator();
}

function buildOsrmRouteUrl(baseUrl: string, from: GeoPoint, to: GeoPoint): string {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const query = new URLSearchParams({
    overview: "false",
    alternatives: "false",
    steps: "false",
  });

  return `${baseUrl}/route/v1/driving/${coordinates}?${query.toString()}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
