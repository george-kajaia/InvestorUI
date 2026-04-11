import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ServiceTokenDto } from '../../shared/models/service-token.model';

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

  add(token: ServiceTokenDto, market: CartMarket): void {
    const current = this._items.value;
    if (!current.find(i => i.token.id === token.id)) {
      this._items.next([...current, { token, market }]);
    }
  }

  remove(tokenId: string): void {
    this._items.next(this._items.value.filter(i => i.token.id !== tokenId));
  }

  clear(): void { this._items.next([]); }

  has(tokenId: string): boolean {
    return this._items.value.some(i => i.token.id === tokenId);
  }
}
