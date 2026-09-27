/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness transpiles the TypeScript engine in memory. */
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};

const { getInitialGameState } = require('../lib/game/board.ts');
const { applyMove, getLegalMovesForPiece } = require('../lib/game/moves.ts');
const { INITIAL_PIP_COUNT, getCurrentPipCount, getCompletedPip } = require('../lib/game/pip.ts');

function emptyState(player) {
  return {
    ...getInitialGameState(),
    status: 'PLAYING',
    currentPlayer: player,
    board: Array.from({ length: 24 }, () => ({ player: null, count: 0 })),
  };
}

test('both players start with 0 completed out of 167 pips', () => {
  const state = getInitialGameState();
  assert.equal(INITIAL_PIP_COUNT, 167);
  for (const player of ['player1', 'player2']) {
    assert.equal(getCurrentPipCount(state, player), 167);
    assert.equal(getCompletedPip(state, player), 0);
  }
});

test('pip calculations leave the game state and match score unchanged', () => {
  const state = getInitialGameState();
  state.matchScore = { player1: 4, player2: 2 };
  const original = structuredClone(state);

  for (const player of ['player1', 'player2']) {
    assert.equal(getCurrentPipCount(state, player), 167);
    assert.equal(getCompletedPip(state, player), 0);
    assert.equal(getCompletedPip({ ...state, matchScore: { player1: 9, player2: 7 } }, player), 0);
  }
  assert.deepEqual(state, original);
});

for (const player of ['player1', 'player2']) {
  const opponent = player === 'player1' ? 'player2' : 'player1';
  const pointAtDistance = (distance) => player === 'player1' ? 24 - distance : distance - 1;

  test(`${player}: rolling dice alone does not advance progress`, () => {
    const state = { ...getInitialGameState(), status: 'PLAYING', currentPlayer: player };
    for (const dice of [[6, 4], [6, 6]]) {
      const rolled = {
        ...state,
        dice,
        remainingMoves: dice[0] === dice[1] ? Array(4).fill(dice[0]) : [...dice],
      };
      assert.equal(getCurrentPipCount(rolled, player), 167);
      assert.equal(getCompletedPip(rolled, player), 0);
      assert.equal(getCompletedPip(rolled, opponent), 0);
    }
  });

  test(`${player}: board, bar and borne-off checkers together leave 100 pips and 67 completed`, () => {
    const state = emptyState(player);
    state.borneOff[player] = 5;
    state.bar[player] = 2;
    state.board[pointAtDistance(7)] = { player, count: 5 };
    state.board[pointAtDistance(5)] = { player, count: 3 };

    assert.equal(getCurrentPipCount(state, player), 100);
    assert.equal(getCompletedPip(state, player), 67);

    const restored = JSON.parse(JSON.stringify(state));
    assert.equal(getCurrentPipCount(restored, player), 100);
    assert.equal(getCompletedPip(restored, player), 67);
  });

  test(`${player}: 120 remaining pips displays 47 completed pips`, () => {
    const state = emptyState(player);
    state.board[pointAtDistance(8)] = { player, count: 15 };
    assert.equal(getCurrentPipCount(state, player), 120);
    assert.equal(getCompletedPip(state, player), 47);
  });

  test(`${player}: moving six points increases progress by six`, () => {
    const state = getInitialGameState();
    state.status = 'PLAYING';
    state.currentPlayer = player;
    state.remainingMoves = [6];
    const move = getLegalMovesForPiece(state, player, pointAtDistance(24), 6);
    assert.ok(move);
    const next = applyMove(state, move);
    assert.equal(getCurrentPipCount(next, player), 161);
    assert.equal(getCompletedPip(next, player), 6);
    assert.equal(getCompletedPip(next, opponent), 0);
    assert.equal(getCompletedPip(state, player), 0);
  });

  test(`${player}: capture reduces the victim's progress and bar entry restores distance traveled`, () => {
    const state = emptyState(player);
    state.borneOff = { player1: 14, player2: 14 };
    state.board[pointAtDistance(7)] = { player, count: 1 };
    state.board[pointAtDistance(6)] = { player: opponent, count: 1 };
    state.remainingMoves = [1];
    assert.equal(getCurrentPipCount(state, opponent), 19);
    assert.equal(getCompletedPip(state, opponent), 148);

    const capture = getLegalMovesForPiece(state, player, pointAtDistance(7), 1);
    assert.ok(capture);
    const captured = applyMove(state, capture);
    assert.equal(captured.bar[opponent], 1);
    assert.equal(getCurrentPipCount(captured, opponent), 25);
    assert.equal(getCompletedPip(captured, opponent), 142);
    assert.equal(getCompletedPip(captured, player), 161);

    captured.currentPlayer = opponent;
    captured.remainingMoves = [5];
    const entry = getLegalMovesForPiece(captured, opponent, 'bar', 5);
    assert.ok(entry);
    const entered = applyMove(captured, entry);
    assert.equal(getCurrentPipCount(entered, opponent), 20);
    assert.equal(getCompletedPip(entered, opponent), 147);
  });

  test(`${player}: a setback above 167 remaining pips clamps progress to zero`, () => {
    const state = getInitialGameState();
    state.board[pointAtDistance(6)].count -= 2;
    state.bar[player] = 2;
    assert.equal(getCurrentPipCount(state, player), 205);
    assert.equal(getCompletedPip(state, player), 0);
  });

  for (const die of [2, 6]) {
    test(`${player}: bearing off with die ${die} credits only the checker's remaining distance`, () => {
      const state = emptyState(player);
      state.borneOff[player] = 13;
      state.board[pointAtDistance(2)] = { player, count: 2 };
      state.remainingMoves = [die, die];
      assert.equal(getCompletedPip(state, player), 163);

      const move = getLegalMovesForPiece(state, player, pointAtDistance(2), die);
      assert.ok(move);
      assert.equal(move.to, 'borneOff');
      const next = applyMove(state, move);
      assert.equal(getCurrentPipCount(next, player), 2);
      assert.equal(getCompletedPip(next, player), 165);

      const finalMove = getLegalMovesForPiece(next, player, pointAtDistance(2), die);
      assert.ok(finalMove);
      const finished = applyMove(next, finalMove);
      assert.equal(finished.borneOff[player], 15);
      assert.equal(finished.status, 'FINISHED');
      assert.equal(finished.winner, player);
      assert.equal(getCurrentPipCount(finished, player), 0);
      assert.equal(getCompletedPip(finished, player), 167);
    });
  }
}
