import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrderStore } from "@/store/order-store";
import { demoMerchants } from "@/store/demo-data";
import { MerchantIcon } from "@/components/MerchantIcon";
import type { MerchantItem } from "@/types/contracts";
import { Check, Plus, Minus } from "lucide-react";

export default function CreateOrderPage() {
  const [selected, setSelected] = useState<Map<string, MerchantItem>>(new Map());
  const createOrder = useOrderStore((s) => s.createOrder);
  const navigate = useNavigate();

  const toggle = (item: MerchantItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.merchantId)) next.delete(item.merchantId);
      else next.set(item.merchantId, item);
      return next;
    });
  };

  const handleCreate = () => {
    if (selected.size === 0) return;
    const order = createOrder(Array.from(selected.values()));
    navigate(`/order/${order.id}`);
  };

  const total = Array.from(selected.values()).reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Create Order</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Select items from multiple vendors. One delivery partner handles everything.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {demoMerchants.map((item) => {
          const isSelected = selected.has(item.merchantId);
          return (
            <button
              key={item.merchantId}
              onClick={() => toggle(item)}
              className={`text-left border rounded-md p-3 transition-all ${
                isSelected ? "border-foreground bg-muted/30" : "border-border hover:border-foreground/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <MerchantIcon type={item.merchantType} className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground capitalize">{item.merchantType}</span>
                  </div>
                  <p className="text-sm font-medium">{item.merchantName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.itemName}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>${item.price.toFixed(2)}</span>
                    <span>·</span>
                    <span>~{item.estimatedPrepTime} min prep</span>
                  </div>
                </div>
                <div
                  className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? "bg-foreground border-foreground" : "border-border"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-background" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 sm:static sm:mt-6 border-t sm:border-t-0 bg-background p-4 sm:p-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">{selected.size} items</span>
            {selected.size > 0 && (
              <span className="ml-2 font-medium">${total.toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={handleCreate}
            disabled={selected.size === 0}
            className="text-sm px-4 py-2 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}