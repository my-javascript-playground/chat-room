import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router }    from '@angular/router';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { SidebarComponent }             from '../sidebar/sidebar.component';
import { MessageListComponent }         from '../message-list/message-list.component';
import { MessageInputComponent }        from '../message-input/message-input.component';
import { AdminPanelComponent }          from '../admin-panel/admin-panel.component';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { DirectMessagePanelComponent }  from '../direct-message-panel/direct-message-panel.component';

import { ChatService }    from '../../services/chat.service';
import { SessionService } from '../../services/session.service';
import { environment }    from '../../../environments/environment';
import {
  Session, Room, MentionNotification,
  MessageItem, UserPresence, ConnectionStatus,
  PresenceStatus, DmConversation, DmMessage,
} from '../../models/chat.models';

type Modal = 'none' | 'admin' | 'changePassword';

@Component({
  selector:    'app-chat',
  standalone:  true,
  templateUrl: './chat.component.html',
  imports: [
    AsyncPipe,
    SidebarComponent, MessageListComponent, MessageInputComponent,
    AdminPanelComponent, ChangePasswordModalComponent, DirectMessagePanelComponent,
  ],
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('joinMenuRef') joinMenuRef!: ElementRef<HTMLDivElement>;

  session!:     Session;
  modal:        Modal   = 'none';
  allRooms:     Room[]  = [];
  showJoinMenu  = false;
  mobileSidebar = false;

  messages$:        Observable<MessageItem[]>               = this.chat.messages$;
  users$:           Observable<UserPresence[]>              = this.chat.users$;
  status$:          Observable<ConnectionStatus>            = this.chat.status$;
  currentRoom$:     Observable<Room | null>                 = this.chat.currentRoom$;
  rooms$:           Observable<Room[]>                      = this.chat.rooms$;
  unreadCounts$:    Observable<Record<number, number>>      = this.chat.unreadCounts$;
  mentions$:        Observable<MentionNotification[]>       = this.chat.mentions$;
  presenceStatus$:  Observable<PresenceStatus>              = this.chat.presenceStatus$;
  dmConversations$: Observable<DmConversation[]>            = this.chat.dmConversations$;
  dmUnread$:        Observable<Record<string, number>>      = this.chat.dmUnread$;
  activeDm$:        Observable<string | null>               = this.chat.activeDm$;
  globalPresence$:  Observable<Map<string, PresenceStatus>> = this.chat.globalPresence$;
  dmMessages$:      Observable<Record<string, DmMessage[]>> = this.chat.dmMessages$;

  totalUnread$: Observable<number> = combineLatest([this.unreadCounts$, this.dmUnread$]).pipe(
    map(([rc, dm]) =>
      Object.values(rc).reduce((a, b) => a + b, 0) +
      Object.values(dm).reduce((a, b) => a + b, 0)
    )
  );

  joinableRooms:          Room[]                      = [];
  readonly emptyPresenceMap = new Map<string, PresenceStatus>();

  private subs = new Subscription();
  private docClickHandler = (e: MouseEvent) => {
    if (this.showJoinMenu && this.joinMenuRef?.nativeElement &&
        !this.joinMenuRef.nativeElement.contains(e.target as Node)) {
      this.showJoinMenu = false;
    }
  };

  constructor(
    private chat:     ChatService,
    private session_: SessionService,
    private router:   Router,
  ) {}

  ngOnInit(): void {
    const sess = this.session_.session;
    if (!sess) { this.router.navigate(['/login']); return; }
    this.session = sess;
    this.chat.connect(sess.token, sess.username, () => this.handleAuthError());
    this.fetchAllRooms();
    document.addEventListener('mousedown', this.docClickHandler);

    this.subs.add(this.rooms$.subscribe(rooms => {
      const memberIds = new Set(rooms.map(r => r.id));
      this.joinableRooms = this.allRooms.filter(r => !memberIds.has(r.id) && r.name.toLowerCase() !== 'general');
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    document.removeEventListener('mousedown', this.docClickHandler);
  }

  handleAuthError(): void {
    this.session_.clear();
    this.router.navigate(['/login']);
  }

  handleLogout(): void {
    this.chat.disconnect();
    this.session_.clear();
    this.router.navigate(['/login']);
  }

  async fetchAllRooms(): Promise<void> {
    try {
      const res = await fetch(`${environment.serverUrl}/auth/rooms`, {
        headers: { Authorization: `Bearer ${this.session.token}` },
      });
      if (res.ok) {
        this.allRooms = await res.json();
        const memberIds = new Set(this.chat.rooms.map(r => r.id));
        this.joinableRooms = this.allRooms.filter(r => !memberIds.has(r.id) && r.name.toLowerCase() !== 'general');
      }
    } catch { /* ignore */ }
  }

  handleSwitchRoom(roomId: number): void {
    this.chat.markRoomRead(roomId);
    this.chat.switchRoom(roomId);
  }

  async joinRoom(r: Room): Promise<void> {
    const res  = await fetch(`${environment.serverUrl}/auth/rooms/${r.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session.token}` },
    });
    const body = await res.json().catch(() => ({}));
    this.showJoinMenu = false;
    alert(body?.message ?? (res.ok ? 'Request sent!' : 'Error'));
    this.fetchAllRooms();
  }

  getDmMessages(activeDm: string | null, all: Record<string, DmMessage[]>): DmMessage[] {
    return activeDm ? (all[activeDm] ?? []) : [];
  }

  onSendDm(text: string, activeDm: string | null): void {
    if (activeDm) this.chat.sendDm(activeDm, text);
  }

  clearMention(id: string): void       { this.chat.clearMention(id); }
  exitRoom(id: number): void           { this.chat.exitRoom(id); }
  setPresence(p: PresenceStatus): void { this.chat.setPresence(p); }
  openDm(username: string): void       { this.chat.openDm(username); }
  closeDm(): void                      { this.chat.closeDm(); }
  closeDmConvo(p: string): void        { this.chat.closeDmConversation(p); }
}
