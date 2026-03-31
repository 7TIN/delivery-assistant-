import { useEffect, useMemo, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { DisplayRouteStop } from "@/lib/order-presenters";
import type {
  DeliveryLocation,
  DeliveryPerson,
  GeoPoint,
} from "@/types/contracts";
import { getRouteColor } from "@/lib/route-colors";
// import { getRouteColor } from "./UserControl";

// ---------------------------------------------------------------------------
// Overlap offset utility (USED ONLY FOR VISUAL MARKERS)
// ---------------------------------------------------------------------------
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

  const latDegPerMeter = 1 / 111320;
  const result = items.map((item) => ({ ...item })) as (T & { lat: number; lng: number })[];

  buckets.forEach((indices) => {
    if (indices.length <= 1) return;

    indices.forEach((idx, slot) => {
      if (slot === 0) return; 
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
// Global Smart Dispatch Logic (Process Scheduling style)
// ---------------------------------------------------------------------------

interface RoutingTask {
  userId: string;
  type: "pickup" | "delivery";
  lat: number;
  lng: number;
}

/**
 * Calculates a single optimal driver path across multiple users.
 * Constraint: A user's delivery location is only visited AFTER all their merchants are visited.
 */
function calculateGlobalOptimizedRoute(
  multiUserRoutes: UserRouteData[],
  driverPosition?: [number, number] | null
): { lat: number; lng: number }[] {

  const unvisitedPickups: RoutingTask[] = [];
  const pendingDeliveries = new Map<string, RoutingTask>();
  const pickupRequirements = new Map<string, number>();
  const completedPickups = new Map<string, number>();

  // 1. Build the "Process Queue"
  multiUserRoutes.forEach((route) => {
    const stops = route.stops ?? [];
    pickupRequirements.set(route.userId, stops.length);
    completedPickups.set(route.userId, 0);

    stops.forEach((stop) => {
      unvisitedPickups.push({
        userId: route.userId,
        type: "pickup",
        lat: stop.location.lat,
        lng: stop.location.lng,
      });
    });

    if (route.deliveryLocation) {
      pendingDeliveries.set(route.userId, {
        userId: route.userId,
        type: "delivery",
        lat: route.deliveryLocation.lat,
        lng: route.deliveryLocation.lng,
      });
    }
  });

  const finalPath: { lat: number; lng: number }[] = [];
  
  // Start at Driver, OR first pickup, OR first delivery
  let currentLoc: { lat: number; lng: number } | null = null;

  if (driverPosition) {
    currentLoc = { lat: driverPosition[0], lng: driverPosition[1] };
  } else if (unvisitedPickups.length > 0 && unvisitedPickups[0]) {
    currentLoc = { lat: unvisitedPickups[0].lat, lng: unvisitedPickups[0].lng };
  } else if (pendingDeliveries.size > 0) {
    const firstDelivery = Array.from(pendingDeliveries.values())[0];
    if (firstDelivery) {
        currentLoc = { lat: firstDelivery.lat, lng: firstDelivery.lng };
    }
  }

  // If there are literally no coordinates provided anywhere, exit early.
  if (!currentLoc) return [];

  finalPath.push(currentLoc);

  // 2. Execute Preemptive Greedy TSP Scheduling
  while (unvisitedPickups.length > 0 || pendingDeliveries.size > 0) {
    let nextTask: RoutingTask | null = null;
    let bestIdx = -1;
    let shortestDist = Infinity;

    // Check Unvisited Pickups using standard 'for' loop for proper TS Control Flow
    for (let i = 0; i < unvisitedPickups.length; i++) {
      const task = unvisitedPickups[i];
      if (!task) continue;
      
      const dist = (task.lat - currentLoc.lat) ** 2 + (task.lng - currentLoc.lng) ** 2;
      if (dist < shortestDist) {
        shortestDist = dist;
        nextTask = task;
        bestIdx = i;
      }
    }

    // Check UNLOCKED Deliveries using 'for...of' for proper TS Control Flow
    for (const [userId, task] of pendingDeliveries.entries()) {
      const required = pickupRequirements.get(userId) || 0;
      const completed = completedPickups.get(userId) || 0;
      
      if (completed >= required) { // Valid ONLY if all food/items are picked up
        const dist = (task.lat - currentLoc.lat) ** 2 + (task.lng - currentLoc.lng) ** 2;
        if (dist < shortestDist) {
          shortestDist = dist;
          nextTask = task;
          bestIdx = -1; // Flag as delivery
        }
      }
    }

    // Graceful exit if data is missing or corrupt
    if (!nextTask || !currentLoc) break; 

    finalPath.push({ lat: nextTask.lat, lng: nextTask.lng });
    currentLoc = { lat: nextTask.lat, lng: nextTask.lng };

    // Update state
    if (nextTask.type === "pickup") {
      unvisitedPickups.splice(bestIdx, 1);
      completedPickups.set(nextTask.userId, (completedPickups.get(nextTask.userId) || 0) + 1);
    } else {
      pendingDeliveries.delete(nextTask.userId);
    }
  }

  return finalPath;
}

async function fetchRoadRoute(waypoints: { lat: number; lng: number }[]): Promise<[number, number][]> {
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("OSRM routing failed");
  return data.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

function extractGeoPoint(loc: DeliveryPerson | GeoPoint): GeoPoint {
  return "location" in loc ? loc.location : loc;
}

interface UserRouteData {
  userId: string;
  userIndex: number;
  stops?: DisplayRouteStop[];
  deliveryLocation?: DeliveryLocation;
  deliveryPerson?: DeliveryPerson | GeoPoint;
}

interface MapViewProps {
  stops?: DisplayRouteStop[];
  deliveryLocation?: DeliveryLocation;
  deliveryPerson?: DeliveryPerson | GeoPoint;
  className?: string;
  multiUserRoutes?: UserRouteData[];
}

// Strictly type the raw stops to replace 'any'
interface RawStop {
  lat: number;
  lng: number;
  stop: DisplayRouteStop;
  routeIdx: number;
  stopIdx: number;
  colorBg: string;
  userId: string;
}

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
  deliveryPerson,
  className,
  multiUserRoutes,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const driverPosition = useMemo<[number, number] | null>(
    () => deliveryPerson ? [extractGeoPoint(deliveryPerson).lat, extractGeoPoint(deliveryPerson).lng] : null,
    [deliveryPerson],
  );

  const center = useMemo<[number, number]>(() => {
    if (driverPosition) return driverPosition;
    if (deliveryLocation) return [deliveryLocation.lat, deliveryLocation.lng];
    if (multiUserRoutes && multiUserRoutes.length > 0) {
      const first = multiUserRoutes.find((r) => r.deliveryLocation);
      if (first?.deliveryLocation) return [first.deliveryLocation.lat, first.deliveryLocation.lng];
    }
    return DEFAULT_CENTER;
  }, [deliveryLocation, driverPosition, multiUserRoutes]);

  const allPositions = useMemo<[number, number][]>(() => {
    const all: [number, number][] = [];
    if (driverPosition) all.push(driverPosition);
    if (multiUserRoutes) {
      multiUserRoutes.forEach((route) => {
        route.stops?.forEach(s => all.push([s.location.lat, s.location.lng]));
        if (route.deliveryLocation) all.push([route.deliveryLocation.lat, route.deliveryLocation.lng]);
      });
    } else {
      stops?.forEach(s => all.push([s.location.lat, s.location.lng]));
      if (deliveryLocation) all.push([deliveryLocation.lat, deliveryLocation.lng]);
    }
    return all.length > 0 ? all : [center];
  }, [multiUserRoutes, stops, deliveryLocation, driverPosition, center]);


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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    const renderRouteLine = async (waypoints: { lat: number; lng: number }[], color: string) => {
      if (waypoints.length < 2) return;
      try {
        const latlngs = await fetchRoadRoute(waypoints);
        L.polyline(latlngs, { color: "#ffffff", weight: 8, opacity: 0.5 }).addTo(layers);
        L.polyline(latlngs, { color, weight: 5, opacity: 0.9 }).addTo(layers);
      } catch {
        L.polyline(waypoints.map((p) => [p.lat, p.lng] as [number, number]), { color, weight: 4, opacity: 0.6, dashArray: "10 6" }).addTo(layers);
      }
    };

    // ── MULTI-USER MODE ────────────────────────────────────────────────────
    if (multiUserRoutes && multiUserRoutes.length > 0) {
      
      const rawDestinations = multiUserRoutes.filter((r) => r.deliveryLocation).map((r) => ({
        lat: r.deliveryLocation!.lat, lng: r.deliveryLocation!.lng, address: r.deliveryLocation!.address, userId: r.userId, colorBg: getRouteColor(r.userIndex).bg,
      }));
      const offsetDestinations = applyOverlapOffsets(rawDestinations, 12);

      const rawStops: RawStop[] = []; // Replaced 'any' with explicit interface
      multiUserRoutes.forEach((route) => {
        route.stops?.forEach((stop, stopIdx) => {
          rawStops.push({ 
            lat: stop.location.lat, 
            lng: stop.location.lng, 
            stop, 
            routeIdx: route.userIndex, 
            stopIdx, 
            colorBg: getRouteColor(route.userIndex).bg, 
            userId: route.userId 
          });
        });
      });
      const offsetStops = applyOverlapOffsets(rawStops, 9);

      if (driverPosition) {
        L.marker(driverPosition, { icon: driverIcon }).bindPopup(`<strong>Driver</strong>`).addTo(layers);
      }

      offsetStops.forEach((os) => {
        L.marker([os.lat, os.lng], { icon: createColoredStopIcon(os.stopIdx + 1, os.colorBg) })
          .bindPopup(`<strong>${os.stop.merchantName}</strong><br/>${os.userId} — Stop #${os.stopIdx + 1}`)
          .addTo(layers);
      });

      offsetDestinations.forEach((dest) => {
        L.marker([dest.lat, dest.lng], { icon: createDestinationIcon(dest.colorBg) })
          .bindPopup(`<strong>${dest.userId}</strong><br/>${dest.address || "Destination"}`)
          .addTo(layers);
      });

      const optimizedPath = calculateGlobalOptimizedRoute(multiUserRoutes, driverPosition);
      void renderRouteLine(optimizedPath, "#10b981");

      map.fitBounds(L.latLngBounds(allPositions), { padding: [40, 40], maxZoom: 15 });
      return;
    }

    // ── SINGLE-USER MODE ───────────────────────────────────────────────────
    if (stops || deliveryLocation) {
      stops?.forEach((stop, index) => {
        L.marker([stop.location.lat, stop.location.lng], { icon: createStopIcon(index + 1, stop.state) })
          .bindPopup(`<strong>${stop.merchantName}</strong><br/>Stop #${index + 1}`)
          .addTo(layers);
      });

      if (deliveryLocation) {
        L.marker([deliveryLocation.lat, deliveryLocation.lng], { icon: singleDestinationIcon }).addTo(layers);
      }
      if (driverPosition) {
        L.marker(driverPosition, { icon: driverIcon }).addTo(layers);
      }

      const singleRouteData = { userId: "single", userIndex: 0, stops, deliveryLocation };
      const optimizedPath = calculateGlobalOptimizedRoute([singleRouteData], driverPosition);
      
      void renderRouteLine(optimizedPath, "#0f766e");
      
      if (allPositions.length > 0) map.fitBounds(L.latLngBounds(allPositions), { padding: [40, 40], maxZoom: 15 });
    }

  }, [ center, deliveryLocation, driverPosition, stops, multiUserRoutes, allPositions]);

  const containerClass = className ?? "h-[400px] w-full overflow-hidden rounded-[1.5rem] border border-white/70";
  return (
    <div className={containerClass}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}