import { Injectable, signal } from "@angular/core";
import type { Team } from "../models/player";

@Injectable({ providedIn: "root" })
export class DataService {
  private _teams = signal<Team[]>([]);
  readonly teams = this._teams.asReadonly();

  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();

  async loadData(): Promise<void> {
    if (this._loaded()) return;

    const res = await fetch("/data/teams.json");
    if (!res.ok) {
      throw new Error(
        "Failed to load team data. Did you run 'npm run setup-data'?"
      );
    }
    const teams: Team[] = await res.json();
    this._teams.set(teams);
    this._loaded.set(true);
  }

  getTeam(name: string): Team | undefined {
    return this._teams().find((t) => t.name === name);
  }
}
