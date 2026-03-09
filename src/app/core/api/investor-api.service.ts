import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Investor } from '../../shared/models/user.model';
import { InvestorCreateDto } from '../../shared/models/dtos.model';

@Injectable({ providedIn: 'root' })
export class InvestorApiService {
  private baseUrl = `${environment.apiBaseUrl}/Investor`;

  constructor(private http: HttpClient) {}

  login(payload: { userName: string; password: string }): Observable<Investor> {
    return this.http.post<Investor>(`${this.baseUrl}/Login`, payload);
  }

  register(dto: InvestorCreateDto): Observable<Investor> {
    // Backend: [HttpPost("create")]
    return this.http.post<Investor>(`${this.baseUrl}/create`, dto);
  }

  getAll(skip: number = 0, take: number = 50, search: string | null = null): Observable<Investor[]> {
    let params = new HttpParams().set('skip', skip).set('take', take);
    if (search && search.trim().length > 0) params = params.set('search', search.trim());
    return this.http.get<Investor[]>(`${this.baseUrl}/GetAll`, { params });
  }

  updateInvestor(investorId: number, rowVersion: number, investor: Investor): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/update?investorId=${investorId}&rowVersion=${rowVersion}`, investor);
  }

  approveInvestor(investorId: number, rowVersion: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/Approve?investorId=${investorId}&rowVersion=${rowVersion}`, null);
  }

  deleteInvestor(investorId: number, rowVersion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete?investorId=${investorId}&rowVersion=${rowVersion}`);
  }
}
