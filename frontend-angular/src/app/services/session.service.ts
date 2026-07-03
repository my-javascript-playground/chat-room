import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Session } from '../models/chat.models';

const SESSION_KEY = 'chatroom_session';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private _session = new BehaviorSubject<Session | null>(this.load());
  session$ = this._session.asObservable();

  get session(): Session | null {
    return this._session.value;
  }

  private load(): Session | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s.token && s.username ? s : null;
    } catch { return null; }
  }

  save(s: Session): void {
    const j = JSON.stringify(s);
    localStorage.setItem(SESSION_KEY, j);
    sessionStorage.setItem(SESSION_KEY, j);
    this._session.next(s);
  }

  clear(): void {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    this._session.next(null);
  }
}
