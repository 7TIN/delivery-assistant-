import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Navigation, RadioTower, Route, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MapView } from "@/components/MapView";
import { RouteTimeline } from "@/components/RouteTimeline";
import { SurfaceCard } from "@/components/SurfaceCard";
import { UserControl, getRouteColor } from "@/components/UserControl";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useUpdateDriverLocation } from "@/hooks/use-update-driver-location";
import { getAllUsersRoutes } from "@/api/orders";
import { formatTime } from "@/lib/format";
import { buildDisplayRouteStops, resolveMerchantName } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";
import type { UserOrderRouteSummary, UserRoutesResponse } from "@/types/contracts";

const inputClassName =
  "h-11 rounded-2xl border border-border/80 bg-background/70 px-4 text-sm outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

export default function RiderGuidancePage() {
  const [users] = usePersistentState<string[]>("delivery.users", ["user_demo"]);
  const [selectedUser] = usePersistentState<string>("delivery.userId", "user_demo");
  const [selectedOrderId, setSelectedOrderId] = usePersistentState<string>("delivery.guidanceOrderId", "");
  const [isLoading, setIsLoading] = useState(false);
  const [allRoutesData, setAllRoutesData] = useState<UserRoutesResponse[]>([]);

  const fetchAllRoutes = async () => {
    setIsLoading(true);
    try {
      const results = await getAllUsersRoutes(users);
      setAllRoutesData(results);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRoutes();
  }, [users]);

  const allOrders = useMemo(() => {
    const orders: Array<UserOrderRouteSummary & { userId: string; userIndex: number }> = [];
    allRoutesData.forEach((userRoutes, userIndex) => {
      const userId = users[userIndex];
      if (!userId) return;
      userRoutes.orders.forEach(order => {
        orders.push({ ...order, userId, userIndex });
      });
    });
    return orders;
  }, [allRoutesData, users]);

  useEffect(() => {
    if (!allOrders.length) return;
    if (!allOrders.some((order) => order.orderId === selectedOrderId)) {
      setSelectedOrderId(allOrders[0].orderId);
    }
  }, [allOrders, selectedOrderId, setSelectedOrderId]);

  const selectedOrder = allOrders.find((order) => order.orderId === selectedOrderId) ?? allOrders[0];
  const displayStops = selectedOrder
    ? buildDisplayRouteStops(selectedOrder.routePlan, selectedOrder.dispatchInstruction, selectedOrder.status)
    : [];

  const multiUserRoutes = useMemo(() => {
    return allOrders.map((order) => ({
      userId: order.userId,
      userIndex: order.userIndex,
      stops: buildDisplayRouteStops(order.routePlan, order.dispatchInstruction, order.status),
      deliveryLocation: order.deliveryLocation,
      driverLocation: order.driverLocation,
    }));
  }, [allOrders]);

  const selectedUserOrders = useMemo(() => {
    return allOrders.filter((order) => order.userId === selectedUser);
  }, [allOrders, selectedUser]);

  const activeOrdersCount = allOrders.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Rider guidance</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Multi-user dispatch view</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Combined route guidance for all users in the area. Each user has a different colored route.
                The rider can optimize deliveries based on the combined stops.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Total dispatches:</span> {activeOrdersCount} | <span className="font-semibold">Users:</span> {users.length}
            </div>
          </div>
        </SurfaceCard>

        <UserControl onRefresh={fetchAllRoutes} isRefreshing={isLoading} />
      </div>

      {isLoading && allOrders.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <SurfaceCard key={index} className="animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-2/3 rounded bg-muted" />
              <div className="mt-6 h-48 rounded-[1.5rem] bg-muted/80" />
            </SurfaceCard>
          ))}
        </div>
      ) : allOrders.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title="No active dispatch instructions"
          description="Create orders and wait for them to reach `dispatching`. Add multiple users to see combined routes."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground py-2">Orders:</span>
            {allOrders.map((order) => {
              const color = getRouteColor(order.userIndex);
              return (
                <button
                  key={order.orderId}
                  type="button"
                  onClick={() => setSelectedOrderId(order.orderId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    order.orderId === selectedOrderId
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-border bg-background/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: color.bg }} />
                  {order.userId.slice(0, 8)}...{order.orderId.slice(-4)}
                </button>
              );
            })}
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
                      {selectedOrder?.dispatchInstruction?.nextStop
                        ? resolveMerchantName(selectedOrder.dispatchInstruction.nextStop.merchantId)
                        : "No stop assigned"}
                    </h3>
                  </div>
                </div>
                <div className="mt-5 rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                  <p className="text-sm font-medium text-foreground">{selectedOrder?.dispatchInstruction?.pickupNotes}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      ETA {selectedOrder?.dispatchInstruction?.etaToNextStopMinutes} min
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      Route v{selectedOrder?.dispatchInstruction?.routeVersion}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      Issued {formatTime(selectedOrder?.dispatchInstruction?.issuedAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Order</p>
                    <p className="mt-2 text-sm font-semibold text-foreground truncate" title={selectedOrder?.orderId}>
                      {selectedOrder?.orderId?.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Destination</p>
                    <p className="mt-2 text-sm font-semibold text-foreground truncate">
                      {selectedOrder?.deliveryLocation?.address?.slice(0, 20)}...
                    </p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/65 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">User</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedOrder?.userId}</p>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <Route className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Selected user route</p>
                    <h3 className="text-lg font-semibold tracking-tight">Pickup sequence - {selectedUser}</h3>
                  </div>
                </div>
                <div className="mt-5">
                  <RouteTimeline stops={displayStops} />
                </div>
              </SurfaceCard>

              {selectedUserOrders.length > 1 && (
                <SurfaceCard>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">All {selectedUser} orders</p>
                      <h3 className="text-lg font-semibold tracking-tight">{selectedUserOrders.length} orders in queue</h3>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedUserOrders.map((order, idx) => (
                      <div key={order.orderId} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/65 p-3">
                        <div>
                          <p className="text-sm font-medium">#{idx + 1} {order.orderId.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">{order.deliveryLocation.address}</p>
                        </div>
                        <Link
                          to={`/orders/${order.orderId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Detail
                        </Link>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>
              )}
            </div>

            <div className="space-y-6">
              <SurfaceCard>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Combined route map</p>
                  <span className="text-xs text-muted-foreground">{users.length} users, {activeOrdersCount} orders</span>
                </div>
                <MapView
                  multiUserRoutes={multiUserRoutes}
                  className="h-[500px]"
                />
              </SurfaceCard>

              {selectedOrder && (
                <DriverLocationControl orderId={selectedOrder.orderId} />
              )}

              <SurfaceCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Jump deeper</p>
                    <h3 className="text-lg font-semibold tracking-tight">Open full tracking view</h3>
                  </div>
                  {selectedOrder && (
                    <Link
                      to={`/orders/${selectedOrder.orderId}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Order detail
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_DRIVER_LOCATION = {
  lat: 37.782319,
  lng: -122.404046,
};

function DriverLocationControl({ orderId }: { orderId: string }) {
  const updateMutation = useUpdateDriverLocation(orderId);
  const [lat, setLat] = useState(DEMO_DRIVER_LOCATION.lat.toString());
  const [lng, setLng] = useState(DEMO_DRIVER_LOCATION.lng.toString());

  const handleSetDemo = () => {
    setLat(DEMO_DRIVER_LOCATION.lat.toString());
    setLng(DEMO_DRIVER_LOCATION.lng.toString());
  };

  const handleUpdate = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      return;
    }
    updateMutation.mutate({ lat: parsedLat, lng: parsedLng });
  };

  return (
    <SurfaceCard>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-500/15 bg-green-500/10 text-green-600">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Driver location</p>
          <h3 className="text-lg font-semibold tracking-tight">Set driver position</h3>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Latitude</label>
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className={cn(inputClassName, "w-full")}
            placeholder="37.782319"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Longitude</label>
          <input
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className={cn(inputClassName, "w-full")}
            placeholder="-122.404046"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="flex-1 rounded-2xl bg-green-600 hover:bg-green-700"
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Updating..." : "Update"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-2xl"
            onClick={handleSetDemo}
          >
            Demo
          </Button>
        </div>
      </div>
      {updateMutation.isSuccess && (
        <p className="mt-3 text-sm text-green-600">Driver location updated!</p>
      )}
      {updateMutation.isError && (
        <p className="mt-3 text-sm text-destructive">Failed to update driver location</p>
      )}
    </SurfaceCard>
  );
}
