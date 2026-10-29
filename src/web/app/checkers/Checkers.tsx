'use client';

import { useState } from 'react';
import {
  createGame,
  getLegalMoves,
  makeMove,
  movesFrom,
  sameSquare,
  isDarkSquare,
  type GameState,
  type Square,
} from './logic';

export default function Checkers() {
  const [game, setGame] = useState<GameState>(createGame);
  const [selected, setSelected] = useState<Square | null>(null);

  const legalMoves = getLegalMoves(game);
  const mustCapture = legalMoves.some((move) => move.captured.length > 0);
  const targets = selected ? movesFrom(game, selected).map((move) => move.to) : [];

  function handleSquareClick(square: Square) {
    if (game.winner) return;

    if (selected && targets.some((target) => sameSquare(target, square))) {
      const next = makeMove(game, selected, square);
      if (next) {
        setGame(next);
      }
      setSelected(null);
      return;
    }

    const piece = game.board[square.row][square.col];
    const canMove = piece !== null && piece.player === game.turn && movesFrom(game, square).length > 0;
    setSelected(canMove && !(selected && sameSquare(selected, square)) ? square : null);
  }

  function restart() {
    setGame(createGame());
    setSelected(null);
  }

  const status = game.winner
    ? `${game.winner === 'red' ? 'Red' : 'Black'} wins!`
    : `${game.turn === 'red' ? 'Red' : 'Black'} to move${mustCapture ? ' (capture required)' : ''}`;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <p aria-live="polite" className="mb-4 text-center text-lg font-medium text-zinc-900 dark:text-zinc-50">
        {status}
      </p>
      <div
        aria-label="Checkers board"
        className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded border-4 border-zinc-800 dark:border-zinc-950"
      >
        {game.board.map((row, r) =>
          row.map((piece, c) => {
            const square = { row: r, col: c };
            const dark = isDarkSquare(r, c);
            const isSelected = selected !== null && sameSquare(selected, square);
            const isTarget = targets.some((target) => sameSquare(target, square));
            const label = `${piece ? `${piece.player}${piece.king ? ' king' : ''}` : 'empty'} square ${r + 1},${c + 1}`;

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={label}
                disabled={!dark}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400 ${
                  dark ? 'bg-emerald-800' : 'bg-amber-100 dark:bg-amber-200'
                } ${isSelected ? 'ring-4 ring-inset ring-amber-400' : ''}`}
              >
                {isTarget && <span className="absolute h-3 w-3 rounded-full bg-amber-400/80" aria-hidden="true" />}
                {piece && (
                  <span
                    aria-hidden="true"
                    className={`flex h-[78%] w-[78%] items-center justify-center rounded-full border-4 text-xl font-bold shadow-md ${
                      piece.player === 'red'
                        ? 'bg-red-600 border-red-300 text-red-100'
                        : 'bg-zinc-900 border-zinc-500 text-zinc-300'
                    }`}
                  >
                    {piece.king ? '♛' : ''}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {legalMoves.length} legal {legalMoves.length === 1 ? 'move' : 'moves'}
        </span>
        <button
          type="button"
          onClick={restart}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        >
          New game
        </button>
      </div>
    </div>
  );
}
