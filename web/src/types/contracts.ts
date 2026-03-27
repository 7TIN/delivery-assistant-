export type OrderStatus =
  | "created"
  | "orchestrating"
  | "awaiting_ops"
  | "route_ready"
  | "dispatching"
  | "completed"
  | "canceled";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryLocation extends GeoPoint {
  address: string;
}

export interface MerchantItem {
  merchantId: string;
  merchantName: string;
  merchantType: "grocery" | "restaurant" | "electronics" | "pharmacy";
  itemName: string;
  quantity: number;
  price: number;
  location: GeoPoint;
  estimatedPrepTime: number; // minutes
}

export interface RouteStop {
  merchantId: string;
  merchantName: string;
  merchantType: MerchantItem["merchantType"];
  location: GeoPoint;
  etaArrivalAt: string;
  etaReadyAt: string;
  status: "pending" | "arrived" | "picked_up";
}

export interface RoutePlan {
  orderId: string;
  version: number;
  stops: RouteStop[];
  estimatedCompletionAt: string;
  objectiveScore: number;
  generatedAt: string;
}

export interface DispatchInstruction {
  orderId: string;
  routeVersion: number;
  nextStop?: RouteStop;
  pickupNotes: string;
  etaToNextStopMinutes: number;
  issuedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  items: MerchantItem[];
  deliveryLocation: DeliveryLocation;
  routePlan?: RoutePlan;
  dispatchInstruction?: DispatchInstruction;
  createdAt: string;
  updatedAt: string;
}
