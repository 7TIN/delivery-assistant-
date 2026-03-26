import type { CreateOrderRequest } from "../../../packages/contracts/src";
import { createRuntimeContext, registerAllWorkers } from "../../../packages/core/src";

const context = createRuntimeContext();
registerAllWorkers(context);

const port = Number(Bun.env.ORDER_API_PORT ?? 3000);

const server = Bun.serve({
  port,
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/health") {
        return json({ status: "ok", service: "order-api" });
      }

      if (request.method === "POST" && path === "/api/v1/orders") {
        const body = (await request.json()) as CreateOrderRequest;
        const response = await context.services.orderApi.createOrder(body);
        return json(response, 201);
      }

      const orderMatch = matchOrderPath(path);
      if (orderMatch && request.method === "GET" && orderMatch.action === "root") {
        const snapshot = context.services.orderApi.getOrderSnapshot(orderMatch.orderId);
        if (!snapshot) {
          return json({ error: "Order not found" }, 404);
        }
        return json(snapshot);
      }

      if (orderMatch && request.method === "POST" && orderMatch.action === "cancel") {
        const canceled = context.services.orderApi.cancelOrder(orderMatch.orderId);
        if (!canceled) {
          return json({ error: "Order not found" }, 404);
        }
        return json(canceled);
      }

      if (orderMatch && request.method === "GET" && orderMatch.action === "route") {
        const route = context.services.orderApi.getRoute(orderMatch.orderId);
        if (!route) {
          return json({ error: "Route not available yet" }, 404);
        }
        return json(route);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return json({ error: message }, 400);
    }
  },
});

console.log(`order-api listening on http://localhost:${port}`);

const stop = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}, shutting down...`);
  server.stop(true);
  await context.queue.close?.();
  process.exit(0);
};

process.on("SIGINT", () => {
  void stop("SIGINT");
});

process.on("SIGTERM", () => {
  void stop("SIGTERM");
});

function matchOrderPath(path: string):
  | { orderId: string; action: "root" | "cancel" | "route" }
  | undefined {
  const root = path.match(/^\/api\/v1\/orders\/([^/]+)$/);
  if (root?.[1]) {
    return { orderId: root[1], action: "root" };
  }

  const cancel = path.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
  if (cancel?.[1]) {
    return { orderId: cancel[1], action: "cancel" };
  }

  const route = path.match(/^\/api\/v1\/orders\/([^/]+)\/route$/);
  if (route?.[1]) {
    return { orderId: route[1], action: "route" };
  }

  return undefined;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
