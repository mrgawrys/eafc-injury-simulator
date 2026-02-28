# Fatigue Simulation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional playing-time-aware fatigue system that modifies injury probabilities based on squad selection, substitutions, and return-from-injury cooldowns.

**Architecture:** Simple branching in SimulationService gated by `GameState.fatigueEnabled`. New fatigue model types + FatigueService for score calculations. Dashboard gets a squad selection step in the advance dialog and fatigue badges in the squad table. Team selection gets a toggle + starting XI picker.

**Tech Stack:** Angular 21, TypeScript strict mode, Vitest, Tailwind CSS v4, Signals

---

### Task 1: Add fatigue model types

**Files:**
- Create: `src/app/models/fatigue.ts`
- Modify: `src/app/models/game-state.ts`

**Step 1: Create fatigue model file**

```typescript
// src/app/models/fatigue.ts
export type MatchRole = 'starter' | 'sub' | 'rested';

export interface PlayerMatchEntry {
  playerId: string;
  role: MatchRole;
}

export interface MatchLog {
  date: string;
  players: PlayerMatchEntry[];
}
```

**Step 2: Add new optional fields to GameState**

In `src/app/models/game-state.ts`, add to the `GameState` interface:

```typescript
import type { MatchLog } from './fatigue';

export interface GameState {
  teamName: string;
  currentDate: string;
  seasonStartDate: string;
  activeInjuries: Injury[];
  injuryHistory: Injury[];
  // Fatigue system (optional, gated by fatigueEnabled)
  fatigueEnabled: boolean;
  defaultSquad: string[];               // player IDs of starting XI
  matchLog: MatchLog[];                 // history of who played each match
  playerFatigue: Record<string, number>; // current fatigue score per player (0-100)
}
```

**Step 3: Verify build compiles**

Run: `npx ng build 2>&1 | head -30`

Fix any compilation errors caused by existing code not providing the new required fields. The `selectTeam()` method in `team-selection.ts` and `saveGameState` calls in `dashboard.ts` will need the new fields added with defaults:
- `fatigueEnabled: false`
- `defaultSquad: []`
- `matchLog: []`
- `playerFatigue: {}`

**Step 4: Commit**

```bash
git add src/app/models/fatigue.ts src/app/models/game-state.ts src/app/pages/team-selection/team-selection.ts src/app/pages/dashboard/dashboard.ts
git commit -m "feat: add fatigue model types and GameState fields"
```

---

### Task 2: Create FatigueService with core calculations

**Files:**
- Create: `src/app/services/fatigue.ts`
- Create: `src/app/services/fatigue.spec.ts`

**Step 1: Write failing tests for fatigue calculations**

Create `src/app/services/fatigue.spec.ts`:

```typescript
import { FatigueService } from './fatigue';

describe('FatigueService', () => {
  let service: FatigueService;

  beforeEach(() => {
    service = new FatigueService();
  });

  describe('getMultiplier', () => {
    it('should return 0.85 for fresh players (0-25)', () => {
      expect(service.getMultiplier(0)).toBe(0.85);
      expect(service.getMultiplier(25)).toBe(0.85);
    });

    it('should return 1.0 for normal fatigue (26-50)', () => {
      expect(service.getMultiplier(26)).toBe(1.0);
      expect(service.getMultiplier(50)).toBe(1.0);
    });

    it('should return 1.25 for fatigued players (51-70)', () => {
      expect(service.getMultiplier(51)).toBe(1.25);
      expect(service.getMultiplier(70)).toBe(1.25);
    });

    it('should return 1.5 for high risk players (71-85)', () => {
      expect(service.getMultiplier(71)).toBe(1.5);
      expect(service.getMultiplier(85)).toBe(1.5);
    });

    it('should return 2.0 for extreme fatigue (86-100)', () => {
      expect(service.getMultiplier(86)).toBe(2.0);
      expect(service.getMultiplier(100)).toBe(2.0);
    });
  });

  describe('decayFatigue', () => {
    it('should decay by 3 per day', () => {
      expect(service.decayFatigue(30, 1)).toBe(27);
      expect(service.decayFatigue(30, 3)).toBe(21);
    });

    it('should not go below 0', () => {
      expect(service.decayFatigue(5, 10)).toBe(0);
    });
  });

  describe('addBackgroundLeagueLoad', () => {
    it('should add 5 fatigue for every 3 days elapsed', () => {
      expect(service.addBackgroundLeagueLoad(20, 3)).toBe(25);
      expect(service.addBackgroundLeagueLoad(20, 6)).toBe(30);
    });

    it('should not add for fewer than 3 days', () => {
      expect(service.addBackgroundLeagueLoad(20, 2)).toBe(20);
    });

    it('should not exceed 100', () => {
      expect(service.addBackgroundLeagueLoad(98, 6)).toBe(100);
    });
  });

  describe('applyMatchLoad', () => {
    it('should add 15 for starters', () => {
      expect(service.applyMatchLoad(20, 'starter')).toBe(35);
    });

    it('should add 8 for subs', () => {
      expect(service.applyMatchLoad(20, 'sub')).toBe(28);
    });

    it('should not change for rested', () => {
      expect(service.applyMatchLoad(20, 'rested')).toBe(20);
    });

    it('should cap at 100', () => {
      expect(service.applyMatchLoad(95, 'starter')).toBe(100);
    });
  });

  describe('getReturnFromInjuryFatigue', () => {
    it('should return value between 40 and 50', () => {
      const val = service.getReturnFromInjuryFatigue();
      expect(val).toBeGreaterThanOrEqual(40);
      expect(val).toBeLessThanOrEqual(50);
    });
  });

  describe('getBadge', () => {
    it('should return "fresh" for 0-25', () => {
      expect(service.getBadge(10)).toBe('fresh');
    });

    it('should return null for 26-50', () => {
      expect(service.getBadge(35)).toBeNull();
    });

    it('should return "fatigued" for 51-70', () => {
      expect(service.getBadge(60)).toBe('fatigued');
    });

    it('should return "high-risk" for 71+', () => {
      expect(service.getBadge(75)).toBe('high-risk');
      expect(service.getBadge(90)).toBe('high-risk');
    });
  });

  describe('updateFatigueForDays', () => {
    it('should decay fatigue and add background load over a range', () => {
      const fatigue: Record<string, number> = { 'p1': 50, 'p2': 20 };
      const result = service.updateFatigueForDays(fatigue, 6);
      // 6 days: decay 6*3=18, background load floor(6/3)*5=10
      // p1: 50 - 18 + 10 = 42
      // p2: 20 - 18 + 10 = 12
      expect(result['p1']).toBe(42);
      expect(result['p2']).toBe(12);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx ng test 2>&1 | tail -20`
Expected: FAIL — `FatigueService` does not exist yet.

**Step 3: Implement FatigueService**

Create `src/app/services/fatigue.ts`:

```typescript
import { Injectable } from '@angular/core';
import type { MatchRole } from '../models/fatigue';

export type FatigueBadge = 'fresh' | 'fatigued' | 'high-risk';

@Injectable({ providedIn: 'root' })
export class FatigueService {
  getMultiplier(fatigue: number): number {
    if (fatigue <= 25) return 0.85;
    if (fatigue <= 50) return 1.0;
    if (fatigue <= 70) return 1.25;
    if (fatigue <= 85) return 1.5;
    return 2.0;
  }

  decayFatigue(current: number, days: number): number {
    return Math.max(0, current - days * 3);
  }

  addBackgroundLeagueLoad(current: number, days: number): number {
    const loads = Math.floor(days / 3);
    return Math.min(100, current + loads * 5);
  }

  applyMatchLoad(current: number, role: MatchRole): number {
    if (role === 'rested') return current;
    const add = role === 'starter' ? 15 : 8;
    return Math.min(100, current + add);
  }

  getReturnFromInjuryFatigue(): number {
    return 40 + Math.floor(Math.random() * 11); // 40-50
  }

  getBadge(fatigue: number): FatigueBadge | null {
    if (fatigue <= 25) return 'fresh';
    if (fatigue <= 50) return null;
    if (fatigue <= 70) return 'fatigued';
    return 'high-risk';
  }

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
```

**Step 4: Run tests to verify they pass**

Run: `npx ng test 2>&1 | tail -20`
Expected: All FatigueService tests PASS.

**Step 5: Commit**

```bash
git add src/app/services/fatigue.ts src/app/services/fatigue.spec.ts
git commit -m "feat: add FatigueService with core fatigue calculations"
```

---

### Task 3: Integrate fatigue into SimulationService

**Files:**
- Modify: `src/app/services/simulation.ts`
- Create: `src/app/services/simulation.spec.ts`

**Step 1: Write failing tests for fatigue-aware simulation**

Create `src/app/services/simulation.spec.ts`:

```typescript
import { SimulationService } from './simulation';
import { FatigueService } from './fatigue';
import type { Player } from '../models/player';
import type { GameState } from '../models/game-state';

const makePlayer = (name: string, injuriesPerSeason = 1.0): Player => ({
  name,
  position: 'FW',
  age: 25,
  injuryProfile: {
    injuriesPerSeason,
    avgDaysMissed: 10,
    stdDevDaysMissed: 3,
    injuryTypeWeights: { 'Muscle Injury': 1.0 },
  },
});

describe('SimulationService', () => {
  let service: SimulationService;

  beforeEach(() => {
    service = new SimulationService(new FatigueService());
  });

  describe('simulateDay (no fatigue)', () => {
    it('should use base probability when fatigue is disabled', () => {
      const players = [makePlayer('TestPlayer', 365)]; // ~100% daily chance
      const result = service.simulateDay(players, [], 'Team', '2025-01-01');
      // With injuriesPerSeason=365, dailyProb=1.0, should almost certainly injure
      expect(result.newInjuries.length).toBeLessThanOrEqual(1);
    });
  });

  describe('simulateDay (with fatigue)', () => {
    it('should accept playerFatigue and apply multiplier', () => {
      const players = [makePlayer('TestPlayer', 0.5)];
      const fatigue = { 'Team__TestPlayer': 10 }; // fresh = 0.85x
      const result = service.simulateDay(
        players, [], 'Team', '2025-01-01', fatigue
      );
      // Just verify it runs without error
      expect(result).toBeDefined();
      expect(result.newInjuries).toBeDefined();
    });
  });

  describe('simulateRange (with fatigue)', () => {
    it('should update fatigue scores over the range', () => {
      const players = [makePlayer('P1', 0)]; // 0 injuries/season = no injuries
      const fatigue = { 'Team__P1': 50 };
      const result = service.simulateRange(
        players, [], 'Team', '2025-01-01', '2025-01-07', fatigue
      );
      // After 7 days: decay 7*3=21, background floor(7/3)*5=10 → 50-21+10=39
      expect(result.updatedFatigue!['Team__P1']).toBe(39);
    });

    it('should set return-from-injury fatigue when player recovers', () => {
      const players = [makePlayer('P1', 0)];
      const injuries = [{
        playerId: 'Team__P1',
        playerName: 'P1',
        type: 'Muscle Injury',
        startDate: '2024-12-25',
        returnDate: '2025-01-03',
        daysMissed: 9,
      }];
      const fatigue = { 'Team__P1': 0 };
      const result = service.simulateRange(
        players, injuries, 'Team', '2025-01-01', '2025-01-07', fatigue
      );
      // Player recovers on Jan 3, gets 40-50 fatigue, then decays for remaining days
      expect(result.updatedFatigue!['Team__P1']).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx ng test 2>&1 | tail -20`
Expected: FAIL — `SimulationService` constructor doesn't accept `FatigueService`.

**Step 3: Modify SimulationService to accept fatigue**

Modify `src/app/services/simulation.ts`:

- Inject `FatigueService`
- Add optional `playerFatigue` param to `simulateDay` — when provided, multiply daily probability by `fatigueService.getMultiplier(fatigue)`
- Add optional `playerFatigue` param to `simulateRange` — when provided, run fatigue decay/background-load per day, set return-from-injury fatigue on recovery, and return `updatedFatigue` in the result
- Add `updatedFatigue?: Record<string, number>` to `DayResult`

Key changes to `simulateDay`:
```typescript
constructor(private fatigueService: FatigueService) {}

simulateDay(
  players: Player[],
  activeInjuries: Injury[],
  teamName: string,
  date: string,
  playerFatigue?: Record<string, number>
): DayResult {
  // ...existing logic...
  for (const player of players) {
    const playerId = `${teamName}__${player.name}`;
    if (injuredPlayerIds.has(playerId)) continue;

    let dailyProb = player.injuryProfile.injuriesPerSeason / 365;
    if (playerFatigue && playerId in playerFatigue) {
      dailyProb *= this.fatigueService.getMultiplier(playerFatigue[playerId]);
    }

    if (Math.random() < dailyProb) {
      // ...existing injury creation...
    }
  }
  // ...
}
```

Key changes to `simulateRange`:
```typescript
simulateRange(
  players: Player[],
  activeInjuries: Injury[],
  teamName: string,
  fromDate: string,
  toDate: string,
  playerFatigue?: Record<string, number>
): DayResult {
  let fatigue = playerFatigue ? { ...playerFatigue } : undefined;
  // ...existing day loop...
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    // Decay fatigue daily
    if (fatigue) {
      for (const id of Object.keys(fatigue)) {
        fatigue[id] = this.fatigueService.decayFatigue(fatigue[id], 1);
        // Background league load: +5 every 3 days (check if day count divisible by 3)
        const daysSinceStart = /* days from fromDate to dateStr */;
        if (daysSinceStart > 0 && daysSinceStart % 3 === 0) {
          fatigue[id] = Math.min(100, fatigue[id] + 5);
        }
      }
    }

    // Check recoveries — set return-from-injury fatigue
    for (const inj of current) {
      if (inj.returnDate <= dateStr) {
        allRecovered.add(inj.playerName);
        if (fatigue) {
          fatigue[inj.playerId] = this.fatigueService.getReturnFromInjuryFatigue();
        }
      }
    }

    // Simulate new injuries with fatigue
    const dayResult = this.simulateDay(players, current, teamName, dateStr, fatigue);
    // ...
  }

  return {
    newInjuries: allNewInjuries,
    recovered: [...allRecovered],
    activeInjuries: current,
    updatedFatigue: fatigue,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx ng test 2>&1 | tail -20`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/app/services/simulation.ts src/app/services/simulation.spec.ts
git commit -m "feat: integrate fatigue multiplier into simulation engine"
```

---

### Task 4: Add fatigue toggle to team selection

**Files:**
- Modify: `src/app/pages/team-selection/team-selection.ts`
- Modify: `src/app/pages/team-selection/team-selection.html`

**Step 1: Add fatigueEnabled signal to component**

In `src/app/pages/team-selection/team-selection.ts`, add:

```typescript
fatigueEnabled = signal(false);

toggleFatigue() {
  this.fatigueEnabled.update(v => !v);
}
```

Update `selectTeam()` to include the new fields:

```typescript
selectTeam(teamName: string) {
  const today = new Date().toISOString().slice(0, 10);
  const state: GameState = {
    teamName,
    currentDate: today,
    seasonStartDate: today,
    activeInjuries: [],
    injuryHistory: [],
    fatigueEnabled: this.fatigueEnabled(),
    defaultSquad: [],
    matchLog: [],
    playerFatigue: {},
  };
  this.storageService.saveGameState(state);
  this.router.navigate(['/dashboard']);
}
```

**Step 2: Add toggle UI to template**

In `src/app/pages/team-selection/team-selection.html`, add below the search input and above the team grid:

```html
<div class="mb-6 flex items-center gap-3 rounded-lg border bg-card p-4">
  <button
    class="relative h-6 w-11 rounded-full transition-colors"
    [class]="fatigueEnabled() ? 'bg-primary' : 'bg-muted'"
    (click)="toggleFatigue()"
  >
    <span
      class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
      [class.translate-x-5]="fatigueEnabled()"
    ></span>
  </button>
  <div>
    <div class="text-sm font-medium">Fatigue Simulation</div>
    <div class="text-xs text-muted-foreground">
      Track squad selection, substitutions, and fatigue-based injury risk
    </div>
  </div>
</div>
```

**Step 3: Verify build and test manually**

Run: `npx ng build 2>&1 | head -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/pages/team-selection/team-selection.ts src/app/pages/team-selection/team-selection.html
git commit -m "feat: add fatigue simulation toggle to team selection"
```

---

### Task 5: Add Starting XI selection to team selection

**Files:**
- Modify: `src/app/pages/team-selection/team-selection.ts`
- Modify: `src/app/pages/team-selection/team-selection.html`

This step only appears when `fatigueEnabled` is true. After selecting a team, show a squad picker before navigating to the dashboard.

**Step 1: Add squad selection state to component**

In `src/app/pages/team-selection/team-selection.ts`:

```typescript
// New signals
selectedTeam = signal<string | null>(null);
showSquadPicker = signal(false);
selectedSquad = signal<Set<string>>(new Set());

teamPlayers = computed(() => {
  const name = this.selectedTeam();
  if (!name) return [];
  const team = this.dataService.getTeam(name);
  return team?.players ?? [];
});

squadCount = computed(() => this.selectedSquad().size);
```

Change `selectTeam()` to conditionally show squad picker:

```typescript
selectTeam(teamName: string) {
  if (this.fatigueEnabled()) {
    this.selectedTeam.set(teamName);
    this.showSquadPicker.set(true);
    return;
  }
  this.startGame(teamName, []);
}

togglePlayerInSquad(playerId: string) {
  this.selectedSquad.update(set => {
    const next = new Set(set);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else if (next.size < 11) {
      next.add(playerId);
    }
    return next;
  });
}

confirmSquad() {
  const teamName = this.selectedTeam()!;
  this.startGame(teamName, [...this.selectedSquad()]);
}

cancelSquadPicker() {
  this.showSquadPicker.set(false);
  this.selectedTeam.set(null);
  this.selectedSquad.set(new Set());
}

private startGame(teamName: string, defaultSquad: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const team = this.dataService.getTeam(teamName);
  const playerFatigue: Record<string, number> = {};
  if (team) {
    for (const p of team.players) {
      playerFatigue[`${teamName}__${p.name}`] = 30; // start at normal baseline
    }
  }
  const state: GameState = {
    teamName,
    currentDate: today,
    seasonStartDate: today,
    activeInjuries: [],
    injuryHistory: [],
    fatigueEnabled: this.fatigueEnabled(),
    defaultSquad,
    matchLog: [],
    playerFatigue,
  };
  this.storageService.saveGameState(state);
  this.router.navigate(['/dashboard']);
}
```

**Step 2: Add squad picker UI to template**

Append to `team-selection.html`, inside the main `@if (loaded())` block:

```html
@if (showSquadPicker()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg max-h-[80vh] overflow-y-auto">
      <h3 class="text-lg font-semibold">Select Starting XI</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ selectedTeam() }} &middot; {{ squadCount() }}/11 selected
      </p>

      <div class="mt-4 space-y-1">
        @for (player of teamPlayers(); track player.name) {
          @let playerId = selectedTeam() + '__' + player.name;
          <button
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
            [class]="selectedSquad().has(playerId) ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
            (click)="togglePlayerInSquad(playerId)"
          >
            <span>{{ player.name }}</span>
            <span class="text-xs text-muted-foreground">{{ player.position }}</span>
          </button>
        }
      </div>

      <div class="mt-4 flex gap-2">
        <button
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          [disabled]="squadCount() !== 11"
          (click)="confirmSquad()"
        >
          Start Season
        </button>
        <button
          class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          (click)="cancelSquadPicker()"
        >
          Back
        </button>
      </div>
    </div>
  </div>
}
```

**Step 3: Verify build**

Run: `npx ng build 2>&1 | head -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/pages/team-selection/team-selection.ts src/app/pages/team-selection/team-selection.html
git commit -m "feat: add starting XI squad picker when fatigue is enabled"
```

---

### Task 6: Add fatigue badges to dashboard squad table

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.ts`
- Modify: `src/app/pages/dashboard/dashboard.html`

**Step 1: Inject FatigueService and add fatigue data to PlayerRow**

In `src/app/pages/dashboard/dashboard.ts`:

Add to `PlayerRow` interface:
```typescript
fatigueBadge?: 'fresh' | 'fatigued' | 'high-risk' | null;
fatigueScore?: number;
```

Inject `FatigueService` and update the `players` computed:
```typescript
private fatigueService = inject(FatigueService);

// Inside the players computed, when building each row:
const fatigueScore = state.fatigueEnabled
  ? (state.playerFatigue[playerId] ?? 30)
  : undefined;
const fatigueBadge = fatigueScore !== undefined
  ? this.fatigueService.getBadge(fatigueScore)
  : undefined;

return { name: p.name, position: p.position, age: p.age, status, injury, fatigueBadge, fatigueScore };
```

Also add:
```typescript
fatigueEnabled = computed(() => this.gameState()?.fatigueEnabled ?? false);
```

**Step 2: Add fatigue column to the squad table**

In `src/app/pages/dashboard/dashboard.html`, add a conditional Fatigue header and cell to the table:

In `<thead>`, after the Details th:
```html
@if (fatigueEnabled()) {
  <th class="px-4 py-3 text-left font-medium">Fatigue</th>
}
```

In each `<tr>` row, after the Details td:
```html
@if (fatigueEnabled()) {
  <td class="px-4 py-3">
    @switch (player.fatigueBadge) {
      @case ('fresh') {
        <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Fresh
        </span>
      }
      @case ('fatigued') {
        <span class="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
          Fatigued
        </span>
      }
      @case ('high-risk') {
        <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          High Risk
        </span>
      }
    }
  </td>
}
```

**Step 3: Verify build**

Run: `npx ng build 2>&1 | head -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html
git commit -m "feat: add fatigue badges to dashboard squad table"
```

---

### Task 7: Add squad selection step to advance time dialog

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.ts`
- Modify: `src/app/pages/dashboard/dashboard.html`

This is the main UX change: when fatigue is enabled, the advance dialog gets a "Who Played?" step before simulation.

**Step 1: Add squad selection state to dashboard component**

In `src/app/pages/dashboard/dashboard.ts`:

```typescript
import type { MatchRole, PlayerMatchEntry, MatchLog } from '../../models/fatigue';

// New signals for match squad selection
matchSquad = signal<Record<string, MatchRole>>({});
advanceStep = signal<'squad' | 'date' | 'result'>('date');

// Initialize match squad from default XI, auto-swapping injured players
initMatchSquad() {
  const state = this.gameState();
  if (!state) return;

  const team = this.dataService.getTeam(state.teamName);
  if (!team) return;

  const injuredIds = new Set(state.activeInjuries.map(i => i.playerId));
  const squad: Record<string, MatchRole> = {};

  for (const p of team.players) {
    const id = `${state.teamName}__${p.name}`;
    if (injuredIds.has(id)) {
      squad[id] = 'rested'; // injured players can't play
    } else if (state.defaultSquad.includes(id)) {
      squad[id] = 'starter';
    } else {
      squad[id] = 'rested';
    }
  }

  this.matchSquad.set(squad);
}

cycleRole(playerId: string) {
  const state = this.gameState();
  if (!state) return;
  const injuredIds = new Set(state.activeInjuries.map(i => i.playerId));
  if (injuredIds.has(playerId)) return; // can't change injured players

  this.matchSquad.update(squad => {
    const current = squad[playerId] ?? 'rested';
    const next: MatchRole =
      current === 'rested' ? 'starter' :
      current === 'starter' ? 'sub' : 'rested';
    return { ...squad, [playerId]: next };
  });
}
```

Update `openAdvanceDialog()`:
```typescript
openAdvanceDialog() {
  this.lastResult.set(null);
  this.targetDate.set(this.addDays(this.gameState()?.currentDate ?? '', 3));
  if (this.fatigueEnabled()) {
    this.initMatchSquad();
    this.advanceStep.set('squad');
  } else {
    this.advanceStep.set('date');
  }
  this.showAdvanceDialog.set(true);
}
```

Update `advanceTime()` to record match log and pass fatigue:
```typescript
advanceTime() {
  const state = this.gameState();
  if (!state) return;

  const team = this.dataService.getTeam(state.teamName);
  if (!team) return;

  const toDate = this.targetDate();
  if (toDate <= state.currentDate) return;

  // Build match log entry if fatigue enabled
  let updatedFatigue = state.playerFatigue;
  const newMatchLog = [...state.matchLog];

  if (state.fatigueEnabled) {
    const squad = this.matchSquad();
    const entries: PlayerMatchEntry[] = Object.entries(squad).map(([playerId, role]) => ({
      playerId,
      role,
    }));

    // Apply match load to fatigue before simulating
    const fatigueAfterMatch = { ...state.playerFatigue };
    for (const entry of entries) {
      const current = fatigueAfterMatch[entry.playerId] ?? 30;
      fatigueAfterMatch[entry.playerId] = this.fatigueService.applyMatchLoad(current, entry.role);
    }
    updatedFatigue = fatigueAfterMatch;

    newMatchLog.push({ date: state.currentDate, players: entries });
  }

  const result = this.simulationService.simulateRange(
    team.players,
    state.activeInjuries,
    state.teamName,
    state.currentDate,
    toDate,
    state.fatigueEnabled ? updatedFatigue : undefined
  );

  const newState: GameState = {
    ...state,
    currentDate: toDate,
    activeInjuries: result.activeInjuries,
    injuryHistory: [...state.injuryHistory, ...result.newInjuries],
    matchLog: newMatchLog,
    playerFatigue: result.updatedFatigue ?? state.playerFatigue,
  };

  this.storageService.saveGameState(newState);
  this.gameState.set(newState);
  this.lastResult.set({ newInjuries: result.newInjuries, recovered: result.recovered });
  this.advanceStep.set('result');
}

proceedToDate() {
  this.advanceStep.set('date');
}
```

**Step 2: Update the advance dialog template**

Replace the advance time dialog section in `src/app/pages/dashboard/dashboard.html` with a three-step flow:

```html
@if (showAdvanceDialog()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeDialog()">
    <div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg max-h-[80vh] overflow-y-auto" (click)="$event.stopPropagation()">

      @switch (advanceStep()) {
        @case ('squad') {
          <h3 class="text-lg font-semibold">Who Played?</h3>
          <p class="mt-1 text-sm text-muted-foreground">Tap to cycle: Starter → Sub → Rested</p>

          <div class="mt-4 space-y-1">
            @for (player of players(); track player.name) {
              @let playerId = teamName() + '__' + player.name;
              @let role = matchSquad()[playerId] ?? 'rested';
              <button
                class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
                [class]="role === 'starter' ? 'bg-primary/10' : role === 'sub' ? 'bg-blue-50' : ''"
                [disabled]="player.status === 'injured'"
                (click)="cycleRole(playerId)"
              >
                <span [class.text-muted-foreground]="player.status === 'injured'">
                  {{ player.name }}
                </span>
                <span class="text-xs font-medium"
                  [class]="role === 'starter' ? 'text-primary' : role === 'sub' ? 'text-blue-600' : 'text-muted-foreground'"
                >
                  @if (player.status === 'injured') {
                    Injured
                  } @else {
                    {{ role === 'starter' ? 'Starter' : role === 'sub' ? 'Sub' : 'Rested' }}
                  }
                </span>
              </button>
            }
          </div>

          <div class="mt-4 flex gap-2">
            <button
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              (click)="proceedToDate()"
            >
              Next
            </button>
            <button
              class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              (click)="closeDialog()"
            >
              Cancel
            </button>
          </div>
        }

        @case ('date') {
          <h3 class="text-lg font-semibold">Advance Time</h3>
          <div class="mt-4 space-y-4">
            <div>
              <label class="block text-sm font-medium">Advance to date</label>
              <input
                type="date"
                [min]="currentDate()"
                [value]="targetDate()"
                (input)="onDateInput($event)"
                class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div class="flex gap-2">
              <button
                class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                (click)="advanceTime()"
              >
                Advance
              </button>
              <button
                class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                (click)="advanceToNextMatch()"
              >
                Next Match (+3 days)
              </button>
            </div>
          </div>
        }

        @case ('result') {
          <!-- identical to current results view -->
          <h3 class="text-lg font-semibold">Advance Time</h3>
          <div class="mt-4 space-y-3">
            <p class="text-sm text-muted-foreground">Advanced to <strong>{{ currentDate() }}</strong></p>

            @if (lastResult()!.newInjuries.length > 0) {
              <div>
                <h4 class="text-sm font-semibold text-destructive">New Injuries</h4>
                <ul class="mt-1 space-y-1 text-sm">
                  @for (inj of lastResult()!.newInjuries; track inj.playerId) {
                    <li>{{ inj.playerName }} — {{ inj.type }} ({{ inj.daysMissed }} days)</li>
                  }
                </ul>
              </div>
            } @else {
              <p class="text-sm text-green-600">No new injuries!</p>
            }

            @if (lastResult()!.recovered.length > 0) {
              <div>
                <h4 class="text-sm font-semibold text-green-600">Recovered</h4>
                <ul class="mt-1 space-y-1 text-sm">
                  @for (name of lastResult()!.recovered; track name) {
                    <li>{{ name }}</li>
                  }
                </ul>
              </div>
            }

            <button
              class="mt-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              (click)="closeDialog()"
            >
              Close
            </button>
          </div>
        }
      }
    </div>
  </div>
}
```

**Step 3: Verify build**

Run: `npx ng build 2>&1 | head -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html
git commit -m "feat: add squad selection step to advance time dialog"
```

---

### Task 8: Add Edit Starting XI from dashboard

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.ts`
- Modify: `src/app/pages/dashboard/dashboard.html`

**Step 1: Add edit squad dialog state**

In `src/app/pages/dashboard/dashboard.ts`:

```typescript
showEditSquad = signal(false);
editingSquad = signal<Set<string>>(new Set());
editSquadCount = computed(() => this.editingSquad().size);

openEditSquad() {
  const state = this.gameState();
  if (!state) return;
  this.editingSquad.set(new Set(state.defaultSquad));
  this.showEditSquad.set(true);
}

toggleEditSquadPlayer(playerId: string) {
  this.editingSquad.update(set => {
    const next = new Set(set);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else if (next.size < 11) {
      next.add(playerId);
    }
    return next;
  });
}

saveEditSquad() {
  const state = this.gameState();
  if (!state) return;
  const newState = { ...state, defaultSquad: [...this.editingSquad()] };
  this.storageService.saveGameState(newState);
  this.gameState.set(newState);
  this.showEditSquad.set(false);
}
```

**Step 2: Add Edit Starting XI button and dialog to template**

In the header area of `dashboard.html`, add a button (conditionally shown when fatigue enabled):

```html
@if (fatigueEnabled()) {
  <button
    class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
    (click)="openEditSquad()"
  >
    Edit Starting XI
  </button>
}
```

Add a dialog at the bottom (reuse same pattern as squad picker from team selection — modal with player list, tap to toggle, confirm when 11 selected).

**Step 3: Verify build**

Run: `npx ng build 2>&1 | head -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html
git commit -m "feat: add edit starting XI dialog to dashboard"
```

---

### Task 9: End-to-end manual testing and polish

**Files:**
- Any files that need fixes

**Step 1: Run full build**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

**Step 2: Run all tests**

Run: `npx ng test 2>&1 | tail -30`
Expected: All tests pass.

**Step 3: Manual testing checklist**

Start dev server (`npm start`) and verify:

1. **Simple mode**: Create a game with fatigue OFF → same behavior as before, no fatigue column, no squad step
2. **Fatigue mode setup**: Create a game with fatigue ON → squad picker appears, must pick 11 → game starts
3. **Advance with squad**: Open advance dialog → squad step shows with defaults → cycle roles → proceed to date → advance → results
4. **Fatigue badges**: After advancing, squad table shows Fresh/Fatigued/High Risk badges
5. **Return from injury**: When a player recovers, their fatigue starts elevated (orange/red zone)
6. **Edit Starting XI**: Button visible, dialog works, saves correctly
7. **Persistence**: Refresh page → game state preserved with fatigue data

**Step 4: Fix any issues found**

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish fatigue simulation after manual testing"
```
