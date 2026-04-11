import { Injectable } from '@angular/core';
import { Investor } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class InvestorStateService {
  investor: Investor | null = null;

  /** Token id to auto-open in the marketplace after login (set by home page card click) */
  pendingTokenId: string | null = null;
}
