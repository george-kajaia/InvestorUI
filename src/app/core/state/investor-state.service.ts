import { Injectable } from '@angular/core';
import { Investor } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class InvestorStateService {
  investor: Investor | null = null;
}
