'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Engine } = require('../core/engine');
const { Store } = require('../core/store');
const { createApi } = require('../core/api');
const { buildProblem } = require('../core/problems');
const { SKILLS } = require('../core/skills');

const root = path.join(__dirname, '..', 'renderer');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

/** Boot the real renderer against the real engine; `hooks` can make individual API calls fail. */
function boot(hooks = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const engine = new Engine({ store: new Store() });
  const real = createApi(engine);
  const seen = { problems: [] };
  const api = {};
  for (const name of Object.keys(real)) {
    api[name] = async (args) => {
      if (hooks.override && hooks.override[name]) return hooks.override[name](args);
      if (hooks[name] && hooks[name]()) throw new Error('Simulated failure in ' + name);
      const out = real[name](args);
      if (out && out.problem) seen.problems.push(out.problem);
      return out;
    };
  }
  window.eval(appJs);
  window.MathPathApp.start(api, window.document.getElementById('app'), window.document.getElementById('who'));
  return { window, doc: window.document, engine, seen, api };
}

async function waitFor(fn, what = 'condition') {
  for (let i = 0; i < 400; i++) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('Timed out waiting for ' + what);
}
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
const submitForm = (form) => form.dispatchEvent(new form.ownerDocument.defaultView.Event('submit', { bubbles: true, cancelable: true }));
const setValue = (input, v) => {
  input.value = v;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('input', { bubbles: true }));
};

async function createLearner(ctx, { name = 'Sam', year = new Date().getFullYear() - 30, guardian = '' } = {}) {
  const { doc } = ctx;
  await waitFor(() => doc.querySelector('[data-screen="profiles"]'), 'profiles screen');
  setValue(doc.getElementById('name'), name);
  setValue(doc.getElementById('birth_year'), String(year));
  setValue(doc.getElementById('guardian'), guardian);
  submitForm(doc.getElementById('new-learner'));
}

/** Fill in the on-screen question widget with a given answer. */
function fillAnswer(doc, pub, answer) {
  switch (pub.type) {
    case 'numeric':
    case 'expression':
      return setValue(doc.getElementById('answer'), String(answer));
    case 'multiple_choice':
      return click([...doc.querySelectorAll('input[name="choice"]')].find((i) => i.value === answer));
    case 'fraction':
      setValue(doc.getElementById('frac-n'), String(answer.n));
      return setValue(doc.getElementById('frac-d'), String(answer.d));
    case 'drag':
      answer.forEach((item, pos) => {
        for (;;) {
          const current = [...doc.querySelectorAll('#order li')].map((li) => li.dataset.item);
          const at = current.indexOf(item);
          if (at <= pos) break;
          click(doc.querySelectorAll('#order li')[at].querySelector('.up'));
        }
      });
      return undefined;
    default:
      throw new Error('unknown type');
  }
}
const correctFor = (pub) => {
  const p = buildProblem(pub.template_id, pub.seed);
  return p.type === 'fraction' ? { n: p.answer.n, d: p.answer.d } : p.answer;
};
const lastProblem = (ctx) => ctx.seen.problems.at(-1);

test('renderer: new-learner form shows the guardian field only for under-13s and enforces it', async () => {
  const ctx = boot();
  const { doc } = ctx;
  await waitFor(() => doc.querySelector('[data-screen="profiles"]'));
  const row = doc.getElementById('guardian-row');
  assert.equal(row.hidden, true);
  const thisYear = new Date().getFullYear();
  setValue(doc.getElementById('birth_year'), String(thisYear - 8));
  assert.equal(row.hidden, false);
  setValue(doc.getElementById('birth_year'), String(thisYear - 13));
  assert.equal(row.hidden, true);
  await createLearner(ctx, { name: 'Kit', year: thisYear - 8 });
  await waitFor(() => doc.querySelector('.error').textContent.includes('guardian'), 'guardian error');
  assert.equal(ctx.engine.listLearners().length, 0);
  await createLearner(ctx, { name: 'Kit', year: thisYear - 8, guardian: 'Pat' });
  await waitFor(() => doc.querySelector('[data-screen="home"]'), 'home');
  assert.match(doc.body.textContent, /Hello, Kit!/);
  assert.equal(doc.getElementById('who').textContent, 'Kit');
});

test('renderer: practise, get feedback with a misconception message, and carry on', async () => {
  const ctx = boot();
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('practice'), 'practice button'));
  await waitFor(() => doc.querySelector('[data-screen="question"]'));
  const first = lastProblem(ctx);
  assert.equal(first.skill_id, '2.num.order');
  assert.ok(doc.querySelector('.prompt').textContent.length > 5);

  // Hint button reveals hints one by one.
  click(doc.getElementById('hint'));
  assert.equal(doc.querySelectorAll('#hints .hint').length, 1);

  // Wrong (reversed) order → "Not quite" and the reversed-order misconception message.
  fillAnswer(doc, first, correctFor(first));
  const reversed = [...correctFor(first)].reverse();
  fillAnswer(doc, first, reversed);
  submitForm(doc.getElementById('question'));
  await waitFor(() => doc.getElementById('feedback'), 'feedback');
  assert.match(doc.getElementById('feedback').textContent, /Not quite/);
  assert.match(doc.getElementById('misconception').textContent, /opposite order/);
  assert.equal(ctx.engine.data.attempts[0].hints_used, 1);
  assert.equal(ctx.engine.data.attempts[0].detected_misconception, 'reversed-order');

  click(doc.getElementById('next'));
  await waitFor(() => doc.querySelector('[data-screen="question"]') && lastProblem(ctx) !== first, 'next question');
  const second = lastProblem(ctx);
  fillAnswer(doc, second, correctFor(second));
  submitForm(doc.getElementById('question'));
  await waitFor(() => doc.getElementById('feedback'));
  assert.match(doc.getElementById('feedback').textContent, /Correct!/);
});

test('renderer: a failed submit shows the message and lets the learner try again', async () => {
  let failOnce = true;
  const ctx = boot({ submitAnswer: () => { const f = failOnce; failOnce = false; return f; } });
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('practice')));
  await waitFor(() => doc.querySelector('[data-screen="question"]'));
  const pub = lastProblem(ctx);
  fillAnswer(doc, pub, correctFor(pub));
  submitForm(doc.getElementById('question'));
  await waitFor(() => /Simulated failure/.test(doc.querySelector('#question .error').textContent), 'error message');
  assert.equal(doc.getElementById('submit').disabled, false, 'can submit again');
  submitForm(doc.getElementById('question'));
  await waitFor(() => doc.getElementById('feedback'), 'feedback after retry');
  assert.match(doc.getElementById('feedback').textContent, /Correct!/);
  assert.equal(ctx.engine.data.attempts.length, 1);
});

test('renderer: multiple choice widget sends the chosen option', async () => {
  const sent = [];
  const mc = { template_id: 'x', skill_id: '2.num.order', difficulty: 1, type: 'multiple_choice', seed: 5, prompt: 'Pick two', choices: ['1', '2', '3'], items: null, hints: ['h'] };
  const ctx = boot({
    override: {
      nextProblem: async () => ({ reason: 'learn', skill: { id: '2.num.order', name: 'Test skill', track: 'T' }, problem: mc }),
      submitAnswer: async (args) => {
        sent.push(args);
        return { is_correct: args.response === '2', misconception: null, explanation: 'Because.', correct_answer: '2', mastery: {}, newly_mastered: false, unlocked_skills: [] };
      },
    },
  });
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('practice')));
  await waitFor(() => doc.querySelector('[data-screen="question"]'));
  assert.equal(doc.querySelectorAll('input[name="choice"]').length, 3);
  fillAnswer(doc, mc, '2');
  submitForm(doc.getElementById('question'));
  await waitFor(() => doc.getElementById('feedback'), 'feedback');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].response, '2');
  assert.equal(sent[0].template_id, 'x');
  assert.equal(sent[0].seed, 5);
  assert.match(doc.getElementById('feedback').textContent, /Correct!/);
});

test('renderer: placement runs to the end, every question type works, and "All done!" is shown', async () => {
  const ctx = boot();
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('placement'), 'placement button'));
  const types = new Set();
  let answered = 0;
  for (;;) {
    await waitFor(() => doc.querySelector('[data-screen="question"]') || doc.querySelector('[data-screen="placement-done"]'), 'next placement screen');
    if (doc.querySelector('[data-screen="placement-done"]')) break;
    const pub = lastProblem(ctx);
    types.add(pub.type);
    fillAnswer(doc, pub, correctFor(pub));
    submitForm(doc.getElementById('question'));
    answered++;
    click(await waitFor(() => doc.getElementById('continue'), 'continue button'));
    assert.ok(answered <= SKILLS.length, 'placement should not loop forever');
  }
  assert.equal(answered, SKILLS.length);
  assert.match(doc.querySelector('[data-screen="placement-done"]').textContent, /All done!/);
  assert.match(doc.querySelector('[data-screen="placement-done"]').textContent, new RegExp('already know ' + SKILLS.length));
  for (const t of ['drag', 'numeric', 'fraction', 'expression']) assert.ok(types.has(t), 'placement showed a ' + t + ' question; saw ' + [...types]);
  assert.equal(ctx.engine.getProgress({ learner_id: ctx.engine.listLearners()[0].id }).mastered, SKILLS.length);
});

test('renderer: placement cannot get stuck when fetching the next question fails', async () => {
  let failNext = false;
  let fails = 0;
  const ctx = boot({ nextPlacementProblem: () => { if (failNext) { failNext = false; fails++; return true; } return false; } });
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('placement')));
  await waitFor(() => doc.querySelector('[data-screen="question"]'));
  const pub = lastProblem(ctx);
  fillAnswer(doc, pub, correctFor(pub));
  submitForm(doc.getElementById('question'));
  const cont = await waitFor(() => doc.getElementById('continue'));
  failNext = true;
  click(cont);
  await waitFor(() => /Simulated failure/.test(doc.body.textContent), 'error shown');
  assert.equal(fails, 1);
  assert.equal(ctx.engine.data.attempts.length, 1, 'the answer was recorded once');
  const retry = [...doc.querySelectorAll('button')].find((b) => b.textContent === 'Try again');
  assert.ok(retry, 'a Try again button is offered');
  click(retry);
  await waitFor(() => doc.querySelector('[data-screen="question"]') && lastProblem(ctx) !== pub, 'next question after retry');
  assert.equal(ctx.engine.data.attempts.length, 1, 'retrying did not re-submit the old answer');
  assert.match(doc.querySelector('[data-screen="question"]').textContent, /question 2/);
});

test('renderer: progress screen lists every skill with real text and locks later skills', async () => {
  const ctx = boot();
  const { doc } = ctx;
  await createLearner(ctx);
  click(await waitFor(() => doc.getElementById('progress')));
  await waitFor(() => doc.querySelector('[data-screen="progress"]'));
  const text = doc.body.textContent;
  assert.ok(!text.includes('[object'), 'no [object ...] text');
  assert.equal(doc.querySelectorAll('.skill').length, SKILLS.length);
  for (const s of SKILLS) assert.ok(text.includes(s.name), s.name);
  assert.match(doc.querySelector('[data-skill="3.mult.facts"] .badge').textContent, /locked/);
  assert.equal(doc.querySelector('[data-skill="3.mult.facts"] button'), null, 'locked skills cannot be practised');
  assert.ok(doc.querySelector('[data-skill="2.num.order"] button'));
  assert.equal(doc.querySelector('[data-skill="2.num.order"] .bar > div').style.width, '10%');
});

test('renderer: switching learner shows existing profiles', async () => {
  const ctx = boot();
  const { doc } = ctx;
  await createLearner(ctx, { name: 'Ada' });
  await waitFor(() => doc.querySelector('[data-screen="home"]'));
  click([...doc.querySelectorAll('button')].find((b) => b.textContent === 'Switch learner'));
  await waitFor(() => doc.querySelector('[data-screen="profiles"]'));
  const names = [...doc.querySelectorAll('button.learner')].map((b) => b.textContent);
  assert.deepEqual(names, ['Ada']);
  assert.equal(doc.getElementById('who').textContent, '');
});
