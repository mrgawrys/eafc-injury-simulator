# Fatigue-Based Injury Simulation

## Overview

Add playing-time awareness to the injury simulation. Players who play every match accumulate fatigue, increasing injury risk. Players returning from injury start at elevated fatigue. Resting players reduces their risk. The entire feature is **optional per game** via a toggle at game creation.

## Context & Constraints

- Used for **Champions League tournaments** — matches can be days or months apart
- Players also play domestic league matches (~1 every 3-4 days) which we don't track but assume as background load
- The base `injuriesPerSeason` from Transfermarkt **already assumes heavy usage**, so multipliers should be subtle
- UX must stay fast: users advance between matches quickly and don't want to spend time managing squads

## Data Model

### New types

```typescript
interface PlayerMatchEntry {
  playerId: string;
  role: 'starter' | 'sub' | 'rested';
}

interface MatchLog {
  date: string;
  players: PlayerMatchEntry[];
}
```

### GameState changes

```typescript
interface GameState {
  // ...existing fields...
  fatigueEnabled: boolean;          // toggle set at game creation
  defaultSquad: string[];           // player IDs of starting XI
  matchLog: MatchLog[];             // history of who played each match
  playerFatigue: Record<string, number>; // current fatigue score per player ID (0-100)
}
```

## Fatigue Mechanics

### Fatigue score changes

| Event                    | Change        |
|--------------------------|---------------|
| Starter in a match       | +15           |
| Sub in a match           | +8            |
| Background league load   | +5 every ~3 days (auto) |
| Natural daily decay      | -3 per day    |
| Return from injury       | Starts at ~40-50, decays normally |
| Floor / ceiling          | 0 – 100       |

### Fatigue-to-injury multiplier

| Fatigue score | Multiplier | Badge            |
|---------------|------------|------------------|
| 0–25          | 0.85x      | Fresh (green)    |
| 26–50         | 1.0x       | — (no badge)     |
| 51–70         | 1.25x      | Fatigued (orange)|
| 71–85         | 1.5x       | High Risk (red)  |
| 86–100        | 2.0x       | High Risk (red)  |

### Injury probability formula

```
// Simple mode (fatigueEnabled = false):
dailyProb = injuriesPerSeason / 365

// Fatigue mode (fatigueEnabled = true):
dailyProb = (injuriesPerSeason / 365) * fatigueMultiplier(playerFatigue)
```

### Why multipliers are conservative

The base `injuriesPerSeason` already reflects real-world data where players play most matches. So 1.0x = "normal heavy usage" (what the data assumes). The system mostly **rewards rotation** (0.85x for rested players) rather than dramatically punishing heavy play. Only extreme situations (just back from injury at 86-100 fatigue) reach 2.0x.

## Architecture

### No DI strategy pattern — simple branching

`SimulationService` reads `fatigueEnabled` from GameState and branches with `if`:

```typescript
const dailyProb = state.fatigueEnabled
  ? (injuriesPerSeason / 365) * this.fatigueMultiplier(fatigue)
  : injuriesPerSeason / 365;
```

Dashboard checks `gameState().fatigueEnabled` to conditionally render squad selection step and fatigue badges.

### Fatigue update flow

During `simulateRange()`, when fatigue is enabled:
1. Each simulated day: decay all fatigue scores by natural rate (-3/day)
2. Every ~3 days: add background league load (+5)
3. On match day (when a MatchLog entry exists for that date): apply starter/sub fatigue gains
4. On recovery day (player's returnDate): set fatigue to ~40-50

## UX Flow

### Game creation (team selection page)

1. Pick a team (existing)
2. **New toggle**: "Enable fatigue simulation" with description
3. **If enabled**: "Select Starting XI" step — tap 11 players grouped by position
4. Start game

### Match day flow (advance time dialog, redesigned when fatigue enabled)

**Step 1 — "Who Played?"**
- Shows default XI as starters
- Injured players auto-swapped out and highlighted
- Empty slots for replacements — tap to pick from bench
- "Subs" section below — tap bench players to mark as subbed in
- Date picker for match date

**Step 2 — Confirm & Simulate**
- Simulation runs from current date to match date
- Fatigue scores updated based on squad selection

**Step 3 — Results**
- Same as current: new injuries, recoveries
- Fatigue badge changes visible on squad table after closing

### When fatigue is disabled

Advance time dialog works exactly as it does today — date picker, simulate, results. No squad selection step.

### Dashboard changes (fatigue enabled)

- Squad table gains a **Fatigue column** with pill badges:
  - Fresh (green) — 0-25
  - Fatigued (orange) — 51-70
  - High Risk (red) — 71-100
  - No badge for normal range (26-50)
- "Edit Starting XI" button accessible from dashboard
- Players returning from injury show both injury status and fatigue badge

### What stays the same

- Injury log page — unchanged
- Storage mechanism — localStorage, same key
- Day-by-day simulation loop — unchanged internally
- All existing UI when fatigue is disabled

## Feature toggle

The `fatigueEnabled` flag in GameState controls everything:
- Stored per game in localStorage
- Set at game creation, persists for the season
- All new UI and logic is gated behind `gameState().fatigueEnabled` checks
- Existing behavior is completely preserved when disabled
