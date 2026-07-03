import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { FormsModule }    from '@angular/forms';
import { Router }         from '@angular/router';
import { environment }    from '../../../environments/environment';
import { SessionService } from '../../services/session.service';

type Mode = 'login' | 'register';

declare global {
  interface Window {
    grecaptcha?: {
      render:      (el: HTMLElement, p: object) => number;
      reset:       (id?: number) => void;
      getResponse: (id?: number) => string;
    };
    onRecaptchaLoad?: () => void;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('captchaContainer') captchaContainerRef!: ElementRef<HTMLDivElement>;

  mode: Mode = 'login';
  username     = '';
  password     = '';
  confirm      = '';
  error        = '';
  info         = '';
  loading      = false;
  captchaToken = '';

  readonly recaptchaActive = !!environment.recaptchaSiteKey;

  private widgetId:     number | null = null;
  private scriptLoaded  = false;
  private scriptReady   = false;

  constructor(
    private cd:       ChangeDetectorRef,
    private session_: SessionService,
    private router:   Router,
  ) {}

  ngOnInit(): void {
    if (!this.recaptchaActive || this.scriptLoaded) return;
    this.scriptLoaded = true;
    window.onRecaptchaLoad = () => { this.scriptReady = true; this.renderWidget(); };
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
      const s = document.createElement('script');
      s.src   = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    } else if (window.grecaptcha) {
      this.scriptReady = true;
      this.renderWidget();
    }
  }

  ngOnDestroy(): void { delete window.onRecaptchaLoad; }

  switchMode(next: Mode): void {
    this.mode = next; this.error = ''; this.info = '';
    this.password = ''; this.confirm = ''; this.captchaToken = '';
    if (this.recaptchaActive && this.scriptReady) setTimeout(() => this.renderWidget(), 50);
  }

  private renderWidget(): void {
    if (!this.captchaContainerRef?.nativeElement || !window.grecaptcha) return;
    if (this.widgetId !== null) { window.grecaptcha.reset(this.widgetId); this.captchaToken = ''; return; }
    this.captchaContainerRef.nativeElement.innerHTML = '';
    this.widgetId = window.grecaptcha.render(this.captchaContainerRef.nativeElement, {
      sitekey:            environment.recaptchaSiteKey,
      theme:              'dark',
      callback:           (t: string) => { this.captchaToken = t; this.cd.detectChanges(); },
      'expired-callback': ()          => { this.captchaToken = ''; this.cd.detectChanges(); },
      'error-callback':   ()          => { this.captchaToken = ''; this.cd.detectChanges(); },
    });
  }

  private validate(): string | null {
    if (!this.username.trim())    return 'Please enter a username.';
    if (!this.password)           return 'Please enter a password.';
    if (this.password.length < 6) return 'Password must be at least 6 characters.';
    if (this.mode === 'register' && this.password !== this.confirm) return 'Passwords do not match.';
    if (this.recaptchaActive && !this.captchaToken) return 'Please complete the reCAPTCHA challenge.';
    return null;
  }

  async handleSubmit(): Promise<void> {
    const err = this.validate();
    if (err) { this.error = err; return; }
    this.error = ''; this.info = ''; this.loading = true;
    try {
      if (this.mode === 'register') {
        const res  = await fetch(`${environment.serverUrl}/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username.trim(), password: this.password, recaptchaToken: this.captchaToken }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message ?? `Registration failed: ${res.status}`);
        this.info = 'Registration submitted! Wait for admin approval, then sign in.';
        this.switchMode('login');
      } else {
        const res  = await fetch(`${environment.serverUrl}/auth/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username.trim(), password: this.password, recaptchaToken: this.captchaToken }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message ?? `Login failed: ${res.status}`);
        const { token, role } = body as { token: string; role: string };
        if (!token) throw new Error('Server returned empty token');
        this.session_.save({ token, username: this.username.trim(), role: role as 'user' | 'admin' });
        this.router.navigate(['/']);
      }
    } catch (e: unknown) {
      if (this.recaptchaActive && window.grecaptcha && this.widgetId !== null) {
        window.grecaptcha.reset(this.widgetId); this.captchaToken = '';
      }
      this.error = (e instanceof Error ? e.message : null) ?? 'Something went wrong.';
    } finally {
      this.loading = false;
    }
  }

  get isSubmitDisabled(): boolean {
    return this.loading || (this.recaptchaActive && !this.captchaToken);
  }
}
