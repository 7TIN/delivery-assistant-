import type { QueueBroker } from "../../../queue/src";
import type { OrderStore } from "../store";

export class OpsFallbackService {
  constructor(
    private readonly store: OrderStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("ops.ticket.created", async ({ ticket }) => {
      await this.store.addOpsTicket(ticket);
    });
  }
}
