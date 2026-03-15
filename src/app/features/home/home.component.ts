import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const PWA_DISMISS_KEY = 'pwa-install-dismissed-at';

interface FaqItem { q: string; a: string; open: boolean; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  showInstallBanner = false;
  private deferredPrompt: any = null;
  private beforeInstallHandler = (e: Event) => {
    e.preventDefault();
    this.deferredPrompt = e;
    if (!this.wasDismissedToday()) this.showInstallBanner = true;
  };

  faqs: FaqItem[] = [
    { q: 'What are service tokens?', a: 'Service tokens are digital vouchers issued by companies that you can purchase, redeem for a specific service, or resell to others on the platform.', open: false },
    { q: 'How do I buy service tokens?', a: 'Register as an investor on this page, browse available tokens in the marketplace, and purchase directly from the issuing company.', open: false },
    { q: 'Can I resell tokens I have purchased?', a: 'Yes. You have full flexibility to either redeem your tokens for the service or resell them to other buyers on the platform at any time.', open: false },
    { q: 'Is my data secure on this platform?', a: 'All data is encrypted in transit and at rest. We never share your information with third parties, and our infrastructure meets GDPR compliance requirements.', open: false },
    { q: 'What types of services can I buy tokens for?', a: 'Service Tokens is cross-industry. You will find tokens from service businesses across many sectors — from fitness to consulting.', open: false },
    { q: 'How do I redeem a token for service?', a: 'Once you hold a token, you can redeem it directly through your investor dashboard. The issuing company will then fulfil the service.', open: false },
  ];

  year = new Date().getFullYear();

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);
    window.addEventListener('appinstalled', () => {
      this.showInstallBanner = false;
      this.deferredPrompt = null;
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
  }

  toggleFaq(item: FaqItem): void { item.open = !item.open; }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') this.showInstallBanner = false;
    this.deferredPrompt = null;
  }

  dismissBanner(): void {
    this.showInstallBanner = false;
    localStorage.setItem(PWA_DISMISS_KEY, new Date().toDateString());
  }

  private wasDismissedToday(): boolean {
    return localStorage.getItem(PWA_DISMISS_KEY) === new Date().toDateString();
  }
}
