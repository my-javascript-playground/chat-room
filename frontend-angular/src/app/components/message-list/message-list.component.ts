import {
  Component, Input, OnChanges, ViewChild,
  ElementRef, AfterViewChecked,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MessageItem } from '../../models/chat.models';

@Component({
  selector: 'app-message-list',
  standalone: true,
  templateUrl: './message-list.component.html',
})
export class MessageListComponent implements OnChanges, AfterViewChecked {
  @Input() messages:    MessageItem[] = [];
  @Input() currentUser = '';

  @ViewChild('bottom') bottomRef!: ElementRef<HTMLDivElement>;

  private shouldScroll = false;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.bottomRef?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  renderText(text: string, currentUser: string): SafeHtml {
    const parts = text.split(/(@[\w-]{1,24})/g);
    const html = parts.map(part => {
      if (part.startsWith('@')) {
        const name = part.slice(1);
        const isMe = name === currentUser;
        const color = isMe ? '#ff9944' : 'var(--accent)';
        const bg    = isMe ? '#ff994415' : '#00e5a010';
        return `<span style="font-weight:700;color:${color};background:${bg};border-radius:3px;padding:0 2px">${this.esc(part)}</span>`;
      }
      return this.esc(part);
    }).join('');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  isGrouped(i: number): boolean {
    const prev = this.messages[i - 1];
    const cur  = this.messages[i];
    return !!(prev && prev.kind === 'chat' && cur.kind === 'chat' && prev.username === cur.username);
  }

  isMentioned(msg: MessageItem): boolean {
    return msg.kind === 'chat' && !!(msg.mentions?.includes(this.currentUser));
  }
}
