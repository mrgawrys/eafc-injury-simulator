import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data';
import { StorageService } from '../../services/storage';
import type { SaveSlot } from '../../models/save-slot';
import type { GameState } from '../../models/game-state';

@Component({
  selector: 'app-team-selection',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './team-selection.html',
})
export class TeamSelectionComponent implements OnInit {
  private dataService = inject(DataService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  searchQuery = signal('');
  saves = signal<SaveSlot[]>([]);
  showAllSaves = signal(false);
  fatigueEnabled = signal(true);

  // New season dialog
  showNewSeasonDialog = signal(false);
  selectedTeamName = signal('');
  saveName = signal('');


  filteredTeams = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const teams = this.dataService.teams();
    if (!query) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(query));
  });

  latestSave = computed(() => {
    const all = this.saves();
    if (all.length === 0) return null;
    return [...all].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  });

  olderSaves = computed(() => {
    const latest = this.latestSave();
    if (!latest) return [];
    return this.saves()
      .filter((s) => s.id !== latest.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  loaded = this.dataService.loaded;

  async ngOnInit() {
    await this.dataService.loadData();
    this.refreshSaves();
  }

  private refreshSaves() {
    this.saves.set(this.storageService.getSaves());
  }

  private getNextSaveNumber(teamName: string): number {
    const existing = this.saves().filter((s) => s.gameState.teamName === teamName);
    return existing.length + 1;
  }

  toggleFatigue() {
    this.fatigueEnabled.update((v) => !v);
  }

  openNewSeasonDialog(teamName: string) {
    this.selectedTeamName.set(teamName);
    const num = this.getNextSaveNumber(teamName);
    this.saveName.set(`${teamName} Save (${num})`);
    this.showNewSeasonDialog.set(true);
  }

  closeNewSeasonDialog() {
    this.showNewSeasonDialog.set(false);
  }

  createSave() {
    if (this.fatigueEnabled()) {
      const teamName = this.selectedTeamName();
      const team = this.dataService.getTeam(teamName);
      const playerFatigue: Record<string, number> = {};
      if (team) {
        for (const p of team.players) {
          playerFatigue[`${teamName}__${p.name}`] = 30;
        }
      }
      this.startGame([], playerFatigue, true);
      return;
    }
    this.startGame([], {});
  }

  private startGame(defaultSquad: string[], playerFatigue: Record<string, number>, pickSquad = false) {
    const teamName = this.selectedTeamName();
    const name = this.saveName().trim() || `${teamName} Save`;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const gameState: GameState = {
      teamName,
      currentDate: today,
      seasonStartDate: today,
      activeInjuries: [],
      injuryHistory: [],
      fatigueEnabled: this.fatigueEnabled(),
      defaultSquad,
      matchLog: [],
      playerFatigue,
      playerRecovery: {},
    };

    const slot: SaveSlot = {
      id: crypto.randomUUID(),
      name,
      gameState,
      createdAt: now,
      updatedAt: now,
    };

    this.storageService.saveSave(slot);
    this.storageService.setActiveSaveId(slot.id);
    this.router.navigate(['/dashboard'], pickSquad ? { queryParams: { pickSquad: '1' } } : {});
  }

  loadSave(save: SaveSlot) {
    this.storageService.setActiveSaveId(save.id);
    this.router.navigate(['/dashboard']);
  }

  deleteSave(save: SaveSlot, event: Event) {
    event.stopPropagation();
    this.storageService.deleteSave(save.id);
    this.refreshSaves();
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onSaveNameInput(event: Event) {
    this.saveName.set((event.target as HTMLInputElement).value);
  }

  getTeamBadgeUrl(teamName: string): string | undefined {
    return this.dataService.getTeam(teamName)?.badgeUrl;
  }
}
