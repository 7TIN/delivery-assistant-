import { Activity, ArrowRight, Plus, Route } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { SurfaceCard } from "@/components/SurfaceCard";
import { UserControl } from "@/components/UserControl";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useUserRoutes } from "@/hooks/use-user-routes";
import { titleCase } from "@/lib/format";
import { buildDashboardMetrics, resolveMerchantName } from "@/lib/order-presenters";

export default function OrdersPage() {
  const [userId] = usePersistentState<string>("delivery.userId", "user_demo");
  const routesQuery = useUserRoutes(userId);

  const orders = routesQuery.data?.orders ?? [];
  const metrics = buildDashboardMetrics(orders);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <SurfaceCard className="overflow-hidden p-0">
          <div className="border-b border-white/70 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Live dashboard</p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Backend-aware order control</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  This screen is now driven by real order-route summaries from the backend. Create a multi-vendor
                  order, watch orchestration move forward, and jump straight into route or rider views.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/create" className={buttonVariants({ className: "rounded-2xl px-5" })}>
                  <Plus className="h-4 w-4" />
                  Create order
                </Link>
                <Link
                  to="/routes"
                  className={buttonVariants({ variant: "outline", className: "rounded-2xl px-5" })}
                >
                  <Route className="h-4 w-4" />
                  Open routes
                </Link>
              </div>
            </div>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
            {[
              { label: "Orders", value: metrics.total, hint: "tracked for this user" },
              { label: "Active routes", value: metrics.activeRoutes, hint: "route plans available" },
              { label: "Dispatching", value: metrics.dispatching, hint: "guidance payload ready" },
              { label: "Awaiting ops", value: metrics.awaitingOps, hint: "needs intervention" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[1.25rem] border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <UserControl
            onRefresh={() => void routesQuery.refetch()}
            isRefreshing={routesQuery.isFetching}
          />
          <div className="mt-5 rounded-[1.25rem] border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What is still mocked?</p>
            <p className="mt-2 leading-6">
              Only the catalog used to build order requests is local. The backend does not expose a merchant or item
              catalog yet, so the order builder supplies known merchant ids, names, and coordinates for a realistic
              frontend flow.
            </p>
          </div>
        </SurfaceCard>
      </div>

      {routesQuery.isLoading && orders.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <SurfaceCard key={index} className="animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-2/3 rounded bg-muted" />
              <div className="mt-6 h-24 rounded-3xl bg-muted/80" />
            </SurfaceCard>
          ))}
        </div>
      ) : routesQuery.isError ? (
        <SurfaceCard>
          <p className="text-sm font-medium text-destructive">Unable to load route summaries.</p>
          <p className="mt-2 text-sm text-muted-foreground">{routesQuery.error.message}</p>
        </SurfaceCard>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No orders tracked yet"
          description="Create an order for this user and it will show up here with route readiness, dispatch state, and delivery destination context."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => {
            const nextMerchantId =
              order.dispatchInstruction?.nextStop?.merchantId ?? order.routePlan?.stops[0]?.merchantId;

            return (
              <Link key={order.orderId} to={`/orders/${order.orderId}`} className="group block">
                <SurfaceCard className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Order
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">{order.orderId}</h3>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <div className="mt-4 rounded-[1.25rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Delivery
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{order.deliveryLocation.address}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {order.merchantLocations.length} merchant{order.merchantLocations.length === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1">{titleCase(order.status)}</span>
                      {order.routePlan && (
                        <span className="rounded-full bg-muted px-2.5 py-1">v{order.routePlan.version} route</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Next action
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {nextMerchantId ? resolveMerchantName(nextMerchantId) : "Route still orchestrating"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
