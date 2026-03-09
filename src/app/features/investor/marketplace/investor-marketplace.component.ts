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

type MarketplaceTab = 'yourTokens' | 'primaryMarket' | 'secondaryMarket';

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

  // Filters for market tabs
  marketCompanyId: number = -1;
  marketRequestId: number = -1;

  // Data
  yourTokens: ServiceTokenDto[] = [];
  filteredYourTokens: ServiceTokenDto[] = [];
  primaryMarketTokens: ServiceTokenDto[] = [];
  secondaryMarketTokens: ServiceTokenDto[] = [];

  loading = false;

  // Selected rows (actions moved to top toolbar)
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
    if (!investor) {
      this.router.navigate(['/login']);
      return;
    }

    this.investorPublicKey = investor.publicKey;

    this.loadCompanies();
    this.loadYourTokens();
  }

  setTab(tab: MarketplaceTab) {
    this.activeTab = tab;

    // Clear selection when switching tabs
    this.clearSelection();

    if (tab === 'yourTokens') {
      this.loadYourTokens();
    } else if (tab === 'primaryMarket') {
      this.loadPrimaryMarket();
    } else {
      this.loadSecondaryMarket();
    }
  }

  loadCompanies() {
    this.companyApi.getAll(0, 500, null).subscribe({
      next: list => (this.companies = list ?? []),
      error: err => {
        console.error(err);
        // non-blocking
      }
    });
  }

  // -----------------------------
  // Your tokens
  // -----------------------------
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
        console.error(err);
        this.loading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load your service tokens. Please check your connection.',
            () => this.loadYourTokens()
          );
        }
      }
    });
  }

  // -----------------------------
  // Filters (shared UI)
  // -----------------------------
  applyFilters() {
    if (this.activeTab === 'yourTokens') {
      // Client-side filtering (API currently returns all investor tokens)
      this.applyLocalYourTokensFilters();
      return;
    }

    if (this.activeTab === 'primaryMarket') {
      this.loadPrimaryMarket();
      return;
    }

    this.loadSecondaryMarket();
  }

  refreshFilters() {
    this.marketCompanyId = -1;
    this.marketRequestId = -1;
    this.refreshCurrentTab();
  }

  refreshCurrentTab() {
    if (this.activeTab === 'yourTokens') {
      this.loadYourTokens();
      return;
    }

    if (this.activeTab === 'primaryMarket') {
      this.loadPrimaryMarket();
      return;
    }

    this.loadSecondaryMarket();
  }

  private applyLocalYourTokensFilters() {
    const companyId = Number(this.marketCompanyId);
    const requestId = Number(this.marketRequestId);

    let result = [...(this.yourTokens ?? [])];

    if (!Number.isNaN(companyId) && companyId !== -1) {
      result = result.filter(t => Number((t as any).companyId) === companyId);
    }

    if (!Number.isNaN(requestId) && requestId !== -1) {
      result = result.filter(t => Number((t as any).requestId) === requestId);
    }

    this.filteredYourTokens = result;
  }

  // -----------------------------
  // Selection + toolbar actions
  // -----------------------------
  clearSelection() {
    this.selectedYourToken = null;
    this.selectedPrimaryToken = null;
    this.selectedSecondaryToken = null;
  }

  private reconcileSelection() {
    // When lists refresh, clear selection if the selected token is no longer present.
    if (this.selectedYourToken) {
      const exists = (this.filteredYourTokens ?? []).some(t => t.id === this.selectedYourToken?.id);
      if (!exists) this.selectedYourToken = null;
    }

    if (this.selectedPrimaryToken) {
      const exists = (this.primaryMarketTokens ?? []).some(t => t.id === this.selectedPrimaryToken?.id);
      if (!exists) this.selectedPrimaryToken = null;
    }

    if (this.selectedSecondaryToken) {
      const exists = (this.secondaryMarketTokens ?? []).some(t => t.id === this.selectedSecondaryToken?.id);
      if (!exists) this.selectedSecondaryToken = null;
    }
  }

  selectYourToken(t: ServiceTokenDto) {
    this.selectedYourToken = t;
  }

  selectPrimaryToken(t: ServiceTokenDto) {
    this.selectedPrimaryToken = t;
  }

  selectSecondaryToken(t: ServiceTokenDto) {
    this.selectedSecondaryToken = t;
  }

  isSelectedYour(t: ServiceTokenDto): boolean {
    return !!this.selectedYourToken && this.selectedYourToken.id === t.id;
  }

  isSelectedPrimary(t: ServiceTokenDto): boolean {
    return !!this.selectedPrimaryToken && this.selectedPrimaryToken.id === t.id;
  }

  isSelectedSecondary(t: ServiceTokenDto): boolean {
    return !!this.selectedSecondaryToken && this.selectedSecondaryToken.id === t.id;
  }

  
  get canMarkForResell(): boolean {
    return !!this.selectedYourToken && Number((this.selectedYourToken as any).status) === 1 && !this.loading;
  }

  get canCancelReselling(): boolean {
    return !!this.selectedYourToken && Number((this.selectedYourToken as any).status) === 0 && !this.loading;
  }

  get canBuyPrimary(): boolean {
    return !!this.selectedPrimaryToken && !this.loading;
  }

  get canBuySecondary(): boolean {
    return !!this.selectedSecondaryToken && !this.loading;
  }

markSelectedForResell() {
    if (!this.selectedYourToken) return;
    this.markForResell(this.selectedYourToken);
  }

  cancelSelectedReselling() {
    if (!this.selectedYourToken) return;
    this.cancelReselling(this.selectedYourToken);
  }

  buySelectedPrimary() {
    if (!this.selectedPrimaryToken) return;
    this.buyPrimary(this.selectedPrimaryToken);
  }

  buySelectedSecondary() {
    if (!this.selectedSecondaryToken) return;
    this.buySecondary(this.selectedSecondaryToken);
  }

  markForResell(t: ServiceTokenDto) {
    this.loading = true;

    this.serviceTokenApi.markServiceTokenForResell(t.id, t.rowVersion).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Token marked for resell.');
        this.loadYourTokens(true);
      },
      error: err => {
        console.error(err);
        this.loading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  cancelReselling(t: ServiceTokenDto) {
    this.loading = true;

    this.serviceTokenApi.cancelReselling(t.id, t.rowVersion).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Reselling cancelled.');
        this.loadYourTokens(true);
      },
      error: err => {
        console.error(err);
        this.loading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  // -----------------------------
  // Primary market
  // -----------------------------
  loadPrimaryMarket(silent = false) {
    this.loading = true;

    this.serviceTokenApi.getPrimaryMarketServiceTokens(this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => {
        this.primaryMarketTokens = list ?? [];
        this.reconcileSelection();
        this.loading = false;
      },
      error: err => {
        console.error(err);
        this.loading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load primary market tokens. Please check your connection.',
            () => this.loadPrimaryMarket()
          );
        }
      }
    });
  }

  buyPrimary(t: ServiceTokenDto) {
    this.loading = true;

    this.serviceTokenApi.buyPrimaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Token purchased successfully.');
        // After buying: refresh both lists (silent to avoid duplicate toasts)
        this.loadYourTokens(true);
        this.loadPrimaryMarket(true);
      },
      error: err => {
        console.error(err);
        this.loading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);

      }
    });
  }

  // -----------------------------
  // Secondary market
  // -----------------------------
  loadSecondaryMarket(silent = false) {
    this.loading = true;

    this.serviceTokenApi
      .getSecondaryMarketServiceTokens(this.investorPublicKey, this.marketCompanyId, this.marketRequestId)
      .subscribe({
        next: list => {
          this.secondaryMarketTokens = list ?? [];
          this.reconcileSelection();
          this.loading = false;
        },
        error: err => {
          console.error(err);
          this.loading = false;
          if (!silent) {
            this.toast.errorWithRetry(
              'Failed to load secondary market tokens. Please check your connection.',
              () => this.loadSecondaryMarket()
            );
          }
        }
      });
  }

  buySecondary(t: ServiceTokenDto) {
    this.loading = true;

    this.serviceTokenApi.buySecondaryServiceToken(t.id, t.rowVersion, this.investorPublicKey).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Token purchased successfully.');
        // After buying: refresh both lists (silent to avoid duplicate toasts)
        this.loadYourTokens(true);
        this.loadSecondaryMarket(true);
      },
      error: err => {
        console.error(err);
        this.loading = false;
        
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);

      }
    });
  }

  // -----------------------------
  // Display helpers
  // -----------------------------
  tokenStatusLabel(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available:
        return 'Available';
      case ServiceTokenStatus.Sold:
        return 'Sold';
      case ServiceTokenStatus.Finished:
        return 'Finished';
      default:
        return `Status ${status}`;
    }
  }

  scheduleTypeLabel(st: ScheduleType): string {
    if (!st) return '-';

    const base = this.schedulePeriodLabel(st.periodType);
    const n = st.periodNumber;
    if (!n || n <= 0) return base;
    return `${base} / ${n}`;
  }

  private schedulePeriodLabel(value: number): string {
    switch (value) {
      case 0:
        return 'None';
      case 1:
        return 'Daily';
      case 2:
        return 'Weekly';
      case 3:
        return 'Monthly';
      case 4:
        return 'Yearly';
      default:
        return `Period ${value}`;
    }
  }
}
