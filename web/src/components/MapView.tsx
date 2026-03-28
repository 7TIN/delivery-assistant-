import { useEffect, useMemo, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { DisplayRouteStop } from "@/lib/order-presenters";
import type { DeliveryLocation, DriverLocation, GeoPoint } from "@/types/contracts";
import { getRouteColor } from "./UserControl";

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
  html: `<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e11d48;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#10b981;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25);"><svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M12 14c-3 0-6 2-6 3v2h12v-2c0-1-3-3-6-3z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

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

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];
const SF_BOUNDS: [[number, number], [number, number]] = [
  [37.70, -122.52],
  [37.82, -122.35],
];

function extractGeoPoint(loc: DriverLocation | GeoPoint): GeoPoint {
  return "location" in loc ? loc.location : loc;
}

export function MapView({ stops, deliveryLocation, driverLocation, className, multiUserRoutes }: MapViewProps) {
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
    () => {
      if (driverPosition) return driverPosition;
      if (deliveryLocation) return [deliveryLocation.lat, deliveryLocation.lng];
      if (multiUserRoutes && multiUserRoutes.length > 0) {
        const firstWithDelivery = multiUserRoutes.find(r => r.deliveryLocation);
        if (firstWithDelivery?.deliveryLocation) {
          return [firstWithDelivery.deliveryLocation.lat, firstWithDelivery.deliveryLocation.lng];
        }
      }
      return DEFAULT_CENTER;
    },
    [deliveryLocation, driverPosition, multiUserRoutes],
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

  const allPositions = useMemo<[number, number][]>(() => {
    if (!multiUserRoutes || multiUserRoutes.length === 0) {
      return positions;
    }
    const all: [number, number][] = [];
    if (driverPosition) all.push(driverPosition);
    for (const route of multiUserRoutes) {
      if (route.driverLocation) {
        const driverPos = extractGeoPoint(route.driverLocation);
        all.push([driverPos.lat, driverPos.lng]);
      }
      if (route.stops) {
        for (const stop of route.stops) {
          all.push([stop.location.lat, stop.location.lng]);
        }
      }
      if (route.deliveryLocation) {
        all.push([route.deliveryLocation.lat, route.deliveryLocation.lng]);
      }
    }
    return all.length > 0 ? all : positions;
  }, [multiUserRoutes, positions, driverPosition]);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 12,
      maxZoom: 17,
      maxBounds: SF_BOUNDS,
      maxBoundsViscosity: 1.0,
    }).setView(center, 14);

    map.setMaxBounds(SF_BOUNDS);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
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

    const renderRoute = async (
      waypoints: { lat: number; lng: number }[],
      color: string,
      _isFallback = false
    ) => {
      if (waypoints.length < 2) return;
      
      try {
        const latlngs = await fetchRoadRoute(waypoints);
        L.polyline(latlngs, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.4,
        }).addTo(layers);
        L.polyline(latlngs, {
          color: color,
          weight: 5,
          opacity: 0.85,
        }).addTo(layers);
      } catch {
        L.polyline(waypoints.map(p => [p.lat, p.lng] as [number, number]), {
          color: color,
          weight: 4,
          opacity: 0.6,
          dashArray: "10 6",
        }).addTo(layers);
      }
    };

    if (multiUserRoutes && multiUserRoutes.length > 0) {
      for (const route of multiUserRoutes) {
        const color = getRouteColor(route.userIndex) ?? { bg: "#6366f1", border: "#4f46e5", name: "Indigo" };
        const waypoints: { lat: number; lng: number }[] = [];
        
        if (route.driverLocation) {
          const driverPos = extractGeoPoint(route.driverLocation);
          waypoints.push({ lat: driverPos.lat, lng: driverPos.lng });
          
          L.marker([driverPos.lat, driverPos.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#10b981;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25);"><svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M12 14c-3 0-6 2-6 3v2h12v-2c0-1-3-3-6-3z"/></svg></div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            }),
          })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>Driver</strong><br/><span style="color:#64748b;">${route.userId}</span></div>`,
            )
            .addTo(layers);
        }
        
        if (route.stops && route.stops.length > 0) {
          route.stops.forEach((stop, idx) => {
            waypoints.push({ lat: stop.location.lat, lng: stop.location.lng });
            L.marker([stop.location.lat, stop.location.lng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:Inter,sans-serif;background:${color.bg};color:#ffffff;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${idx + 1}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              }),
            })
              .bindPopup(
                `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>${stop.merchantName}</strong><br/><span style="color:#64748b;">${route.userId} - Stop #${idx + 1}</span></div>`,
              )
              .addTo(layers);
          });
        }
        
        if (route.deliveryLocation) {
          if (waypoints.length === 0) {
            waypoints.push({ lat: route.deliveryLocation.lat, lng: route.deliveryLocation.lng });
          } else {
            waypoints.push({ lat: route.deliveryLocation.lat, lng: route.deliveryLocation.lng });
          }
          
          L.marker([route.deliveryLocation.lat, route.deliveryLocation.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color.bg};border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          })
            .bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;"><strong>${route.userId}</strong><br/><span style="color:#64748b;">${route.deliveryLocation.address || 'Destination'}</span></div>`,
            )
            .addTo(layers);
        }
        
        if (waypoints.length >= 2) {
          renderRoute(waypoints, color.bg, false);
        }
      }
      
      if (allPositions.length > 0) {
        map.fitBounds(L.latLngBounds(allPositions), { padding: [40, 40], maxZoom: 15 });
      }
    } else if (positions.length > 1) {
      fetchRoadRoute([
        ...(driverPosition ? [{ lat: driverPosition[0], lng: driverPosition[1] }] : []),
        ...(stops?.map((s) => ({ lat: s.location.lat, lng: s.location.lng })) ??
          []),
        ...(deliveryLocation
          ? [{ lat: deliveryLocation.lat, lng: deliveryLocation.lng }]
          : []),
      ])
        .then((latlngs) => {
          L.polyline(latlngs, {
            color: "#ffffff",
            weight: 8,
            opacity: 0.4,
          }).addTo(layers);
          L.polyline(latlngs, {
            color: "#0f766e",
            weight: 5,
            opacity: 0.85,
          }).addTo(layers);
        })
        .catch(() => {
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
    } else if (positions.length === 1 && positions[0]) {
      map.setView(positions[0], 14);
    } else {
      map.setView(center, 14);
    }
  }, [center, deliveryLocation, driverPosition, positions, stops, multiUserRoutes, allPositions]);

  const containerClass =
    className ??
    "h-[400px] w-full overflow-hidden rounded-[1.5rem] border border-white/70";

  return (
    <div className={containerClass}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
