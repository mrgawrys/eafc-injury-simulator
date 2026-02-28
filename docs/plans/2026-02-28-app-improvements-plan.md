# App Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cursor pointer, table sorting, multi-save system with naming, player overall ratings, and remove "New Season" button.

**Architecture:** Six independent improvements to the Angular 21 app. Tasks 1-2 are CSS/UI-only. Task 3-5 restructure storage to support multiple named save slots. Task 6 adds `overall` to the data pipeline and displays it in the squad table. Each task can be committed independently.

**Tech Stack:** Angular 21 (signals, standalone components), Tailwind CSS v4, localStorage, TypeScript, tsx scripts.

---

### Task 1: Add global cursor pointer for interactive elements

**Files:**
- Modify: `src/styles.css:51` (after the `.dark` block)

**Step 1: Add cursor pointer rule**

Add at the end of `src/styles.css`:

```css
button,
a,
[role='button'],
[tabindex='0'] {
  cursor: pointer;
}
```

**Step 2: Verify visually**

Run: `npm start`
Check: All buttons on team selection, dashboard, and injury log pages show pointer cursor on hover. Team cards, "Advance Time", "Injury Log", dialog buttons, etc.

**Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: add cursor pointer to all interactive elements"
```

---

### Task 2: Add player overall rating to data pipeline

**Files:**
- Modify: `src/app/models/player.ts:8-13` — add `overall` field to `Player`
- Modify: `scripts/process-data.ts:32-37` — add `overall` to `PlayerData`, parse from CSV
- Modify: `src/app/pages/dashboard/dashboard.ts:11-16` — add `overall` to `PlayerRow`
- Modify: `src/app/pages/dashboard/dashboard.html:34-77` — add OVR column

**Step 1: Add `overall` to Player model**

In `src/app/models/player.ts`, add to the `Player` interface:

```typescript
export interface Player {
  name: string;
  position: string;
  age: number;
  overall?: number;
  injuryProfile: InjuryProfile;
}
```

**Step 2: Add `overall` to data pipeline**

In `scripts/process-data.ts`, update the `PlayerData` interface (line ~32):

```typescript
export interface PlayerData {
  name: string;
  position: string;
  age: number;
  overall?: number;
  injuryProfile: InjuryProfile;
}
```

Update the `RosterPlayer` interface (line ~10):

```typescript
export interface RosterPlayer {
  name: string;
  team: string;
  position: string;
  age: number;
  overall?: number;
}
```

Update `parseRosterCsv` function (line ~168) to extract overall_rating. In the return object inside the `.map()`:

```typescript
return {
  name,
  team: r["team"] || "",
  position: r["position_short_label"] || r["position"] || "",
  age,
  overall: parseInt(r["overall_rating"], 10) || undefined,
};
```

Update the output building section (line ~264) to include overall:

```typescript
teamPlayers.push({
  name: p.name,
  position: p.position,
  age: p.age,
  overall: p.overall,
  injuryProfile: profile,
});
```

**Step 3: Re-process the data**

Run: `npm run process-data`
Expected: `teams.json` now includes `overall` field for players.

Verify: `node -e "const d=require('./public/data/teams.json'); const p=d.find(t=>t.name==='Real Madrid').players[0]; console.log(p.name, p.overall)"`
Expected: e.g. `Kylian Mbappé 91`

**Step 4: Add OVR column to dashboard**

In `src/app/pages/dashboard/dashboard.ts`, update `PlayerRow` interface:

```typescript
interface PlayerRow {
  name: string;
  position: string;
  age: number;
  overall?: number;
  status: 'available' | 'injured' | 'returning-soon';
  injury?: Injury;
}
```

In the `players` computed signal, update the row mapping (line ~62):

```typescript
return { name: p.name, position: p.position, age: p.age, overall: p.overall, status, injury };
```

In `src/app/pages/dashboard/dashboard.html`, add OVR column header after Name (line ~37):

```html
<th class="px-4 py-3 text-left font-medium">Name</th>
<th class="px-4 py-3 text-left font-medium">OVR</th>
```

Add OVR cell after the name cell (line ~47):

```html
<td class="px-4 py-3 font-medium">{{ player.name }}</td>
<td class="px-4 py-3">
  @if (player.overall) {
    <span
      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      [class]="player.overall >= 80 ? 'bg-green-100 text-green-800' : player.overall >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'"
    >
      {{ player.overall }}
    </span>
  } @else {
    <span class="text-muted-foreground">—</span>
  }
</td>
```

**Step 5: Verify visually**

Run: `npm start`
Check: Dashboard squad table shows OVR column with color-coded badges.

**Step 6: Commit**

```bash
git add src/app/models/player.ts scripts/process-data.ts src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html public/data/teams.json
git commit -m "feat: add player overall rating from FC 25 data"
```

---

### Task 3: Implement multi-save storage system

**Files:**
- Create: `src/app/models/save-slot.ts`
- Modify: `src/app/services/storage.ts` — rewrite for multi-save support

**Step 1: Create SaveSlot model**

Create `src/app/models/save-slot.ts`:

```typescript
import type { GameState } from './game-state';

export interface SaveSlot {
  id: string;
  name: string;
  gameState: GameState;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Rewrite StorageService**

Replace `src/app/services/storage.ts` entirely:

```typescript
import { Injectable } from '@angular/core';
import type { GameState } from '../models/game-state';
import type { SaveSlot } from '../models/save-slot';

const SAVES_KEY = 'fifa-injuries-saves';
const ACTIVE_SAVE_KEY = 'fifa-injuries-active-save';
const LEGACY_KEY = 'fifa-injuries-game-state';

export abstract class StorageService {
  abstract getSaves(): SaveSlot[];
  abstract getSave(id: string): SaveSlot | null;
  abstract saveSave(slot: SaveSlot): void;
  abstract deleteSave(id: string): void;
  abstract getActiveSaveId(): string | null;
  abstract setActiveSaveId(id: string | null): void;

  // Convenience methods
  abstract getActiveGameState(): GameState | null;
  abstract hasAnySave(): boolean;
}

@Injectable({ providedIn: 'root' })
export class LocalStorageService extends StorageService {
  constructor() {
    super();
    this.migrateLegacy();
  }

  private migrateLegacy(): void {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;

    const gameState: GameState = JSON.parse(legacy);
    const now = new Date().toISOString();
    const slot: SaveSlot = {
      id: crypto.randomUUID(),
      name: `${gameState.teamName} Save (1)`,
      gameState,
      createdAt: now,
      updatedAt: now,
    };

    this.saveSave(slot);
    this.setActiveSaveId(slot.id);
    localStorage.removeItem(LEGACY_KEY);
  }

  getSaves(): SaveSlot[] {
    const raw = localStorage.getItem(SAVES_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  getSave(id: string): SaveSlot | null {
    return this.getSaves().find((s) => s.id === id) ?? null;
  }

  saveSave(slot: SaveSlot): void {
    const saves = this.getSaves();
    const idx = saves.findIndex((s) => s.id === slot.id);
    if (idx >= 0) {
      saves[idx] = slot;
    } else {
      saves.push(slot);
    }
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  }

  deleteSave(id: string): void {
    const saves = this.getSaves().filter((s) => s.id !== id);
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    if (this.getActiveSaveId() === id) {
      this.setActiveSaveId(null);
    }
  }

  getActiveSaveId(): string | null {
    return localStorage.getItem(ACTIVE_SAVE_KEY);
  }

  setActiveSaveId(id: string | null): void {
    if (id) {
      localStorage.setItem(ACTIVE_SAVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SAVE_KEY);
    }
  }

  getActiveGameState(): GameState | null {
    const id = this.getActiveSaveId();
    if (!id) return null;
    return this.getSave(id)?.gameState ?? null;
  }

  hasAnySave(): boolean {
    return this.getSaves().length > 0;
  }
}
```

**Step 3: Verify it compiles**

Run: `npm start`
Expected: No compile errors. App may not fully work yet (team-selection/dashboard need updates).

**Step 4: Commit**

```bash
git add src/app/models/save-slot.ts src/app/services/storage.ts
git commit -m "feat: implement multi-save storage system with legacy migration"
```

---

### Task 4: Update dashboard for new save system

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.ts` — use new StorageService API
- Modify: `src/app/pages/dashboard/dashboard.html` — replace "New Season" with "Back to Home"

**Step 1: Update dashboard component**

In `src/app/pages/dashboard/dashboard.ts`:

Replace the `ngOnInit` method to load active save:

```typescript
async ngOnInit() {
  await this.dataService.loadData();
  const state = this.storageService.getActiveGameState();
  if (!state) {
    this.router.navigate(['/']);
    return;
  }
  this.gameState.set(state);
}
```

Replace the `advanceTime` method to save via SaveSlot:

```typescript
advanceTime() {
  const state = this.gameState();
  if (!state) return;

  const team = this.dataService.getTeam(state.teamName);
  if (!team) return;

  const toDate = this.targetDate();
  if (toDate <= state.currentDate) return;

  const result = this.simulationService.simulateRange(
    team.players,
    state.activeInjuries,
    state.teamName,
    state.currentDate,
    toDate
  );

  const newState: GameState = {
    ...state,
    currentDate: toDate,
    activeInjuries: result.activeInjuries,
    injuryHistory: [...state.injuryHistory, ...result.newInjuries],
  };

  const saveId = this.storageService.getActiveSaveId()!;
  const save = this.storageService.getSave(saveId)!;
  this.storageService.saveSave({
    ...save,
    gameState: newState,
    updatedAt: new Date().toISOString(),
  });
  this.gameState.set(newState);
  this.lastResult.set({ newInjuries: result.newInjuries, recovered: result.recovered });
}
```

Replace the `newSeason` method with `backToHome`:

```typescript
backToHome() {
  this.router.navigate(['/']);
}
```

**Step 2: Update dashboard template**

In `src/app/pages/dashboard/dashboard.html`, replace the "New Season" button (lines ~23-28) with:

```html
<a
  routerLink="/"
  class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
>
  Home
</a>
```

**Step 3: Update injury log to use new storage**

In `src/app/pages/injury-log/injury-log.ts`, update `ngOnInit`:

```typescript
ngOnInit() {
  const state = this.storageService.getActiveGameState();
  if (!state) {
    this.router.navigate(['/']);
    return;
  }
  this.teamName.set(state.teamName);
  this.injuries.set(state.injuryHistory);
}
```

**Step 4: Verify**

Run: `npm start`
Check: Dashboard loads, advance time works, "Home" link navigates back to team selection.

**Step 5: Commit**

```bash
git add src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html src/app/pages/injury-log/injury-log.ts
git commit -m "feat: update dashboard and injury log for multi-save storage"
```

---

### Task 5: Update team selection for multi-save with naming dialog

**Files:**
- Modify: `src/app/pages/team-selection/team-selection.ts` — full rewrite for save management
- Modify: `src/app/pages/team-selection/team-selection.html` — save cards + new season dialog

**Step 1: Rewrite team selection component**

Replace `src/app/pages/team-selection/team-selection.ts`:

```typescript
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data';
import { StorageService } from '../../services/storage';
import type { SaveSlot } from '../../models/save-slot';
import type { GameState } from '../../models/game-state';

@Component({
  selector: 'app-team-selection',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './team-selection.html',
})
export class TeamSelectionComponent implements OnInit {
  private dataService = inject(DataService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  searchQuery = signal('');
  saves = signal<SaveSlot[]>([]);
  showAllSaves = signal(false);

  // New season dialog
  showNewSeasonDialog = signal(false);
  selectedTeamName = signal('');
  saveName = signal('');

  filteredTeams = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const teams = this.dataService.teams();
    if (!query) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(query));
  });

  latestSave = computed(() => {
    const all = this.saves();
    if (all.length === 0) return null;
    return [...all].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  });

  olderSaves = computed(() => {
    const latest = this.latestSave();
    if (!latest) return [];
    return this.saves()
      .filter((s) => s.id !== latest.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  loaded = this.dataService.loaded;

  async ngOnInit() {
    await this.dataService.loadData();
    this.refreshSaves();
  }

  private refreshSaves() {
    this.saves.set(this.storageService.getSaves());
  }

  private getNextSaveNumber(teamName: string): number {
    const existing = this.saves().filter(
      (s) => s.gameState.teamName === teamName
    );
    return existing.length + 1;
  }

  openNewSeasonDialog(teamName: string) {
    this.selectedTeamName.set(teamName);
    const num = this.getNextSaveNumber(teamName);
    this.saveName.set(`${teamName} Save (${num})`);
    this.showNewSeasonDialog.set(true);
  }

  closeNewSeasonDialog() {
    this.showNewSeasonDialog.set(false);
  }

  createSave() {
    const teamName = this.selectedTeamName();
    const name = this.saveName().trim() || `${teamName} Save`;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const gameState: GameState = {
      teamName,
      currentDate: today,
      seasonStartDate: today,
      activeInjuries: [],
      injuryHistory: [],
    };

    const slot: SaveSlot = {
      id: crypto.randomUUID(),
      name,
      gameState,
      createdAt: now,
      updatedAt: now,
    };

    this.storageService.saveSave(slot);
    this.storageService.setActiveSaveId(slot.id);
    this.router.navigate(['/dashboard']);
  }

  loadSave(save: SaveSlot) {
    this.storageService.setActiveSaveId(save.id);
    this.router.navigate(['/dashboard']);
  }

  deleteSave(save: SaveSlot, event: Event) {
    event.stopPropagation();
    this.storageService.deleteSave(save.id);
    this.refreshSaves();
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onSaveNameInput(event: Event) {
    this.saveName.set((event.target as HTMLInputElement).value);
  }
}
```

**Step 2: Rewrite team selection template**

Replace `src/app/pages/team-selection/team-selection.html`:

```html
@if (!loaded()) {
  <p class="text-muted-foreground">Loading team data...</p>
} @else {
  <!-- Latest Save Card -->
  @if (latestSave(); as save) {
    <div class="mb-6 rounded-lg border bg-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">{{ save.name }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ save.gameState.teamName }} &middot; {{ save.gameState.currentDate }}
            &middot; {{ save.gameState.activeInjuries.length }} active injuries
          </p>
        </div>
        <div class="flex gap-2">
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            (click)="loadSave(save)"
          >
            Continue
          </button>
          <button
            class="rounded-md border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            (click)="deleteSave(save, $event)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Show all saves toggle -->
    @if (olderSaves().length > 0) {
      <button
        class="mb-6 text-sm font-medium text-muted-foreground hover:text-foreground"
        (click)="showAllSaves.set(!showAllSaves())"
      >
        {{ showAllSaves() ? 'Hide' : 'Show' }} all saves ({{ saves().length }})
      </button>

      @if (showAllSaves()) {
        <div class="mb-6 space-y-3">
          @for (s of olderSaves(); track s.id) {
            <div
              class="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              (click)="loadSave(s)"
            >
              <div>
                <div class="font-medium">{{ s.name }}</div>
                <div class="text-sm text-muted-foreground">
                  {{ s.gameState.teamName }} &middot; {{ s.gameState.currentDate }}
                </div>
              </div>
              <button
                class="rounded-md border border-destructive px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                (click)="deleteSave(s, $event)"
              >
                Delete
              </button>
            </div>
          }
        </div>
      }
    }
  }

  <h2 class="mb-4 text-2xl font-bold">Select a Team</h2>

  <input
    type="text"
    placeholder="Search teams..."
    class="mb-6 w-full rounded-md border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    [value]="searchQuery()"
    (input)="onSearchInput($event)"
  />

  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    @for (team of filteredTeams(); track team.name) {
      <button
        class="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
        (click)="openNewSeasonDialog(team.name)"
      >
        <div class="font-semibold">{{ team.name }}</div>
        <div class="mt-1 text-sm text-muted-foreground">{{ team.players.length }} players</div>
      </button>
    }
  </div>

  @if (filteredTeams().length === 0) {
    <p class="text-muted-foreground">No teams match "{{ searchQuery() }}"</p>
  }

  <!-- New Season Dialog -->
  @if (showNewSeasonDialog()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="closeNewSeasonDialog()">
      <div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" (click)="$event.stopPropagation()">
        <h3 class="text-lg font-semibold">Start New Season</h3>
        <p class="mt-1 text-sm text-muted-foreground">{{ selectedTeamName() }}</p>

        <div class="mt-4">
          <label class="block text-sm font-medium">Save Name</label>
          <input
            type="text"
            [value]="saveName()"
            (input)="onSaveNameInput($event)"
            class="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            (click)="closeNewSeasonDialog()"
          >
            Cancel
          </button>
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            (click)="createSave()"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  }
}
```

**Step 3: Verify full flow**

Run: `npm start`
Check:
1. If legacy save exists, it's migrated to a SaveSlot on first load
2. Latest save shows at top with "Continue" button
3. "Show all saves" reveals older saves
4. Clicking a team opens "Start New Season" dialog with pre-filled name
5. Creating a save navigates to dashboard
6. Delete button works
7. Dashboard loads the active save and "Home" link returns to selection

**Step 4: Commit**

```bash
git add src/app/pages/team-selection/team-selection.ts src/app/pages/team-selection/team-selection.html
git commit -m "feat: add multi-save management with naming dialog"
```

---

### Task 6: Add table sorting to dashboard and injury log

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.ts` — add sort signals and sorted computed
- Modify: `src/app/pages/dashboard/dashboard.html` — clickable column headers with arrows
- Modify: `src/app/pages/injury-log/injury-log.ts` — add sort signals and sorted computed
- Modify: `src/app/pages/injury-log/injury-log.html` — clickable column headers with arrows

**Step 1: Add sort logic to dashboard component**

In `src/app/pages/dashboard/dashboard.ts`, add after the existing signals:

```typescript
sortColumn = signal<string | null>(null);
sortDirection = signal<'asc' | 'desc' | null>(null);

sortedPlayers = computed<PlayerRow[]>(() => {
  const rows = this.players();
  const col = this.sortColumn();
  const dir = this.sortDirection();
  if (!col || !dir) return rows;

  return [...rows].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    switch (col) {
      case 'name': valA = a.name; valB = b.name; break;
      case 'overall': valA = a.overall ?? 0; valB = b.overall ?? 0; break;
      case 'position': valA = a.position; valB = b.position; break;
      case 'age': valA = a.age; valB = b.age; break;
      case 'status': {
        const order: Record<string, number> = { injured: 0, 'returning-soon': 1, available: 2 };
        valA = order[a.status]; valB = order[b.status]; break;
      }
      default: return 0;
    }

    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
});

toggleSort(column: string) {
  if (this.sortColumn() === column) {
    if (this.sortDirection() === 'asc') {
      this.sortDirection.set('desc');
    } else {
      this.sortColumn.set(null);
      this.sortDirection.set(null);
    }
  } else {
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }
}

sortIndicator(column: string): string {
  if (this.sortColumn() !== column) return '';
  return this.sortDirection() === 'asc' ? ' ▲' : ' ▼';
}
```

**Step 2: Update dashboard template headers**

In `src/app/pages/dashboard/dashboard.html`, replace the `<thead>` section:

```html
<thead>
  <tr class="border-b bg-muted/50">
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('name')">
      Name{{ sortIndicator('name') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('overall')">
      OVR{{ sortIndicator('overall') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('position')">
      Position{{ sortIndicator('position') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('age')">
      Age{{ sortIndicator('age') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('status')">
      Status{{ sortIndicator('status') }}
    </th>
    <th class="px-4 py-3 text-left font-medium">Details</th>
  </tr>
</thead>
```

Update the `@for` loop to use `sortedPlayers()` instead of `players()`:

```html
@for (player of sortedPlayers(); track player.name) {
```

**Step 3: Add sort logic to injury log component**

In `src/app/pages/injury-log/injury-log.ts`, add:

```typescript
sortColumn = signal<string | null>(null);
sortDirection = signal<'asc' | 'desc' | null>(null);

sortedInjuries = computed(() => {
  const injuries = [...this.injuries()];
  const col = this.sortColumn();
  const dir = this.sortDirection();

  if (!col || !dir) {
    // Default: newest first
    return injuries.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  return injuries.sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    switch (col) {
      case 'playerName': valA = a.playerName; valB = b.playerName; break;
      case 'type': valA = a.type; valB = b.type; break;
      case 'startDate': valA = a.startDate; valB = b.startDate; break;
      case 'daysMissed': valA = a.daysMissed; valB = b.daysMissed; break;
      case 'returnDate': valA = a.returnDate; valB = b.returnDate; break;
      default: return 0;
    }

    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
});

toggleSort(column: string) {
  if (this.sortColumn() === column) {
    if (this.sortDirection() === 'asc') {
      this.sortDirection.set('desc');
    } else {
      this.sortColumn.set(null);
      this.sortDirection.set(null);
    }
  } else {
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }
}

sortIndicator(column: string): string {
  if (this.sortColumn() !== column) return '';
  return this.sortDirection() === 'asc' ? ' ▲' : ' ▼';
}
```

Note: Remove the old standalone `sortedInjuries` computed signal that was previously defined (line ~19-23), since we're replacing it with the new one that includes sort config.

**Step 4: Update injury log template headers**

In `src/app/pages/injury-log/injury-log.html`, replace the `<thead>`:

```html
<thead>
  <tr class="border-b bg-muted/50">
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('playerName')">
      Player{{ sortIndicator('playerName') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('type')">
      Injury Type{{ sortIndicator('type') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('startDate')">
      Date Injured{{ sortIndicator('startDate') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('daysMissed')">
      Days Missed{{ sortIndicator('daysMissed') }}
    </th>
    <th class="px-4 py-3 text-left font-medium select-none" (click)="toggleSort('returnDate')">
      Return Date{{ sortIndicator('returnDate') }}
    </th>
  </tr>
</thead>
```

**Step 5: Verify sorting**

Run: `npm start`
Check:
1. Dashboard: Click "Name" → sorts A-Z, click again → Z-A, click again → default (by status)
2. Dashboard: Click "OVR" → sorts by rating, ascending then descending
3. Dashboard: Click "Age" → numeric sort works
4. Injury Log: Click "Days Missed" → sorts numerically
5. Injury Log: Click "Date Injured" → sorts chronologically
6. Both tables: Third click resets to default sort order

**Step 6: Commit**

```bash
git add src/app/pages/dashboard/dashboard.ts src/app/pages/dashboard/dashboard.html src/app/pages/injury-log/injury-log.ts src/app/pages/injury-log/injury-log.html
git commit -m "feat: add click-to-sort column headers on both tables"
```

---

### Task 7: Final verification and cleanup

**Step 1: Full smoke test**

Run: `npm start`

Verify all features:
1. Cursor pointer on all buttons, links, team cards, sortable headers
2. Table sorting works on both pages (asc → desc → default)
3. Fresh start: no saves, team grid shows, click team → dialog → create save → dashboard
4. Dashboard: OVR column shows, advance time works, "Home" link works
5. Team selection: latest save card at top, "Show all saves" expands list
6. Delete a save, verify it's removed
7. Multiple saves for different teams coexist

**Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass.

**Step 3: Build check**

Run: `npm run build`
Expected: Production build succeeds with no errors.
