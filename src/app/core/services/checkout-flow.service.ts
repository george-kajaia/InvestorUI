import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { concatMap, filter, map, take, tap, timeout } from 'rxjs/operators';
import { CartItem, CartService } from './cart.service';
import { PaymentApiService } from '../api/payment-api.service';
import {
  InitiateEmbeddedPaymentResult,
  PaymentStatusResult,
  isFinalStatus
} from '../../shared/models/payment.model';

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
  orderId?: string;
  outcome: 'success' | 'failed' | 'cancelled';
}

interface CheckoutSession {
  publicKey: string;
  queue: CheckoutQueueItem[];
  index: number;
  currentOrderId?: string;
  currentToken?: string;
  results: CheckoutItemResult[];
}

/**
 * Drives an embedded Flitt checkout across the cart. The buyer never leaves the page: each
 * primary-market item is paid in turn by rendering the Flitt widget with a fresh order token
 * and polling the backend until the order reaches a terminal status. The session (queue +
 * progress) is persisted to sessionStorage so it can be resumed if a hard redirect ever occurs
 * (e.g. an external 3-D Secure step that lands back on /payment/return).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlowService {
  private readonly KEY = 'checkout_session';
  private readonly POLL_INTERVAL_MS = 2000;
  private readonly POLL_TIMEOUT_MS = 600000; // 10 min — buyer may be entering card / 3DS

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
   * Creates the Flitt order for the current queue item and returns the checkout token the
   * caller renders into the embedded widget. The order id is stored for polling.
   */
  initiateCurrent(): Observable<InitiateEmbeddedPaymentResult> {
    const s = this.getSession();
    if (!s) return throwError(() => new Error('No active checkout session.'));
    if (s.index >= s.queue.length) return throwError(() => new Error('Nothing left to pay.'));

    const item = s.queue[s.index];
    return this.paymentApi
      .initiateEmbeddedPayment(item.tokenId, item.rowVersion, s.publicKey)
      .pipe(
        tap(res => {
          if (!res.token) throw new Error('No checkout token returned.');
          s.currentOrderId = res.orderId;
          s.currentToken = res.token;
          this.save(s);
        })
      );
  }

  /** The Flitt checkout token for the in-flight order, if any (used to (re)render the widget). */
  get currentToken(): string | null {
    return this.getSession()?.currentToken ?? null;
  }

  /** True when an order has been initiated and is awaiting a terminal status. */
  hasPendingOrder(): boolean {
    return !!this.getSession()?.currentOrderId;
  }

  /**
   * Polls the current order until it reaches a terminal status, records the outcome, drops the
   * token from the cart on success, and advances the queue.
   */
  resolveCurrent(): Observable<CheckoutItemResult> {
    const s = this.getSession();
    if (!s || !s.currentOrderId) {
      return throwError(() => new Error('No payment to resolve.'));
    }

    const orderId = s.currentOrderId;
    const item = s.queue[s.index];

    return this.pollUntilFinal(orderId).pipe(
      map(status => {
        const outcome: CheckoutItemResult['outcome'] =
          status.status === 'Succeeded' ? 'success'
            : status.status === 'Cancelled' ? 'cancelled'
              : 'failed';

        const result: CheckoutItemResult = {
          tokenId: item.tokenId,
          productName: item.productName,
          orderId,
          outcome
        };

        if (outcome === 'success') {
          this.cart.removeLocal(item.tokenId);
        }

        s.results.push(result);
        s.index += 1;
        s.currentOrderId = undefined;
        s.currentToken = undefined;
        this.save(s);
        return result;
      })
    );
  }

  private pollUntilFinal(orderId: string): Observable<PaymentStatusResult> {
    return timer(0, this.POLL_INTERVAL_MS).pipe(
      concatMap(() => this.paymentApi.getStatus(orderId)),
      filter(r => isFinalStatus(r.status)),   // ignore non-terminal states
      take(1),                                // complete on the first terminal status
      timeout({ first: this.POLL_TIMEOUT_MS })
    );
  }
}
