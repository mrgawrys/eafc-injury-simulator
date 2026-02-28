import { Injectable, signal } from '@angular/core';
import type { Team, TeamsFile } from '../models/player';

@Injectable({ providedIn: 'root' })
export class DataService {
  private _teams = signal<Team[]>([]);
  readonly teams = this._teams.asReadonly();

  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  async loadData(): Promise<void> {
    if (this._loaded()) return;

    const res = await fetch('/data/teams.json');
    if (!res.ok) {
      throw new Error("Failed to load team data. Did you run 'npm run setup-data'?");
    }
    const data: TeamsFile = await res.json();

    // Hydrate players that have no individual profile with the league average
    const teams: Team[] = data.teams.map((t) => ({
      ...t,
      players: t.players.map((p) => ({
        ...p,
        injuryProfile: p.injuryProfile ?? data.leagueAverage,
      })),
    }));

    this._teams.set(teams);
    this._loaded.set(true);
  }

  getTeam(name: string): Team | undefined {
    return this._teams().find((t) => t.name === name);
  }
}
