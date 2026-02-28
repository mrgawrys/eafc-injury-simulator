import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { DataService } from "../../services/data";
import { StorageService } from "../../services/storage";
import { SimulationService } from "../../services/simulation";
import type { GameState } from "../../models/game-state";
import type { Player } from "../../models/player";
import type { Injury } from "../../models/injury";

interface PlayerRow {
  name: string;
  position: string;
  age: number;
  overall?: number;
  status: "available" | "injured" | "returning-soon";
  injury?: Injury;
}

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./dashboard.html",
})
export class DashboardComponent implements OnInit {
  private dataService = inject(DataService);
  private storageService = inject(StorageService);
  private simulationService = inject(SimulationService);
  private router = inject(Router);

  gameState = signal<GameState | null>(null);
  showAdvanceDialog = signal(false);
  targetDate = signal("");
  lastResult = signal<{ newInjuries: Injury[]; recovered: string[] } | null>(null);

  teamName = computed(() => this.gameState()?.teamName ?? "");
  currentDate = computed(() => this.gameState()?.currentDate ?? "");

  players = computed<PlayerRow[]>(() => {
    const state = this.gameState();
    if (!state) return [];

    const team = this.dataService.getTeam(state.teamName);
    if (!team) return [];

    const injuryMap = new Map<string, Injury>();
    for (const inj of state.activeInjuries) {
      injuryMap.set(inj.playerId, inj);
    }

    const rows = team.players.map((p: Player) => {
      const playerId = `${state.teamName}__${p.name}`;
      const injury = injuryMap.get(playerId);

      let status: PlayerRow["status"] = "available";
      if (injury) {
        const daysUntilReturn = Math.ceil(
          (new Date(injury.returnDate).getTime() - new Date(state.currentDate).getTime()) / 86400000
        );
        status = daysUntilReturn <= 3 ? "returning-soon" : "injured";
      }

      return { name: p.name, position: p.position, age: p.age, overall: p.overall, status, injury };
    });

    const statusOrder: Record<string, number> = { injured: 0, "returning-soon": 1, available: 2 };
    return rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  });

  sortColumn = signal<string | null>(null);
  sortDirection = signal<'asc' | 'desc' | null>(null);

  sortedPlayers = computed<PlayerRow[]>(() => {
    const rows = this.players();
    const col = this.sortColumn();
    const dir = this.sortDirection();
    if (!col || !dir) return rows;

    return [...rows].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (col) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'overall': valA = a.overall ?? 0; valB = b.overall ?? 0; break;
        case 'position': valA = a.position; valB = b.position; break;
        case 'age': valA = a.age; valB = b.age; break;
        case 'status': {
          const order: Record<string, number> = { injured: 0, 'returning-soon': 1, available: 2 };
          valA = order[a.status]; valB = order[b.status]; break;
        }
        default: return 0;
      }

      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  injuredCount = computed(() => this.players().filter((p) => p.status !== "available").length);
  availableCount = computed(() => this.players().filter((p) => p.status === "available").length);

  async ngOnInit() {
    await this.dataService.loadData();
    const state = this.storageService.getActiveGameState();
    if (!state) {
      this.router.navigate(['/']);
      return;
    }
    this.gameState.set(state);
  }

  openAdvanceDialog() {
    this.lastResult.set(null);
    this.targetDate.set(this.addDays(this.gameState()?.currentDate ?? "", 3));
    this.showAdvanceDialog.set(true);
  }

  closeDialog() {
    this.showAdvanceDialog.set(false);
  }

  advanceTime() {
    const state = this.gameState();
    if (!state) return;

    const team = this.dataService.getTeam(state.teamName);
    if (!team) return;

    const toDate = this.targetDate();
    if (toDate <= state.currentDate) return;

    const result = this.simulationService.simulateRange(
      team.players,
      state.activeInjuries,
      state.teamName,
      state.currentDate,
      toDate
    );

    const newState: GameState = {
      ...state,
      currentDate: toDate,
      activeInjuries: result.activeInjuries,
      injuryHistory: [...state.injuryHistory, ...result.newInjuries],
    };

    const saveId = this.storageService.getActiveSaveId()!;
    const save = this.storageService.getSave(saveId)!;
    this.storageService.saveSave({
      ...save,
      gameState: newState,
      updatedAt: new Date().toISOString(),
    });
    this.gameState.set(newState);
    this.lastResult.set({ newInjuries: result.newInjuries, recovered: result.recovered });
  }

  advanceToNextMatch() {
    const state = this.gameState();
    if (!state) return;
    this.targetDate.set(this.addDays(state.currentDate, 3));
    this.advanceTime();
  }

  backToHome() {
    this.router.navigate(['/']);
  }

  onDateInput(event: Event) {
    this.targetDate.set((event.target as HTMLInputElement).value);
  }

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

  private addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
