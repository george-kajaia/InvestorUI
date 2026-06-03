// Models for the TBC payment flow (mirrors the .NET PaymentController DTOs).

export interface InitiatePaymentResult {
  payId: string;
  approvalUrl: string;
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
  payId: string;
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
