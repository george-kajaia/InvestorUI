import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub: signalR.HubConnection | null = null;

  get connectionId(): string | null {
    return this.hub?.connectionId ?? null;
  }

  async connect(): Promise<string> {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.signalRHubUrl}`)
      .withAutomaticReconnect()
      .build();

    await this.hub.start();
    return this.hub.connectionId!;
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.hub?.on(event, callback);
  }

  off(event: string): void {
    this.hub?.off(event);
  }

  async disconnect(): Promise<void> {
    if (this.hub) {
      await this.hub.stop();
      this.hub = null;
    }
  }
}
