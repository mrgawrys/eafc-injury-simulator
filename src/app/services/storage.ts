import { Injectable } from "@angular/core";
import type { GameState } from "../models/game-state";

const STORAGE_KEY = "fifa-injuries-game-state";

export abstract class StorageService {
  abstract getGameState(): GameState | null;
  abstract saveGameState(state: GameState): void;
  abstract clearGameState(): void;
  abstract hasActiveGame(): boolean;
}

@Injectable({ providedIn: "root" })
export class LocalStorageService extends StorageService {
  getGameState(): GameState | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  saveGameState(state: GameState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  clearGameState(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  hasActiveGame(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}
