import type { RoutePlan } from "@/types/contracts";
import { MerchantIcon } from "./MerchantIcon";
import { cn } from "@/lib/utils";

export function RouteTimeline({ plan }: { plan: RoutePlan }) {
  return (
    <div className="space-y-0">
      {plan.stops.map((stop, i) => {
        const isActive = stop.status === "arrived";
        const isDone = stop.status === "picked_up";
        return (
          <div key={stop.merchantId} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-7 w-7 rounded-md border flex items-center justify-center text-xs font-medium shrink-0",
                  isActive && "bg-foreground text-background border-foreground",
                  isDone && "bg-secondary text-muted-foreground border-border",
                  !isActive && !isDone && "bg-background text-muted-foreground border-border"
                )}
              >
                {i + 1}
              </div>
              {i < plan.stops.length - 1 && (
                <div className="w-px h-8 bg-border" />
              )}
            </div>
            {/* Content */}
            <div className="pb-6 pt-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <MerchantIcon type={stop.merchantType} className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{stop.merchantName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                ETA: {new Date(stop.etaArrivalAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                Ready: {new Date(stop.etaReadyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}