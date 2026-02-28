# FIFA Injury Simulator — Feature Specification

## Overview

A football squad injury simulator that uses real-world Transfermarkt injury data to generate statistically realistic injuries for FC 25 teams. The user manages a squad through a simulated season, advancing time day-by-day and observing injuries and recoveries.

---

## Core Concept

Each player has a statistical **injury profile** derived from real historical data:
- Injuries per season (frequency)
- Average days missed per injury
- Standard deviation of days missed
- Weighted distribution of injury types (e.g., 35% hamstring, 20% knee, etc.)

Players without enough historical data fall back to **league-average profiles**. The simulation runs a **per-day probability roll** for each healthy player, using a Box-Muller normal distribution for injury duration and weighted random sampling for injury type.

---

## Screens & Features

### 1. Team Selection (Home Screen)

**Continue a Save:**
- The most recent save is displayed prominently at the top as a card showing: save name, team name, current in-game date, and count of active injuries.
- A "Continue" button loads that save directly.
- A "Delete" button removes the save (with click-event isolation so it doesn't trigger Continue).

**Manage Multiple Saves:**
- If 2+ saves exist, a "Show all saves (N)" toggle reveals the full list of older saves.
- Each save row shows: save name, team name, current date. Clicking loads it. Each has a Delete button.
- Saves are sorted by most recently updated.

**Start a New Season:**
- A search input filters the team list in real time (case-insensitive substring match).
- Teams are displayed in a responsive grid (1 col mobile, 2 col tablet, 3 col desktop). Each card shows team name and player count.
- Clicking a team opens a "Start New Season" modal dialog:
  - Shows the selected team name.
  - Editable "Save Name" input, auto-filled with `"<TeamName> Save (<N>)"` where N increments per team.
  - Cancel / Start buttons. Start creates a new save with today's date and navigates to the dashboard.
- Clicking the overlay background dismisses the dialog.

**Loading State:** Shows "Loading team data..." while data fetches.

**Empty State:** Shows "No teams match..." when search yields no results.

---

### 2. Dashboard (Squad Management)

**Header Bar:**
- Team name, current in-game date, available player count, injured player count.
- Three actions: "Advance Time" button (opens simulation dialog), "Injury Log" link, "Home" link.

**Squad Table:**
Columns: Name, OVR (Overall Rating), Position, Age, Status, Details.

- **OVR**: Color-coded badge — green (80+), yellow (70-79), gray (<70). Shows "—" for unmatched players.
- **Status**: Three states rendered as colored pills:
  - "Available" (green)
  - "Returning Soon" (yellow) — player returns within 3 days
  - "Injured" (red)
- **Details**: For injured players, shows injury type and return date (e.g., "Hamstring Injury · returns 2025-03-15").
- **Default sort**: Injured first, then returning-soon, then available.

**Advance Time Dialog (modal):**
- **Before simulation**: Date picker (min = current date), "Advance" button, and a "Next Match (+3 days)" shortcut button.
- **After simulation**: Shows the new date, lists any new injuries (player name, injury type, duration in days), lists recovered players, or shows "No new injuries!" in green. "Close" button dismisses.

**Simulation Engine:**
- Iterates each day from current date to target date.
- Each day: recovers players whose return date has passed, then rolls injury probability for each healthy player.
- Injury probability per day = `injuriesPerSeason / 365`.
- Injury duration = Box-Muller normal distribution (mean + z * stddev), minimum 1 day.
- Injury type = weighted random selection from the player's historical injury type distribution.

---

### 3. Injury Log (History)

**Header:** "Injury Log" title, team name, total injury count, "Back to Dashboard" link.

**Injury Table:**
Columns: Player, Injury Type, Date Injured, Days Missed, Return Date.

- Shows all historical injuries for the active save, sorted newest-first by default.

**Empty State:** "No injuries recorded yet. Advance time on the dashboard to simulate injuries."

---

## Table Sorting

Both tables (dashboard squad + injury log) have **clickable column headers** that cycle through: ascending → descending → default order.

- Dashboard sortable columns: Name, OVR, Position, Age, Status.
- Injury Log sortable columns: Player, Injury Type, Date Injured, Days Missed, Return Date.
- Sort indicators (▲/▼) appear next to the active sort column.
- Third click resets to the default sort order.

---

## Save System

**Multi-slot saves** stored in browser localStorage:
- Each save has: unique ID, user-given name, full game state, created/updated timestamps.
- One save is marked as "active" at a time.
- **Legacy migration**: Old single-save format is automatically migrated to the new multi-save system on first load.

**Game State per save:**
- Team name, current date, season start date
- Active injuries (currently injured players)
- Full injury history (all injuries ever simulated)

---

## Data Pipeline

Offline data processing (not part of the running app):
1. Downloads three CSV datasets: Transfermarkt injury records, Transfermarkt player profiles, FC 25 player ratings (from SoFIFA).
2. Fuzzy-matches players between the FC 25 roster and Transfermarkt data using Levenshtein distance (threshold <= 3 for names, <= 5 for club names).
3. Computes per-player injury profiles from matched historical data.
4. Falls back to league-average profiles for unmatched players.
5. Outputs a single `teams.json` containing all teams, players, and their injury profiles.

Each player record includes: name, position, age, overall rating (from FC 25), and injury profile.

---

## Visual Design

- Light theme with oklch color tokens (dark theme CSS defined but no toggle implemented).
- Clean, minimal UI with rounded corners, subtle borders, and muted backgrounds.
- Responsive layout: max-width container, grid adapts from 1-3 columns.
- Color-coded elements: green/yellow/red for player status; green/yellow/gray for OVR ratings; red for destructive actions.
- Pointer cursor on all interactive elements (buttons, links, clickable rows).

---

## Navigation Flow

```
Team Selection (/) ──→ Dashboard (/dashboard) ──→ Injury Log (/injury-log)
       ↑                    │                            │
       └────────────────────┘ (Home link)                │
       ↑                                                 │
       └─────────────────────────────────────────────────┘ (Back to Dashboard)
```

Guards: Dashboard and Injury Log redirect to Team Selection if no active save exists.

---

This document describes **what the app does**, not how it's built. Any framework or stack can implement these features.
