import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { InvestorStateService } from '../../../core/state/investor-state.service';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { CartService, CartMarket } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';

import { Company } from '../../../shared/models/company.model';
import { ScheduleType } from '../../../shared/models/product.model';
import { ServiceTokenDto, ServiceTokenStatus } from '../../../shared/models/service-token.model';
import { GetServiceComponent, ServiceResult } from '../get-service/get-service.component';

export type MarketplaceTab = 'yourTokens' | 'primaryMarket' | 'secondaryMarket';

@Component({
  selector: 'app-investor-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GetServiceComponent],
  templateUrl: './investor-marketplace.component.html',
  styleUrls: ['./investor-marketplace.component.scss']
})
export class InvestorMarketplaceComponent implements OnInit {
  activeTab: MarketplaceTab = 'yourTokens';
  investorPublicKey = '';
  investorName = '';
  companies: Company[] = [];

  marketCompanyId = -1;
  marketRequestId = -1;

  yourTokens: ServiceTokenDto[] = [];
  filteredYourTokens: ServiceTokenDto[] = [];
  primaryMarketTokens: ServiceTokenDto[] = [];
  secondaryMarketTokens: ServiceTokenDto[] = [];

  loading = false;

  // Token detail modal
  detailToken: ServiceTokenDto | null = null;
  detailTab: MarketplaceTab = 'primaryMarket';

  // Get Service QR overlay
  getServiceToken: ServiceTokenDto | null = null;

  private toast = inject(ToastService);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private investorState: InvestorStateService,
    private companyApi: CompanyApiService,
    private serviceTokenApi: ServiceTokenApiService,
    public cartService: CartService
  ) {}

  ngOnInit(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }
    this.investorPublicKey = investor.publicKey;
    this.investorName = investor.userName;
    this.loadCompanies();

    // Check query params — e.g. from home page click after login
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as MarketplaceTab | undefined;
      const openToken = params['openToken'] as string | undefined;

      if (tab === 'primaryMarket') {
        this.activeTab = 'primaryMarket';
        this.loadPrimaryMarket(false, openToken);
      } else if (tab === 'secondaryMarket') {
        this.activeTab = 'secondaryMarket';
        this.loadSecondaryMarket();
      } else {
        this.loadYourTokens();
      }
    });

    // Clear pending token after handling
    this.investorState.pendingTokenId = null;
  }

  setTab(tab: MarketplaceTab) {
    this.activeTab = tab;
    if (tab === 'yourTokens') this.loadYourTokens();
    else if (tab === 'primaryMarket') this.loadPrimaryMarket();
    else this.loadSecondaryMarket();
  }

  loadCompanies() {
    this.companyApi.getAll(0, 500, null).subscribe({
      next: list => this.companies = list ?? [],
      error: err => console.error(err)
    });
  }

  loadYourTokens(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getInvestorServiceTokens(this.investorPublicKey).subscribe({
      next: list => {
        this.yourTokens = list ?? [];
        this.applyLocalYourTokensFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        if (!silent) this.toast.errorWithRetry('Failed to load your tokens.', () => this.loadYourTokens());
      }
    });
  }

  applyFilters() {
    if (this.activeTab === 'yourTokens') { this.applyLocalYourTokensFilters(); return; }
    if (this.activeTab === 'primaryMarket') { this.loadPrimaryMarket(); return; }
    this.loadSecondaryMarket();
  }

  refreshFilters() {
    this.marketCompanyId = -1;
    this.marketRequestId = -1;
    this.refreshCurrentTab();
  }

  refreshCurrentTab() {
    if (this.activeTab === 'yourTokens') this.loadYourTokens();
    else if (this.activeTab === 'primaryMarket') this.loadPrimaryMarket();
    else this.loadSecondaryMarket();
  }

  private applyLocalYourTokensFilters() {
    let result = [...(this.yourTokens ?? [])];
    const cId = Number(this.marketCompanyId);
    const rId = Number(this.marketRequestId);
    if (!isNaN(cId) && cId !== -1) result = result.filter(t => Number(t.companyId) === cId);
    if (!isNaN(rId) && rId !== -1) result = result.filter(t => Number(t.requestId) === rId);
    this.filteredYourTokens = result;
  }

  // ── Token detail modal ─────────────────────────────────────
  openDetail(token: ServiceTokenDto, tab: MarketplaceTab) {
    this.detailToken = token;
    this.detailTab = tab;
  }

  closeDetail() { this.detailToken = null; }

  addToCart(token: ServiceTokenDto) {
    const market = this.detailTab === 'primaryMarket' ? 'primaryMarket' : 'secondaryMarket';
    this.cartService.add(token, market).subscribe({
      next: () => this.toast.success(`"${token.productName}" added to cart.`),
      error: err => this.toast.error(err?.error?.message ?? err?.error ?? 'Failed to add token to cart.')
    });
  }

  // ── Cart ──────────────────────────────────────────────────
  openCart() { this.router.navigate(['/cart']); }

  // ── Get Service QR overlay ─────────────────────────────────
  openGetService(t: ServiceTokenDto) { this.getServiceToken = t; }

  onGetServiceClosed(result: ServiceResult | null) {
    this.getServiceToken = null;
    if (!result) return;
    if (result.success) {
      this.toast.success('Service granted successfully!');
      this.loadYourTokens(true);
    } else {
      this.toast.error(result.message ?? 'Service request failed.');
      this.loadYourTokens(true);
    }
  }

  // ── Mark / Cancel / Buy ────────────────────────────────────
  markForResell(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.markServiceTokenForResell(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token marked for resell.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  cancelReselling(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.cancelReselling(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Reselling cancelled.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  loadPrimaryMarket(silent = false, openTokenId?: string) {
    this.loading = true;
    this.serviceTokenApi.getPrimaryMarketServiceTokens(this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => {
        this.primaryMarketTokens = list ?? [];
        this.loading = false;
        if (openTokenId) {
          const t = this.primaryMarketTokens.find(x => x.id === openTokenId);
          if (t) this.openDetail(t, 'primaryMarket');
        }
      },
      error: () => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load primary market.', () => this.loadPrimaryMarket()); }
    });
  }

  buyPrimary(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.buyPrimaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Token purchased!');
        this.closeDetail();
        this.loadYourTokens(true);
        this.loadPrimaryMarket(true);
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  loadSecondaryMarket(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getSecondaryMarketServiceTokens(this.investorPublicKey, this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => { this.secondaryMarketTokens = list ?? []; this.loading = false; },
      error: () => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load secondary market.', () => this.loadSecondaryMarket()); }
    });
  }

  buySecondary(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.buySecondaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Token purchased!');
        this.closeDetail();
        this.loadYourTokens(true);
        this.loadSecondaryMarket(true);
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  // ── Filtered token lists (exclude items already in cart) ──
  get visiblePrimaryTokens(): ServiceTokenDto[] {
    return this.primaryMarketTokens.filter(t => !this.cartService.has(t.id));
  }

  get visibleSecondaryTokens(): ServiceTokenDto[] {
    return this.secondaryMarketTokens.filter(t => !this.cartService.has(t.id));
  }

  // ── Display helpers ────────────────────────────────────────
  statusClass(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available: return 'badge--green';
      case ServiceTokenStatus.Sold:      return 'badge--gray';
      case ServiceTokenStatus.Finished:  return 'badge--gray';
      default:                           return 'badge--gray';
    }
  }

  tokenStatusLabel(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available: return 'Available';
      case ServiceTokenStatus.Sold:      return 'Sold';
      case ServiceTokenStatus.Finished:  return 'Finished';
      default: return `Status ${status}`;
    }
  }

  scheduleTypeLabel(st: ScheduleType): string {
    if (!st) return '—';
    const base = this.schedulePeriodLabel(st.periodType);
    return st.periodNumber > 0 ? `${base} / ${st.periodNumber}` : base;
  }

  private schedulePeriodLabel(v: number): string {
    switch (v) {
      case 0: return 'None';  case 1: return 'Daily';
      case 2: return 'Weekly'; case 3: return 'Monthly';
      case 4: return 'Yearly'; default: return `Period ${v}`;
    }
  }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }
}
