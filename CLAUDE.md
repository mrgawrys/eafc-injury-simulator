# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Dev server at localhost:4200
npm run build          # Production build
npm test               # Unit tests (Vitest via @angular/build:unit-test)
npm run setup-data     # Download + process CSV data into public/data/teams.json
npm run process-data   # Re-process CSVs in data-raw/ without re-downloading
```

Formatting: Prettier with 100-char width, single quotes, Angular HTML parser.

## Architecture

Angular 21 standalone-component app that simulates realistic squad injuries for FC 26 teams using Transfermarkt injury data.

### Routing (`src/app/app.routes.ts`)

Three lazy-loaded routes: `/` (team selection) → `/dashboard` (squad management) → `/injury-log` (history).

### Services (`src/app/services/`)

- **DataService** — loads `public/data/teams.json` via fetch, caches in a signal, provides `getTeam()` lookup
- **SimulationService** — injury simulation engine: daily probability from `injuriesPerSeason / 365`, Box-Muller normal distribution for duration, weighted injury-type sampling
- **StorageService** (abstract) + **LocalStorageService** — persists `GameState` to localStorage under key `"fifa-injuries-game-state"`

### State model (`src/app/models/`)

`GameState` holds `teamName`, `currentDate`, `seasonStartDate`, `activeInjuries[]`, and `injuryHistory[]`. Each `Player` has an `InjuryProfile` with `injuriesPerSeason`, `avgDaysMissed`, `stdDevDaysMissed`, and `injuryTypeWeights`.

### UI components (`src/app/components/ui/`)

Spartan-ng headless components (button, dialog, table, card, badge, etc.) aliased as `@spartan-ng/helm/*` via tsconfig paths. Styled with Tailwind CSS v4 and oklch color tokens in `src/styles.css`.

### Data pipeline (`scripts/`)

TypeScript scripts (run via `tsx`) that download CSVs from Kaggle/GitHub, fuzzy-match players between roster and injury datasets using Levenshtein distance (threshold ≤3), compute per-player injury profiles, and fall back to league averages for unmatched players. Output: `public/data/teams.json`.

## Spec

`spec.md` is the stack-agnostic feature specification for this app. After completing any task that adds, changes, or removes a feature, update `spec.md` to reflect the current state of the app.

## Conventions

- All components use Angular standalone pattern (no NgModules)
- State management via Angular Signals and computed signals (not RxJS-heavy)
- Component selector prefix: `app-`
- TypeScript strict mode with `noImplicitOverride`, `noImplicitReturns`, `isolatedModules`
