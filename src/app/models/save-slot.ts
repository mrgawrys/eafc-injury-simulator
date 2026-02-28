import type { GameState } from './game-state';

export interface SaveSlot {
  id: string;
  name: string;
  gameState: GameState;
  createdAt: string;
  updatedAt: string;
}
