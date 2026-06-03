import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartItem, CartService } from '../../../core/services/cart.service';
import { CheckoutFlowService } from '../../../core/services/checkout-flow.service';
import { InvestorStateService } from '../../../core/state/investor-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  loading = false;       // loading the cart
  redirecting = false;   // initiating payment / redirecting to TBC

  payableItems: CartItem[] = [];
  secondaryItems: CartItem[] = [];

  constructor(
    public cartService: CartService,
    private checkoutFlow: CheckoutFlowService,
    private investorState: InvestorStateService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }

    this.loading = true;
    this.cartService.load(investor.publicKey).subscribe({
      next: () => { this.refreshItems(); this.loading = false; },
      error: () => {
        this.refreshItems();           // fall back to whatever is already in memory
        this.loading = false;
        this.toast.error('Could not refresh your cart.');
      }
    });
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

  pay(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }

    if (this.payableItems.length === 0) {
      this.toast.warning('There are no payable items in your cart.');
      return;
    }

    const started = this.checkoutFlow.begin(this.cartService.items, investor.publicKey);
    if (!started) {
      this.toast.warning('There are no payable items in your cart.');
      return;
    }

    this.redirecting = true;
    // Initiates the first payment and redirects to the TBC checkout page.
    this.checkoutFlow.initiateCurrent().subscribe({
      error: (err) => {
        this.redirecting = false;
        this.checkoutFlow.clear();
        const detail = typeof err?.error === 'string' ? err.error : (err?.error?.message ?? err?.message);
        this.toast.error(detail ? `Payment could not start: ${detail}` : 'Could not start the payment. Please try again.');
      }
    });
  }

  goToCart(): void { this.router.navigate(['/cart']); }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }
}
