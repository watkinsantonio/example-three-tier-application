'use strict';

(function () {
  const input = document.getElementById('expr');
  const result = document.getElementById('result');
  const keys = document.getElementById('keys');

  const layout = [
    ['C', 'clear'], ['⌫', 'back'], ['(', ')'], ['÷', 'op'],
    ['7'], ['8'], ['9'], ['×', 'op'],
    ['4'], ['5'], ['6'], ['−', 'op'],
    ['1'], ['2'], ['3'], ['+', 'op'],
    ['0'], ['.'], ['%', 'op'], ['=', 'equals'],
  ];

  function preview() {
    if (input.value.trim() === '') {
      result.textContent = '0';
      result.className = '';
      return;
    }
    const out = window.Calc.calculate(input.value);
    result.textContent = out.ok ? out.text : '';
    result.className = '';
  }

  function commit() {
    if (input.value.trim() === '') return;
    const out = window.Calc.calculate(input.value);
    result.textContent = out.text;
    result.className = out.ok ? '' : 'error';
    if (out.ok) input.value = out.text;
  }

  layout.forEach(([label, kind]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (kind === 'op' || kind === 'equals') button.className = 'op';
    button.addEventListener('click', () => {
      if (kind === 'clear') input.value = '';
      else if (kind === 'back') input.value = input.value.slice(0, -1);
      else if (kind === 'equals') return commit();
      else input.value += label;
      preview();
      input.focus();
    });
    keys.appendChild(button);
  });

  input.addEventListener('input', preview);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') { input.value = ''; preview(); }
  });
})();
