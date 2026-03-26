import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";

export class ReportAggregatorService {
  constructor(
    private readonly store: OrderStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("vendor.report.ready", async ({ orderId, report }) => {
      const order = await this.store.getOrder(orderId);
      if (!order || order.status === "canceled") {
        return;
      }

      await this.store.upsertVendorReport(report);

      await this.queue.publish("route.plan.requested", {
        orderId,
      });
    });
  }
}
