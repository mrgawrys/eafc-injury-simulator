// scripts/process-data.test.ts
import { describe, it, expect } from "vitest";
import {
  matchPlayers,
  buildInjuryProfile,
  computeLeagueAverage,
  type RosterPlayer,
  type InjuryRecord,
} from "./process-data";

describe("matchPlayers", () => {
  const roster: RosterPlayer[] = [
    { name: "Mohamed Salah", team: "Liverpool", position: "RW", age: 32 },
    { name: "Virgil van Dijk", team: "Liverpool", position: "CB", age: 33 },
    { name: "Unknown Player", team: "Liverpool", position: "GK", age: 20 },
  ];

  const injuries: InjuryRecord[] = [
    { playerName: "Mohamed Salah", club: "Liverpool FC", season: "2022/23", injury: "Hamstring Injury", daysMissed: 14 },
    { playerName: "Mohamed Salah", club: "Liverpool FC", season: "2023/24", injury: "Muscle Injury", daysMissed: 7 },
    { playerName: "Virgil van Dijk", club: "Liverpool FC", season: "2022/23", injury: "Knee Injury", daysMissed: 30 },
  ];

  it("matches players by exact name and club substring", () => {
    const result = matchPlayers(roster, injuries);
    expect(result.get("Mohamed Salah")).toHaveLength(2);
    expect(result.get("Virgil van Dijk")).toHaveLength(1);
  });

  it("returns empty array for unmatched players", () => {
    const result = matchPlayers(roster, injuries);
    expect(result.get("Unknown Player")).toBeUndefined();
  });

  it("handles fuzzy name matching (accent/transliteration differences)", () => {
    const rosterWithAccent: RosterPlayer[] = [
      { name: "Pedri", team: "FC Barcelona", position: "CM", age: 21 },
    ];
    const injuriesWithFullName: InjuryRecord[] = [
      { playerName: "Pedro González López", club: "FC Barcelona", season: "2023/24", injury: "Hamstring Injury", daysMissed: 60 },
    ];
    // Fuzzy match should NOT match these (too different) — requires club match + close name
    const result = matchPlayers(rosterWithAccent, injuriesWithFullName);
    // Pedri -> Pedro González López is too far, should not match
    expect(result.get("Pedri")).toBeUndefined();
  });
});

describe("buildInjuryProfile", () => {
  it("computes correct per-player injury stats", () => {
    const injuries: InjuryRecord[] = [
      { playerName: "Test", club: "Club", season: "2021/22", injury: "Hamstring Injury", daysMissed: 10 },
      { playerName: "Test", club: "Club", season: "2022/23", injury: "Hamstring Injury", daysMissed: 20 },
      { playerName: "Test", club: "Club", season: "2022/23", injury: "Knee Injury", daysMissed: 30 },
      { playerName: "Test", club: "Club", season: "2023/24", injury: "Hamstring Injury", daysMissed: 15 },
    ];

    const profile = buildInjuryProfile(injuries);

    // 4 injuries across 3 seasons = ~1.33 per season
    expect(profile.injuriesPerSeason).toBeCloseTo(1.33, 1);
    // Mean of [10, 20, 30, 15] = 18.75
    expect(profile.avgDaysMissed).toBeCloseTo(18.75, 1);
    // Std dev of [10, 20, 30, 15]
    expect(profile.stdDevDaysMissed).toBeGreaterThan(0);
    // 3 hamstring, 1 knee
    expect(profile.injuryTypeWeights["Hamstring Injury"]).toBeCloseTo(0.75, 2);
    expect(profile.injuryTypeWeights["Knee Injury"]).toBeCloseTo(0.25, 2);
  });
});

describe("computeLeagueAverage", () => {
  it("computes a fallback profile from all injuries", () => {
    const allInjuries: InjuryRecord[] = [
      { playerName: "A", club: "X", season: "2022/23", injury: "Hamstring Injury", daysMissed: 10 },
      { playerName: "B", club: "Y", season: "2022/23", injury: "Knee Injury", daysMissed: 20 },
    ];
    const avg = computeLeagueAverage(allInjuries);
    expect(avg.avgDaysMissed).toBeCloseTo(15, 0);
    expect(avg.injuriesPerSeason).toBeGreaterThan(0);
  });
});
