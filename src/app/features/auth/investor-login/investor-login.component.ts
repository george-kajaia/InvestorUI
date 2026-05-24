import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { InvestorApiService } from '../../../core/api/investor-api.service';
import { InvestorStateService } from '../../../core/state/investor-state.service';
import { InvestorCreateDto } from '../../../shared/models/dtos.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-investor-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './investor-login.component.html',
  styleUrls: ['./investor-login.component.scss']
})
export class InvestorLoginComponent implements OnInit {
  isRegisterMode = false;

  loginModel = { userName: '', password: '' };
  registerModel: InvestorCreateDto = { publicKey: '', userName: '', password: '' };

  loading = false;
  loginError = '';

  private toast = inject(ToastService);

  constructor(
    private investorApi: InvestorApiService,
    private investorState: InvestorStateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.isRegisterMode = true;
      }
    });
  }

  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.loginError = '';
  }

  onLogin() {
    this.loading = true;
    this.loginError = '';
    this.investorApi.login(this.loginModel).subscribe({
      next: investor => {
        this.loading = false;
        this.investorState.investor = investor;
        const pendingId = this.investorState.pendingTokenId;
        if (pendingId) {
          this.router.navigate(['/marketplace'], { queryParams: { tab: 'primaryMarket', openToken: pendingId } });
        } else {
          this.router.navigate(['/marketplace']);
        }
      },
      error: () => {
        this.loading = false;
        this.loginError = 'Incorrect username or password. Please try again.';
      }
    });
  }

  onRegister() {
    this.loading = true;
    this.investorApi.register(this.registerModel).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Registration successful! You can now login with your credentials.');
        this.isRegisterMode = false;
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }
}
