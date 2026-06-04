import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CheckoutFlowService, CheckoutItemResult } from '../../../core/services/checkout-flow.service';

type ViewState = 'verifying' | 'done' | 'pending' | 'noSession';

/**
 * Landing page for the rare case where the embedded Flitt checkout performs a hard redirect
 * (e.g. an external 3-D Secure step) instead of resolving inline. It confirms the in-flight
 * order, then either returns to /checkout to finish any remaining items or shows the summary.
 */
@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-return.component.html',
  styleUrls: ['./payment-return.component.scss']
})
export class PaymentReturnComponent implements OnInit {
  state: ViewState = 'verifying';
  results: CheckoutItemResult[] = [];

  constructor(
    private checkoutFlow: CheckoutFlowService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const session = this.checkoutFlow.getSession();
    if (!session || !session.currentOrderId) {
      this.state = 'noSession';
      return;
    }
    this.verify();
  }

  /** Polls the current order to a terminal state, then continues or finishes. */
  verify(): void {
    this.state = 'verifying';
    this.checkoutFlow.resolveCurrent().subscribe({
      next: () => {
        if (this.checkoutFlow.hasMore()) {
          // More items to pay — resume the embedded flow on the checkout page.
          this.router.navigate(['/checkout']);
        } else {
          this.finish();
        }
      },
      error: () => {
        // Timed out / couldn't confirm. Leave the session intact so the user can retry.
        this.state = 'pending';
      }
    });
  }

  private finish(): void {
    this.results = this.checkoutFlow.results();
    this.checkoutFlow.clear();
    this.state = 'done';
  }

  get successCount(): number {
    return this.results.filter(r => r.outcome === 'success').length;
  }

  get failedCount(): number {
    return this.results.filter(r => r.outcome !== 'success').length;
  }

  goToMarketplace(): void { this.router.navigate(['/marketplace']); }
  goToCart(): void { this.router.navigate(['/cart']); }
}
