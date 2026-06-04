import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { InitiateEmbeddedPaymentResult, PaymentStatusResult } from '../../shared/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private baseUrl = `${environment.apiBaseUrl}/Payment`;

  constructor(private http: HttpClient) {}

  /** Creates a Flitt order for an in-cart token and returns the embedded-checkout token. */
  initiateEmbeddedPayment(
    serviceTokenId: string,
    rowVersion: number,
    investorPublicKey: string
  ): Observable<InitiateEmbeddedPaymentResult> {
    return this.http.post<any>(`${this.baseUrl}/InitiateEmbeddedPayment`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), investorPublicKey }
    }).pipe(map(r => this.normalizeInitiate(r)));
  }

  /** Polls the current status of a payment by its order id. */
  getStatus(orderId: string): Observable<PaymentStatusResult> {
    return this.http.get<any>(`${this.baseUrl}/GetStatus`, {
      params: { orderId }
    }).pipe(map(r => this.normalizeStatus(r)));
  }

  // ASP.NET Core may serialize either camelCase or PascalCase depending on config,
  // so accept both — matching the pattern used by ServiceTokenApiService.
  private normalizeInitiate(raw: any): InitiateEmbeddedPaymentResult {
    return {
      orderId: raw?.orderId ?? raw?.OrderId,
      token:   raw?.token   ?? raw?.Token
    };
  }

  private normalizeStatus(raw: any): PaymentStatusResult {
    return {
      orderId:        raw?.orderId        ?? raw?.OrderId,
      serviceTokenId: raw?.serviceTokenId ?? raw?.ServiceTokenId,
      status:         raw?.status         ?? raw?.Status,
      amount:         raw?.amount         ?? raw?.Amount,
      currency:       raw?.currency       ?? raw?.Currency
    };
  }
}
