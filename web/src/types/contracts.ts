export type ItemCategory = "grocery" | "food" | "electronics" | "other";

export type OrderStatus =
  | "created"
  | "orchestrating"
  | "awaiting_ops"
  | "route_ready"
  | "dispatching"
  | "completed"
  | "canceled";

export type MerchantTaskStatus =
  | "pending"
  | "checking_vendor"
  | "confirmed"
  | "failed"
  | "canceled";

export type OpsTicketStatus = "open" | "in_progress" | "resolved";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryLocation extends GeoPoint {
  address: string;
}

export interface CreateOrderItemInput {
  itemId: string;
  name: string;
  category: ItemCategory;
  merchantId: string;
  quantity: number;
  merchantLocation?: GeoPoint;
}

export interface CreateOrderRequest {
  userId: string;
  deliveryLocation: DeliveryLocation;
  items: CreateOrderItemInput[];
}

export interface CreateOrderResponse {
  orderId: string;
  status: OrderStatus;
  merchantTaskCount: number;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  deliveryLocation: DeliveryLocation;
  createdAt: string;
  updatedAt: string;
  canceledAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemId: string;
  name: string;
  category: ItemCategory;
  merchantId: string;
  quantity: number;
  status: "created" | "unavailable" | "picked" | "canceled";
}

export interface MerchantTask {
  id: string;
  orderId: string;
  merchantId: string;
  merchantLocation: GeoPoint;
  taskStatus: MerchantTaskStatus;
  attemptCount: number;
  deadlineAt: string;
}

export interface VendorReport {
  orderId: string;
  merchantId: string;
  availability: "available" | "partial" | "unavailable";
  etaReadyAt: string;
  confidence: number;
  source: "ai_call" | "ai_chat" | "api" | "ops";
  reportedAt: string;
  notes?: string;
}

export interface RouteStop {
  merchantId: string;
  location: GeoPoint;
  etaArrivalAt: string;
  etaReadyAt: string;
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

export interface OpsTicket {
  id: string;
  orderId: string;
  merchantId: string;
  reason: string;
  priority: "high" | "medium" | "low";
  status: OpsTicketStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface DriverLocation {
  orderId: string;
  location: GeoPoint;
  updatedAt: string;
}

export interface OrderSnapshot {
  order: Order;
  items: OrderItem[];
  merchantTasks: MerchantTask[];
  vendorReports: VendorReport[];
  routePlan?: RoutePlan;
  dispatchInstruction?: DispatchInstruction;
  opsTickets: OpsTicket[];
  driverLocation?: DriverLocation;
}

export interface UserOrderRouteSummary {
  orderId: string;
  status: OrderStatus;
  deliveryLocation: DeliveryLocation;
  merchantLocations: Array<{
    merchantId: string;
    taskStatus: MerchantTaskStatus;
    location: GeoPoint;
  }>;
  routePlan?: RoutePlan;
  dispatchInstruction?: DispatchInstruction;
  driverLocation?: DriverLocation;
}

export interface UserRoutesResponse {
  userId: string;
  count: number;
  orders: UserOrderRouteSummary[];
}
