import { useOrderStore } from "@/store/order-store";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { MerchantIcon } from "@/components/MerchantIcon";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";

export default function OrdersPage() {
  const orders = useOrderStore((s) => s.orders);
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">{orders.length} total</p>
        </div>
        <button
          onClick={() => navigate("/create")}
          className="text-sm px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          New Order
        </button>
      </div>

      <div className="border rounded-md divide-y">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => navigate(`/order/${order.id}`)}
            className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-muted-foreground">{order.id}</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>{order.items.length} items</span>
                <span className="flex items-center gap-1">
                  {order.items.map((item) => (
                    <MerchantIcon key={item.merchantId} type={item.merchantType} className="h-3 w-3 text-muted-foreground" />
                  ))}
                </span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
        {orders.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No orders yet. Create your first order.
          </div>
        )}
      </div>
    </div>
  );
}
