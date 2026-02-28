import type { Injury } from './injury';
import type { MatchLog } from './fatigue';

export interface GameState {
  teamName: string;
  currentDate: string; // ISO date
  seasonStartDate: string; // ISO date
  activeInjuries: Injury[];
  injuryHistory: Injury[];
  // Fatigue system (optional, gated by fatigueEnabled)
  fatigueEnabled: boolean;
  defaultSquad: string[];
  matchLog: MatchLog[];
  playerFatigue: Record<string, number>;
  /** Maps playerId → recovery end date (ISO). Players recovering from injury have increased injury risk. */
  playerRecovery: Record<string, string>;
}
