export interface ChargeRequest {
  contactId: string | null;
  /** Amount in the smallest currency unit (cents). */
  amount: number;
  currency: string;
  description: string;
}

export interface ChargeResult {
  paymentId: string;
  externalId: string;
  status: "succeeded" | "failed";
  provider: string;
}

/** The only way the app takes money. See getPaymentsProvider(). */
export interface PaymentsProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
