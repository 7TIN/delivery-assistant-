import type { DisplayRouteStop } from "@/lib/order-presenters";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MerchantIcon } from "./MerchantIcon";

export function RouteTimeline({ stops }: { stops: DisplayRouteStop[] }) {
  return (
    <div className="space-y-0">
      {stops.map((stop, index) => {
        const isActive = stop.state === "active";
        const isDone = stop.state === "complete";

        return (
          <div key={stop.merchantId} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold",
                  isActive && "border-primary/30 bg-primary text-primary-foreground",
                  isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  !isActive && !isDone && "border-border bg-background text-muted-foreground",
                )}
              >
                {index + 1}
              </div>
              {index < stops.length - 1 && <div className="h-10 w-px bg-border" />}
            </div>
            <div className="min-w-0 pb-7 pt-0.5">
              <div className="flex items-center gap-2">
                <MerchantIcon type={stop.merchantKind} className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{stop.merchantName}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Arrive {formatTime(stop.etaArrivalAt)}
                {" • "}
                Ready {formatTime(stop.etaReadyAt)}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground/80">
                {stop.state === "active" && "Current pickup focus"}
                {stop.state === "complete" && "Already cleared"}
                {stop.state === "pending" && "Waiting in queue"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
