import type { QueueBroker } from "../../../queue/src";
import { InMemoryStore } from "../store";

export class OpsFallbackService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly queue: QueueBroker,
  ) {}

  register(): void {
    this.queue.subscribe("ops.ticket.created", async ({ ticket }) => {
      this.store.addOpsTicket(ticket);
    });
  }
}
