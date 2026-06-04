// Models for the Flitt embedded checkout flow (mirrors the .NET PaymentController DTOs).

/** Result of initiating a payment: the order id we poll on, and the Flitt checkout token. */
export interface InitiateEmbeddedPaymentResult {
  orderId: string;
  token: string;
}

// Mirrors the backend PaymentStatus enum (serialized as its name string).
export type PaymentStatusValue =
  | 'None'
  | 'Created'
  | 'Processing'
  | 'Succeeded'
  | 'Failed'
  | 'Expired'
  | 'Cancelled';

export interface PaymentStatusResult {
  orderId: string;
  serviceTokenId: string;
  status: PaymentStatusValue | string;
  amount: number;
  currency: string;
}

const FINAL_PAYMENT_STATUSES: ReadonlyArray<string> =
  ['Succeeded', 'Failed', 'Expired', 'Cancelled'];

/** True once the backend has reached a terminal state for the payment. */
export function isFinalStatus(status: string): boolean {
  return FINAL_PAYMENT_STATUSES.includes(status);
}

/** True only when funds were captured and ownership was finalized. */
export function isSuccessStatus(status: string): boolean {
  return status === 'Succeeded';
}
