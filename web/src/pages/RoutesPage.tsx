import { useOrderStore } from "@/store/order-store";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { RouteTimeline } from "@/components/RouteTimeline";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Route } from "lucide-react";

export default function RoutesPage() {
  const orders = useOrderStore((s) => s.orders);
  const navigate = useNavigate();

  const ordersWithRoutes = orders.filter((o) => o.routePlan);
  const ordersWithoutRoutes = orders.filter((o) => !o.routePlan);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Routes Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">
        All planned delivery routes for user_demo
      </p>

      {ordersWithRoutes.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground border rounded-md">
          No routes available yet.
        </div>
      )}

      <div className="space-y-4">
        {ordersWithRoutes.map((order) => (
          <div key={order.id} className="border rounded-md">
            <button
              onClick={() => navigate(`/order/${order.id}`)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors border-b"
            >
              <div className="flex items-center gap-3">
                <Route className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">{order.id}</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {order.routePlan && (
              <div className="px-4 py-3">
                <RouteTimeline plan={order.routePlan} />
              </div>
            )}
          </div>
        ))}
      </div>

      {ordersWithoutRoutes.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Awaiting Route</h2>
          <div className="border rounded-md divide-y">
            {ordersWithoutRoutes.map((order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/order/${order.id}`)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">{order.id}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
