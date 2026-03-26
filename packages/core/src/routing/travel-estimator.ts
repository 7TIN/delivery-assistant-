import type { GeoPoint } from "../../../contracts/src";
import { estimateTravelMinutes, haversineKm } from "../utils";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEALTH_RETRIES = 3;
const DEFAULT_HEALTH_RETRY_DELAY_MS = 600;

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
    private readonly timeoutMs = getOsrmTimeoutMs(),
  ) {}

  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const url = buildOsrmRouteUrl(this.baseUrl, from, to);

    try {
      const response = await fetchWithTimeout(url, this.timeoutMs);
      if (!response.ok) {
        throw new Error(`OSRM request failed: HTTP ${response.status}`);
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
      console.warn(`OSRM estimate failed (${normalizeError(error)}), using local fallback`);
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

export function getOsrmTimeoutMs(): number {
  const parsed = Number(Bun.env.OSRM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

export async function checkOsrmApiAvailability(): Promise<OsrmAvailabilityResult> {
  const configuredBaseUrl = getOsrmBaseUrl();

  if (!isOsrmEnabled()) {
    return {
      enabled: false,
      baseUrl: configuredBaseUrl,
      reachable: false,
      error: "OSRM disabled by OSRM_ENABLED=false",
    };
  }

  const retries = getOsrmHealthRetries();
  const retryDelayMs = getOsrmHealthRetryDelayMs();
  const timeoutMs = getOsrmTimeoutMs();
  const candidateBaseUrls = getCandidateBaseUrls(configuredBaseUrl);

  let lastFailure: OsrmAvailabilityResult | undefined;

  for (const candidateBaseUrl of candidateBaseUrls) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const probe = await probeOsrm(candidateBaseUrl, timeoutMs);
      if (probe.reachable) {
        if (candidateBaseUrl !== configuredBaseUrl) {
          console.warn(
            `[routing] OSRM reachable via fallback URL ${candidateBaseUrl}. Consider updating OSRM_BASE_URL.`,
          );
        }
        return probe;
      }

      lastFailure = probe;

      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  return (
    lastFailure ?? {
      enabled: true,
      baseUrl: configuredBaseUrl,
      reachable: false,
      error: "Unknown OSRM probe failure",
    }
  );
}

export function createTravelEstimator(): TravelEstimator {
  if (isOsrmEnabled()) {
    return new OsrmTravelEstimator();
  }

  return new LocalTravelEstimator();
}

async function probeOsrm(baseUrl: string, timeoutMs: number): Promise<OsrmAvailabilityResult> {
  const sampleFrom: GeoPoint = { lat: 12.9716, lng: 77.5946 };
  const sampleTo: GeoPoint = { lat: 12.9728, lng: 77.6022 };
  const url = buildOsrmRouteUrl(baseUrl, sampleFrom, sampleTo);

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
      error: normalizeError(error),
    };
  }
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

function getCandidateBaseUrls(baseUrl: string): string[] {
  const candidates = [baseUrl];

  if (baseUrl.startsWith("https://")) {
    candidates.push(baseUrl.replace("https://", "http://"));
  }

  return [...new Set(candidates)];
}

function getOsrmHealthRetries(): number {
  const parsed = Number(Bun.env.OSRM_HEALTH_RETRIES ?? DEFAULT_HEALTH_RETRIES);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_HEALTH_RETRIES;
  }
  return Math.floor(parsed);
}

function getOsrmHealthRetryDelayMs(): number {
  const parsed = Number(Bun.env.OSRM_HEALTH_RETRY_DELAY_MS ?? DEFAULT_HEALTH_RETRY_DELAY_MS);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_HEALTH_RETRY_DELAY_MS;
  }
  return Math.floor(parsed);
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Request timed out";
    }
    return error.message;
  }

  return "Unknown OSRM error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
