'use strict';

(function () {
  const input = document.getElementById('expr');
  const result = document.getElementById('result');
  const keys = document.getElementById('keys');
  const { layout, applyKey } = window.Keypad;

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

  layout.flat().forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = key.label;
    if (key.kind === 'op' || key.kind === 'equals') button.className = 'op';
    if (key.span) button.style.gridColumn = `span ${key.span}`;
    button.addEventListener('click', () => {
      if (key.kind === 'equals') return commit();
      input.value = applyKey(input.value, key);
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
