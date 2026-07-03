import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ElementRef, ViewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ConnectionBadgeComponent, PresenceDotComponent } from '../status-badge/status-badge.component';
import {
  ConnectionStatus, Room, UserPresence,
  PresenceStatus, DmConversation,
} from '../../models/chat.models';

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'online',  label: '🟢 Online'  },
  { value: 'away',    label: '🟡 Away'    },
  { value: 'offline', label: '⚫ Offline' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgTemplateOutlet, ConnectionBadgeComponent, PresenceDotComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() status!:           ConnectionStatus;
  @Input() users!:            UserPresence[];
  @Input() currentUser!:      string;
  @Input() isAdmin!:          boolean;
  @Input() rooms!:            Room[];
  @Input() currentRoom!:      Room | null;
  @Input() unreadCounts!:     Record<number, number>;
  @Input() presenceStatus!:   PresenceStatus;
  @Input() dmConversations!:  DmConversation[];
  @Input() dmUnread!:         Record<string, number>;
  @Input() activeDm!:         string | null;
  @Input() globalPresence!:   Map<string, PresenceStatus>;
  @Input() mobileOpen!:       boolean;

  @Output() logout            = new EventEmitter<void>();
  @Output() adminPanel        = new EventEmitter<void>();
  @Output() changePassword    = new EventEmitter<void>();
  @Output() switchRoom        = new EventEmitter<number>();
  @Output() exitRoom          = new EventEmitter<number>();
  @Output() setPresence       = new EventEmitter<PresenceStatus>();
  @Output() openDm            = new EventEmitter<string>();
  @Output() closeDmConvo      = new EventEmitter<string>();
  @Output() mobileClose       = new EventEmitter<void>();

  @ViewChild('presenceMenu') presenceMenuRef!: ElementRef<HTMLDivElement>;

  showPresenceMenu = false;
  readonly presenceOptions = PRESENCE_OPTIONS;

  private docListener = (e: MouseEvent) => {
    if (this.presenceMenuRef?.nativeElement && !this.presenceMenuRef.nativeElement.contains(e.target as Node)) {
      this.showPresenceMenu = false;
    }
  };

  ngOnInit(): void {
    document.addEventListener('mousedown', this.docListener, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousedown', this.docListener, true);
  }

  presenceLabel(s: PresenceStatus): string {
    return PRESENCE_OPTIONS.find(o => o.value === s)?.label.replace(/^\S+\s/, '') ?? s;
  }

  getPartnerPresence(partner: string): PresenceStatus {
    return this.globalPresence.get(partner) ?? 'offline';
  }

  get dmPartners(): Set<string> {
    return new Set(this.dmConversations.map(c => c.partner));
  }

  canDm(u: UserPresence): boolean {
    return u.username !== this.currentUser &&
      (u.presenceStatus === 'online' || this.dmPartners.has(u.username));
  }

  doSwitchRoom(id: number): void    { this.switchRoom.emit(id);  this.mobileClose.emit(); }
  doOpenDm(username: string): void  { this.openDm.emit(username); this.mobileClose.emit(); }
  doAdminPanel(): void              { this.adminPanel.emit();      this.mobileClose.emit(); }
  doChangePassword(): void          { this.changePassword.emit();  this.mobileClose.emit(); }

  selectPresence(val: PresenceStatus): void {
    this.setPresence.emit(val);
    this.showPresenceMenu = false;
  }
}
