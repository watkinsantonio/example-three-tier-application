import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  createInitialBoard,
  getLegalMoves,
  isDarkSquare,
  makeMove,
  movesFrom,
  type Board,
  type GameState,
  type Piece,
  type Player,
} from './logic.ts';

type Placement = [row: number, col: number, piece: Piece];

const red = (row: number, col: number, king = false): Placement => [row, col, { player: 'red', king }];
const black = (row: number, col: number, king = false): Placement => [row, col, { player: 'black', king }];

function stateWith(turn: Player, placements: Placement[]): GameState {
  const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  for (const [row, col, piece] of placements) {
    board[row][col] = piece;
  }
  return { board, turn, winner: null };
}

function countPieces(board: Board, player: Player): number {
  return board.flat().filter((piece) => piece?.player === player).length;
}

test('initial board has 12 pieces per side on dark squares only', () => {
  const board = createInitialBoard();
  assert.equal(countPieces(board, 'red'), 12);
  assert.equal(countPieces(board, 'black'), 12);

  board.forEach((row, r) =>
    row.forEach((piece, c) => {
      if (piece) assert.ok(isDarkSquare(r, c), `piece on light square ${r},${c}`);
    }),
  );
});

test('red has seven opening moves, all simple and from row 5', () => {
  const moves = getLegalMoves(createGame());
  assert.equal(moves.length, 7);
  for (const move of moves) {
    assert.equal(move.from.row, 5);
    assert.equal(move.to.row, 4);
    assert.deepEqual(move.captured, []);
  }
});

test('makeMove moves the piece, passes the turn and rejects illegal moves', () => {
  const game = createGame();
  const next = makeMove(game, { row: 5, col: 0 }, { row: 4, col: 1 });
  assert.ok(next);
  assert.equal(next.turn, 'black');
  assert.equal(next.board[5][0], null);
  assert.deepEqual(next.board[4][1], { player: 'red', king: false });

  // Moving a black piece on red's turn, or a jump-less diagonal, is illegal.
  assert.equal(makeMove(game, { row: 2, col: 1 }, { row: 3, col: 0 }), null);
  assert.equal(makeMove(game, { row: 5, col: 0 }, { row: 3, col: 2 }), null);
});

test('captures are mandatory', () => {
  // Red man can jump the black man on (4,3); the other red man could only step forward.
  const state = stateWith('red', [red(5, 2), black(4, 3), red(5, 6)]);
  const moves = getLegalMoves(state);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].to, { row: 3, col: 4 });
  assert.deepEqual(moves[0].captured, [{ row: 4, col: 3 }]);
});

test('a capture can continue into a multi-jump', () => {
  // (7,2) jumps (6,3) to (5,4), then jumps (4,5) to (3,6).
  const state = stateWith('red', [red(7, 2), black(6, 3), black(4, 5)]);
  const moves = getLegalMoves(state);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [
    { row: 5, col: 4 },
    { row: 3, col: 6 },
  ]);
  assert.equal(moves[0].captured.length, 2);

  const next = makeMove(state, { row: 7, col: 2 }, { row: 3, col: 6 });
  assert.ok(next);
  assert.equal(countPieces(next.board, 'black'), 0);
  assert.equal(next.winner, 'red');
});

test('men cannot capture backwards, kings can', () => {
  const man = stateWith('red', [red(3, 3), black(4, 4)]);
  const manMoves = getLegalMoves(man);
  assert.ok(manMoves.every((move) => move.captured.length === 0));
  assert.equal(manMoves.length, 2);
  assert.ok(manMoves.every((move) => move.to.row === 2));

  const king = stateWith('red', [red(3, 3, true), black(4, 4)]);
  const kingMoves = getLegalMoves(king);
  assert.equal(kingMoves.length, 1);
  assert.deepEqual(kingMoves[0].to, { row: 5, col: 5 });
});

test('a man moving onto the far row is crowned', () => {
  const state = stateWith('red', [red(1, 2), black(7, 0)]);
  const next = makeMove(state, { row: 1, col: 2 }, { row: 0, col: 1 });
  assert.ok(next);
  assert.deepEqual(next.board[0][1], { player: 'red', king: true });
});

test('crowning ends a multi-jump immediately', () => {
  // Red man (2,5) jumps (1,4) and is crowned on (0,3). As a king it could jump (1,2)
  // from there, but the turn must end on promotion.
  const state = stateWith('red', [red(2, 5), black(1, 4), black(1, 2)]);
  const moves = getLegalMoves(state);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].to, { row: 0, col: 3 });
  assert.equal(moves[0].captured.length, 1);
});

test('black men are crowned on row 7 and move downwards', () => {
  const state = stateWith('black', [black(6, 1), red(3, 4), red(0, 7)]);
  const next = makeMove(state, { row: 6, col: 1 }, { row: 7, col: 0 });
  assert.ok(next);
  assert.deepEqual(next.board[7][0], { player: 'black', king: true });
});

test('the side to move with no legal moves loses', () => {
  // Black's only man sits on the far row with nowhere to go, so after red moves black loses.
  const state = stateWith('red', [red(1, 2), black(7, 0)]);
  const next = makeMove(state, { row: 1, col: 2 }, { row: 0, col: 1 });
  assert.ok(next);
  assert.equal(next.winner, 'red');
  assert.deepEqual(getLegalMoves(next), []);
  assert.equal(makeMove(next, { row: 7, col: 0 }, { row: 6, col: 1 }), null);
});

test('movesFrom only returns moves for the selected piece', () => {
  const state = createGame();
  const fromFive = movesFrom(state, { row: 5, col: 2 });
  assert.equal(fromFive.length, 2);
  assert.deepEqual(movesFrom(state, { row: 2, col: 1 }), []);
});
