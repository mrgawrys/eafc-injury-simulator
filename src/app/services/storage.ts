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
  abstract getActiveGameState(): GameState | null;
  abstract hasAnySave(): boolean;

  /** @deprecated Use getActiveGameState() — will be removed in Tasks 4-5 */
  abstract getGameState(): GameState | null;
  /** @deprecated Use saveSave() — will be removed in Tasks 4-5 */
  abstract saveGameState(state: GameState): void;
  /** @deprecated Use deleteSave() — will be removed in Tasks 4-5 */
  abstract clearGameState(): void;
  /** @deprecated Use hasAnySave() — will be removed in Tasks 4-5 */
  abstract hasActiveGame(): boolean;
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

  /** @deprecated Compat shim — delegates to getActiveGameState() */
  getGameState(): GameState | null {
    return this.getActiveGameState();
  }

  /** @deprecated Compat shim — saves into active slot or creates new one */
  saveGameState(state: GameState): void {
    const activeId = this.getActiveSaveId();
    const existing = activeId ? this.getSave(activeId) : null;
    const now = new Date().toISOString();

    if (existing) {
      existing.gameState = state;
      existing.updatedAt = now;
      this.saveSave(existing);
    } else {
      const slot: SaveSlot = {
        id: crypto.randomUUID(),
        name: `${state.teamName} Save`,
        gameState: state,
        createdAt: now,
        updatedAt: now,
      };
      this.saveSave(slot);
      this.setActiveSaveId(slot.id);
    }
  }

  /** @deprecated Compat shim — deletes active save */
  clearGameState(): void {
    const activeId = this.getActiveSaveId();
    if (activeId) {
      this.deleteSave(activeId);
    }
  }

  /** @deprecated Compat shim — delegates to hasAnySave() */
  hasActiveGame(): boolean {
    return this.getActiveSaveId() !== null && this.hasAnySave();
  }
}
