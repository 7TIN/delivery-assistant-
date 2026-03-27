import { useMemo, useState } from "react";
import { Minus, PackageCheck, Plus, Route, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { deliveryPresets, merchantCatalog } from "@/data/catalog";
import { MerchantIcon } from "@/components/MerchantIcon";
import { SurfaceCard } from "@/components/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCreateOrder } from "@/hooks/use-create-order";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { formatCurrency } from "@/lib/format";
import type { CreateOrderRequest } from "@/types/contracts";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 rounded-2xl border border-border/80 bg-background/70 px-4 text-sm outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const createOrderMutation = useCreateOrder();
  const [userId, setUserId] = usePersistentState("delivery.userId", "user_demo");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(deliveryPresets[0]?.id ?? "");
  const [address, setAddress] = useState(deliveryPresets[0]?.location.address ?? "");
  const [lat, setLat] = useState(String(deliveryPresets[0]?.location.lat ?? 0));
  const [lng, setLng] = useState(String(deliveryPresets[0]?.location.lng ?? 0));
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const selectedItems = useMemo(
    () =>
      merchantCatalog
        .map((item) => ({ item, quantity: quantities[item.itemId] ?? 0 }))
        .filter((entry) => entry.quantity > 0),
    [quantities],
  );

  const total = selectedItems.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);

  const updateQuantity = (itemId: string, nextQuantity: number) => {
    setQuantities((current) => ({
      ...current,
      [itemId]: Math.max(0, nextQuantity),
    }));
  };

  const handleDeliveryPresetChange = (presetId: string) => {
    setSelectedDeliveryId(presetId);
    const preset = deliveryPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setAddress(preset.location.address);
    setLat(String(preset.location.lat));
    setLng(String(preset.location.lng));
  };

  const submitOrder = async () => {
    if (selectedItems.length === 0) {
      return;
    }

    const payload: CreateOrderRequest = {
      userId,
      deliveryLocation: {
        address,
        lat: Number(lat),
        lng: Number(lng),
      },
      items: selectedItems.map(({ item, quantity }) => ({
        itemId: item.itemId,
        name: item.itemName,
        category: item.category,
        merchantId: item.merchantId,
        quantity,
        merchantLocation: item.merchantLocation,
      })),
    };

    const response = await createOrderMutation.mutateAsync(payload);
    navigate(`/orders/${response.orderId}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SurfaceCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Create order</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Turn the catalog mock into a real backend request
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                The order builder keeps a local merchant catalog only because the backend MVP does not expose product
                search or merchant lookup yet. Everything after submit uses live backend state: orchestration, route
                plans, dispatching, cancellations, and rider guidance.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Guide alignment:</span> multi-vendor create, tracking, routes, rider
              payload.
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Request scope</p>
              <h3 className="text-lg font-semibold tracking-tight">Order metadata</h3>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                User id
              </label>
              <input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className={cn(inputClassName, "mt-2 w-full")}
                placeholder="user_demo"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Delivery preset
              </label>
              <select
                value={selectedDeliveryId}
                onChange={(event) => handleDeliveryPresetChange(event.target.value)}
                className={cn(inputClassName, "mt-2 w-full appearance-none")}
              >
                {deliveryPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                {deliveryPresets.find((item) => item.id === selectedDeliveryId)?.blurb}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Address
              </label>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className={cn(inputClassName, "mt-2 w-full")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Latitude
                </label>
                <input
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  className={cn(inputClassName, "mt-2 w-full")}
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Longitude
                </label>
                <input
                  value={lng}
                  onChange={(event) => setLng(event.target.value)}
                  className={cn(inputClassName, "mt-2 w-full")}
                />
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {merchantCatalog.map((entry) => {
            const quantity = quantities[entry.itemId] ?? 0;

            return (
              <SurfaceCard key={entry.itemId} className="p-0">
                <div className="flex flex-col gap-4 border-b border-white/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground">
                      <MerchantIcon type={entry.merchantKind} className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {entry.merchantName}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold tracking-tight">{entry.itemName}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/60 px-4 py-3 text-sm">
                    <p className="font-semibold text-foreground">{formatCurrency(entry.price)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">~{entry.prepMinutes} min prep</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">merchantId: {entry.merchantId}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1">category: {entry.category}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      {entry.merchantLocation.lat.toFixed(4)}, {entry.merchantLocation.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => updateQuantity(entry.itemId, quantity - 1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <div className="min-w-10 text-center text-sm font-semibold">{quantity}</div>
                    <Button
                      type="button"
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => updateQuantity(entry.itemId, quantity + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Request preview</p>
                <h3 className="text-lg font-semibold tracking-tight">What will be sent</h3>
              </div>
            </div>
            <div className="mt-5 rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Selected line items</span>
                <span className="font-semibold text-foreground">{selectedItems.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Unique merchants</span>
                <span className="font-semibold text-foreground">
                  {new Set(selectedItems.map((entry) => entry.item.merchantId)).size}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {selectedItems.length === 0 ? (
                <p className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                  Add at least one item to generate a live order request.
                </p>
              ) : (
                selectedItems.map(({ item, quantity }) => (
                  <div key={item.itemId} className="rounded-[1.25rem] border border-border/60 bg-background/60 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">{item.merchantName}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        x{quantity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {createOrderMutation.isError && (
              <div className="mt-4 rounded-[1.25rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {createOrderMutation.error.message}
              </div>
            )}

            <Button
              type="button"
              className="mt-5 w-full rounded-2xl"
              size="lg"
              disabled={selectedItems.length === 0 || createOrderMutation.isPending}
              onClick={() => void submitOrder()}
            >
              <Route className="h-4 w-4" />
              {createOrderMutation.isPending ? "Creating live order..." : "Create live order"}
            </Button>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
