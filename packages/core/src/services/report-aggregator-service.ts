import type { QueueBroker } from "../../../queue/src";
import { InMemoryStore } from "../store";

export class ReportAggregatorService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("vendor.report.ready", async ({ orderId, report }) => {
      const order = this.store.getOrder(orderId);
      if (!order || order.status === "canceled") {
        return;
      }

      this.store.upsertVendorReport(report);

      await this.queue.publish("route.plan.requested", {
        orderId,
      });
    });
  }
}
