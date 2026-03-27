import type { MerchantItem, Order, RoutePlan, DispatchInstruction } from "@/types/contracts";

// Demo merchants around San Francisco
export const demoMerchants: MerchantItem[] = [
  {
    merchantId: "m1",
    merchantName: "Fresh Mart Grocery",
    merchantType: "grocery",
    itemName: "Weekly Essentials Pack",
    quantity: 1,
    price: 45.99,
    location: { lat: 37.7849, lng: -122.4094 },
    estimatedPrepTime: 5,
  },
  {
    merchantId: "m2",
    merchantName: "Sakura Ramen House",
    merchantType: "restaurant",
    itemName: "Tonkotsu Ramen",
    quantity: 2,
    price: 16.5,
    location: { lat: 37.7752, lng: -122.4183 },
    estimatedPrepTime: 20,
  },
  {
    merchantId: "m3",
    merchantName: "TechZone Electronics",
    merchantType: "electronics",
    itemName: "USB-C Hub Adapter",
    quantity: 1,
    price: 34.99,
    location: { lat: 37.7899, lng: -122.4014 },
    estimatedPrepTime: 3,
  },
  {
    merchantId: "m4",
    merchantName: "City Pharmacy",
    merchantType: "pharmacy",
    itemName: "Vitamin D Supplements",
    quantity: 1,
    price: 12.99,
    location: { lat: 37.7831, lng: -122.4159 },
    estimatedPrepTime: 4,
  },
  {
    merchantId: "m5",
    merchantName: "Green Bowl Cafe",
    merchantType: "restaurant",
    itemName: "Acai Bowl",
    quantity: 1,
    price: 13.5,
    location: { lat: 37.7780, lng: -122.4120 },
    estimatedPrepTime: 10,
  },
  {
    merchantId: "m6",
    merchantName: "Whole Basket Organics",
    merchantType: "grocery",
    itemName: "Organic Fruit Box",
    quantity: 1,
    price: 29.99,
    location: { lat: 37.7870, lng: -122.4050 },
    estimatedPrepTime: 5,
  },
];

export const demoDeliveryLocation = {
  lat: 37.7749,
  lng: -122.4194,
  address: "123 Market St, San Francisco, CA 94103",
};

function makeRoutePlan(orderId: string, items: MerchantItem[]): RoutePlan {
  const now = new Date();
  const stops = items.map((item, i) => ({
    merchantId: item.merchantId,
    merchantName: item.merchantName,
    merchantType: item.merchantType,
    location: item.location,
    etaArrivalAt: new Date(now.getTime() + (i + 1) * 8 * 60000).toISOString(),
    etaReadyAt: new Date(now.getTime() + (i + 1) * 6 * 60000).toISOString(),
    status: i === 0 ? "arrived" as const : "pending" as const,
  }));

  return {
    orderId,
    version: 1,
    stops,
    estimatedCompletionAt: new Date(now.getTime() + (items.length + 1) * 10 * 60000).toISOString(),
    objectiveScore: 0.87,
    generatedAt: now.toISOString(),
  };
}

function makeDispatchInstruction(orderId: string, plan: RoutePlan): DispatchInstruction {
  return {
    orderId,
    routeVersion: plan.version,
    nextStop: plan.stops[0],
    pickupNotes: `Head to ${plan.stops[0].merchantName}. Order is being prepared. ETA ${Math.round((new Date(plan.stops[0].etaReadyAt).getTime() - Date.now()) / 60000)} min.`,
    etaToNextStopMinutes: 4,
    issuedAt: new Date().toISOString(),
  };
}

export function createDemoOrder(items: MerchantItem[]): Order {
  const id = `ord_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  return {
    id,
    userId: "user_demo",
    status: "created",
    items,
    deliveryLocation: demoDeliveryLocation,
    createdAt: now,
    updatedAt: now,
  };
}

// Pre-made demo orders for the dashboard
const demoItems1 = [demoMerchants[0], demoMerchants[1], demoMerchants[2]];
const demoItems2 = [demoMerchants[3], demoMerchants[4]];

const plan1 = makeRoutePlan("ord_demo1", demoItems1);
const plan2 = makeRoutePlan("ord_demo2", demoItems2);

export const seedOrders: Order[] = [
  {
    id: "ord_demo1",
    userId: "user_demo",
    status: "dispatching",
    items: demoItems1,
    deliveryLocation: demoDeliveryLocation,
    routePlan: plan1,
    dispatchInstruction: makeDispatchInstruction("ord_demo1", plan1),
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ord_demo2",
    userId: "user_demo",
    status: "route_ready",
    items: demoItems2,
    deliveryLocation: demoDeliveryLocation,
    routePlan: plan2,
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ord_demo3",
    userId: "user_demo",
    status: "completed",
    items: [demoMerchants[5]],
    deliveryLocation: demoDeliveryLocation,
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 80 * 60000).toISOString(),
  },
];
