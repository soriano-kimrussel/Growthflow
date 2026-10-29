import type { TenantDb } from "@/lib/db/tenant";
import { SimulatedPaymentsProvider } from "./simulated";
import type { PaymentsProvider } from "./types";

export type * from "./types";

/** Picks the payments implementation from PAYMENTS_PROVIDER. */
export function getPaymentsProvider(db: TenantDb): PaymentsProvider {
  const name = process.env.PAYMENTS_PROVIDER ?? "simulated";
  switch (name) {
    case "simulated":
      return new SimulatedPaymentsProvider(db);
    default:
      throw new Error(`Unknown PAYMENTS_PROVIDER "${name}"`);
  }
}
