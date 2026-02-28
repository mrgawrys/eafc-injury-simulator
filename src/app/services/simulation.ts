import { inject, Injectable } from '@angular/core';
import type { Player, InjuryProfile } from '../models/player';
import type { Injury } from '../models/injury';
import { FatigueService } from './fatigue';

/** Recovery injury-risk multiplier for players recently returned from injury. */
const RECOVERY_MULTIPLIER = 1.5;

export interface DayResult {
  newInjuries: Injury[];
  recovered: string[];
  activeInjuries: Injury[];
  updatedFatigue?: Record<string, number>;
  updatedRecovery?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class SimulationService {
  private fatigueService = inject(FatigueService);

  /** Simulate a single day for all players */
  simulateDay(
    players: Player[],
    activeInjuries: Injury[],
    teamName: string,
    date: string,
    playerFatigue?: Record<string, number>,
    playerRecovery?: Record<string, string>
  ): DayResult {
    const newInjuries: Injury[] = [];
    const injuredPlayerIds = new Set(activeInjuries.map((i) => i.playerId));

    for (const player of players) {
      const playerId = `${teamName}__${player.name}`;
      if (injuredPlayerIds.has(playerId)) continue;

      let dailyProb = player.injuryProfile.injuriesPerSeason / 365;
      if (playerFatigue && playerId in playerFatigue) {
        dailyProb *= this.fatigueService.getMultiplier(playerFatigue[playerId]);
      }
      if (playerRecovery && playerId in playerRecovery && playerRecovery[playerId] > date) {
        dailyProb *= RECOVERY_MULTIPLIER;
      }
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
    toDate: string,
    playerFatigue?: Record<string, number>,
    playerRecovery?: Record<string, string>
  ): DayResult {
    let current = activeInjuries.slice();
    const allNewInjuries: Injury[] = [];
    const allRecovered = new Set<string>();
    let fatigue = playerFatigue ? { ...playerFatigue } : undefined;
    let recovery = playerRecovery ? { ...playerRecovery } : undefined;
    let dayCount = 0;

    const start = new Date(fromDate);
    const end = new Date(toDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      dayCount++;

      if (fatigue) {
        // Decay all fatigue by 1 day (= -3 per player)
        for (const id of Object.keys(fatigue)) {
          fatigue[id] = Math.max(0, fatigue[id] - 3);
        }
        // Background league load every 3 days
        if (dayCount % 3 === 0) {
          for (const id of Object.keys(fatigue)) {
            fatigue[id] = Math.min(100, fatigue[id] + 5);
          }
        }
      }

      // Expire finished recovery periods
      if (recovery) {
        for (const id of Object.keys(recovery)) {
          if (recovery[id] <= dateStr) {
            delete recovery[id];
          }
        }
      }

      // Check recoveries
      const stillInjured: Injury[] = [];
      for (const inj of current) {
        if (inj.returnDate <= dateStr) {
          allRecovered.add(inj.playerName);
          if (fatigue) {
            fatigue[inj.playerId] = this.fatigueService.getReturnFromInjuryFatigue();
          }
          // Set recovery period: 30% of days missed, clamped to 3-14 days
          const recoveryDays = Math.min(14, Math.max(3, Math.round(inj.daysMissed * 0.3)));
          if (!recovery) recovery = {};
          recovery[inj.playerId] = this.addDays(dateStr, recoveryDays);
        } else {
          stillInjured.push(inj);
        }
      }
      current = stillInjured;

      // Simulate new injuries
      const dayResult = this.simulateDay(players, current, teamName, dateStr, fatigue, recovery);
      allNewInjuries.push(...dayResult.newInjuries);
      current = [...current, ...dayResult.newInjuries];
    }

    return {
      newInjuries: allNewInjuries,
      recovered: [...allRecovered],
      activeInjuries: current,
      updatedFatigue: fatigue,
      updatedRecovery: recovery,
    };
  }

  private sampleDuration(profile: InjuryProfile): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const duration = Math.round(profile.avgDaysMissed + z * profile.stdDevDaysMissed);
    return Math.min(120, Math.max(1, duration));
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
