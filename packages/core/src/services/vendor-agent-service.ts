import type { OpsTicket, VendorReport } from "../../../contracts/src";
import type { QueueBroker } from "../../../queue/src";
import { InMemoryStore } from "../store";
import { addMinutes, isoNow, simpleHash } from "../utils";

interface VendorAgentOptions {
  minConfidence?: number;
}

export class VendorAgentService {
  private readonly minConfidence: number;

  constructor(
    private readonly store: InMemoryStore,
    private readonly queue: QueueBroker,
    options: VendorAgentOptions = {},
  ) {
    this.minConfidence = options.minConfidence ?? 0.65;
  }

  register(): void {
    this.queue.subscribe("vendor.check.requested", async ({ orderId, merchantTask }) => {
      const order = this.store.getOrder(orderId);
      if (!order || order.status === "canceled") {
        return;
      }

      const orderItems = this.store.getOrderItemsByMerchant(orderId, merchantTask.merchantId);
      const report = buildVendorReport({
        orderId,
        merchantId: merchantTask.merchantId,
        categories: orderItems.map((item) => item.category),
      });

      if (report.confidence < this.minConfidence) {
        this.store.setMerchantTaskStatus(orderId, merchantTask.id, "failed");
        const ticket = buildOpsTicket(orderId, merchantTask.merchantId, report.confidence);

        await this.queue.publish("ops.ticket.created", {
          orderId,
          ticket,
        });

        return;
      }

      this.store.setMerchantTaskStatus(orderId, merchantTask.id, "confirmed");

      await this.queue.publish("vendor.report.ready", {
        orderId,
        report,
      });
    });
  }
}

function buildVendorReport(input: {
  orderId: string;
  merchantId: string;
  categories: string[];
}): VendorReport {
  const baseReadyMinutes = pickReadyMinutes(input.categories);
  const seed = simpleHash(`${input.orderId}:${input.merchantId}`);
  const jitter = seed % 6;

  return {
    orderId: input.orderId,
    merchantId: input.merchantId,
    availability: "available",
    etaReadyAt: addMinutes(isoNow(), baseReadyMinutes + jitter),
    confidence: deriveConfidence(seed),
    source: seed % 2 === 0 ? "ai_chat" : "ai_call",
    reportedAt: isoNow(),
    notes: "Automated vendor confirmation completed.",
  };
}

function buildOpsTicket(orderId: string, merchantId: string, confidence: number): OpsTicket {
  return {
    id: crypto.randomUUID(),
    orderId,
    merchantId,
    reason: `Low-confidence vendor response (${confidence.toFixed(2)}).`,
    priority: "high",
    status: "open",
    createdAt: isoNow(),
  };
}

function pickReadyMinutes(categories: string[]): number {
  if (categories.includes("food")) {
    return 25;
  }
  if (categories.includes("electronics")) {
    return 12;
  }
  return 6;
}

function deriveConfidence(seed: number): number {
  const min = 0.58;
  const max = 0.96;
  const normalized = (seed % 100) / 100;
  return Number((min + normalized * (max - min)).toFixed(2));
}
