import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { InvestorStateService } from '../../../core/state/investor-state.service';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { ToastService } from '../../../core/services/toast.service';

import { Company } from '../../../shared/models/company.model';
import { ScheduleType } from '../../../shared/models/product.model';
import { ServiceTokenDto, ServiceTokenStatus } from '../../../shared/models/service-token.model';

export type MarketplaceTab = 'yourTokens' | 'primaryMarket' | 'secondaryMarket';

@Component({
  selector: 'app-investor-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './investor-marketplace.component.html',
  styleUrls: ['./investor-marketplace.component.scss']
})
export class InvestorMarketplaceComponent implements OnInit {
  activeTab: MarketplaceTab = 'yourTokens';
  investorPublicKey = '';
  companies: Company[] = [];

  marketCompanyId = -1;
  marketRequestId = -1;

  yourTokens: ServiceTokenDto[] = [];
  filteredYourTokens: ServiceTokenDto[] = [];
  primaryMarketTokens: ServiceTokenDto[] = [];
  secondaryMarketTokens: ServiceTokenDto[] = [];

  loading = false;

  selectedYourToken: ServiceTokenDto | null = null;
  selectedPrimaryToken: ServiceTokenDto | null = null;
  selectedSecondaryToken: ServiceTokenDto | null = null;

  private toast = inject(ToastService);

  constructor(
    private router: Router,
    private investorState: InvestorStateService,
    private companyApi: CompanyApiService,
    private serviceTokenApi: ServiceTokenApiService
  ) {}

  ngOnInit(): void {
    const investor = this.investorState.investor;
    if (!investor) { this.router.navigate(['/login']); return; }
    this.investorPublicKey = investor.publicKey;
    this.loadCompanies();
    this.loadYourTokens();
  }

  setTab(tab: MarketplaceTab) {
    this.activeTab = tab;
    this.clearSelection();
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
        this.reconcileSelection();
        this.loading = false;
      },
      error: err => {
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
    if (!isNaN(cId) && cId !== -1) result = result.filter(t => Number((t as any).companyId) === cId);
    if (!isNaN(rId) && rId !== -1) result = result.filter(t => Number((t as any).requestId) === rId);
    this.filteredYourTokens = result;
  }

  clearSelection() {
    this.selectedYourToken = null;
    this.selectedPrimaryToken = null;
    this.selectedSecondaryToken = null;
  }

  private reconcileSelection() {
    if (this.selectedYourToken && !this.filteredYourTokens.some(t => t.id === this.selectedYourToken?.id))
      this.selectedYourToken = null;
    if (this.selectedPrimaryToken && !this.primaryMarketTokens.some(t => t.id === this.selectedPrimaryToken?.id))
      this.selectedPrimaryToken = null;
    if (this.selectedSecondaryToken && !this.secondaryMarketTokens.some(t => t.id === this.selectedSecondaryToken?.id))
      this.selectedSecondaryToken = null;
  }

  selectYourToken(t: ServiceTokenDto) { this.selectedYourToken = t; }
  selectPrimaryToken(t: ServiceTokenDto) { this.selectedPrimaryToken = t; }
  selectSecondaryToken(t: ServiceTokenDto) { this.selectedSecondaryToken = t; }

  isSelectedYour(t: ServiceTokenDto) { return this.selectedYourToken?.id === t.id; }
  isSelectedPrimary(t: ServiceTokenDto) { return this.selectedPrimaryToken?.id === t.id; }
  isSelectedSecondary(t: ServiceTokenDto) { return this.selectedSecondaryToken?.id === t.id; }

  get canMarkForResell() { return !!this.selectedYourToken && Number((this.selectedYourToken as any).status) === 1 && !this.loading; }
  get canCancelReselling() { return !!this.selectedYourToken && Number((this.selectedYourToken as any).status) === 0 && !this.loading; }
  get canBuyPrimary() { return !!this.selectedPrimaryToken && !this.loading; }
  get canBuySecondary() { return !!this.selectedSecondaryToken && !this.loading; }

  // ── Mobile: open detail screen ─────────────────────────────
  openDetail(t: ServiceTokenDto, tab: MarketplaceTab) {
    this.router.navigate(['/token', t.id], {
      state: { token: t, tab, investorPublicKey: this.investorPublicKey }
    });
  }

  // ── Actions (desktop table) ────────────────────────────────
  markSelectedForResell() { if (this.selectedYourToken) this.markForResell(this.selectedYourToken); }
  cancelSelectedReselling() { if (this.selectedYourToken) this.cancelReselling(this.selectedYourToken); }
  buySelectedPrimary() { if (this.selectedPrimaryToken) this.buyPrimary(this.selectedPrimaryToken); }
  buySelectedSecondary() { if (this.selectedSecondaryToken) this.buySecondary(this.selectedSecondaryToken); }

  markForResell(t: ServiceTokenDto) {
    this.loading = true;
    this.serviceTokenApi.markServiceTokenForResell(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token marked for resell.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  cancelReselling(t: ServiceTokenDto) {
    this.loading = true;
    this.serviceTokenApi.cancelReselling(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Reselling cancelled.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  loadPrimaryMarket(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getPrimaryMarketServiceTokens(this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => { this.primaryMarketTokens = list ?? []; this.reconcileSelection(); this.loading = false; },
      error: err => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load primary market.', () => this.loadPrimaryMarket()); }
    });
  }

  buyPrimary(t: ServiceTokenDto) {
    this.loading = true;
    this.serviceTokenApi.buyPrimaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token purchased!'); this.loadYourTokens(true); this.loadPrimaryMarket(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  loadSecondaryMarket(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getSecondaryMarketServiceTokens(this.investorPublicKey, this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => { this.secondaryMarketTokens = list ?? []; this.reconcileSelection(); this.loading = false; },
      error: err => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load secondary market.', () => this.loadSecondaryMarket()); }
    });
  }

  buySecondary(t: ServiceTokenDto) {
    this.loading = true;
    this.serviceTokenApi.buySecondaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token purchased!'); this.loadYourTokens(true); this.loadSecondaryMarket(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
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
}
