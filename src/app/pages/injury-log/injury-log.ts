import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { StorageService } from "../../services/storage";
import type { Injury } from "../../models/injury";

@Component({
  selector: "app-injury-log",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./injury-log.html",
})
export class InjuryLogComponent implements OnInit {
  private storageService = inject(StorageService);
  private router = inject(Router);

  injuries = signal<Injury[]>([]);
  teamName = signal("");

  sortColumn = signal<string | null>(null);
  sortDirection = signal<'asc' | 'desc' | null>(null);

  sortedInjuries = computed(() => {
    const injuries = [...this.injuries()];
    const col = this.sortColumn();
    const dir = this.sortDirection();

    if (!col || !dir) {
      return injuries.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
    }

    return injuries.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (col) {
        case 'playerName': valA = a.playerName; valB = b.playerName; break;
        case 'type': valA = a.type; valB = b.type; break;
        case 'startDate': valA = a.startDate; valB = b.startDate; break;
        case 'daysMissed': valA = a.daysMissed; valB = b.daysMissed; break;
        case 'returnDate': valA = a.returnDate; valB = b.returnDate; break;
        default: return 0;
      }

      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  toggleSort(column: string) {
    if (this.sortColumn() === column) {
      if (this.sortDirection() === 'asc') {
        this.sortDirection.set('desc');
      } else {
        this.sortColumn.set(null);
        this.sortDirection.set(null);
      }
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  sortIndicator(column: string): string {
    if (this.sortColumn() !== column) return '';
    return this.sortDirection() === 'asc' ? ' ▲' : ' ▼';
  }

  ngOnInit() {
    const state = this.storageService.getActiveGameState();
    if (!state) {
      this.router.navigate(['/']);
      return;
    }
    this.teamName.set(state.teamName);
    this.injuries.set(state.injuryHistory);
  }
}
