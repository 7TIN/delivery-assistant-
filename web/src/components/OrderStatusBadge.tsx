import type { OrderStatus } from "@/types/contracts";

import { titleCase } from "@/lib/format";
import { statusTone } from "@/lib/order-presenters";
import { cn } from "@/lib/utils";

const toneClasses: Record<ReturnType<typeof statusTone>, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  accent: "border-primary/20 bg-primary/10 text-primary",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = statusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        toneClasses[tone],
      )}
    >
      {titleCase(status)}
    </span>
  );
}
