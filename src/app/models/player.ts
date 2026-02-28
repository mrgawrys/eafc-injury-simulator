export interface InjuryProfile {
  injuriesPerSeason: number;
  avgDaysMissed: number;
  stdDevDaysMissed: number;
  injuryTypeWeights: Record<string, number>;
}

export interface Player {
  name: string;
  position: string;
  age: number;
  overall?: number;
  avatarUrl?: string;
  injuryProfile: InjuryProfile;
}

export interface Team {
  name: string;
  league: string;
  badgeUrl?: string;
  players: Player[];
}
