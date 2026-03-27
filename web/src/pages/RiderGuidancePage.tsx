import { useOrderStore } from "@/store/order-store";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { MapView } from "@/components/MapView";
import { RouteTimeline } from "@/components/RouteTimeline";
import { MerchantIcon } from "@/components/MerchantIcon";
import { Navigation, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function RiderGuidancePage() {
  const orders = useOrderStore((s) => s.orders);
  const activeOrders = orders.filter((o) => o.status === "dispatching" && o.dispatchInstruction);
  const [selectedId, setSelectedId] = useState(activeOrders[0]?.id ?? "");
  const order = orders.find((o) => o.id === selectedId);

  if (activeOrders.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold mb-1">Rider Guidance</h1>
        <p className="text-sm text-muted-foreground mb-6">Active dispatch instructions for delivery partner</p>
        <div className="py-12 text-center text-sm text-muted-foreground border rounded-md">
          No active dispatches. Create an order and wait for it to reach "dispatching" status.
        </div>
      </div>
    );
  }

  const di = order?.dispatchInstruction;
  const rp = order?.routePlan;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Rider Guidance</h1>
          <p className="text-sm text-muted-foreground">Active dispatch instructions</p>
        </div>
        {activeOrders.length > 1 && (
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="appearance-none text-sm bg-secondary rounded-md px-3 py-1.5 pr-7 border-0 cursor-pointer"
            >
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>{o.id}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {order && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {/* Next stop card */}
            {di?.nextStop && (
              <div className="border rounded-md p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="h-4 w-4" />
                  <span className="text-sm font-medium">Next Stop</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <MerchantIcon type={di.nextStop.merchantType} className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{di.nextStop.merchantName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{di.nextStop.merchantType}</p>
                  </div>
                </div>
                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm">{di.pickupNotes}</p>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="bg-foreground text-background px-2 py-0.5 rounded font-medium">
                    {di.etaToNextStopMinutes} min away
                  </span>
                  <span>
                    Ready at: {new Date(di.nextStop.etaReadyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            )}

            {/* Full route */}
            {rp && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium">Full Route</h2>
                  <span className="text-xs text-muted-foreground">
                    {rp.stops.length} stops · Done by {new Date(rp.estimatedCompletionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <RouteTimeline plan={rp} />
              </div>
            )}

            {/* Delivery destination */}
            <div className="border rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Deliver to</p>
              <p className="text-sm">{order.deliveryLocation.address}</p>
            </div>
          </div>

          {/* Map */}
          <div>
            <MapView
              stops={rp?.stops}
              deliveryLocation={order.deliveryLocation}
              activeStopId={di?.nextStop?.merchantId}
              className="h-[500px] w-full rounded-md border overflow-hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
