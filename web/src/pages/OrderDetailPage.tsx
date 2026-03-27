import { useParams, useNavigate } from "react-router-dom";
import { useOrderStore } from "@/store/order-store";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { RouteTimeline } from "@/components/RouteTimeline";
import { MapView } from "@/components/MapView";
import { MerchantIcon } from "@/components/MerchantIcon";
import { ArrowLeft, Clock, MapPin, X } from "lucide-react";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrderStore((s) => s.orders.find((o) => o.id === orderId));
  const cancelOrder = useOrderStore((s) => s.cancelOrder);
  const navigate = useNavigate();

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Order not found</p>
        <button onClick={() => navigate("/")} className="text-sm mt-2 underline text-muted-foreground hover:text-foreground">
          Back to orders
        </button>
      </div>
    );
  }

  const canCancel = !["completed", "canceled"].includes(order.status);

  return (
    <div>
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold font-mono">{order.id}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(order.createdAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {order.deliveryLocation.address}
            </span>
          </div>
        </div>
        {canCancel && (
          <button
            onClick={() => cancelOrder(order.id)}
            className="text-xs px-2.5 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Items */}
          <div>
            <h2 className="text-sm font-medium mb-3">Items ({order.items.length})</h2>
            <div className="border rounded-md divide-y">
              {order.items.map((item) => (
                <div key={item.merchantId} className="px-3 py-2.5 flex items-center gap-3">
                  <MerchantIcon type={item.merchantType} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">{item.merchantName}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Route timeline */}
          {order.routePlan && (
            <div>
              <h2 className="text-sm font-medium mb-3">Route Plan</h2>
              <RouteTimeline plan={order.routePlan} />
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>Score: {order.routePlan.objectiveScore.toFixed(2)}</span>
                <span>
                  Completion: {new Date(order.routePlan.estimatedCompletionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}

          {/* Dispatch instruction */}
          {order.dispatchInstruction && (
            <div>
              <h2 className="text-sm font-medium mb-3">Dispatch Instruction</h2>
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm">{order.dispatchInstruction.pickupNotes}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>ETA: {order.dispatchInstruction.etaToNextStopMinutes} min</span>
                  <span>Version: {order.dispatchInstruction.routeVersion}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Map */}
        <div>
          <h2 className="text-sm font-medium mb-3">Map</h2>
          <MapView
            stops={order.routePlan?.stops}
            deliveryLocation={order.deliveryLocation}
            activeStopId={order.dispatchInstruction?.nextStop?.merchantId}
          />
          {!order.routePlan && (
            <div className="mt-3 text-xs text-muted-foreground border rounded-md p-3 text-center">
              Route not available yet. Waiting for orchestration to complete.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
