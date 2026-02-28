# FIFA Injury Simulator

Add more spice to your FIFA tournament experience with a realistic injury system between matches. Instead of playing every game with a full-strength squad, this app simulates injuries based on real Transfermarkt data — so your star striker might pull a hamstring right before the final, just like in real football.

Pick a team, advance time between matches, and deal with the squad selection headaches that real managers face. Players get injured at rates matching their actual injury history, miss realistic recovery times, and suffer the same types of injuries they do in real life.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
npm run setup-data
```

`setup-data` downloads three CSV datasets (~8MB total) and processes them into JSON:
- **FC 26 roster** — 18,000+ players from SoFIFA
- **Transfermarkt injury history** — 143,000+ injury records
- **Transfermarkt player profiles** — maps player IDs to names for joining

Players are fuzzy-matched between datasets. Those with injury history get personalized injury profiles; others get a league-average fallback.

### Manual data fallback

If auto-download fails, manually place these files in `data-raw/`:
- `roster.csv` from [Kaggle FC26 dataset](https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data)
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
