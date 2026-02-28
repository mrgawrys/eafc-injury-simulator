import { Component, computed, inject, input } from '@angular/core';
import { PlayerAvatarComponent } from './player-avatar';
import { FatigueService, type FatigueBadge } from '../services/fatigue';

@Component({
  selector: 'app-player-list-item',
  standalone: true,
  imports: [PlayerAvatarComponent],
  host: { style: 'display: contents' },
  template: `
    <app-player-avatar [name]="name()" [avatarUrl]="avatarUrl()" size="sm" />
    <span class="flex-1 text-left" [class.text-muted-foreground]="muted()">{{ name() }}</span>
    @if (overall()) {
      <span
        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        [class]="overall()! >= 80 ? 'bg-green-100 text-green-800' : overall()! >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'"
      >
        {{ overall() }}
      </span>
    }
    @if (fatigueBadge(); as badge) {
      @switch (badge) {
        @case ('fresh') {
          <span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
            Fresh
          </span>
        }
        @case ('fatigued') {
          <span class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-800">
            Fatigued
          </span>
        }
        @case ('high-risk') {
          <span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
            High Risk
          </span>
        }
      }
    }
    <span class="text-xs text-muted-foreground">{{ position() }}</span>
    <ng-content />
  `,
})
export class PlayerListItemComponent {
  private fatigueService = inject(FatigueService);

  name = input.required<string>();
  avatarUrl = input<string | undefined>();
  overall = input<number | undefined>();
  position = input.required<string>();
  fatigueScore = input<number | undefined>();
  muted = input(false);

  fatigueBadge = computed<FatigueBadge | null>(() => {
    const score = this.fatigueScore();
    return score !== undefined ? this.fatigueService.getBadge(score) : null;
  });
}
