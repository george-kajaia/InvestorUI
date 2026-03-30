import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';

export interface ServiceResult {
  success: boolean;
  message: string;
  count?: number;
  rowVersion?: number;
}

@Component({
  selector: 'app-get-service',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './get-service.component.html',
  styleUrls: ['./get-service.component.scss']
})
export class GetServiceComponent implements OnInit, OnDestroy {
  @Input() token!: ServiceTokenDto;
  @Output() closed = new EventEmitter<ServiceResult | null>();

  qrDataUrl = '';
  connectionId = '';
  connecting = true;
  error = '';

  private signalR = inject(SignalRService);
  private toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      // 1. Open SignalR connection and get connectionId
      this.connectionId = await this.signalR.connect();

      // 2. Listen for the result notification from the API
      this.signalR.on('ServiceResult', (result: ServiceResult) => {
        this.closed.emit(result);
      });

      // 3. Generate QR code containing tokenId + rowVersion + connectionId + companyId
      const payload = JSON.stringify({
        tokenId: this.token.id,
        companyId: this.token.companyId,
        rowVersion: this.token.rowVersion,
        connectionId: this.connectionId
      });

      this.qrDataUrl = await QRCode.toDataURL(payload, {
        width: 280,
        margin: 2,
        color: { dark: '#064e3b', light: '#ffffff' }
      });

      this.connecting = false;
    } catch (err) {
      this.error = 'Failed to connect. Please try again.';
      this.connecting = false;
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.signalR.off('ServiceResult');
    await this.signalR.disconnect();
  }

  close(): void {
    this.closed.emit(null);
  }
}
