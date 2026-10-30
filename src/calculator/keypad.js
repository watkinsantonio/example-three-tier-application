'use strict';

// Keypad layout and pure key handling, kept free of DOM code so it can be tested in Node.
// Every entry is { label, kind, span? }. kind: 'key' (append label), 'op' (append label,
// styled as operator), 'clear', 'back', 'equals'. Each row must add up to COLUMNS cells.

const COLUMNS = 4;

const layout = [
  [{ label: 'C', kind: 'clear' }, { label: '⌫', kind: 'back' }, { label: '(', kind: 'key' }, { label: ')', kind: 'key' }],
  [{ label: '7', kind: 'key' }, { label: '8', kind: 'key' }, { label: '9', kind: 'key' }, { label: '÷', kind: 'op' }],
  [{ label: '4', kind: 'key' }, { label: '5', kind: 'key' }, { label: '6', kind: 'key' }, { label: '×', kind: 'op' }],
  [{ label: '1', kind: 'key' }, { label: '2', kind: 'key' }, { label: '3', kind: 'key' }, { label: '−', kind: 'op' }],
  [{ label: '0', kind: 'key' }, { label: '.', kind: 'key' }, { label: '%', kind: 'op' }, { label: '+', kind: 'op' }],
  [{ label: '^', kind: 'op' }, { label: '=', kind: 'equals', span: 3 }],
];

/** Returns the new expression text after pressing a key (equals is handled by the caller). */
function applyKey(text, key) {
  if (key.kind === 'clear') return '';
  if (key.kind === 'back') return text.slice(0, -1);
  if (key.kind === 'equals') return text;
  return text + key.label;
}

const api = { COLUMNS, layout, applyKey };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Keypad = api;
