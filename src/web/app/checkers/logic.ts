// Pure American checkers rules: no React, no DOM, so they can be unit tested directly.
//
// Rules implemented:
// - 8x8 board, pieces only on dark squares ((row + col) is odd).
// - Red starts on the bottom three rows and moves towards row 0; black starts on
//   the top three rows and moves towards row 7.
// - Men move one square diagonally forward; kings move one square diagonally in any direction.
// - Captures jump an adjacent enemy piece onto an empty square beyond it. Captures
//   are mandatory: if any capture exists for the side to move, only captures are legal.
// - A capture may continue with the same piece (multi-jump). A man that reaches the
//   far row is crowned and its turn ends immediately, even if further jumps exist.
// - A player who has no legal moves on their turn (including having no pieces) loses.

export type Player = 'red' | 'black';

export type Square = { row: number; col: number };

export type Piece = { player: Player; king: boolean };

export type Board = (Piece | null)[][];

export type Move = {
  from: Square;
  to: Square;
  // Every square the moving piece lands on, in order. The last entry equals `to`.
  path: Square[];
  // Squares of the enemy pieces jumped by this move.
  captured: Square[];
};

export type GameState = {
  board: Board;
  turn: Player;
  winner: Player | null;
};

export const BOARD_SIZE = 8;

const ALL_DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isDarkSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

function inBounds(square: Square): boolean {
  return square.row >= 0 && square.row < BOARD_SIZE && square.col >= 0 && square.col < BOARD_SIZE;
}

function opponent(player: Player): Player {
  return player === 'red' ? 'black' : 'red';
}

// The row a player's men are crowned on when they reach it.
function isPromotionSquare(player: Player, square: Square): boolean {
  return square.row === (player === 'red' ? 0 : BOARD_SIZE - 1);
}

function directionsFor(piece: Piece): [number, number][] {
  if (piece.king) return ALL_DIRECTIONS;
  const forward = piece.player === 'red' ? -1 : 1;
  return ALL_DIRECTIONS.filter(([dr]) => dr === forward);
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Piece | null),
  );
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isDarkSquare(row, col)) continue;
      if (row < 3) board[row][col] = { player: 'black', king: false };
      if (row > BOARD_SIZE - 4) board[row][col] = { player: 'red', king: false };
    }
  }
  return board;
}

export function createGame(): GameState {
  return { board: createInitialBoard(), turn: 'red', winner: null };
}

function simpleMovesFrom(board: Board, from: Square, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const to = { row: from.row + dr, col: from.col + dc };
    if (inBounds(to) && board[to.row][to.col] === null) {
      moves.push({ from, to, path: [to], captured: [] });
    }
  }
  return moves;
}

function captureMovesFrom(board: Board, from: Square, piece: Piece): Move[] {
  // Work on a copy with the moving piece lifted off its start square. Jumped pieces
  // stay on the copy until the move finishes, so they still block landing and
  // cannot be jumped twice.
  const work: Board = board.map((row) => row.slice());
  work[from.row][from.col] = null;

  const moves: Move[] = [];

  const search = (position: Square, path: Square[], captured: Square[]) => {
    let extended = false;

    for (const [dr, dc] of directionsFor(piece)) {
      const over = { row: position.row + dr, col: position.col + dc };
      const landing = { row: position.row + 2 * dr, col: position.col + 2 * dc };
      if (!inBounds(landing)) continue;

      const jumped = work[over.row][over.col];
      if (!jumped || jumped.player === piece.player) continue;
      if (captured.some((square) => sameSquare(square, over))) continue;
      if (work[landing.row][landing.col] !== null) continue;

      extended = true;
      const nextPath = [...path, landing];
      const nextCaptured = [...captured, over];

      if (!piece.king && isPromotionSquare(piece.player, landing)) {
        // Crowning ends the turn, so this branch stops here.
        moves.push({ from, to: landing, path: nextPath, captured: nextCaptured });
      } else {
        search(landing, nextPath, nextCaptured);
      }
    }

    if (!extended && captured.length > 0) {
      moves.push({ from, to: path[path.length - 1], path, captured });
    }
  };

  search(from, [], []);
  return moves;
}

// All legal moves for the side to move. Empty once the game is over.
export function getLegalMoves(state: GameState): Move[] {
  if (state.winner !== null) return [];

  const captures: Move[] = [];
  const simple: Move[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = state.board[row][col];
      if (!piece || piece.player !== state.turn) continue;
      const from = { row, col };
      captures.push(...captureMovesFrom(state.board, from, piece));
      simple.push(...simpleMovesFrom(state.board, from, piece));
    }
  }

  return captures.length > 0 ? captures : simple;
}

// Applies a legal move. Assumes the move came from getLegalMoves.
function applyMove(state: GameState, move: Move): GameState {
  const board: Board = state.board.map((row) => row.slice());
  const piece = board[move.from.row][move.from.col];
  if (!piece) throw new Error('No piece on the starting square');

  board[move.from.row][move.from.col] = null;
  for (const square of move.captured) {
    board[square.row][square.col] = null;
  }

  const king = piece.king || isPromotionSquare(piece.player, move.to);
  board[move.to.row][move.to.col] = { player: piece.player, king };

  const next: GameState = { board, turn: opponent(state.turn), winner: null };
  if (getLegalMoves(next).length === 0) {
    next.winner = state.turn;
  }
  return next;
}

// Plays the move that goes from `from` to `to`, or returns null if no legal move does.
// When several legal moves share the same start and end squares, the first one is used.
export function makeMove(state: GameState, from: Square, to: Square): GameState | null {
  const move = getLegalMoves(state).find(
    (candidate) => sameSquare(candidate.from, from) && sameSquare(candidate.to, to),
  );
  return move ? applyMove(state, move) : null;
}

// Legal moves for the piece on `from`, for the side to move.
export function movesFrom(state: GameState, from: Square): Move[] {
  return getLegalMoves(state).filter((move) => sameSquare(move.from, from));
}
