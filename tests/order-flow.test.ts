import { afterEach, describe, expect, it } from "bun:test";

import { createRuntimeContext, registerAllWorkers } from "../packages/core/src";

const previousQueueDriver = Bun.env.QUEUE_DRIVER;
const previousVendorMinConfidence = Bun.env.VENDOR_MIN_CONFIDENCE;
const previousOsrmEnabled = Bun.env.OSRM_ENABLED;

afterEach(() => {
  if (previousQueueDriver === undefined) {
    delete Bun.env.QUEUE_DRIVER;
  } else {
    Bun.env.QUEUE_DRIVER = previousQueueDriver;
  }

  if (previousVendorMinConfidence === undefined) {
    delete Bun.env.VENDOR_MIN_CONFIDENCE;
  } else {
    Bun.env.VENDOR_MIN_CONFIDENCE = previousVendorMinConfidence;
  }

  if (previousOsrmEnabled === undefined) {
    delete Bun.env.OSRM_ENABLED;
  } else {
    Bun.env.OSRM_ENABLED = previousOsrmEnabled;
  }
});

describe("order orchestration flow", () => {
  it("creates an order and produces route + dispatch instruction", async () => {
    Bun.env.QUEUE_DRIVER = "in-memory";
    Bun.env.VENDOR_MIN_CONFIDENCE = "0";
    Bun.env.OSRM_ENABLED = "false";

    const runtime = createRuntimeContext();
    registerAllWorkers(runtime);

    const created = await runtime.services.orderApi.createOrder({
      userId: "usr_test_1",
      deliveryLocation: {
        lat: 12.9716,
        lng: 77.5946,
        address: "Bengaluru",
      },
      items: [
        {
          itemId: "itm_1",
          name: "Milk",
          category: "grocery",
          merchantId: "m_grocery_1",
          quantity: 1,
        },
        {
          itemId: "itm_2",
          name: "Pizza",
          category: "food",
          merchantId: "m_food_1",
          quantity: 1,
        },
      ],
    });

    const snapshot = runtime.services.orderApi.getOrderSnapshot(created.orderId);

    expect(snapshot).toBeDefined();
    expect(snapshot?.order.status).toBe("dispatching");
    expect(snapshot?.routePlan).toBeDefined();
    expect(snapshot?.routePlan?.stops.length).toBeGreaterThan(0);
    expect(snapshot?.dispatchInstruction).toBeDefined();

    await runtime.queue.close?.();
  });

  it("cancels an order", async () => {
    Bun.env.QUEUE_DRIVER = "in-memory";
    Bun.env.VENDOR_MIN_CONFIDENCE = "0";
    Bun.env.OSRM_ENABLED = "false";

    const runtime = createRuntimeContext();
    registerAllWorkers(runtime);

    const created = await runtime.services.orderApi.createOrder({
      userId: "usr_test_2",
      deliveryLocation: {
        lat: 12.9716,
        lng: 77.5946,
        address: "Bengaluru",
      },
      items: [
        {
          itemId: "itm_3",
          name: "Cable",
          category: "electronics",
          merchantId: "m_elec_1",
          quantity: 1,
        },
      ],
    });

    const canceled = runtime.services.orderApi.cancelOrder(created.orderId);

    expect(canceled).toBeDefined();
    expect(canceled?.status).toBe("canceled");

    const snapshot = runtime.services.orderApi.getOrderSnapshot(created.orderId);
    expect(snapshot?.order.status).toBe("canceled");

    await runtime.queue.close?.();
  });
});
