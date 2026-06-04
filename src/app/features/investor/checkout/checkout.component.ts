import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CartItem, CartService } from '../../../core/services/cart.service';
import { CheckoutFlowService, CheckoutItemResult, CheckoutQueueItem } from '../../../core/services/checkout-flow.service';
import { FlittCheckoutService } from '../../../core/services/flitt-checkout.service';
import { InvestorStateService } from '../../../core/state/investor-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';

type ViewState = 'loading' | 'empty' | 'summary' | 'paying' | 'pending' | 'done';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  state: ViewState = 'loading';

  payableItems: CartItem[] = [];
  secondaryItems: CartItem[] = [];

  currentItem: CheckoutQueueItem | null = null;
  results: CheckoutItemResult[] = [];

  private readonly CONTAINER = '#flitt-checkout';

  constructor(
    public cartService: CartService,
    private checkoutFlow: CheckoutFlowService,
    private flitt: FlittCheckoutService,
    private investorState: InvestorStateService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }

    this.cartService.load(investor.publicKey).subscribe({
      next: () => this.afterCartLoaded(),
      error: () => {
        this.afterCartLoaded();           // fall back to whatever is already in memory
        this.toast.error('Could not refresh your cart.');
      }
    });
  }

  private afterCartLoaded(): void {
    this.refreshItems();

    // Resume an in-flight checkout (e.g. after an external 3-D Secure redirect).
    if (this.checkoutFlow.hasPendingOrder() || this.checkoutFlow.hasMore()) {
      this.processQueue();
      return;
    }

    this.state = this.payableItems.length === 0 ? 'empty' : 'summary';
  }

  private refreshItems(): void {
    const items = this.cartService.items;
    this.payableItems = items.filter(i => i.market === 'primaryMarket');
    this.secondaryItems = items.filter(i => i.market !== 'primaryMarket');
  }

  get total(): number {
    return this.payableItems.reduce((sum, i) => sum + (i.token.price ?? 0), 0);
  }

  get currency(): string {
    // All tokens are priced in GEL on this platform.
    return 'GEL';
  }

  get progressText(): string {
    const s = this.checkoutFlow.getSession();
    if (!s) return '';
    return `Item ${Math.min(s.index + 1, s.queue.length)} of ${s.queue.length}`;
  }

  pay(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }

    const started = this.checkoutFlow.begin(this.cartService.items, investor.publicKey);
    if (!started) {
      this.toast.warning('There are no payable items in your cart.');
      return;
    }
    this.processQueue();
  }

  /** Pays every queued item in turn with its own embedded Flitt widget. */
  private async processQueue(): Promise<void> {
    this.state = 'paying';

    while (this.checkoutFlow.hasMore()) {
      this.currentItem = this.checkoutFlow.current;

      // If we don't yet have a token for this item (fresh item, not a resume), create the order.
      if (!this.checkoutFlow.hasPendingOrder()) {
        try {
          await firstValueFrom(this.checkoutFlow.initiateCurrent());
        } catch (err: any) {
          this.toast.error(this.errorText(err, 'Could not start the payment.'));
          this.finish();
          return;
        }
      }

      const token = this.checkoutFlow.currentToken;
      if (token) {
        await this.renderWidget(token);
      }

      try {
        await firstValueFrom(this.checkoutFlow.resolveCurrent());
      } catch {
        // Timed out waiting for a terminal status — keep the session so the buyer can retry.
        this.state = 'pending';
        return;
      }
    }

    this.finish();
  }

  /** Ensures the container is in the DOM, then mounts the Flitt widget into it. */
  private async renderWidget(token: string): Promise<void> {
    this.cdr.detectChanges();              // make sure #flitt-checkout is rendered
    await this.tick();
    try {
      await this.flitt.render(this.CONTAINER, token);
    } catch (err: any) {
      this.toast.error(this.errorText(err, 'Could not load the payment form.'));
    }
  }

  /** Continue polling / retry after a "pending" timeout. */
  retry(): void {
    this.processQueue();
  }

  private finish(): void {
    this.results = this.checkoutFlow.results();
    this.checkoutFlow.clear();
    this.currentItem = null;
    this.state = 'done';
  }

  get successCount(): number {
    return this.results.filter(r => r.outcome === 'success').length;
  }

  get failedCount(): number {
    return this.results.filter(r => r.outcome !== 'success').length;
  }

  goToCart(): void { this.router.navigate(['/cart']); }
  goToMarketplace(): void { this.router.navigate(['/marketplace']); }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }

  private tick(): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  private errorText(err: any, fallback: string): string {
    const detail = typeof err?.error === 'string' ? err.error : (err?.error?.message ?? err?.message);
    return detail ? `${fallback} ${detail}` : fallback;
  }
}
