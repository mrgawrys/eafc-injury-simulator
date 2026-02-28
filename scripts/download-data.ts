// scripts/download-data.ts
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, "..", "data-raw");

const SOURCES = {
  injuries:
    "https://raw.githubusercontent.com/salimt/football-datasets/main/datalake/transfermarkt/player_injuries/player_injuries.csv",
  // Transfermarkt player profiles — maps player_id to name/club for joining with injuries
  profiles:
    "https://raw.githubusercontent.com/salimt/football-datasets/main/datalake/transfermarkt/player_profiles/player_profiles.csv",
  // FC 26 roster — sourced from ismailoksuz's EAFC26-DataHub repo (SoFIFA data).
  // If this link breaks, download manually from:
  // https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data
  roster:
    "https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.csv",
};

function download(url: string, dest: string): void {
  execFileSync("curl", ["-sL", "-o", dest, url], { stdio: "inherit" });
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });

  for (const [name, url] of Object.entries(SOURCES)) {
    const dest = join(RAW_DIR, `${name}.csv`);
    if (existsSync(dest)) {
      console.log(`✓ ${name}.csv already exists, skipping`);
      continue;
    }
    console.log(`↓ Downloading ${name}...`);
    download(url, dest);
    console.log(`✓ ${name}.csv saved`);
  }
}

main().catch((err) => {
  console.error("Download failed:", err);
  process.exit(1);
});
