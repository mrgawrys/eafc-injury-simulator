import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { DataService } from "../../services/data";
import { StorageService } from "../../services/storage";
import { SimulationService } from "../../services/simulation";
import { FatigueService } from "../../services/fatigue";
import { PlayerAvatarComponent } from "../../components/player-avatar";
import { PlayerListItemComponent } from "../../components/player-list-item";
import { SquadPickerComponent } from "../../components/squad-picker";
import type { GameState } from "../../models/game-state";
import type { Player } from "../../models/player";
import type { Injury } from "../../models/injury";
import type { MatchRole, PlayerMatchEntry } from "../../models/fatigue";

interface PlayerRow {
  name: string;
  position: string;
  age: number;
  overall?: number;
  avatarUrl?: string;
  status: "available" | "injured" | "returning-soon" | "recovering";
  injury?: Injury;
  recoveryEndDate?: string;
  fatigueBadge?: 'fresh' | 'fatigued' | 'high-risk' | null;
  fatigueScore?: number;
  inSquad?: boolean;
}

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink, PlayerAvatarComponent, PlayerListItemComponent, SquadPickerComponent],
  templateUrl: "./dashboard.html",
})
export class DashboardComponent implements OnInit {
  private dataService = inject(DataService);
  private storageService = inject(StorageService);
  private simulationService = inject(SimulationService);
  private fatigueService = inject(FatigueService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  gameState = signal<GameState | null>(null);
  showAdvanceDialog = signal(false);
  targetDate = signal("");
  lastResult = signal<{ newInjuries: Injury[]; recovered: string[] } | null>(null);
  matchSquad = signal<Record<string, MatchRole>>({});
  advanceStep = signal<'squad' | 'date' | 'result'>('date');

  // Edit Starting XI
  showEditSquad = signal(false);
  initialSquadPick = signal(false);

  teamName = computed(() => this.gameState()?.teamName ?? "");
  teamPlayers = computed(() => {
    const name = this.teamName();
    if (!name) return [];
    const team = this.dataService.getTeam(name);
    return team?.players ?? [];
  });
  currentDate = computed(() => this.gameState()?.currentDate ?? "");
  fatigueEnabled = computed(() => this.gameState()?.fatigueEnabled ?? false);
  teamBadgeUrl = computed(() => {
    const name = this.teamName();
    return name ? this.dataService.getTeam(name)?.badgeUrl : undefined;
  });

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
      let recoveryEndDate: string | undefined;
      if (injury) {
        const daysUntilReturn = Math.ceil(
          (new Date(injury.returnDate).getTime() - new Date(state.currentDate).getTime()) / 86400000
        );
        status = daysUntilReturn <= 3 ? "returning-soon" : "injured";
      } else if (state.playerRecovery?.[playerId] && state.playerRecovery[playerId] > state.currentDate) {
        status = "recovering";
        recoveryEndDate = state.playerRecovery[playerId];
      }

      const fatigueScore = state.fatigueEnabled
        ? (state.playerFatigue[playerId] ?? 30)
        : undefined;
      const fatigueBadge = fatigueScore !== undefined
        ? this.fatigueService.getBadge(fatigueScore)
        : undefined;
      const inSquad = state.fatigueEnabled
        ? state.defaultSquad.includes(playerId)
        : undefined;

      return { name: p.name, position: p.position, age: p.age, overall: p.overall, avatarUrl: p.avatarUrl, status, injury, recoveryEndDate, fatigueBadge, fatigueScore, inSquad };
    });

    const statusOrder: Record<string, number> = { injured: 0, "returning-soon": 1, recovering: 2, available: 3 };
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
        case 'position': {
          const posOrder: Record<string, number> = {
            GK: 0, CB: 1, LB: 2, RB: 3, CDM: 4, CM: 5, LM: 6, RM: 7, CAM: 8, LW: 9, RW: 10, ST: 11,
          };
          valA = posOrder[a.position] ?? 99; valB = posOrder[b.position] ?? 99; break;
        }
        case 'age': valA = a.age; valB = b.age; break;
        case 'status': {
          const order: Record<string, number> = { injured: 0, 'returning-soon': 1, recovering: 2, available: 3 };
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

    if (this.route.snapshot.queryParamMap.get('pickSquad')) {
      this.initialSquadPick.set(true);
      this.showEditSquad.set(true);
    }
  }

  openAdvanceDialog() {
    this.lastResult.set(null);
    this.targetDate.set(this.addDays(this.gameState()?.currentDate ?? "", 3));
    if (this.fatigueEnabled()) {
      this.initMatchSquad();
      this.advanceStep.set('squad');
    } else {
      this.advanceStep.set('date');
    }
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

    let updatedFatigue = state.playerFatigue;
    const newMatchLog = [...state.matchLog];

    if (state.fatigueEnabled) {
      const squad = this.matchSquad();
      const entries: PlayerMatchEntry[] = Object.entries(squad).map(([playerId, role]) => ({
        playerId,
        role,
      }));

      // Apply match load to fatigue before simulating
      const fatigueAfterMatch = { ...state.playerFatigue };
      for (const entry of entries) {
        const current = fatigueAfterMatch[entry.playerId] ?? 30;
        fatigueAfterMatch[entry.playerId] = this.fatigueService.applyMatchLoad(current, entry.role);
      }
      updatedFatigue = fatigueAfterMatch;
      newMatchLog.push({ date: state.currentDate, players: entries });
    }

    const result = this.simulationService.simulateRange(
      team.players,
      state.activeInjuries,
      state.teamName,
      state.currentDate,
      toDate,
      state.fatigueEnabled ? updatedFatigue : undefined,
      state.playerRecovery
    );

    const newState: GameState = {
      ...state,
      currentDate: toDate,
      activeInjuries: result.activeInjuries,
      injuryHistory: [...state.injuryHistory, ...result.newInjuries],
      matchLog: newMatchLog,
      playerFatigue: result.updatedFatigue ?? state.playerFatigue,
      playerRecovery: result.updatedRecovery ?? state.playerRecovery,
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
    this.advanceStep.set('result');
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

  getPlayerAvatarUrl(playerName: string): string | undefined {
    const state = this.gameState();
    if (!state) return undefined;
    const team = this.dataService.getTeam(state.teamName);
    return team?.players.find((p) => p.name === playerName)?.avatarUrl;
  }

  initMatchSquad() {
    const state = this.gameState();
    if (!state) return;
    const team = this.dataService.getTeam(state.teamName);
    if (!team) return;

    const injuredIds = new Set(state.activeInjuries.map(i => i.playerId));
    const squad: Record<string, MatchRole> = {};

    for (const p of team.players) {
      const id = `${state.teamName}__${p.name}`;
      if (injuredIds.has(id)) {
        squad[id] = 'rested';
      } else if (state.defaultSquad.includes(id)) {
        squad[id] = 'starter';
      } else {
        squad[id] = 'rested';
      }
    }
    this.matchSquad.set(squad);
  }

  cycleRole(playerId: string) {
    const state = this.gameState();
    if (!state) return;
    const injuredIds = new Set(state.activeInjuries.map(i => i.playerId));
    if (injuredIds.has(playerId)) return;

    this.matchSquad.update(squad => {
      const current = squad[playerId] ?? 'rested';
      const starterCount = Object.values(squad).filter(r => r === 'starter').length;
      let next: MatchRole;
      if (current === 'rested') {
        next = starterCount < 11 ? 'starter' : 'sub';
      } else if (current === 'starter') {
        next = 'sub';
      } else {
        next = 'rested';
      }
      return { ...squad, [playerId]: next };
    });
  }

  proceedToDate() {
    this.advanceStep.set('date');
  }

  openEditSquad() {
    this.initialSquadPick.set(false);
    this.showEditSquad.set(true);
  }

  saveSquad(selected: Set<string>) {
    const state = this.gameState();
    if (!state) return;
    const newState = { ...state, defaultSquad: [...selected] };
    const saveId = this.storageService.getActiveSaveId()!;
    const save = this.storageService.getSave(saveId)!;
    this.storageService.saveSave({
      ...save,
      gameState: newState,
      updatedAt: new Date().toISOString(),
    });
    this.gameState.set(newState);
    this.showEditSquad.set(false);
    this.initialSquadPick.set(false);
  }

  cancelEditSquad() {
    this.showEditSquad.set(false);
    this.initialSquadPick.set(false);
  }

  private addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
