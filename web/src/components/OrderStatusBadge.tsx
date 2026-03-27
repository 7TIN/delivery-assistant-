import type { OrderStatus } from "@/types/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  created: { label: "Created", className: "bg-secondary text-secondary-foreground" },
  orchestrating: { label: "Orchestrating", className: "bg-secondary text-secondary-foreground animate-pulse" },
  awaiting_ops: { label: "Awaiting Ops", className: "bg-warning/10 text-warning-foreground border-warning/30" },
  route_ready: { label: "Route Ready", className: "bg-secondary text-foreground" },
  dispatching: { label: "Dispatching", className: "bg-foreground text-background" },
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/30" },
  canceled: { label: "Canceled", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border", config.className)}>
      {config.label}
    </Badge>
  );
}