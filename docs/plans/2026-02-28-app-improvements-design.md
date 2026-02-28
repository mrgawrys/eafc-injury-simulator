# App Improvements Design

Date: 2026-02-28

## 1. Cursor Pointer (Global CSS)

Add global CSS rule to `src/styles.css` for all interactive elements:

```css
button, a, [role="button"], [tabindex="0"] { cursor: pointer; }
```

## 2. Table Sorting

Add sortable column headers to both tables (dashboard squad + injury log). Click toggles: ascending -> descending -> default order.

- `sortConfig` signal per page component: `{ column: string, direction: 'asc' | 'desc' | null }`
- `computed()` signal derives sorted data from sort config
- Column headers get `(click)` handler + arrow icon (up/down/none)

Applies to:
- Dashboard squad table: Name, Position, Age, Status columns
- Injury log table: Player, Injury Type, Date Injured, Days Missed, Return Date columns

## 3. Save System (Multi-slot localStorage)

Replace single `GameState` with `SaveSlot[]`.

```typescript
interface SaveSlot {
  id: string;           // UUID
  name: string;         // User-given name, default "Team Save (X)"
  gameState: GameState;
  createdAt: string;    // ISO date
  updatedAt: string;    // ISO date
}
```

Storage key: `"fifa-injuries-saves"` with migration from old `"fifa-injuries-game-state"`.

### StorageService API

- `getSaves(): SaveSlot[]`
- `getSave(id): SaveSlot | null`
- `saveSave(slot): void`
- `deleteSave(id): void`
- `getActiveSaveId(): string | null` / `setActiveSaveId(id): void`

### Team Selection Page UX

- Top section: most recent save as prominent card (team name, save name, current date, injury count) with "Continue" button
- "Show all saves" button expands to full list
- Each save card: name, team, date, delete option
- Below: team grid for starting new games
- Click team -> dialog with save name input (pre-filled "Team Save (N)") -> creates new save

## 4. Remove "New Season" Button

- Remove destructive "New Season" button from dashboard
- Add a "Back to Home" / "Change Save" link instead
- Users go to team selection to start fresh or switch saves

## 5. Save Naming

Dialog on team click:
- Title: "Start New Season"
- Input: "Save Name" (pre-filled with `"${teamName} Save (${nextNumber})"`)
- Buttons: Cancel / Start

Name stored in `SaveSlot.name`.

## 6. Player Overall Rating

### Data Pipeline

- Source FC 25 player ratings dataset (CSV)
- Fuzzy-match against roster using existing Levenshtein approach
- Add `overall?: number` to `Player` interface

### UI

- "OVR" column in dashboard squad table
- Color-coded display (green 80+, yellow 70-79, etc.)
- Show "-" for unmatched players
