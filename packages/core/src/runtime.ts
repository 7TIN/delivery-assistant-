import { createQueueBroker, type QueueBroker } from "../../queue/src";
import { createTravelEstimator } from "./routing/travel-estimator";
import { DispatchService } from "./services/dispatch-service";
import { OpsFallbackService } from "./services/ops-fallback-service";
import { OrchestratorService } from "./services/orchestrator-service";
import { OrderApiService } from "./services/order-api-service";
import { ReportAggregatorService } from "./services/report-aggregator-service";
import { RoutePlannerService } from "./services/route-planner-service";
import { VendorAgentService } from "./services/vendor-agent-service";
import { InMemoryStore } from "./store";

export interface RuntimeServices {
  orderApi: OrderApiService;
  orchestrator: OrchestratorService;
  vendorAgent: VendorAgentService;
  reportAggregator: ReportAggregatorService;
  routePlanner: RoutePlannerService;
  dispatch: DispatchService;
  opsFallback: OpsFallbackService;
}

export interface RuntimeContext {
  store: InMemoryStore;
  queue: QueueBroker;
  services: RuntimeServices;
}

export function createRuntimeContext(): RuntimeContext {
  const store = new InMemoryStore();
  const queue = createQueueBroker();
  const travelEstimator = createTravelEstimator();

  const services: RuntimeServices = {
    orderApi: new OrderApiService(store, queue),
    orchestrator: new OrchestratorService(store, queue),
    vendorAgent: new VendorAgentService(store, queue),
    reportAggregator: new ReportAggregatorService(store, queue),
    routePlanner: new RoutePlannerService(store, queue, travelEstimator),
    dispatch: new DispatchService(store),
    opsFallback: new OpsFallbackService(store, queue),
  };

  return {
    store,
    queue,
    services,
  };
}

export function registerAllWorkers(context: RuntimeContext): void {
  context.services.orchestrator.register();
  context.services.vendorAgent.register();
  context.services.reportAggregator.register();
  context.services.routePlanner.register();
  context.services.opsFallback.register();

  context.queue.subscribe("route.plan.updated", ({ orderId }) => {
    context.services.dispatch.handleRouteUpdate(orderId);
  });
}
