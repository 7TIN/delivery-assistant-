import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-white/55 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-4 rounded-full border border-border/60 bg-background/70 p-3 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
