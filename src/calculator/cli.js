#!/usr/bin/env node
'use strict';

// Usage:
//   node cli.js "2 + 3 * 4"      one-shot
//   node cli.js                  interactive prompt (empty line or Ctrl-D to quit)

const readline = require('node:readline');
const { calculate } = require('./calc.js');

function main(argv) {
  if (argv.length > 0) {
    const result = calculate(argv.join(' '));
    (result.ok ? process.stdout : process.stderr).write(`${result.text}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  rl.prompt();
  rl.on('line', (line) => {
    if (line.trim() === '') return rl.close();
    const result = calculate(line);
    console.log(result.ok ? result.text : `Error: ${result.text}`);
    rl.prompt();
  });
}

main(process.argv.slice(2));
