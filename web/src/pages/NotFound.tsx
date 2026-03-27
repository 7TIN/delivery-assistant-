import { Compass } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { SurfaceCard } from "@/components/SurfaceCard";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <SurfaceCard className="max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Route not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          There is no screen registered for <span className="font-medium text-foreground">{location.pathname}</span>.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/" className={buttonVariants({ className: "rounded-full px-5" })}>
            Back to control surface
          </Link>
        </div>
      </SurfaceCard>
    </div>
  );
}
