import {
  Component, Input, OnChanges, SimpleChanges,
  ViewChild, ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConnectionStatus, UserPresence } from '../../models/chat.models';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './message-input.component.html',
})
export class MessageInputComponent implements OnChanges {
  @Input() status!: ConnectionStatus;
  @Input() users:   UserPresence[] = [];

  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;

  draft       = '';
  suggestions: string[] = [];
  suggestIdx  = 0;

  constructor(private chat: ChatService) {}

  get isOpen(): boolean { return this.status === 'connected'; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['users']) this.updateSuggestions();
  }

  onDraftChange(): void {
    this.updateSuggestions();
  }

  private updateSuggestions(): void {
    const match = this.draft.match(/@([\w-]*)$/);
    if (!match) { this.suggestions = []; return; }
    const q = match[1].toLowerCase();
    this.suggestions = this.users.map(u => u.username).filter(u => u.toLowerCase().startsWith(q)).slice(0, 6);
    this.suggestIdx  = 0;
  }

  applySuggestion(username: string): void {
    this.draft       = this.draft.replace(/@([\w-]*)$/, `@${username} `);
    this.suggestions = [];
    this.textareaRef?.nativeElement.focus();
  }

  handleSend(): void {
    if (!this.draft.trim() || !this.isOpen) return;
    this.chat.sendMessage(this.draft);
    this.draft       = '';
    this.suggestions = [];
    if (this.textareaRef?.nativeElement) this.textareaRef.nativeElement.style.height = 'auto';
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (this.suggestions.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); this.suggestIdx = Math.min(this.suggestIdx + 1, this.suggestions.length - 1); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this.suggestIdx = Math.max(this.suggestIdx - 1, 0); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); this.applySuggestion(this.suggestions[this.suggestIdx]); return; }
      if (e.key === 'Escape')     { this.suggestions = []; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
  }
}
