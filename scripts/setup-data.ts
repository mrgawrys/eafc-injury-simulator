// scripts/setup-data.ts — orchestrates download + process
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

console.log("=== Step 1: Download raw data ===");
execFileSync("npx", ["tsx", join(__dirname, "download-data.ts")], {
  cwd: root,
  stdio: "inherit",
});

console.log("\n=== Step 2: Process data ===");
execFileSync("npx", ["tsx", join(__dirname, "process-data.ts")], {
  cwd: root,
  stdio: "inherit",
});

console.log("\n=== Setup complete ===");
