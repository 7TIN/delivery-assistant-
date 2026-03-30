import { useEffect, useMemo, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { DisplayRouteStop } from "@/lib/order-presenters";
import type {
  DeliveryLocation,
  DriverLocation,
  GeoPoint,
} from "@/types/contracts";
import { getRouteColor } from "./UserControl";

// ---------------------------------------------------------------------------
// Overlap offset utility
// ---------------------------------------------------------------------------

/**
 * Groups items by identical lat/lng (to 5 decimal places ≈ 1 m precision)
 * and fans out duplicates in a tight spiral so every marker stays visible
 * and clickable even when multiple orders share the same address.
 *
 * offsetMeters: radial nudge in metres per overlap ring (~10 m default)
 */
function applyOverlapOffsets<T extends { lat: number; lng: number }>(
  items: T[],
  offsetMeters = 10,
): (T & { lat: number; lng: number })[] {
  const buckets = new Map<string, number[]>();

  items.forEach((item, i) => {
    const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(i);
    buckets.set(key, bucket);
  });

  // 1 degree latitude ≈ 111 320 m
  const latDegPerMeter = 1 / 111320;

  const result = items.map((item) => ({ ...item })) as (T & {
    lat: number;
    lng: number;
  })[];

  buckets.forEach((indices) => {
    if (indices.length <= 1) return;

    indices.forEach((idx, slot) => {
      if (slot === 0) return; // keep the first marker exactly on the address

      // Spread evenly around a circle; grow the radius for every 6 extras
      const ring = Math.ceil(slot / 6);
      const angleStep = (2 * Math.PI) / Math.min(indices.length - 1, 6);
      const angle = angleStep * ((slot - 1) % 6);
      const radiusMeters = offsetMeters * ring;

      const latDelta = Math.sin(angle) * radiusMeters * latDegPerMeter;
      const lngDelta =
        (Math.cos(angle) * radiusMeters * latDegPerMeter) /
        Math.cos((items[idx].lat * Math.PI) / 180);

      result[idx] = {
        ...result[idx],
        lat: items[idx].lat + latDelta,
        lng: items[idx].lng + lngDelta,
      };
    });
  });

  return result;
}

// ---------------------------------------------------------------------------
// Icon factories
// ---------------------------------------------------------------------------

function createStopIcon(num: number, state: DisplayRouteStop["state"]) {
  const palette =
    state === "active"
      ? { background: "#0f766e", border: "#115e59", color: "#f0fdfa" }
      : state === "complete"
        ? { background: "#ecfdf5", border: "#34d399", color: "#047857" }
        : { background: "#ffffff", border: "#94a3b8", color: "#0f172a" };

  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:Inter,sans-serif;background:${palette.background};color:${palette.color};border:2px solid ${palette.border};box-shadow:0 2px 6px rgba(0,0,0,0.25);">${num}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function createColoredStopIcon(num: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:Inter,sans-serif;background:${color};color:#ffffff;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.25);">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createDestinationIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

const singleDestinationIcon = createDestinationIcon("#e11d48");

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#10b981;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M12 14c-3 0-6 2-6 3v2h12v-2c0-1-3-3-6-3z"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// ---------------------------------------------------------------------------
// OSRM road-route fetcher
// ---------------------------------------------------------------------------

function optimizeWaypointOrder(
  start: { lat: number; lng: number },
  stops: { lat: number; lng: number }[],
  end?: { lat: number; lng: number },
) {
  const remaining = [...stops];
  const ordered: { lat: number; lng: number }[] = [];

  let current = start;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;

    remaining.forEach((point, i) => {
      const dist =
        (point.lat - current.lat) ** 2 + (point.lng - current.lng) ** 2;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    });

    const next = remaining.splice(nearestIndex, 1)[0];
    ordered.push(next);
    current = next;
  }

  return end ? [start, ...ordered, end] : [start, ...ordered];
}

async function fetchRoadRoute(
  waypoints: { lat: number; lng: number }[],
): Promise<[number, number][]> {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("OSRM routing failed");
  return data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [
    lat,
    lng,
  ]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

function extractGeoPoint(loc: DriverLocation | GeoPoint): GeoPoint {
  return "location" in loc ? loc.location : loc;
}

interface UserRouteData {
  userId: string;
  userIndex: number;
  stops?: DisplayRouteStop[];
  deliveryLocation?: DeliveryLocation;
  driverLocation?: DriverLocation | GeoPoint;
}

interface MapViewProps {
  stops?: DisplayRouteStop[];
  deliveryLocation?: DeliveryLocation;
  driverLocation?: DriverLocation | GeoPoint;
  className?: string;
  multiUserRoutes?: UserRouteData[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];
const SF_BOUNDS: [[number, number], [number, number]] = [
  [37.7, -122.52],
  [37.82, -122.35],
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapView({
  stops,
  deliveryLocation,
  driverLocation,
  className,
  multiUserRoutes,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const driverPosition = useMemo<[number, number] | null>(
    () =>
      driverLocation
        ? [
            extractGeoPoint(driverLocation).lat,
            extractGeoPoint(driverLocation).lng,
          ]
        : null,
    [driverLocation],
  );

  const center = useMemo<[number, number]>(() => {
    if (driverPosition) return driverPosition;
    if (deliveryLocation) return [deliveryLocation.lat, deliveryLocation.lng];
    if (multiUserRoutes && multiUserRoutes.length > 0) {
      const first = multiUserRoutes.find((r) => r.deliveryLocation);
      if (first?.deliveryLocation)
        return [first.deliveryLocation.lat, first.deliveryLocation.lng];
    }
    return DEFAULT_CENTER;
  }, [deliveryLocation, driverPosition, multiUserRoutes]);

  // Single-user positions (used for fitBounds + single-route rendering)
  const positions = useMemo<[number, number][]>(
    () => [
      ...(driverPosition ? [driverPosition] : []),
      ...(stops?.map(
        (s) => [s.location.lat, s.location.lng] as [number, number],
      ) ?? []),
      ...(deliveryLocation
        ? [[deliveryLocation.lat, deliveryLocation.lng] as [number, number]]
        : []),
    ],
    [deliveryLocation, stops, driverPosition],
  );

  // All positions across all routes (used for fitBounds in multi-user mode)
  const allPositions = useMemo<[number, number][]>(() => {
    if (!multiUserRoutes || multiUserRoutes.length === 0) return positions;
    const all: [number, number][] = [];
    if (driverPosition) all.push(driverPosition);
    for (const route of multiUserRoutes) {
      if (route.driverLocation) {
        const p = extractGeoPoint(route.driverLocation);
        all.push([p.lat, p.lng]);
      }
      for (const stop of route.stops ?? []) {
        all.push([stop.location.lat, stop.location.lng]);
      }
      if (route.deliveryLocation) {
        all.push([route.deliveryLocation.lat, route.deliveryLocation.lng]);
      }
    }
    return all.length > 0 ? all : positions;
  }, [multiUserRoutes, positions, driverPosition]);

  // ── Map initialisation (runs once) ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 12,
      maxZoom: 17,
      maxBounds: SF_BOUNDS,
      maxBoundsViscosity: 1.0,
    }).setView(center, 14);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, [center]);

  // ── Marker + route rendering (re-runs when data changes) ──────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // ── Helper: draw road route with white casing ──────────────────────────
    const renderRoute = async (
      waypoints: { lat: number; lng: number }[],
      color: string,
    ) => {
      if (waypoints.length < 2) return;
      try {
        const latlngs = await fetchRoadRoute(waypoints);
        // White casing for contrast against map tiles
        L.polyline(latlngs, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.45,
        }).addTo(layers);
        L.polyline(latlngs, { color, weight: 5, opacity: 0.88 }).addTo(layers);
      } catch {
        // Graceful fallback to dashed straight line
        L.polyline(
          waypoints.map((p) => [p.lat, p.lng] as [number, number]),
          { color, weight: 4, opacity: 0.6, dashArray: "10 6" },
        ).addTo(layers);
      }
    };

    // ── MULTI-USER MODE ────────────────────────────────────────────────────
    if (multiUserRoutes && multiUserRoutes.length > 0) {
      // Collect all delivery destinations with their user colour so we can
      // apply the spiral offset before placing any markers.
      const rawDestinations = multiUserRoutes
        .filter((r) => r.deliveryLocation)
        .map((r) => ({
          lat: r.deliveryLocation!.lat,
          lng: r.deliveryLocation!.lng,
          address: r.deliveryLocation!.address,
          userId: r.userId,
          colorBg: getRouteColor(r.userIndex).bg,
        }));

      const offsetDestinations = applyOverlapOffsets(rawDestinations, 12);

      // Also collect stop positions per route for offset (same merchant can
      // appear in multiple routes).
      type RawStop = {
        lat: number;
        lng: number;
        stop: DisplayRouteStop;
        routeIdx: number;
        stopIdx: number;
        colorBg: string;
        userId: string;
      };

      const rawStops: RawStop[] = [];
      multiUserRoutes.forEach((route) => {
        (route.stops ?? []).forEach((stop, stopIdx) => {
          rawStops.push({
            lat: stop.location.lat,
            lng: stop.location.lng,
            stop,
            routeIdx: route.userIndex,
            stopIdx,
            colorBg: getRouteColor(route.userIndex).bg,
            userId: route.userId,
          });
        });
      });

      const offsetStops = applyOverlapOffsets(rawStops, 9);

      // Build a map from userIndex → offset stop list so we can re-stitch
      // waypoints using the nudged coords.
      const stopsByRoute = new Map<number, typeof offsetStops>();
      offsetStops.forEach((s) => {
        const list = stopsByRoute.get(s.routeIdx) ?? [];
        list.push(s);
        stopsByRoute.set(s.routeIdx, list);
      });

      // ── Place destination markers (with offsets) ──────────────────────────
      offsetDestinations.forEach((dest) => {
        L.marker([dest.lat, dest.lng], {
          icon: createDestinationIcon(dest.colorBg),
        })
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;font-size:13px;">
              <strong>${dest.userId}</strong><br/>
              <span style="color:#64748b;">${dest.address || "Destination"}</span>
            </div>`,
          )
          .addTo(layers);
      });

      // ── Per-route: driver + stops + route polyline ────────────────────────
      for (const route of multiUserRoutes) {
        const color = getRouteColor(route.userIndex);
        const waypoints: { lat: number; lng: number }[] = [];

        // Driver marker
        if (route.driverLocation) {
          const dp = extractGeoPoint(route.driverLocation);
          waypoints.push({ lat: dp.lat, lng: dp.lng });

          L.marker([dp.lat, dp.lng], { icon: driverIcon })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;">
                <strong>Driver</strong><br/>
                <span style="color:#64748b;">${route.userId}</span>
              </div>`,
            )
            .addTo(layers);
        }

        // Stop markers (use offset positions for visual separation)
        const routeOffsetStops = stopsByRoute.get(route.userIndex) ?? [];
        routeOffsetStops.forEach((os) => {
          waypoints.push({ lat: os.lat, lng: os.lng });
          L.marker([os.lat, os.lng], {
            icon: createColoredStopIcon(os.stopIdx + 1, color.bg),
          })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;">
                <strong>${os.stop.merchantName}</strong><br/>
                <span style="color:#64748b;">${route.userId} — Stop #${os.stopIdx + 1}</span>
              </div>`,
            )
            .addTo(layers);
        });

        // Route polyline: driver → stops → delivery (use offset destination)
        const destOffset = offsetDestinations.find(
          (d) => d.userId === route.userId,
        );
        if (destOffset) {
          waypoints.push({ lat: destOffset.lat, lng: destOffset.lng });
        } else if (route.deliveryLocation) {
          waypoints.push({
            lat: route.deliveryLocation.lat,
            lng: route.deliveryLocation.lng,
          });
        }

        if (waypoints.length >= 2) {
          const start = waypoints[0];
          const end = waypoints[waypoints.length - 1];

          const middleStops = waypoints.slice(1, -1);

          const optimized = optimizeWaypointOrder(start, middleStops, end);

          void renderRoute(optimized, color.bg);
        }
      }

      if (allPositions.length > 0) {
        map.fitBounds(L.latLngBounds(allPositions), {
          padding: [40, 40],
          maxZoom: 15,
        });
      }
      return;
    }

    // ── SINGLE-USER MODE ───────────────────────────────────────────────────

    // Stop markers
    stops?.forEach((stop, index) => {
      L.marker([stop.location.lat, stop.location.lng], {
        icon: createStopIcon(index + 1, stop.state),
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;">
            <strong>${stop.merchantName}</strong><br/>
            <span style="color:#64748b;">Stop #${index + 1}</span>
          </div>`,
        )
        .addTo(layers);
    });

    // Destination marker
    if (deliveryLocation) {
      L.marker([deliveryLocation.lat, deliveryLocation.lng], {
        icon: singleDestinationIcon,
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;">
            <strong>Delivery destination</strong><br/>
            <span style="color:#64748b;">${deliveryLocation.address}</span>
          </div>`,
        )
        .addTo(layers);
    }

    // Driver marker
    if (driverPosition) {
      L.marker(driverPosition, { icon: driverIcon })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;">
            <strong>Driver location</strong><br/>
            <span style="color:#64748b;">Current position</span>
          </div>`,
        )
        .addTo(layers);
    }

    // Route polyline: driver → stops → destination
    if (positions.length > 1) {
      const waypoints = [
        ...(driverPosition
          ? [{ lat: driverPosition[0], lng: driverPosition[1] }]
          : []),
        ...(stops?.map((s) => ({ lat: s.location.lat, lng: s.location.lng })) ??
          []),
        ...(deliveryLocation
          ? [{ lat: deliveryLocation.lat, lng: deliveryLocation.lng }]
          : []),
      ];

      const start = waypoints[0];
      const end = waypoints[waypoints.length - 1];
      const middleStops = waypoints.slice(1, -1);

      const optimized = optimizeWaypointOrder(start, middleStops, end);

      void renderRoute(optimized, "#0f766e");

      map.fitBounds(L.latLngBounds(positions), {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else if (positions.length === 1 && positions[0]) {
      map.setView(positions[0], 14);
    } else {
      map.setView(center, 14);
    }
  }, [
    center,
    deliveryLocation,
    driverPosition,
    positions,
    stops,
    multiUserRoutes,
    allPositions,
  ]);

  const containerClass =
    className ??
    "h-[400px] w-full overflow-hidden rounded-[1.5rem] border border-white/70";

  return (
    <div className={containerClass}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
