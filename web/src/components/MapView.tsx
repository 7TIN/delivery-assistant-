import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteStop, DeliveryLocation } from "@/types/contracts";

// Fix default marker icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createStopIcon(num: number, isActive: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;font-family:Inter,sans-serif;
      background:${isActive ? "#2563eb" : "#ffffff"};
      color:${isActive ? "#ffffff" : "#1e293b"};
      border:2px solid ${isActive ? "#1d4ed8" : "#94a3b8"};
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
    ">${num}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const destinationIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:#dc2626;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.3);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface MapViewProps {
  stops?: RouteStop[];
  deliveryLocation?: DeliveryLocation;
  activeStopId?: string;
  className?: string;
}

export function MapView({ stops, deliveryLocation, activeStopId, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const defaultCenter: [number, number] = [37.7749, -122.4194];

  const center: [number, number] = deliveryLocation
    ? [deliveryLocation.lat, deliveryLocation.lng]
    : defaultCenter;

  const positions = useMemo<[number, number][]>(
    () => [
      ...(stops?.map((s) => [s.location.lat, s.location.lng] as [number, number]) ?? []),
      ...(deliveryLocation ? [[deliveryLocation.lat, deliveryLocation.lng] as [number, number]] : []),
    ],
    [stops, deliveryLocation]
  );

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, 14);

    // OpenStreetMap colorful tiles
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    // Force a resize after mount to ensure tiles render properly
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers & route when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // Add stop markers
    stops?.forEach((stop, i) => {
      L.marker([stop.location.lat, stop.location.lng], {
        icon: createStopIcon(i + 1, stop.merchantId === activeStopId),
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;">
            <strong>${stop.merchantName}</strong><br/>
            <span style="color:#64748b;">Stop #${i + 1} · ${stop.merchantType}</span>
          </div>`
        )
        .addTo(layers);
    });

    // Add delivery destination marker
    if (deliveryLocation) {
      L.marker([deliveryLocation.lat, deliveryLocation.lng], {
        icon: destinationIcon,
      })
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;">
            <strong>📍 Delivery Destination</strong><br/>
            <span style="color:#64748b;">${deliveryLocation.address}</span>
          </div>`
        )
        .addTo(layers);
    }

    // Fetch real road routes from OSRM and draw on map
    if (positions.length > 1) {
      const coords = positions.map(([lat, lng]) => `${lng},${lat}`).join(";");
      fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`)
        .then((res) => res.json())
        .then((data) => {
          if (data.code === "Ok" && data.routes?.length) {
            // Pick the shortest route by distance
            const shortest = data.routes.reduce((best: any, r: any) =>
              r.distance < best.distance ? r : best
            , data.routes[0]);
            const routeCoords = shortest.geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            );
            L.polyline(routeCoords, {
              color: "#2563eb",
              weight: 5,
              opacity: 0.8,
            }).addTo(layers);
          } else {
            // Fallback to straight lines
            L.polyline(positions, {
              color: "#2563eb",
              weight: 3,
              opacity: 0.7,
              dashArray: "8 6",
            }).addTo(layers);
          }
        })
        .catch(() => {
          L.polyline(positions, {
            color: "#2563eb",
            weight: 3,
            opacity: 0.7,
            dashArray: "8 6",
          }).addTo(layers);
        });

      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.setView(center, 14);
    }
  }, [stops, deliveryLocation, activeStopId, positions, center]);

  const containerClass = className ?? "h-[400px] w-full rounded-md border overflow-hidden";

  return (
    <div className={containerClass}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}