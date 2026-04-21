import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ServiceTokenDto } from '../../shared/models/service-token.model';
import { ServiceTokenApiService } from '../api/service-token-api.service';

export type CartMarket = 'primaryMarket' | 'secondaryMarket';

export interface CartItem {
  token: ServiceTokenDto;
  market: CartMarket;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = new BehaviorSubject<CartItem[]>([]);
  items$ = this._items.asObservable();

  get items(): CartItem[] { return this._items.value; }
  get count(): number { return this._items.value.length; }

  constructor(private serviceTokenApi: ServiceTokenApiService) {}

  /** Calls MarkServiceTokenInCart on the API, then adds the token to the local cart on success. */
  add(token: ServiceTokenDto, market: CartMarket): Observable<void> {
    if (this._items.value.find(i => i.token.id === token.id)) {
      return of(undefined);
    }

    return this.serviceTokenApi.markServiceTokenInCart(token.id, token.rowVersion).pipe(
      tap(() => {
        this._items.next([...this._items.value, { token, market }]);
      })
    );
  }

  /** Calls CancelInCart on the API, then removes the token from the local cart on success. */
  remove(tokenId: string): Observable<void> {
    const item = this._items.value.find(i => i.token.id === tokenId);
    if (!item) {
      return of(undefined);
    }

    return this.serviceTokenApi.cancelInCart(item.token.id, item.token.rowVersion).pipe(
      tap(() => {
        this._items.next(this._items.value.filter(i => i.token.id !== tokenId));
      })
    );
  }

  /** Remove from local state only — used after a successful purchase so we
   *  don't call CancelInCart for tokens that were just bought. */
  removeLocal(tokenId: string): void {
    this._items.next(this._items.value.filter(i => i.token.id !== tokenId));
  }

  clear(): void { this._items.next([]); }

  has(tokenId: string): boolean {
    return this._items.value.some(i => i.token.id === tokenId);
  }
}
