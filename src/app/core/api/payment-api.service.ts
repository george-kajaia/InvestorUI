import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { InitiatePaymentResult, PaymentStatusResult } from '../../shared/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private baseUrl = `${environment.apiBaseUrl}/Payment`;

  constructor(private http: HttpClient) {}

  /** Creates a TBC payment for an in-cart token and returns the checkout redirect URL. */
  initiatePrimaryPayment(
    serviceTokenId: string,
    rowVersion: number,
    investorPublicKey: string
  ): Observable<InitiatePaymentResult> {
    return this.http.post<any>(`${this.baseUrl}/InitiatePrimaryPayment`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), investorPublicKey }
    }).pipe(map(r => this.normalizeInitiate(r)));
  }

  /** Polls the current status of a payment by its payId. */
  getStatus(payId: string): Observable<PaymentStatusResult> {
    return this.http.get<any>(`${this.baseUrl}/GetStatus`, {
      params: { payId }
    }).pipe(map(r => this.normalizeStatus(r)));
  }

  // ASP.NET Core may serialize either camelCase or PascalCase depending on config,
  // so accept both — matching the pattern used by ServiceTokenApiService.
  private normalizeInitiate(raw: any): InitiatePaymentResult {
    return {
      payId:       raw?.payId       ?? raw?.PayId,
      approvalUrl: raw?.approvalUrl ?? raw?.ApprovalUrl
    };
  }

  private normalizeStatus(raw: any): PaymentStatusResult {
    return {
      payId:          raw?.payId          ?? raw?.PayId,
      serviceTokenId: raw?.serviceTokenId ?? raw?.ServiceTokenId,
      status:         raw?.status         ?? raw?.Status,
      amount:         raw?.amount         ?? raw?.Amount,
      currency:       raw?.currency       ?? raw?.Currency
    };
  }
}
