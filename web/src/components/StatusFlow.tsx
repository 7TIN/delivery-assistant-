import type { OrderStatus } from "@/types/contracts";

import { titleCase } from "@/lib/format";
import { getOrderFlow, getOrderStageIndex } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";

export function StatusFlow({ status }: { status: OrderStatus }) {
  const steps = getOrderFlow();
  const currentIndex = getOrderStageIndex(status);

  return (
    <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isComplete = currentIndex > index;
        const isCanceled = status === "canceled" && step === "canceled";

        return (
          <div
            key={step}
            className={cn(
              "rounded-2xl border px-3 py-3 text-xs transition-colors",
              isActive && "border-primary/40 bg-primary/8 text-primary shadow-sm",
              isComplete && "border-emerald-200 bg-emerald-50 text-emerald-700",
              isCanceled && "border-destructive/25 bg-destructive/8 text-destructive",
              !isActive && !isComplete && !isCanceled && "border-border/80 bg-background/70 text-muted-foreground",
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isActive && "bg-primary",
                  isComplete && "bg-emerald-500",
                  isCanceled && "bg-destructive",
                  !isActive && !isComplete && !isCanceled && "bg-border",
                )}
              />
              <span className="font-medium uppercase tracking-[0.16em]">{index + 1}</span>
            </div>
            <p className="text-sm font-medium tracking-tight">{titleCase(step)}</p>
          </div>
        );
      })}
    </div>
  );
}
