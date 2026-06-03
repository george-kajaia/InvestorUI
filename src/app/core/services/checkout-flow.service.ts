import { Injectable } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { concatMap, filter, map, take, tap, timeout } from 'rxjs/operators';
import { CartItem, CartService } from './cart.service';
import { PaymentApiService } from '../api/payment-api.service';
import { PaymentStatusResult, isFinalStatus } from '../../shared/models/payment.model';

export interface CheckoutQueueItem {
  tokenId: string;
  rowVersion: number;
  productName: string;
  companyName: string;
  price: number;
}

export interface CheckoutItemResult {
  tokenId: string;
  productName: string;
  payId?: string;
  outcome: 'success' | 'failed' | 'cancelled';
}

interface CheckoutSession {
  publicKey: string;
  queue: CheckoutQueueItem[];
  index: number;
  currentPayId?: string;
  results: CheckoutItemResult[];
}

/**
 * Drives the checkout across the TBC redirect round-trip. Because TBC processes one
 * payment per redirect, cart items are paid sequentially: the session (queue + progress)
 * is persisted to sessionStorage so it survives the redirect back to /payment/return.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlowService {
  private readonly KEY = 'checkout_session';
  private readonly POLL_INTERVAL_MS = 2000;
  private readonly POLL_TIMEOUT_MS = 60000;

  constructor(
    private paymentApi: PaymentApiService,
    private cart: CartService
  ) {}

  // ── session persistence ──────────────────────────────────────────────────
  getSession(): CheckoutSession | null {
    try {
      const raw = sessionStorage.getItem(this.KEY);
      return raw ? (JSON.parse(raw) as CheckoutSession) : null;
    } catch {
      return null;
    }
  }

  private save(session: CheckoutSession): void {
    try { sessionStorage.setItem(this.KEY, JSON.stringify(session)); } catch { /* ignore */ }
  }

  clear(): void {
    try { sessionStorage.removeItem(this.KEY); } catch { /* ignore */ }
  }

  // ── flow ────────────────────────────────────────────────────────────────
  /**
   * Builds a checkout session from the primary-market items in the cart.
   * Returns false if there is nothing payable (only secondary-market items, or empty).
   */
  begin(items: CartItem[], publicKey: string): boolean {
    const queue: CheckoutQueueItem[] = items
      .filter(i => i.market === 'primaryMarket')
      .map(i => ({
        tokenId: i.token.id,
        rowVersion: i.token.rowVersion,
        productName: i.token.productName,
        companyName: i.token.companyName,
        price: i.token.price
      }));

    if (queue.length === 0) return false;

    this.save({ publicKey, queue, index: 0, results: [] });
    return true;
  }

  get current(): CheckoutQueueItem | null {
    const s = this.getSession();
    if (!s || s.index >= s.queue.length) return null;
    return s.queue[s.index];
  }

  hasMore(): boolean {
    const s = this.getSession();
    return !!s && s.index < s.queue.length;
  }

  results(): CheckoutItemResult[] {
    return this.getSession()?.results ?? [];
  }

  /**
   * Initiates the payment for the current queue item and redirects the browser to the
   * TBC checkout page. The returned observable completes just before the redirect.
   */
  initiateCurrent(): Observable<void> {
    const s = this.getSession();
    if (!s) return throwError(() => new Error('No active checkout session.'));
    if (s.index >= s.queue.length) return of(undefined);

    const item = s.queue[s.index];
    return this.paymentApi
      .initiatePrimaryPayment(item.tokenId, item.rowVersion, s.publicKey)
      .pipe(
        tap(res => {
          if (!res.approvalUrl) {
            throw new Error('No checkout URL returned by the bank.');
          }
          s.currentPayId = res.payId;
          this.save(s);
          window.location.href = res.approvalUrl;
        }),
        map(() => undefined)
      );
  }

  /**
   * Polls the current payId until a terminal status, records the outcome, drops the
   * token from the cart on success, and advances the queue.
   */
  resolveCurrent(): Observable<CheckoutItemResult> {
    const s = this.getSession();
    if (!s || !s.currentPayId) {
      return throwError(() => new Error('No payment to resolve.'));
    }

    const payId = s.currentPayId;
    const item = s.queue[s.index];

    return this.pollUntilFinal(payId).pipe(
      map(status => {
        const outcome: CheckoutItemResult['outcome'] =
          status.status === 'Succeeded' ? 'success'
            : status.status === 'Cancelled' ? 'cancelled'
              : 'failed';

        const result: CheckoutItemResult = {
          tokenId: item.tokenId,
          productName: item.productName,
          payId,
          outcome
        };

        if (outcome === 'success') {
          this.cart.removeLocal(item.tokenId);
        }

        s.results.push(result);
        s.index += 1;
        s.currentPayId = undefined;
        this.save(s);
        return result;
      })
    );
  }

  private pollUntilFinal(payId: string): Observable<PaymentStatusResult> {
    return timer(0, this.POLL_INTERVAL_MS).pipe(
      concatMap(() => this.paymentApi.getStatus(payId)),
      filter(r => isFinalStatus(r.status)),   // ignore non-terminal states
      take(1),                                // complete on the first terminal status
      timeout({ first: this.POLL_TIMEOUT_MS }) // error if none arrives in time → caller shows "still processing"
    );
  }
}
