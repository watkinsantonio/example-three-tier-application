# Calculator

A standalone calculator. No database, no server, no dependencies, no build step.

- **Desktop/browser:** open `index.html` directly in any browser (works from `file://`).
- **Terminal:** `node cli.js "2 + 3 * 4"` prints `14`; `node cli.js` starts an interactive prompt.
- **Tests:** `npm test` (Node 20+, uses the built-in test runner).

Supports `+ - * / % ^`, parentheses, unary minus and decimals (`×`, `÷`, `−` are accepted too).
Division or modulo by zero and malformed input return an error message rather than crashing.
The logic lives in `calc.js`, which is plain JavaScript usable from both Node and the browser.
