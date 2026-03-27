import { afterEach, describe, expect, it } from "bun:test";

import type { CreateOrderRequest } from "../packages/contracts/src";
import { createRuntimeContext, registerAllWorkers } from "../packages/core/src";

const previousQueueDriver = Bun.env.QUEUE_DRIVER;
const previousVendorMinConfidence = Bun.env.VENDOR_MIN_CONFIDENCE;
const previousOsrmEnabled = Bun.env.OSRM_ENABLED;
const previousRepositoryDriver = Bun.env.REPOSITORY_DRIVER;
const previousForcedRepositoryDriver = Bun.env.FORCE_REPOSITORY_DRIVER;

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

  if (previousRepositoryDriver === undefined) {
    delete Bun.env.REPOSITORY_DRIVER;
  } else {
    Bun.env.REPOSITORY_DRIVER = previousRepositoryDriver;
  }

  if (previousForcedRepositoryDriver === undefined) {
    delete Bun.env.FORCE_REPOSITORY_DRIVER;
  } else {
    Bun.env.FORCE_REPOSITORY_DRIVER = previousForcedRepositoryDriver;
  }
});

describe("concurrent multi-order orchestration", () => {
  it("processes many orders in parallel for one user with independent background jobs and route locations", async () => {
    Bun.env.QUEUE_DRIVER = "in-memory";
    Bun.env.REPOSITORY_DRIVER = "memory";
    Bun.env.FORCE_REPOSITORY_DRIVER = "memory";
    Bun.env.VENDOR_MIN_CONFIDENCE = "0";
    Bun.env.OSRM_ENABLED = "false";

    const runtime = createRuntimeContext();
    registerAllWorkers(runtime);

    const orderCount = 10;
    const userId = "usr_concurrent_1";

    const requests = Array.from({ length: orderCount }, (_, index) =>
      buildOrderRequest(userId, index),
    );

    const createdOrders = await Promise.all(
      requests.map((request) => runtime.services.orderApi.createOrder(request)),
    );

    expect(createdOrders.length).toBe(orderCount);
    expect(new Set(createdOrders.map((order) => order.orderId)).size).toBe(orderCount);

    const snapshots = await Promise.all(
      createdOrders.map((order) => runtime.services.orderApi.getOrderSnapshot(order.orderId)),
    );

    const userRouteSummaries = await runtime.services.orderApi.getUserOrderRouteSummaries(userId);
    expect(userRouteSummaries.length).toBe(orderCount);

    for (const summary of userRouteSummaries) {
      expect(summary.deliveryLocation.address.length).toBeGreaterThan(0);
      expect(summary.merchantLocations.length).toBeGreaterThan(0);
      expect(summary.routePlan).toBeDefined();
    }

    for (let index = 0; index < orderCount; index += 1) {
      const request = requests[index]!;
      const snapshot = snapshots[index]!;

      expect(snapshot).toBeDefined();
      expect(snapshot?.order.userId).toBe(userId);

      const expectedMerchantIds = unique(request.items.map((item) => item.merchantId)).sort();
      const snapshotMerchantIds = unique(snapshot?.merchantTasks.map((task) => task.merchantId) ?? []).sort();

      expect(snapshotMerchantIds).toEqual(expectedMerchantIds);
      expect(snapshot?.vendorReports.length).toBe(expectedMerchantIds.length);
      expect(snapshot?.routePlan).toBeDefined();
      expect(snapshot?.dispatchInstruction).toBeDefined();
      expect(snapshot?.routePlan?.stops.length).toBeGreaterThan(0);

      const routeMerchantIds = new Set(snapshot?.routePlan?.stops.map((stop) => stop.merchantId) ?? []);
      for (const merchantId of routeMerchantIds) {
        expect(expectedMerchantIds.includes(merchantId)).toBe(true);
      }

      for (const stop of snapshot?.routePlan?.stops ?? []) {
        expect(Number.isFinite(stop.location.lat)).toBe(true);
        expect(Number.isFinite(stop.location.lng)).toBe(true);
      }
    }

    await runtime.queue.close?.();
    await runtime.store.close?.();
  });
});

function buildOrderRequest(userId: string, index: number): CreateOrderRequest {
  const baseLat = 12.90 + index * 0.01;
  const baseLng = 77.50 + index * 0.01;

  return {
    userId,
    deliveryLocation: {
      lat: baseLat,
      lng: baseLng,
      address: `Delivery address ${index}`,
    },
    items: [
      {
        itemId: `gro_${index}`,
        name: "Grocery pack",
        category: "grocery",
        merchantId: `grocery_${index}`,
        quantity: 1,
        merchantLocation: {
          lat: baseLat + 0.001,
          lng: baseLng + 0.002,
        },
      },
      {
        itemId: `food_${index}`,
        name: "Food pack",
        category: "food",
        merchantId: `food_${index}`,
        quantity: 1,
        merchantLocation: {
          lat: baseLat + 0.002,
          lng: baseLng + 0.003,
        },
      },
      {
        itemId: `elec_${index}`,
        name: "Electronics pack",
        category: "electronics",
        merchantId: `electronics_${index}`,
        quantity: 1,
        merchantLocation: {
          lat: baseLat + 0.003,
          lng: baseLng + 0.004,
        },
      },
    ],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}


