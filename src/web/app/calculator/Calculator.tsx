'use client';

import { useState } from 'react';

type Operator = '+' | '−' | '×' | '÷';

type CalculatorState = {
  display: string;
  operand: number | null;
  operator: Operator | null;
  startNewInput: boolean;
};

const initialState: CalculatorState = {
  display: '0',
  operand: null,
  operator: null,
  startNewInput: false,
};

function calculate(left: number, right: number, operator: Operator): string {
  let result: number;

  switch (operator) {
    case '+': result = left + right; break;
    case '−': result = left - right; break;
    case '×': result = left * right; break;
    case '÷': result = left / right; break;
  }

  return Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error';
}

export default function Calculator() {
  const [state, setState] = useState<CalculatorState>(initialState);

  function enterDigit(digit: string) {
    setState((current) => {
      if (current.display === 'Error') {
        return { ...initialState, display: digit === '.' ? '0.' : digit };
      }
      if (current.startNewInput) {
        return { ...current, display: digit === '.' ? '0.' : digit, startNewInput: false };
      }
      if (digit === '.' && current.display.includes('.')) return current;
      return {
        ...current,
        display: current.display === '0' && digit !== '.' ? digit : current.display + digit,
      };
    });
  }

  function chooseOperator(operator: Operator) {
    setState((current) => {
      if (current.display === 'Error') return current;
      if (current.operator && current.startNewInput) return { ...current, operator };

      const display = current.operator && current.operand !== null
        ? calculate(current.operand, Number(current.display), current.operator)
        : current.display;
      if (display === 'Error') return { ...initialState, display };

      return { display, operand: Number(display), operator, startNewInput: true };
    });
  }

  function equals() {
    setState((current) => {
      if (current.operator === null || current.operand === null || current.startNewInput) return current;
      return {
        display: calculate(current.operand, Number(current.display), current.operator),
        operand: null,
        operator: null,
        startNewInput: true,
      };
    });
  }

  function backspace() {
    setState((current) => {
      if (current.display === 'Error') return initialState;
      if (current.startNewInput) return current;
      const display = current.display.slice(0, -1);
      return { ...current, display: display === '' || display === '-' ? '0' : display };
    });
  }

  const buttonClass = 'rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-4 text-lg font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-colors';
  const operatorClass = 'rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-4 text-lg font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-colors';

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
      <output aria-live="polite" aria-label="Calculator display" className="block overflow-x-auto rounded-lg bg-zinc-50 dark:bg-zinc-900 px-4 py-6 mb-4 text-right text-3xl text-zinc-900 dark:text-zinc-50">
        {state.display}
      </output>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={buttonClass} onClick={() => setState(initialState)}>Clear</button>
        <button type="button" className={buttonClass} onClick={backspace} aria-label="Backspace">⌫</button>
        <button type="button" className={operatorClass} onClick={() => chooseOperator('÷')} aria-label="Divide">÷</button>
        <button type="button" className={operatorClass} onClick={() => chooseOperator('×')} aria-label="Multiply">×</button>
        {['7', '8', '9'].map((digit) => <button type="button" key={digit} className={buttonClass} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className={operatorClass} onClick={() => chooseOperator('−')} aria-label="Subtract">−</button>
        {['4', '5', '6'].map((digit) => <button type="button" key={digit} className={buttonClass} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className={operatorClass} onClick={() => chooseOperator('+')} aria-label="Add">+</button>
        {['1', '2', '3'].map((digit) => <button type="button" key={digit} className={buttonClass} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className={`${operatorClass} row-span-2`} onClick={equals} aria-label="Equals">=</button>
        <button type="button" className={`${buttonClass} col-span-2`} onClick={() => enterDigit('0')}>0</button>
        <button type="button" className={buttonClass} onClick={() => enterDigit('.')} aria-label="Decimal point">.</button>
      </div>
    </div>
  );
}
