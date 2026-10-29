export type MessageSource = "campaign" | "workflow" | "manual" | "system";

export interface OutboundBase {
  /** Contact the message is about, when there is one (null for e.g. invites). */
  contactId: string | null;
  to: string;
  body: string;
  source: MessageSource;
  /** Id of the campaign / workflow that produced the message. */
  sourceId?: string | null;
}

export interface OutboundEmail extends OutboundBase {
  subject: string;
}

export type OutboundSms = OutboundBase;

export interface SendResult {
  messageId: string;
  status: "sent" | "failed";
  provider: string;
}

/**
 * The only way the app sends email or SMS. Callers get an instance from
 * `getMessagingProvider(db)` and never know which implementation they hold.
 *
 * A provider is bound to one sub-account's tenant client, so whatever it
 * records (the outbox row, a delivery log) stays inside that tenant.
 */
export interface MessagingProvider {
  readonly name: string;
  sendEmail(message: OutboundEmail): Promise<SendResult>;
  sendSms(message: OutboundSms): Promise<SendResult>;
}
