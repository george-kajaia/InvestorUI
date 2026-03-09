import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceTokenDto } from '../../shared/models/service-token.model';

@Injectable({ providedIn: 'root' })
export class ServiceTokenApiService {
  private baseUrl = `${environment.apiBaseUrl}/ServiceToken`;

  constructor(private http: HttpClient) {}

  getInvestorServiceTokens(investorPublicKey: string): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetInvestorServiceTokens`, {
      params: { investorPublicKey }
    });
  }

  getPrimaryMarketServiceTokens(companyId: number = -1, requestId: number = -1): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetPrimaryMarketServiceTokens`, {
      params: { companyId: companyId.toString(), requestId: requestId.toString() }
    });
  }

  getSecondaryMarketServiceTokens(
    investorPublicKey: string,
    companyId: number = -1,
    requestId: number = -1
  ): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetSecondaryMarketServiceTokens`, {
      params: { investorPublicKey, companyId: companyId.toString(), requestId: requestId.toString() }
    });
  }

  buyPrimaryServiceToken(serviceTokenId: string, rowVersion: number, investorPublicKey: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/BuyPrimaryServiceToken`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), investorPublicKey }
    });
  }

  markServiceTokenForResell(serviceTokenId: string, rowVersion: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/MarkServiceTokenForResell`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString() }
    });
  }

  cancelReselling(serviceTokenId: string, rowVersion: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/CancelReselling`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString() }
    });
  }

  buySecondaryServiceToken(serviceTokenId: string, rowVersion: number, newInvestorPublicKey: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/BuySecondaryServiceToken`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), newInvestorPublicKey }
    });
  }
}
