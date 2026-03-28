import { useEffect, useMemo, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { DisplayRouteStop } from "@/lib/order-presenters";
import type { DeliveryLocation, DriverLocation, GeoPoint } from "@/types/contracts";

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

const destinationIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#b45309;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#22c55e;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);animation:pulse 2s infinite"><svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/></svg></div><style>@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:0.8}}</style>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

interface MapViewProps {
  stops?: DisplayRouteStop[];
  deliveryLocation?: DeliveryLocation;
  driverLocation?: DriverLocation | GeoPoint;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

function extractGeoPoint(loc: DriverLocation | GeoPoint): GeoPoint {
  return "location" in loc ? loc.location : loc;
}

export function MapView({ stops, deliveryLocation, driverLocation, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const driverPosition = useMemo<[number, number] | null>(
    () =>
      driverLocation
        ? [extractGeoPoint(driverLocation).lat, extractGeoPoint(driverLocation).lng]
        : null,
    [driverLocation],
  );

  const center = useMemo<[number, number]>(
    () =>
      driverPosition
        ? driverPosition
        : deliveryLocation
          ? [deliveryLocation.lat, deliveryLocation.lng]
          : DEFAULT_CENTER,
    [deliveryLocation, driverPosition],
  );

  const positions = useMemo<[number, number][]>(
    () => [
      ...(driverPosition ? [driverPosition] : []),
      ...(stops?.map(
        (stop) => [stop.location.lat, stop.location.lng] as [number, number],
      ) ?? []),
      ...(deliveryLocation
        ? [[deliveryLocation.lat, deliveryLocation.lng] as [number, number]]
        : []),
    ],
    [deliveryLocation, stops, driverPosition],
  );

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, 14);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
    if (!map || !layers) {
      return;
    }

    layers.clearLayers();

    stops?.forEach((stop, index) => {
      L.marker([stop.location.lat, stop.location.lng], {
        icon: createStopIcon(index + 1, stop.state),
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>${stop.merchantName}</strong><br/><span style="color:#64748b;">Stop #${index + 1}</span></div>`,
        )
        .addTo(layers);
    });

    if (deliveryLocation) {
      L.marker([deliveryLocation.lat, deliveryLocation.lng], {
        icon: destinationIcon,
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>Delivery destination</strong><br/><span style="color:#64748b;">${deliveryLocation.address}</span></div>`,
        )
        .addTo(layers);
    }

    if (driverPosition) {
      L.marker([driverPosition[0], driverPosition[1]], {
        icon: driverIcon,
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>Driver location</strong><br/><span style="color:#64748b;">Current position</span></div>`,
        )
        .addTo(layers);
    }

    // if (positions.length > 1) {
    //   L.polyline(positions, {
    //     color: "#0f766e",
    //     weight: 4,
    //     opacity: 0.85,
    //     dashArray: "10 6",
    //   }).addTo(layers);

    //   map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15 });
    if (positions.length > 1) {
      fetchRoadRoute([
        ...(driverPosition ? [{ lat: driverPosition[0], lng: driverPosition[1] }] : []),
        ...(stops?.map((s) => ({ lat: s.location.lat, lng: s.location.lng })) ??
          []),
        ...(deliveryLocation
          ? [{ lat: deliveryLocation.lat, lng: deliveryLocation.lng }]
          : []),
      ])
        .then((latlngs) => {
          // White casing underneath for contrast
          L.polyline(latlngs, {
            color: "#ffffff",
            weight: 8,
            opacity: 0.4,
          }).addTo(layers);
          // Teal route on top
          L.polyline(latlngs, {
            color: "#0f766e",
            weight: 5,
            opacity: 0.85,
          }).addTo(layers);
        })
        .catch(() => {
          // Fallback to straight dashed line if OSRM is unavailable
          L.polyline(positions, {
            color: "#0f766e",
            weight: 4,
            opacity: 0.85,
            dashArray: "10 6",
          }).addTo(layers);
        });
      map.fitBounds(L.latLngBounds(positions), {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.setView(center, 14);
    }
  }, [center, deliveryLocation, driverPosition, positions, stops]);

  const containerClass =
    className ??
    "h-[400px] w-full overflow-hidden rounded-[1.5rem] border border-white/70";

  return (
    <div className={containerClass}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
