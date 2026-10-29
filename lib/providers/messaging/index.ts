import type { TenantDb } from "@/lib/db/tenant";
import { SimulatedMessagingProvider } from "./simulated";
import type { MessagingProvider } from "./types";

export type * from "./types";

/**
 * Picks the messaging implementation from MESSAGING_PROVIDER. To add a real
 * provider (Resend, Twilio, ...), implement MessagingProvider in this folder
 * and add a case here. No caller changes.
 */
export function getMessagingProvider(db: TenantDb): MessagingProvider {
  const name = process.env.MESSAGING_PROVIDER ?? "simulated";
  switch (name) {
    case "simulated":
      return new SimulatedMessagingProvider(db);
    default:
      throw new Error(`Unknown MESSAGING_PROVIDER "${name}"`);
  }
}
