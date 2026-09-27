import type { GameState, Player } from '@/types/game';

export const INITIAL_PIP_COUNT = 167;

export function getCurrentPipCount(state: GameState, player: Player): number {
  // Only positions contribute: a checker on the bar is 25 pips from bearing
  // off, and borne-off checkers contribute zero. Dice and scores are unrelated.
  return state.board.reduce((total, point, index) => {
    if (point.player !== player) return total;

    const distance = player === 'player1' ? 24 - index : index + 1;
    return total + point.count * distance;
  }, state.bar[player] * 25);
}

export function getCompletedPip(state: GameState, player: Player): number {
  // Captured checkers can push the remaining distance above its initial value.
  return Math.max(0, Math.min(INITIAL_PIP_COUNT, INITIAL_PIP_COUNT - getCurrentPipCount(state, player)));
}
