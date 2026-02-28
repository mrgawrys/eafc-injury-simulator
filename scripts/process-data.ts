// scripts/process-data.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { distance } from "fastest-levenshtein";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RosterPlayer {
  name: string;
  team: string;
  position: string;
  age: number;
  overall?: number;
}

export interface InjuryRecord {
  playerName: string;
  club: string;
  season: string;
  injury: string;
  daysMissed: number;
}

export interface InjuryProfile {
  injuriesPerSeason: number;
  avgDaysMissed: number;
  stdDevDaysMissed: number;
  injuryTypeWeights: Record<string, number>;
}

export interface PlayerData {
  name: string;
  position: string;
  age: number;
  overall?: number;
  injuryProfile: InjuryProfile;
}

export interface TeamData {
  name: string;
  league: string;
  players: PlayerData[];
}

// --- Matching ---

export function matchPlayers(
  roster: RosterPlayer[],
  injuries: InjuryRecord[]
): Map<string, InjuryRecord[]> {
  const result = new Map<string, InjuryRecord[]>();

  // Group injuries by normalized club name for faster lookup
  const injuryByClub = new Map<string, InjuryRecord[]>();
  for (const inj of injuries) {
    const club = normalizeClub(inj.club);
    if (!injuryByClub.has(club)) injuryByClub.set(club, []);
    injuryByClub.get(club)!.push(inj);
  }

  for (const player of roster) {
    const normTeam = normalizeClub(player.team);

    // Find all injury records from clubs that fuzzy-match the roster club
    const candidateInjuries: InjuryRecord[] = [];
    for (const [club, injs] of injuryByClub) {
      if (clubsMatch(normTeam, club)) {
        candidateInjuries.push(...injs);
      }
    }

    // Exact name match first
    const exactMatches = candidateInjuries.filter(
      (inj) => normalizeName(inj.playerName) === normalizeName(player.name)
    );
    if (exactMatches.length > 0) {
      result.set(player.name, exactMatches);
      continue;
    }

    // Fuzzy name match — threshold: Levenshtein distance <= 3
    const fuzzyMatches = candidateInjuries.filter(
      (inj) => distance(normalizeName(inj.playerName), normalizeName(player.name)) <= 3
    );
    if (fuzzyMatches.length > 0) {
      result.set(player.name, fuzzyMatches);
    }
  }

  return result;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

function normalizeClub(club: string): string {
  return club
    .toLowerCase()
    .replace(/\bfc\b|\bafc\b|\bcf\b|\bsc\b/g, "")
    .trim();
}

function clubsMatch(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a) || distance(a, b) <= 5;
}

// --- Profile Building ---

export function buildInjuryProfile(injuries: InjuryRecord[]): InjuryProfile {
  const seasons = new Set(injuries.map((i) => i.season));
  const daysList = injuries.map((i) => i.daysMissed);

  const injuriesPerSeason = injuries.length / seasons.size;
  const avgDaysMissed = daysList.reduce((a, b) => a + b, 0) / daysList.length;

  const variance =
    daysList.reduce((sum, d) => sum + (d - avgDaysMissed) ** 2, 0) /
    daysList.length;
  const stdDevDaysMissed = Math.sqrt(variance);

  const typeCounts: Record<string, number> = {};
  for (const inj of injuries) {
    typeCounts[inj.injury] = (typeCounts[inj.injury] || 0) + 1;
  }
  const injuryTypeWeights: Record<string, number> = {};
  for (const [type, count] of Object.entries(typeCounts)) {
    injuryTypeWeights[type] = count / injuries.length;
  }

  return { injuriesPerSeason, avgDaysMissed, stdDevDaysMissed, injuryTypeWeights };
}

export function computeLeagueAverage(allInjuries: InjuryRecord[]): InjuryProfile {
  const byPlayer = new Map<string, InjuryRecord[]>();
  for (const inj of allInjuries) {
    const key = `${inj.playerName}__${inj.club}`;
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(inj);
  }

  const profiles = [...byPlayer.values()].map(buildInjuryProfile);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgProfile: InjuryProfile = {
    injuriesPerSeason: avg(profiles.map((p) => p.injuriesPerSeason)),
    avgDaysMissed: avg(profiles.map((p) => p.avgDaysMissed)),
    stdDevDaysMissed: avg(profiles.map((p) => p.stdDevDaysMissed)),
    injuryTypeWeights: {},
  };

  const allWeights: Record<string, number[]> = {};
  for (const p of profiles) {
    for (const [type, w] of Object.entries(p.injuryTypeWeights)) {
      if (!allWeights[type]) allWeights[type] = [];
      allWeights[type].push(w);
    }
  }
  for (const [type, weights] of Object.entries(allWeights)) {
    avgProfile.injuryTypeWeights[type] = avg(weights);
  }

  return avgProfile;
}

// --- CSV Parsing (adapted to actual dataset column names) ---

function parseRosterCsv(csv: string): RosterPlayer[] {
  const records = parse(csv, { columns: true, skip_empty_lines: true });
  return records
    .filter((r: Record<string, string>) => r["gender_id"] === "0") // men only
    .map((r: Record<string, string>) => {
      const firstName = r["first_name"] || "";
      const lastName = r["last_name"] || "";
      const commonName = r["common_name"] || "";
      const name = commonName || `${firstName} ${lastName}`.trim();
      const birthdate = r["birthdate"] || "";
      const age = birthdate ? Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 25;

      return {
        name,
        team: r["team"] || "",
        position: r["position_short_label"] || r["position"] || "",
        age,
        overall: parseInt(r["overall_rating"], 10) || undefined,
      };
    }).filter((p: RosterPlayer) => p.name && p.team);
}

function buildInjuryRecords(
  injuriesCsv: string,
  profilesCsv: string
): InjuryRecord[] {
  // Parse profiles to build player_id -> {name, club} lookup
  const profiles = parse(profilesCsv, { columns: true, skip_empty_lines: true });
  const profileMap = new Map<string, { name: string; club: string }>();
  for (const p of profiles) {
    profileMap.set(p["player_id"], {
      name: p["player_name"] || "",
      club: p["current_club_name"] || "",
    });
  }

  // Parse injuries and join with profiles
  const rawInjuries = parse(injuriesCsv, { columns: true, skip_empty_lines: true });
  const records: InjuryRecord[] = [];
  for (const r of rawInjuries) {
    const profile = profileMap.get(r["player_id"]);
    if (!profile || !profile.name) continue;

    const daysMissed = parseFloat(r["days_missed"] || "0") || 0;
    if (daysMissed <= 0) continue;

    records.push({
      playerName: profile.name,
      club: profile.club,
      season: r["season_name"] || "",
      injury: r["injury_reason"] || "Unknown",
      daysMissed: Math.round(daysMissed),
    });
  }
  return records;
}

// --- Main ---

async function main() {
  const RAW_DIR = join(__dirname, "..", "data-raw");
  const OUT_DIR = join(__dirname, "..", "public", "data");

  const rosterCsv = readFileSync(join(RAW_DIR, "roster.csv"), "utf-8");
  const injuriesCsv = readFileSync(join(RAW_DIR, "injuries.csv"), "utf-8");
  const profilesCsv = readFileSync(join(RAW_DIR, "profiles.csv"), "utf-8");

  console.log("Parsing CSVs...");
  const roster = parseRosterCsv(rosterCsv);
  const injuries = buildInjuryRecords(injuriesCsv, profilesCsv);
  console.log(`  ${roster.length} roster players, ${injuries.length} injury records`);

  console.log("Matching players...");
  const matches = matchPlayers(roster, injuries);
  console.log(`  Matched ${matches.size}/${roster.length} players`);

  console.log("Computing league average fallback...");
  const leagueAvg = computeLeagueAverage(injuries);

  // Group roster by team
  const teamMap = new Map<string, { players: RosterPlayer[]; league: string }>();
  for (const p of roster) {
    if (!teamMap.has(p.team)) teamMap.set(p.team, { players: [], league: "" });
    teamMap.get(p.team)!.players.push(p);
  }

  // Build output
  const teams: TeamData[] = [];

  for (const [teamName, { players, league }] of teamMap) {
    const teamPlayers: PlayerData[] = [];
    for (const p of players) {
      const playerInjuries = matches.get(p.name);
      const profile = playerInjuries
        ? buildInjuryProfile(playerInjuries)
        : leagueAvg;

      teamPlayers.push({
        name: p.name,
        position: p.position,
        age: p.age,
        overall: p.overall,
        injuryProfile: profile,
      });
    }
    teams.push({ name: teamName, league, players: teamPlayers });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "teams.json"), JSON.stringify(teams, null, 2));
  console.log(`✓ Written teams.json (${teams.length} teams)`);
}

if (process.argv[1]?.includes("process-data")) {
  main().catch((err) => {
    console.error("Processing failed:", err);
    process.exit(1);
  });
}
