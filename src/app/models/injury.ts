export interface Injury {
  playerId: string;       // "TeamName__PlayerName"
  playerName: string;
  type: string;           // e.g. "Hamstring Injury"
  startDate: string;      // ISO date
  returnDate: string;     // ISO date
  daysMissed: number;
}
