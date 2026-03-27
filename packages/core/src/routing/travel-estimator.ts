import type { GeoPoint } from "../../../contracts/src";
import { estimateTravelMinutes, haversineKm } from "../utils";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEALTH_RETRIES = 3;
const DEFAULT_HEALTH_RETRY_DELAY_MS = 600;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60000;
const DEFAULT_CACHE_TTL_MS = 300000;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 4;
const COOLDOWN_LOG_INTERVAL_MS = 15000;

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
  private readonly requestCache = new Map<string, { minutes: number; expiresAt: number }>();
  private readonly cacheTtlMs = getOsrmCacheTtlMs();
  private readonly maxConcurrentRequests = getOsrmMaxConcurrentRequests();

  private inFlightRequests = 0;
  private readonly pendingResolvers: Array<() => void> = [];

  private consecutiveFailures = 0;
  private cooldownUntil = 0;
  private lastCooldownLogAt = 0;

  constructor(
    private readonly baseUrl = getOsrmBaseUrl(),
    private readonly timeoutMs = getOsrmTimeoutMs(),
  ) {}

  async estimateMinutes(from: GeoPoint, to: GeoPoint): Promise<number> {
    const cacheKey = buildEstimateCacheKey(from, to);
    const cachedMinutes = this.getCachedEstimate(cacheKey);
    if (cachedMinutes !== undefined) {
      return cachedMinutes;
    }

    const now = Date.now();

    if (now < this.cooldownUntil) {
      if (now - this.lastCooldownLogAt >= COOLDOWN_LOG_INTERVAL_MS) {
        const secondsLeft = Math.ceil((this.cooldownUntil - now) / 1000);
        console.warn(`OSRM in cooldown for ${secondsLeft}s, using local fallback`);
        this.lastCooldownLogAt = now;
      }

      const fallbackMinutes = await this.fallback.estimateMinutes(from, to);
      this.setCachedEstimate(cacheKey, fallbackMinutes, Math.min(this.cacheTtlMs, 15000));
      return fallbackMinutes;
    }

    const url = buildOsrmRouteUrl(this.baseUrl, from, to);

    try {
      const minutes = await this.runWithConcurrencySlot(async () => {
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
      });

      this.consecutiveFailures = 0;
      this.cooldownUntil = 0;
      this.setCachedEstimate(cacheKey, minutes, this.cacheTtlMs);
      return minutes;
    } catch (error) {
      const reason = normalizeError(error);
      this.consecutiveFailures += 1;

      const threshold = getOsrmFailureThreshold();
      const shouldCooldown = reason.includes("HTTP 429") || this.consecutiveFailures >= threshold;

      if (shouldCooldown) {
        this.cooldownUntil = Date.now() + getOsrmCooldownMs();
        console.warn(
          `OSRM disabled temporarily after ${this.consecutiveFailures} failures (${reason}), using local fallback`,
        );
        this.lastCooldownLogAt = Date.now();
      } else {
        console.warn(`OSRM estimate failed (${reason}), using local fallback`);
      }

      const fallbackMinutes = await this.fallback.estimateMinutes(from, to);
      this.setCachedEstimate(cacheKey, fallbackMinutes, Math.min(this.cacheTtlMs, 30000));
      return fallbackMinutes;
    }
  }

  private getCachedEstimate(key: string): number | undefined {
    const entry = this.requestCache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.requestCache.delete(key);
      return undefined;
    }

    return entry.minutes;
  }

  private setCachedEstimate(key: string, minutes: number, ttlMs: number): void {
    this.requestCache.set(key, {
      minutes,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
  }

  private async runWithConcurrencySlot<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireConcurrencySlot();

    try {
      return await task();
    } finally {
      this.releaseConcurrencySlot();
    }
  }

  private async acquireConcurrencySlot(): Promise<void> {
    if (this.inFlightRequests < this.maxConcurrentRequests) {
      this.inFlightRequests += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.pendingResolvers.push(() => {
        this.inFlightRequests += 1;
        resolve();
      });
    });
  }

  private releaseConcurrencySlot(): void {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);

    const next = this.pendingResolvers.shift();
    if (next) {
      next();
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

function buildEstimateCacheKey(from: GeoPoint, to: GeoPoint): string {
  return `${roundCoord(from.lat)},${roundCoord(from.lng)}->${roundCoord(to.lat)},${roundCoord(to.lng)}`;
}

function roundCoord(value: number): string {
  return value.toFixed(5);
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

function getOsrmFailureThreshold(): number {
  const parsed = Number(Bun.env.OSRM_FAILURE_THRESHOLD ?? DEFAULT_FAILURE_THRESHOLD);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_FAILURE_THRESHOLD;
  }
  return Math.floor(parsed);
}

function getOsrmCooldownMs(): number {
  const parsed = Number(Bun.env.OSRM_COOLDOWN_MS ?? DEFAULT_COOLDOWN_MS);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return DEFAULT_COOLDOWN_MS;
  }
  return Math.floor(parsed);
}

function getOsrmCacheTtlMs(): number {
  const parsed = Number(Bun.env.OSRM_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.floor(parsed);
}

function getOsrmMaxConcurrentRequests(): number {
  const parsed = Number(Bun.env.OSRM_MAX_CONCURRENT_REQUESTS ?? DEFAULT_MAX_CONCURRENT_REQUESTS);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_CONCURRENT_REQUESTS;
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
