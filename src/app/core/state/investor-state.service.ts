import { Injectable } from '@angular/core';
import { Investor } from '../../shared/models/user.model';

const SESSION_KEY = 'investor_session';

@Injectable({ providedIn: 'root' })
export class InvestorStateService {
  private _investor: Investor | null = null;

  constructor() {
    // Rehydrate from sessionStorage on startup (survives F5, cleared on tab close)
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) this._investor = JSON.parse(stored);
    } catch { /* ignore */ }
  }

  get investor(): Investor | null {
    return this._investor;
  }

  set investor(value: Investor | null) {
    this._investor = value;
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }

  /** Token id to auto-open in the marketplace after login (set by home page card click) */
  pendingTokenId: string | null = null;
}
