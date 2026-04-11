import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../../core/services/cart.service';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { InvestorStateService } from '../../../core/state/investor-state.service';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type ItemStatus = 'pending' | 'processing' | 'success' | 'error';

export interface CheckoutItemState {
  item: CartItem;
  status: ItemStatus;
  errorMsg: string;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent {
  checkoutStarted = false;
  checkoutDone = false;
  checkoutLoading = false;
  checkoutStates: CheckoutItemState[] = [];

  constructor(
    public cartService: CartService,
    private serviceTokenApi: ServiceTokenApiService,
    private investorState: InvestorStateService,
    private router: Router
  ) {}

  goBack() { this.router.navigate(['/marketplace']); }

  checkout() {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }

    const primaryItems = this.cartService.items.filter(i => i.market === 'primaryMarket');
    if (primaryItems.length === 0) return;

    this.checkoutStarted = true;
    this.checkoutLoading = true;

    // Build per-item state list (only primary market items participate in checkout)
    this.checkoutStates = primaryItems.map(item => ({
      item,
      status: 'pending' as ItemStatus,
      errorMsg: ''
    }));

    // Process each item sequentially so rowVersion conflicts are minimised
    this.processNext(0, investor.publicKey);
  }

  private processNext(index: number, publicKey: string) {
    if (index >= this.checkoutStates.length) {
      this.checkoutLoading = false;
      this.checkoutDone = true;

      // Remove successfully purchased items from cart
      const successIds = this.checkoutStates
        .filter(s => s.status === 'success')
        .map(s => s.item.token.id);
      successIds.forEach(id => this.cartService.remove(id));
      return;
    }

    const state = this.checkoutStates[index];
    state.status = 'processing';

    this.serviceTokenApi
      .buyPrimaryServiceToken(state.item.token.id, state.item.token.rowVersion, publicKey)
      .pipe(catchError(err => {
        state.status = 'error';
        const msg = err?.error;
        state.errorMsg = typeof msg === 'string' ? msg : (msg?.message ?? 'Purchase failed.');
        return of(null);
      }))
      .subscribe(result => {
        if (state.status !== 'error') {
          state.status = 'success';
        }
        this.processNext(index + 1, publicKey);
      });
  }

  remove(id: string) { this.cartService.remove(id); }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }

  scheduleLabel(token: ServiceTokenDto): string {
    const st = token.scheduleType;
    if (!st) return '—';
    const labels: Record<number, string> = { 0: 'None', 1: 'Daily', 2: 'Weekly', 3: 'Monthly', 4: 'Yearly' };
    const base = labels[st.periodType] ?? `Period ${st.periodType}`;
    return st.periodNumber > 0 ? `${base} / ${st.periodNumber}` : base;
  }

  get hasPrimaryItems(): boolean {
    return this.cartService.items.some(i => i.market === 'primaryMarket');
  }

  get allDone(): boolean {
    return this.checkoutStates.every(s => s.status === 'success' || s.status === 'error');
  }

  get successCount(): number { return this.checkoutStates.filter(s => s.status === 'success').length; }
  get errorCount(): number   { return this.checkoutStates.filter(s => s.status === 'error').length; }
}
