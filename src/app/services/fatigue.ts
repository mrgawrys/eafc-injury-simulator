import { Injectable } from '@angular/core';
import type { MatchRole } from '../models/fatigue';

export type FatigueBadge = 'fresh' | 'fatigued' | 'high-risk';

@Injectable({ providedIn: 'root' })
export class FatigueService {
  /** Returns injury probability multiplier based on fatigue score. */
  getMultiplier(fatigue: number): number {
    if (fatigue <= 25) return 0.85;
    if (fatigue <= 50) return 1.0;
    if (fatigue <= 70) return 1.25;
    if (fatigue <= 85) return 1.5;
    return 2.0;
  }

  /** Subtract 3 fatigue per day, floor at 0. */
  decayFatigue(current: number, days: number): number {
    return Math.max(0, current - days * 3);
  }

  /** Add 5 fatigue for every 3 days elapsed, cap at 100. */
  addBackgroundLeagueLoad(current: number, days: number): number {
    const loads = Math.floor(days / 3);
    return Math.min(100, current + loads * 5);
  }

  /** Apply match load: starter +15, sub +8, rested +0, cap at 100. */
  applyMatchLoad(current: number, role: MatchRole): number {
    if (role === 'rested') return current;
    const add = role === 'starter' ? 15 : 8;
    return Math.min(100, current + add);
  }

  /** Returns a random fatigue value between 40 and 50 for players returning from injury. */
  getReturnFromInjuryFatigue(): number {
    return 40 + Math.floor(Math.random() * 11);
  }

  /** Returns a badge label based on fatigue level, or null for normal range. */
  getBadge(fatigue: number): FatigueBadge | null {
    if (fatigue <= 25) return 'fresh';
    if (fatigue <= 50) return null;
    if (fatigue <= 70) return 'fatigued';
    return 'high-risk';
  }

  /** Applies decay and background load for N days to all players in the fatigue record. */
  updateFatigueForDays(
    fatigue: Record<string, number>,
    days: number
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, score] of Object.entries(fatigue)) {
      let updated = this.decayFatigue(score, days);
      updated = this.addBackgroundLeagueLoad(updated, days);
      result[id] = updated;
    }
    return result;
  }
}
