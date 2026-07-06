import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password-modal.component.html',
})
export class ChangePasswordModalComponent {
  @Input()  token!:  string;
  @Output() closed = new EventEmitter<void>();

  current = '';
  next    = '';
  confirm = '';
  error   = '';
  info    = '';
  loading = false;

  closeIfBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.closed.emit();
  }

  async handleSubmit(): Promise<void> {
    this.error = ''; this.info = '';
    if (!this.current)            { this.error = 'Enter your current password'; return; }
    if (this.next.length < 6)     { this.error = 'New password must be at least 6 characters'; return; }
    if (this.next !== this.confirm) { this.error = 'Passwords do not match'; return; }
    this.loading = true;
    try {
      const res  = await fetch(`${environment.serverUrl}/auth/password`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body:    JSON.stringify({ currentPassword: this.current, newPassword: this.next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? 'Failed to update password');
      this.info = 'Password updated successfully!';
      setTimeout(() => this.closed.emit(), 1200);
    } catch (e: unknown) {
      this.error = (e instanceof Error ? e.message : null) ?? 'Something went wrong.';
    } finally {
      this.loading = false;
    }
  }
}
