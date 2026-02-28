import { Injectable, signal } from '@angular/core';
import type { Team, TeamsFile } from '../models/player';

@Injectable({ providedIn: 'root' })
export class DataService {
  private _teams = signal<Team[]>([]);
  readonly teams = this._teams.asReadonly();

  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  private static readonly CACHE_NAME = 'fifa-injuries-data-v1';
  private static readonly DATA_URL = 'data/teams.json';

  async loadData(): Promise<void> {
    if (this._loaded()) return;

    const res = await this.fetchWithCache(DataService.DATA_URL);
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

  private async fetchWithCache(url: string): Promise<Response> {
    if (typeof caches === 'undefined') {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load team data. Did you run 'npm run setup-data'?");
      return res;
    }

    const cache = await caches.open(DataService.CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load team data. Did you run 'npm run setup-data'?");
    cache.put(url, res.clone());
    return res;
  }
}
