import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DataService } from "../../services/data";
import { StorageService } from "../../services/storage";
import type { GameState } from "../../models/game-state";

@Component({
  selector: "app-team-selection",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./team-selection.html",
})
export class TeamSelectionComponent implements OnInit {
  private dataService = inject(DataService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  searchQuery = signal("");
  hasActiveGame = signal(false);
  activeTeamName = signal("");

  filteredTeams = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const teams = this.dataService.teams();
    if (!query) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(query));
  });

  loaded = this.dataService.loaded;

  async ngOnInit() {
    await this.dataService.loadData();
    const existingState = this.storageService.getGameState();
    if (existingState) {
      this.hasActiveGame.set(true);
      this.activeTeamName.set(existingState.teamName);
    }
  }

  selectTeam(teamName: string) {
    const today = new Date().toISOString().slice(0, 10);
    const state: GameState = {
      teamName,
      currentDate: today,
      seasonStartDate: today,
      activeInjuries: [],
      injuryHistory: [],
    };
    this.storageService.saveGameState(state);
    this.router.navigate(["/dashboard"]);
  }

  continueGame() {
    this.router.navigate(["/dashboard"]);
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }
}
