import { Routes } from '@angular/router';
import { InvestorLoginComponent } from './features/auth/investor-login/investor-login.component';
import { InvestorMarketplaceComponent } from './features/investor/marketplace/investor-marketplace.component';
import { TokenDetailComponent } from './features/investor/token-detail/token-detail.component';
import { HomeComponent } from './features/home/home.component';
import { CartComponent } from './features/investor/cart/cart.component';

export const appRoutes: Routes = [
  { path: '',            component: HomeComponent },
  { path: 'login',       component: InvestorLoginComponent },
  { path: 'marketplace', component: InvestorMarketplaceComponent },
  { path: 'cart',        component: CartComponent },
  { path: 'token/:id',   component: TokenDetailComponent },
  { path: '**',          redirectTo: '' }
];
