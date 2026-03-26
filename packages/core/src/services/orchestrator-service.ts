import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";

export class OrchestratorService {
  constructor(
    private readonly store: OrderStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("order.created", async ({ orderId }) => {
      const order = await this.store.getOrder(orderId);
      if (!order || order.status === "canceled") {
        return;
      }

      const merchantTasks = await this.store.getMerchantTasks(orderId);
      for (const task of merchantTasks) {
        await this.store.setMerchantTaskStatus(orderId, task.id, "checking_vendor");

        await this.queue.publish("vendor.check.requested", {
          orderId,
          merchantTask: {
            ...task,
            taskStatus: "checking_vendor",
            attemptCount: task.attemptCount + 1,
          },
        });
      }
    });
  }
}
