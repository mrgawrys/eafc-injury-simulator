import type { Injury } from "./injury";

export interface GameState {
  teamName: string;
  currentDate: string;      // ISO date
  seasonStartDate: string;  // ISO date
  activeInjuries: Injury[];
  injuryHistory: Injury[];
}
