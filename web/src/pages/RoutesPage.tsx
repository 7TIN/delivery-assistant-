import { ArrowRight, Navigation, RefreshCcw, Route, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { RouteTimeline } from "@/components/RouteTimeline";
import { SurfaceCard } from "@/components/SurfaceCard";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useUserRoutes } from "@/hooks/use-user-routes";
import { buildDashboardMetrics, buildDisplayRouteStops, resolveMerchantName } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 rounded-2xl border border-border/80 bg-background/70 px-4 text-sm outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

export default function RoutesPage() {
  const [userId, setUserId] = usePersistentState("delivery.userId", "user_demo");
  const routesQuery = useUserRoutes(userId);

  const orders = routesQuery.data?.orders ?? [];
  const metrics = buildDashboardMetrics(orders);
  const routedOrders = orders.filter((order) => Boolean(order.routePlan));
  const pendingOrders = orders.filter((order) => !order.routePlan);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Routes dashboard</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Planned pickups across this user scope</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This page mirrors <code>GET /api/v1/users/:userId/routes</code>: route summaries, current status,
                dispatch payload when available, and the sequence the backend decided on for each order.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total", value: metrics.total },
                { label: "With route", value: metrics.activeRoutes },
                { label: "Dispatching", value: metrics.dispatching },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[1.2rem] border border-border/60 bg-background/65 px-4 py-3 text-center"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Feed filter</p>
              <h3 className="text-lg font-semibold tracking-tight">User id</h3>
            </div>
          </div>
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className={cn(inputClassName, "mt-5 w-full")}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full rounded-2xl"
            onClick={() => void routesQuery.refetch()}
            disabled={routesQuery.isFetching}
          >
            <RefreshCcw className={cn("h-4 w-4", routesQuery.isFetching && "animate-spin")} />
            Refresh routes
          </Button>
        </SurfaceCard>
      </div>

      {routesQuery.isLoading && orders.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2].map((index) => (
            <SurfaceCard key={index} className="animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-2/3 rounded bg-muted" />
              <div className="mt-6 h-32 rounded-[1.5rem] bg-muted/80" />
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
          icon={Route}
          title="No route summaries yet"
          description="Create an order for this user and the backend route summary feed will populate here."
        />
      ) : (
        <div className="space-y-6">
          {routedOrders.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {routedOrders.map((order) => {
                const displayStops = buildDisplayRouteStops(order.routePlan, order.dispatchInstruction, order.status);
                const nextMerchantId =
                  order.dispatchInstruction?.nextStop?.merchantId ?? order.routePlan?.stops[0]?.merchantId;

                return (
                  <SurfaceCard key={order.orderId}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Routed order</p>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight">{order.orderId}</h3>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-border/60 bg-background/65 p-4">
                      <p className="text-sm font-medium text-foreground">{order.deliveryLocation.address}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2.5 py-1">v{order.routePlan?.version}</span>
                        <span className="rounded-full bg-muted px-2.5 py-1">{displayStops.length} stops</span>
                        {nextMerchantId && (
                          <span className="rounded-full bg-muted px-2.5 py-1">
                            Next: {resolveMerchantName(nextMerchantId)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-5">
                      <RouteTimeline stops={displayStops} />
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <Link to={`/orders/${order.orderId}`} className="text-sm font-medium text-primary hover:underline">
                        Open order detail
                      </Link>
                      <Link
                        to="/guidance"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Navigation className="h-4 w-4" />
                        Guidance
                      </Link>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}

          {pendingOrders.length > 0 && (
            <SurfaceCard>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                  <RefreshCcw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Awaiting route</p>
                  <h3 className="text-lg font-semibold tracking-tight">Orders still orchestrating</h3>
                </div>
              </div>
              <div className="mt-5 divide-y divide-border/60 rounded-[1.25rem] border border-border/60 bg-background/65">
                {pendingOrders.map((order) => (
                  <Link
                    key={order.orderId}
                    to={`/orders/${order.orderId}`}
                    className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.orderId}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{order.deliveryLocation.address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}
    </div>
  );
}
