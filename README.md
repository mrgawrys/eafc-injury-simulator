# FIFA Injury Simulator

Simulate realistic squad injuries for FC 25 teams using real Transfermarkt injury data. Pick a team, advance through the season, and see who gets injured based on each player's actual injury history.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
npm run setup-data
```

`setup-data` downloads three CSV datasets (~8MB total) and processes them into JSON:
- **FC 25 roster** — 15,800+ players from SoFIFA
- **Transfermarkt injury history** — 143,000+ injury records
- **Transfermarkt player profiles** — maps player IDs to names for joining

Players are fuzzy-matched between datasets. Those with injury history get personalized injury profiles; others get a league-average fallback.

### Manual data fallback

If auto-download fails, manually place these files in `data-raw/`:
- `roster.csv` from [Kaggle FC25 dataset](https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats)
- `injuries.csv` and `profiles.csv` from [salimt/football-datasets](https://github.com/salimt/football-datasets)

Then run `npm run process-data`.

## Run

```bash
npm start
```

Opens at http://localhost:4200.

## How to play

1. **Select a team** — search and pick from 650+ teams
2. **Dashboard** — see your squad with availability status
3. **Advance Time** — skip days or jump to next match (3 days). The simulation rolls daily injury chances based on each player's historical injury rate
4. **Injury Log** — view all injuries that occurred during your season
5. **New Season** — reset and pick a new team
