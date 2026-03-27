import {
  ArrowLeft,
  ClipboardList,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  Route,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { MapView } from "@/components/MapView";
import { MerchantIcon } from "@/components/MerchantIcon";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { RouteTimeline } from "@/components/RouteTimeline";
import { StatusFlow } from "@/components/StatusFlow";
import { SurfaceCard } from "@/components/SurfaceCard";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { useCancelOrder } from "@/hooks/use-cancel-order";
import { useOrderRoute } from "@/hooks/use-order-route";
import { useOrderSnapshot } from "@/hooks/use-order-snapshot";
import { formatDateTime, formatPercent, formatTime, minutesUntil, titleCase } from "@/lib/format";
import { buildDisplayRouteStops, buildMerchantPresentations, merchantTaskTone } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";

const taskToneClasses: Record<ReturnType<typeof merchantTaskTone>, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  accent: "border-primary/20 bg-primary/10 text-primary",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
};

export default function OrderDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId ?? "";

  const snapshotQuery = useOrderSnapshot(orderId);
  const routeQuery = useOrderRoute(orderId, snapshotQuery.data?.order.status, snapshotQuery.data?.routePlan);
  const cancelMutation = useCancelOrder(orderId, snapshotQuery.data?.order.userId);

  if (!orderId) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Missing order id"
        description="Select an order from the dashboard first."
      />
    );
  }

  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <SurfaceCard key={index} className="animate-pulse">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="mt-4 h-9 w-2/3 rounded bg-muted" />
            <div className="mt-6 h-40 rounded-[1.5rem] bg-muted/80" />
          </SurfaceCard>
        ))}
      </div>
    );
  }

  if (snapshotQuery.isError) {
    if (snapshotQuery.error instanceof ApiError && snapshotQuery.error.status === 404) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Order not found"
          description="The backend does not currently know this order id. Create a new order or choose one from the dashboard."
        />
      );
    }

    return (
      <SurfaceCard>
        <p className="text-sm font-medium text-destructive">Unable to load order snapshot.</p>
        <p className="mt-2 text-sm text-muted-foreground">{snapshotQuery.error.message}</p>
      </SurfaceCard>
    );
  }

  const snapshot = snapshotQuery.data;
  if (!snapshot) {
    return null;
  }

  const routePlan = routeQuery.data ?? snapshot.routePlan;
  const displayStops = buildDisplayRouteStops(routePlan, snapshot.dispatchInstruction, snapshot.order.status);
  const merchantPresentations = buildMerchantPresentations({ ...snapshot, routePlan });
  const canCancel = !["completed", "canceled"].includes(snapshot.order.status);
  const routeUnavailable = !routePlan && !routeQuery.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="rounded-full px-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void snapshotQuery.refetch()}>
            <RefreshCcw className={cn("h-4 w-4", snapshotQuery.isFetching && "animate-spin")} />
            Refresh snapshot
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              onClick={() => void cancelMutation.mutateAsync()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel order"}
            </Button>
          )}
        </div>
      </div>

      <SurfaceCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Live tracking</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">{snapshot.order.id}</h2>
              <OrderStatusBadge status={snapshot.order.status} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              User <span className="font-medium text-foreground">{snapshot.order.userId}</span> headed to{" "}
              {snapshot.order.deliveryLocation.address}.
            </p>
          </div>
          <Link to="/guidance" className={buttonVariants({ variant: "outline", className: "rounded-full" })}>
            <Truck className="h-4 w-4" />
            Open rider guidance
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: "Created", value: formatDateTime(snapshot.order.createdAt) },
            { label: "Updated", value: formatDateTime(snapshot.order.updatedAt) },
            { label: "Merchants", value: String(snapshot.merchantTasks.length) },
            { label: "Ops tickets", value: String(snapshot.opsTickets.length) },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[1.25rem] border border-border/60 bg-background/65 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <StatusFlow status={snapshot.order.status} />
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Merchant orchestration
                </p>
                <h3 className="text-lg font-semibold tracking-tight">Task and vendor feedback</h3>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {merchantPresentations.map((merchant) => {
                const tone = merchant.task ? merchantTaskTone(merchant.task.taskStatus) : "neutral";

                return (
                  <div key={merchant.merchantId} className="rounded-[1.35rem] border border-border/60 bg-background/60 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
                          <MerchantIcon type={merchant.merchantKind} className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold tracking-tight">{merchant.merchantName}</p>
                            {merchant.task && (
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                  taskToneClasses[tone],
                                )}
                              >
                                {titleCase(merchant.task.taskStatus)}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {merchant.items.map((item) => `${item.quantity}x ${item.name}`).join(" • ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {typeof merchant.routeIndex === "number" && (
                          <span className="rounded-full bg-muted px-2.5 py-1">Pickup #{merchant.routeIndex + 1}</span>
                        )}
                        {merchant.task && (
                          <span className="rounded-full bg-muted px-2.5 py-1">
                            Deadline {formatTime(merchant.task.deadlineAt)}
                          </span>
                        )}
                        <span className="rounded-full bg-muted px-2.5 py-1">{merchant.items.length} item lines</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1.15rem] border border-border/60 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Vendor report
                        </p>
                        {merchant.report ? (
                          <>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {titleCase(merchant.report.availability)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ready {minutesUntil(merchant.report.etaReadyAt)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Confidence {formatPercent(merchant.report.confidence)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">No vendor report received yet.</p>
                        )}
                      </div>
                      <div className="rounded-[1.15rem] border border-border/60 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Pickup timing
                        </p>
                        {merchant.routeStop ? (
                          <>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              Arrive {formatTime(merchant.routeStop.etaArrivalAt)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ready {formatTime(merchant.routeStop.etaReadyAt)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Route not assigned yet.</p>
                        )}
                      </div>
                      <div className="rounded-[1.15rem] border border-border/60 bg-white/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Item states
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {merchant.items.reduce((sum, item) => sum + item.quantity, 0)} units
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {merchant.items.map((item) => titleCase(item.status)).join(" • ")}
                        </p>
                      </div>
                    </div>

                    {merchant.report?.notes && (
                      <p className="mt-3 rounded-[1.15rem] bg-muted/70 px-3 py-3 text-sm text-muted-foreground">
                        {merchant.report.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <Route className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Route plan</p>
                <h3 className="text-lg font-semibold tracking-tight">Pickup sequence and route score</h3>
              </div>
            </div>

            {routeQuery.isFetching && !routePlan ? (
              <div className="mt-5 flex items-center gap-2 rounded-[1.25rem] border border-border/60 bg-background/65 px-4 py-4 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking whether the backend has published a route yet.
              </div>
            ) : routeUnavailable ? (
              <div className="mt-5 rounded-[1.25rem] border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                Route not available yet. This is expected while the order is still orchestrating or waiting on merchant
                confirmation.
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Stops</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{displayStops.length}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Completion ETA
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatTime(routePlan?.estimatedCompletionAt)}
                    </p>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/60 bg-background/70 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Objective score
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {routePlan?.objectiveScore.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <RouteTimeline stops={displayStops} />
                </div>
              </>
            )}
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <MapPinned className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Delivery map</p>
                <h3 className="text-lg font-semibold tracking-tight">Stops plus destination</h3>
              </div>
            </div>
            <div className="mt-5">
              <MapView stops={displayStops} deliveryLocation={snapshot.order.deliveryLocation} className="h-[420px]" />
            </div>
          </SurfaceCard>

          {snapshot.dispatchInstruction && (
            <SurfaceCard>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Dispatch instruction
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">Current rider guidance</h3>
                </div>
              </div>
              <div className="mt-5 rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{snapshot.dispatchInstruction.pickupNotes}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    ETA {snapshot.dispatchInstruction.etaToNextStopMinutes} min
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Version {snapshot.dispatchInstruction.routeVersion}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    Issued {formatTime(snapshot.dispatchInstruction.issuedAt)}
                  </span>
                </div>
              </div>
            </SurfaceCard>
          )}

          {snapshot.opsTickets.length > 0 && (
            <SurfaceCard>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-destructive/15 bg-destructive/8 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                    Ops fallback
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">Intervention tickets</h3>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.opsTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-[1.25rem] border border-destructive/15 bg-destructive/6 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{ticket.reason}</p>
                      <span className="rounded-full border border-destructive/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Merchant {ticket.merchantId}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Created {formatDateTime(ticket.createdAt)}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}
