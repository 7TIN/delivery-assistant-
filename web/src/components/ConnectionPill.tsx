import { Wifi, WifiOff } from "lucide-react";

import { apiBaseUrl } from "@/api/client";
import { cn } from "@/lib/utils";

interface ConnectionPillProps {
  online: boolean;
}

export function ConnectionPill({ online }: ConnectionPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        online
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{online ? "API reachable" : "Waiting for API"}</span>
      <span className="hidden text-[11px] text-current/70 sm:inline">{apiBaseUrl || "via Vite proxy"}</span>
    </div>
  );
}
