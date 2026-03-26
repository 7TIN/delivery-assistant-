import type { GeoPoint } from "../../contracts/src";

export function isoNow(): string {
  return new Date().toISOString();
}

export function addMinutes(baseIso: string, minutes: number): string {
  const base = new Date(baseIso).getTime();
  return new Date(base + minutes * 60_000).toISOString();
}

export function diffMinutes(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.max(0, Math.round((to - from) / 60_000));
}

export function pseudoMerchantLocation(seedBase: GeoPoint, merchantId: string): GeoPoint {
  const hash = simpleHash(merchantId);
  const latOffset = ((hash % 900) - 450) / 10_000;
  const lngOffset = (((hash / 900) % 900) - 450) / 10_000;

  return {
    lat: round(seedBase.lat + latOffset),
    lng: round(seedBase.lng + lngOffset),
  };
}

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (value: number): number => (value * Math.PI) / 180;

  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function estimateTravelMinutes(distanceKm: number, speedKmh = 25, trafficMultiplier = 1.15): number {
  if (distanceKm <= 0) {
    return 0;
  }

  const adjustedHours = (distanceKm / speedKmh) * trafficMultiplier;
  return Math.max(1, Math.round(adjustedHours * 60));
}

export function simpleHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function round(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}
