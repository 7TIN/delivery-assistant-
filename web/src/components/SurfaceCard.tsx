import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}
