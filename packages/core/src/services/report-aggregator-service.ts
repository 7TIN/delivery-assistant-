import type { MerchantTask, VendorReport } from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";

export class ReportAggregatorService {
  private readonly lastPublishedSignatures = new Map<string, string>();

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

      const snapshot = await this.store.getSnapshot(orderId);
      if (!snapshot || snapshot.order.status === "canceled") {
        return;
      }

      if (snapshot.vendorReports.length === 0) {
        return;
      }

      const hasPendingChecks = snapshot.merchantTasks.some((task) =>
        task.taskStatus === "pending" || task.taskStatus === "checking_vendor",
      );

      // For initial routing, wait until the first confirmation cycle finishes.
      // Once a route exists, allow replan events on new report changes.
      if (hasPendingChecks && !snapshot.routePlan) {
        return;
      }

      const signature = buildRouteSignalSignature(snapshot.merchantTasks, snapshot.vendorReports);
      const previousSignature = this.lastPublishedSignatures.get(orderId);

      if (previousSignature === signature) {
        return;
      }

      this.lastPublishedSignatures.set(orderId, signature);

      await this.queue.publish("route.plan.requested", {
        orderId,
      });
    });
  }
}

function buildRouteSignalSignature(
  tasks: MerchantTask[],
  reports: VendorReport[],
): string {
  const taskPart = tasks
    .map((task) => `${task.merchantId}:${task.taskStatus}`)
    .sort()
    .join("|");

  const reportPart = reports
    .map(
      (report) =>
        `${report.merchantId}:${report.availability}:${report.etaReadyAt}:${report.confidence.toFixed(2)}:${report.source}`,
    )
    .sort()
    .join("|");

  return `${taskPart}::${reportPart}`;
}
