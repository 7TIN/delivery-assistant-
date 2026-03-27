import { ShoppingCart, UtensilsCrossed, Cpu, Pill } from "lucide-react";
import type { MerchantItem } from "@/types/contracts";

const icons = {
  grocery: ShoppingCart,
  restaurant: UtensilsCrossed,
  electronics: Cpu,
  pharmacy: Pill,
};

export function MerchantIcon({ type, className }: { type: MerchantItem["merchantType"]; className?: string }) {
  const Icon = icons[type];
  return <Icon className={className ?? "h-4 w-4 text-muted-foreground"} />;
}