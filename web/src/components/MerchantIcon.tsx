import { Building2, Cpu, Pill, ShoppingBasket, UtensilsCrossed } from "lucide-react";

import type { MerchantKind } from "@/data/catalog";

const icons = {
  grocery: ShoppingBasket,
  restaurant: UtensilsCrossed,
  electronics: Cpu,
  pharmacy: Pill,
  other: Building2,
};

export function MerchantIcon({ type, className }: { type: MerchantKind; className?: string }) {
  const Icon = icons[type];
  return <Icon className={className ?? "h-4 w-4 text-muted-foreground"} />;
}
