import { Component, computed, effect, input, output, signal } from '@angular/core';
import type { Player } from '../models/player';

@Component({
  selector: 'app-squad-picker',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="dismissable() && cancel.emit()">
      <div
        class="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg max-h-[80vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <div class="sticky top-0 z-10 bg-background pb-3">
          <h3 class="text-lg font-semibold">{{ title() }}</h3>
          <p class="mt-1 text-sm text-muted-foreground">{{ selectedCount() }}/11 selected</p>

          <div class="mt-3 flex gap-2">
            <button
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              [disabled]="selectedCount() !== 11"
              (click)="save.emit(selectedIds())"
            >
              {{ confirmLabel() }}
            </button>
            @if (dismissable()) {
              <button
                class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                (click)="cancel.emit()"
              >
                Cancel
              </button>
            }
          </div>
        </div>

        <div class="space-y-1">
          @for (player of players(); track player.name) {
            @let playerId = teamName() + '__' + player.name;
            <button
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
              [class]="selectedIds().has(playerId) ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              (click)="togglePlayer(playerId)"
            >
              <span>{{ player.name }}</span>
              <span class="text-xs text-muted-foreground">{{ player.position }}</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class SquadPickerComponent {
  players = input.required<Player[]>();
  teamName = input.required<string>();
  initialSelection = input<string[]>([]);
  title = input('Select Starting XI');
  confirmLabel = input('Save');
  dismissable = input(true);

  save = output<Set<string>>();
  cancel = output<void>();

  selectedIds = signal<Set<string>>(new Set());
  selectedCount = computed(() => this.selectedIds().size);

  constructor() {
    effect(() => {
      const init = this.initialSelection();
      this.selectedIds.set(new Set(init));
    });
  }

  togglePlayer(playerId: string) {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else if (next.size < 11) {
        next.add(playerId);
      }
      return next;
    });
  }
}
