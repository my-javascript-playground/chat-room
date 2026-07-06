import { Component, Input } from '@angular/core';
import { ConnectionStatus, PresenceStatus } from '../../models/chat.models';

const CONN_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connected:    { label: 'connected',     color: '#00e5a0' },
  connecting:   { label: 'connecting…',   color: '#f0c040' },
  disconnected: { label: 'reconnecting…', color: '#ff9944' },
  error:        { label: 'error',         color: '#ff5e5e' },
};

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  online:  '#00e5a0',
  away:    '#f0c040',
  offline: '#888',
};

@Component({
  selector: 'app-connection-badge',
  standalone: true,
  template: `
    <span [style.display]="'inline-flex'" [style.align-items]="'center'" [style.gap]="'0.4rem'"
          [style.font-size]="'0.72rem'" [style.padding]="'0.25rem 0.6rem'"
          [style.border-radius]="'999px'" [style.border]="'1px solid ' + cfg.color" [style.color]="cfg.color">
      <span [style.width.px]="6" [style.height.px]="6" [style.border-radius]="'50%'"
            [style.background]="cfg.color" [style.display]="'inline-block'"></span>
      {{ cfg.label }}
    </span>
  `,
})
export class ConnectionBadgeComponent {
  @Input() status: ConnectionStatus = 'connecting';
  get cfg() { return CONN_CONFIG[this.status]; }
}

@Component({
  selector: 'app-presence-dot',
  standalone: true,
  template: `
    <span [style.width.px]="size" [style.height.px]="size"
          [style.border-radius]="'50%'" [style.background]="color"
          [style.display]="'inline-block'" [style.flex-shrink]="0"></span>
  `,
})
export class PresenceDotComponent {
  @Input() status: PresenceStatus = 'offline';
  @Input() size = 8;
  get color() { return PRESENCE_COLOR[this.status]; }
}
