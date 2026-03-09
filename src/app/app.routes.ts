import { Routes } from '@angular/router';
import { InvestorLoginComponent } from './features/auth/investor-login/investor-login.component';
import { InvestorMarketplaceComponent } from './features/investor/marketplace/investor-marketplace.component';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: InvestorLoginComponent },
  { path: 'marketplace', component: InvestorMarketplaceComponent },
  { path: '**', redirectTo: 'login' }
];
