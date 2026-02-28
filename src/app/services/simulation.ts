import { Injectable } from "@angular/core";
import type { Player, InjuryProfile } from "../models/player";
import type { Injury } from "../models/injury";

export interface DayResult {
  newInjuries: Injury[];
  recovered: string[];
  activeInjuries: Injury[];
}

@Injectable({ providedIn: "root" })
export class SimulationService {
  /** Simulate a single day for all players */
  simulateDay(
    players: Player[],
    activeInjuries: Injury[],
    teamName: string,
    date: string
  ): DayResult {
    const newInjuries: Injury[] = [];
    const injuredPlayerIds = new Set(activeInjuries.map((i) => i.playerId));

    for (const player of players) {
      const playerId = `${teamName}__${player.name}`;
      if (injuredPlayerIds.has(playerId)) continue;

      const dailyProb = player.injuryProfile.injuriesPerSeason / 365;
      if (Math.random() < dailyProb) {
        const duration = this.sampleDuration(player.injuryProfile);
        const returnDate = this.addDays(date, duration);
        const type = this.sampleInjuryType(player.injuryProfile);

        newInjuries.push({
          playerId,
          playerName: player.name,
          type,
          startDate: date,
          returnDate,
          daysMissed: duration,
        });
      }
    }

    return {
      newInjuries,
      recovered: [],
      activeInjuries: [...activeInjuries, ...newInjuries],
    };
  }

  /** Simulate all days from fromDate (exclusive) to toDate (inclusive) */
  simulateRange(
    players: Player[],
    activeInjuries: Injury[],
    teamName: string,
    fromDate: string,
    toDate: string
  ): DayResult {
    let current = activeInjuries.slice();
    const allNewInjuries: Injury[] = [];
    const allRecovered = new Set<string>();

    const start = new Date(fromDate);
    const end = new Date(toDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);

      // Check recoveries
      const stillInjured: Injury[] = [];
      for (const inj of current) {
        if (inj.returnDate <= dateStr) {
          allRecovered.add(inj.playerName);
        } else {
          stillInjured.push(inj);
        }
      }
      current = stillInjured;

      // Simulate new injuries
      const dayResult = this.simulateDay(players, current, teamName, dateStr);
      allNewInjuries.push(...dayResult.newInjuries);
      current = [...current, ...dayResult.newInjuries];
    }

    return {
      newInjuries: allNewInjuries,
      recovered: [...allRecovered],
      activeInjuries: current,
    };
  }

  private sampleDuration(profile: InjuryProfile): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const duration = Math.round(profile.avgDaysMissed + z * profile.stdDevDaysMissed);
    return Math.max(1, duration);
  }

  private sampleInjuryType(profile: InjuryProfile): string {
    const entries = Object.entries(profile.injuryTypeWeights);
    const rand = Math.random();
    let cumulative = 0;
    for (const [type, weight] of entries) {
      cumulative += weight;
      if (rand < cumulative) return type;
    }
    return entries[entries.length - 1][0];
  }

  private addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
