import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { InvestorPaymentMethod } from '../../shared/models/payment-method.model';

/**
 * Reads / clears the investor's saved payment method. The card token itself is captured
 * server-side when a payment completes and is never exposed here — this only surfaces the
 * masked card for display and lets the investor remove the saved card.
 */
@Injectable({ providedIn: 'root' })
export class PaymentMethodApiService {
  private baseUrl = `${environment.apiBaseUrl}/Investor`;

  constructor(private http: HttpClient) {}

  get(investorId: number): Observable<InvestorPaymentMethod> {
    return this.http
      .get<any>(`${this.baseUrl}/GetPaymentMethod/${investorId}`)
      .pipe(map(r => this.normalize(r)));
  }

  remove(investorId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/DeletePaymentMethod?investorId=${investorId}`);
  }

  // ASP.NET Core may serialize camelCase or PascalCase; accept both.
  private normalize(raw: any): InvestorPaymentMethod {
    return {
      hasSavedCard:  raw?.hasSavedCard  ?? raw?.HasSavedCard  ?? false,
      maskedCard:    raw?.maskedCard    ?? raw?.MaskedCard    ?? null,
      cardType:      raw?.cardType      ?? raw?.CardType      ?? null,
      paymentSystem: raw?.paymentSystem ?? raw?.PaymentSystem ?? null,
      tokenLifetime: raw?.tokenLifetime ?? raw?.TokenLifetime ?? null,
      iban:          raw?.iban          ?? raw?.Iban          ?? null
    };
  }
}
