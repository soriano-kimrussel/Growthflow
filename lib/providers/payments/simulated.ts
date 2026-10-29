import { randomUUID } from "node:crypto";
import type { TenantDb } from "@/lib/db/tenant";
import type { ChargeRequest, ChargeResult, PaymentsProvider } from "./types";

/** Records a succeeded Payment row. No card is ever involved. */
export class SimulatedPaymentsProvider implements PaymentsProvider {
  readonly name = "simulated";

  constructor(private readonly db: TenantDb) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (!Number.isInteger(request.amount) || request.amount <= 0) {
      throw new Error("Amount must be a positive whole number of cents");
    }
    const externalId = `sim_pay_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const row = await this.db.payment.create({
      data: {
        subAccountId: this.db.$subAccountId,
        contactId: request.contactId,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        status: "succeeded",
        provider: this.name,
        externalId,
      },
    });
    return { paymentId: row.id, externalId, status: "succeeded", provider: this.name };
  }
}
