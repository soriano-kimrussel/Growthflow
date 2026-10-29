import type { TenantDb } from "@/lib/db/tenant";
import type { MessagingProvider, OutboundEmail, OutboundSms, SendResult } from "./types";

/**
 * Records every message to the Message table (the Outbox) and reports success.
 * Nothing leaves the machine.
 */
export class SimulatedMessagingProvider implements MessagingProvider {
  readonly name = "simulated";

  constructor(private readonly db: TenantDb) {}

  async sendEmail(message: OutboundEmail): Promise<SendResult> {
    return this.record("email", message.subject, message);
  }

  async sendSms(message: OutboundSms): Promise<SendResult> {
    return this.record("sms", null, message);
  }

  private async record(
    channel: "email" | "sms",
    subject: string | null,
    message: OutboundSms,
  ): Promise<SendResult> {
    const row = await this.db.message.create({
      data: {
        subAccountId: this.db.$subAccountId,
        channel,
        subject,
        to: message.to,
        body: message.body,
        contactId: message.contactId,
        source: message.source,
        sourceId: message.sourceId ?? null,
        status: "sent",
        provider: this.name,
      },
    });
    return { messageId: row.id, status: "sent", provider: this.name };
  }
}
