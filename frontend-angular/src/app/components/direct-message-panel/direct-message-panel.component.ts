import {
  Component, Input, OnChanges, Output, EventEmitter,
  ViewChild, ElementRef, AfterViewChecked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DmMessage } from '../../models/chat.models';

@Component({
  selector: 'app-direct-message-panel',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule],
  templateUrl: './direct-message-panel.component.html',
})
export class DirectMessagePanelComponent implements OnChanges, AfterViewChecked {
  @Input()  partner!:     string;
  @Input()  currentUser!: string;
  @Input()  messages:     DmMessage[] = [];
  @Output() send         = new EventEmitter<string>();
  @Output() closed       = new EventEmitter<void>();

  @ViewChild('bottom') bottomRef!: ElementRef<HTMLDivElement>;

  draft         = '';
  private scroll = false;

  ngOnChanges(): void { this.scroll = true; }

  ngAfterViewChecked(): void {
    if (this.scroll) {
      this.bottomRef?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.scroll = false;
    }
  }

  handleSend(): void {
    if (!this.draft.trim()) return;
    this.send.emit(this.draft.trim());
    this.draft = '';
  }

  handleKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
