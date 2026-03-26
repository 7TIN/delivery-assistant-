import type { QueueBroker } from "../../../queue/src";
import { InMemoryStore } from "../store";

export class OrchestratorService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("order.created", async ({ orderId }) => {
      const order = this.store.getOrder(orderId);
      if (!order || order.status === "canceled") {
        return;
      }

      const merchantTasks = this.store.getMerchantTasks(orderId);
      for (const task of merchantTasks) {
        this.store.setMerchantTaskStatus(orderId, task.id, "checking_vendor");

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
