import { useEffect } from "react";
import { ArrowRight, Navigation, RadioTower, RefreshCcw, Route, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MapView } from "@/components/MapView";
import { RouteTimeline } from "@/components/RouteTimeline";
import { SurfaceCard } from "@/components/SurfaceCard";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useUserRoutes } from "@/hooks/use-user-routes";
import { formatTime } from "@/lib/format";
import { buildDisplayRouteStops, resolveMerchantName } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 rounded-2xl border border-border/80 bg-background/70 px-4 text-sm outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

export default function RiderGuidancePage() {
  const [userId, setUserId] = usePersistentState("delivery.userId", "user_demo");
  const [selectedOrderId, setSelectedOrderId] = usePersistentState("delivery.guidanceOrderId", "");
  const routesQuery = useUserRoutes(userId);

  const activeOrders = (routesQuery.data?.orders ?? []).filter((order) => order.dispatchInstruction && order.routePlan);

  useEffect(() => {
    if (!activeOrders.length) {
      return;
    }

    if (!activeOrders.some((order) => order.orderId === selectedOrderId)) {
      setSelectedOrderId(activeOrders[0].orderId);
    }
  }, [activeOrders, selectedOrderId, setSelectedOrderId]);

  const selectedOrder = activeOrders.find((order) => order.orderId === selectedOrderId) ?? activeOrders[0];
  const displayStops = buildDisplayRouteStops(
    selectedOrder?.routePlan,
    selectedOrder?.dispatchInstruction,
    selectedOrder?.status,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Rider guidance</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Dispatch payload the rider actually needs</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This screen is driven off the user route summary feed and highlights
                <code> dispatchInstruction.nextStop</code>, pickup notes, ETA to next stop, full ordered stops, and the
                final destination on the map.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Active dispatches:</span> {activeOrders.length}
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
            Refresh guidance
          </Button>
        </SurfaceCard>
      </div>

      {routesQuery.isLoading && activeOrders.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <SurfaceCard key={index} className="animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-2/3 rounded bg-muted" />
              <div className="mt-6 h-48 rounded-[1.5rem] bg-muted/80" />
            </SurfaceCard>
          ))}
        </div>
      ) : routesQuery.isError ? (
        <SurfaceCard>
          <p className="text-sm font-medium text-destructive">Unable to load rider guidance.</p>
          <p className="mt-2 text-sm text-muted-foreground">{routesQuery.error.message}</p>
        </SurfaceCard>
      ) : !selectedOrder ? (
        <EmptyState
          icon={RadioTower}
          title="No active dispatch instructions"
          description="Create an order and wait for it to reach `dispatching`. Once the backend publishes rider guidance it will show up here."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {activeOrders.map((order) => (
              <button
                key={order.orderId}
                type="button"
                onClick={() => setSelectedOrderId(order.orderId)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  order.orderId === selectedOrder.orderId
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-background/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {order.orderId}
              </button>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <SurfaceCard>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <Navigation className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Next stop</p>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {selectedOrder.dispatchInstruction?.nextStop
                        ? resolveMerchantName(selectedOrder.dispatchInstruction.nextStop.merchantId)
                        : "No stop assigned"}
                    </h3>
                  </div>
                </div>
                <div className="mt-5 rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                  <p className="text-sm font-medium text-foreground">{selectedOrder.dispatchInstruction?.pickupNotes}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      ETA {selectedOrder.dispatchInstruction?.etaToNextStopMinutes} min
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      Route v{selectedOrder.dispatchInstruction?.routeVersion}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      Issued {formatTime(selectedOrder.dispatchInstruction?.issuedAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Order</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedOrder.orderId}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Destination</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedOrder.deliveryLocation.address}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Stops</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{displayStops.length}</p>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <Route className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ordered route</p>
                    <h3 className="text-lg font-semibold tracking-tight">Pickup sequence</h3>
                  </div>
                </div>
                <div className="mt-5">
                  <RouteTimeline stops={displayStops} />
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-6">
              <SurfaceCard>
                <MapView stops={displayStops} deliveryLocation={selectedOrder.deliveryLocation} className="h-[460px]" />
              </SurfaceCard>

              <SurfaceCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Jump deeper</p>
                    <h3 className="text-lg font-semibold tracking-tight">Open full tracking view</h3>
                  </div>
                  <Link
                    to={`/orders/${selectedOrder.orderId}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Order detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
