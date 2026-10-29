import type { TenantDb } from "@/lib/db/tenant";
import { getMessagingProvider, type MessageSource } from "@/lib/providers/messaging";
import { renderTemplate, type MergeContact } from "@/lib/templates";
import { logActivity } from "@/modules/timeline/service";

export interface SendToContactInput {
  contact: MergeContact & { id: string };
  channel: "email" | "sms";
  subject?: string | null;
  body: string;
  source: MessageSource;
  sourceId?: string | null;
  /** Shown on the timeline, e.g. `campaign "Welcome"`. */
  via?: string;
}

export type SendOutcome = { sent: true; messageId: string } | { sent: false; reason: string };

/**
 * Renders merge fields, sends through the configured messaging provider, and
 * records the result on the contact's timeline. A contact without the needed
 * address is skipped (and the skip is logged) rather than treated as an error.
 */
export async function sendToContact(db: TenantDb, input: SendToContactInput): Promise<SendOutcome> {
  const { contact, channel } = input;
  const to = channel === "email" ? contact.email : contact.phone;
  const label = channel === "email" ? "Email" : "SMS";
  const via = input.via ? ` (${input.via})` : "";

  if (!to) {
    const reason = `No ${channel === "email" ? "email address" : "phone number"} on file`;
    await logActivity(db, contact.id, "message_sent", `${label} skipped${via}`, reason);
    return { sent: false, reason };
  }

  const provider = getMessagingProvider(db);
  const body = renderTemplate(input.body, contact);
  const base = { contactId: contact.id, to, body, source: input.source, sourceId: input.sourceId };
  const result =
    channel === "email"
      ? await provider.sendEmail({ ...base, subject: renderTemplate(input.subject ?? "", contact) })
      : await provider.sendSms(base);

  if (result.status !== "sent") {
    await logActivity(db, contact.id, "message_sent", `${label} failed${via}`, `Provider: ${result.provider}`);
    return { sent: false, reason: "Provider reported a failure" };
  }
  const title =
    channel === "email" ? `Email sent: ${renderTemplate(input.subject ?? "", contact)}` : `SMS sent to ${to}`;
  await logActivity(db, contact.id, "message_sent", `${title}${via}`, body.slice(0, 280));
  return { sent: true, messageId: result.messageId };
}

export function listOutbox(db: TenantDb, opts: { channel?: "email" | "sms"; take?: number } = {}) {
  return db.message.findMany({
    where: opts.channel ? { channel: opts.channel } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.take ?? 100,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}
