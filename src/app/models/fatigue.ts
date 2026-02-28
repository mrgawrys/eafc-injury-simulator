export type MatchRole = 'starter' | 'sub' | 'rested';

export interface PlayerMatchEntry {
  playerId: string;
  role: MatchRole;
}

export interface MatchLog {
  date: string;
  players: PlayerMatchEntry[];
}
