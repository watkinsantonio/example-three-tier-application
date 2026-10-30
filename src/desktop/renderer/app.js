(function () {
  'use strict';

  // ── tiny DOM helpers ───────────────────────────────────────────────────────
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (Array.isArray(c)) append(el, c);
      else if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  function start(api, root, whoEl) {
    const state = { learner: null };

    function show(...nodes) {
      root.replaceChildren();
      append(root, nodes);
    }
    function setWho() {
      if (whoEl) whoEl.textContent = state.learner ? state.learner.display_name : '';
    }
    const errorBox = () => h('p', { class: 'error', role: 'alert' });
    const msg = (e) => (e && e.message) || 'Something went wrong. Please try again.';

    /** Run an async loader; if it fails show the message with a Try again button. */
    async function load(fn, retry, back) {
      show(h('div', { class: 'card' }, 'Loading…'));
      try {
        return await fn();
      } catch (e) {
        show(h('div', { class: 'card' }, h('p', { class: 'error', role: 'alert' }, msg(e)), h('button', { onclick: retry }, 'Try again'), h('button', { class: 'secondary', onclick: back }, 'Back')));
        return undefined;
      }
    }

    // ── profiles ─────────────────────────────────────────────────────────────
    async function profilesScreen() {
      state.learner = null;
      setWho();
      const learners = await load(() => api.listLearners(), profilesScreen, profilesScreen);
      if (!learners) return;
      const yearNow = new Date().getUTCFullYear();
      const err = errorBox();

      const name = h('input', { type: 'text', id: 'name', maxlength: '40', autocomplete: 'off' });
      const year = h('input', { type: 'number', id: 'birth_year', min: '1900', max: String(yearNow) });
      const guardian = h('input', { type: 'text', id: 'guardian', maxlength: '60', autocomplete: 'off' });
      const guardianRow = h('div', { id: 'guardian-row', hidden: true }, h('label', { for: 'guardian' }, 'Parent or guardian name (required if you are 13 or younger)'), guardian);
      year.addEventListener('input', () => {
        const y = Number(year.value);
        // Same rule as core/engine.js: only the birth year is known, so someone born 13 years ago may still be 12.
        guardianRow.hidden = !(Number.isInteger(y) && y > 1900 && yearNow - y <= 13);
      });
      const form = h('form', { id: 'new-learner' }, h('label', { for: 'name' }, 'Name'), name, h('label', { for: 'birth_year' }, 'Year of birth'), year, guardianRow, err, h('button', { type: 'submit' }, 'Create profile'));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        err.textContent = '';
        try {
          state.learner = await api.createLearner({ display_name: name.value, birth_year: year.value, guardian_name: guardian.value });
          homeScreen();
        } catch (e) {
          err.textContent = msg(e);
        }
      });

      show(
        h('div', { class: 'card', 'data-screen': 'profiles' }, h('h1', null, 'Who is learning?'), learners.length ? learners.map((l) => h('button', { class: 'learner', onclick: () => { state.learner = l; homeScreen(); } }, l.display_name)) : h('p', { class: 'muted' }, 'No profiles yet. Create one to begin.')),
        h('div', { class: 'card' }, h('h2', null, 'New learner'), form)
      );
    }

    // ── home ─────────────────────────────────────────────────────────────────
    async function homeScreen() {
      setWho();
      const progress = await load(() => api.getProgress({ learner_id: state.learner.id }), homeScreen, profilesScreen);
      if (!progress) return;
      const due = progress.skills.filter((s) => s.review_due).length;
      show(
        h(
          'div',
          { class: 'card', 'data-screen': 'home' },
          h('h1', null, 'Hello, ' + state.learner.display_name + '!'),
          h('p', null, progress.mastered + ' of ' + progress.total + ' skills mastered. ' + progress.correct + ' of ' + progress.attempts + ' answers correct.'),
          due ? h('p', { class: 'muted' }, due + ' skill(s) are ready for a quick review.') : null,
          h('button', { id: 'practice', onclick: () => practiceScreen() }, 'Practise'),
          progress.attempts === 0 ? h('button', { id: 'placement', class: 'secondary', onclick: placementScreen }, 'Find my starting point') : h('button', { id: 'placement', class: 'secondary', onclick: placementScreen }, 'Take the placement check'),
          h('button', { id: 'progress', class: 'secondary', onclick: progressScreen }, 'My progress'),
          h('button', { class: 'secondary', onclick: profilesScreen }, 'Switch learner'),
          deleteControl()
        )
      );
    }

    /** Two-step delete (no browser confirm() in a desktop window): button, then "Really delete?". */
    function deleteControl() {
      const box = h('div', { class: 'danger', id: 'delete-box' });
      const err = errorBox();
      const ask = () => {
        box.replaceChildren(
          h('p', null, 'Delete ' + state.learner.display_name + "'s profile and all of their progress? This cannot be undone."),
          h('button', { id: 'delete-yes', class: 'danger-button', onclick: confirmDelete }, 'Yes, delete'),
          h('button', { id: 'delete-no', class: 'secondary', onclick: reset }, 'Cancel'),
          err
        );
      };
      const reset = () => box.replaceChildren(h('button', { id: 'delete', class: 'secondary', onclick: ask }, 'Delete this profile'));
      const confirmDelete = async () => {
        err.textContent = '';
        try {
          await api.deleteLearner({ learner_id: state.learner.id });
          profilesScreen();
        } catch (e) {
          err.textContent = msg(e);
        }
      };
      reset();
      return box;
    }

    // ── progress ─────────────────────────────────────────────────────────────
    async function progressScreen() {
      const progress = await load(() => api.getProgress({ learner_id: state.learner.id }), progressScreen, homeScreen);
      if (!progress) return;
      const tracks = [...new Set(progress.skills.map((s) => s.track))];
      const cards = tracks.map((track) =>
        h(
          'div',
          { class: 'card' },
          h('h2', null, track),
          progress.skills
            .filter((s) => s.track === track)
            .map((s) => {
              const fill = h('div');
              fill.style.width = Math.round(s.p_mastery * 100) + '%';
              return h(
                'div',
                { class: 'skill', 'data-skill': s.skill_id },
                h('div', { class: 'info' }, h('strong', null, s.name), h('div', { class: 'muted' }, 'Grade ' + s.grade_band + ' · ' + s.description), h('div', { class: 'bar' }, fill)),
                h('span', { class: 'badge ' + (s.review_due ? 'review' : s.status) }, s.review_due ? 'review due' : s.status),
                s.status === 'locked' ? null : h('button', { class: 'secondary', onclick: () => practiceScreen(s.skill_id) }, 'Practise')
              );
            })
        )
      );
      show(h('div', { class: 'card', 'data-screen': 'progress' }, h('h1', null, 'My progress'), h('button', { class: 'secondary', onclick: homeScreen }, 'Back')), cards);
    }

    // ── question widgets ─────────────────────────────────────────────────────
    /** @returns {{node: HTMLElement, getResponse: () => any, setDisabled: (b: boolean) => void}} */
    function widgetFor(problem) {
      switch (problem.type) {
        case 'multiple_choice': {
          const inputs = problem.choices.map((c, i) => h('input', { type: 'radio', name: 'choice', id: 'choice' + i, value: c }));
          const node = h('div', { class: 'choices', role: 'radiogroup' }, problem.choices.map((c, i) => h('label', { for: 'choice' + i }, inputs[i], ' ' + c)));
          return {
            node,
            getResponse: () => (inputs.find((i) => i.checked) || {}).value,
            setDisabled: (d) => inputs.forEach((i) => (i.disabled = d)),
          };
        }
        case 'fraction': {
          const n = h('input', { type: 'number', id: 'frac-n', 'aria-label': 'top number (numerator)', step: '1' });
          const d = h('input', { type: 'number', id: 'frac-d', 'aria-label': 'bottom number (denominator)', step: '1' });
          return { node: h('div', { class: 'fraction' }, n, h('hr'), d), getResponse: () => ({ n: n.value, d: d.value }), setDisabled: (b) => { n.disabled = b; d.disabled = b; } };
        }
        case 'drag': {
          let items = problem.items.slice();
          const list = h('ol', { class: 'order', id: 'order' });
          let disabled = false;
          const draw = () => {
            list.replaceChildren();
            items.forEach((item, i) => {
              const move = (by) => {
                const j = i + by;
                [items[i], items[j]] = [items[j], items[i]];
                draw();
              };
              list.append(
                h(
                  'li',
                  { 'data-item': item },
                  h('span', null, item),
                  h('button', { type: 'button', class: 'secondary up', 'aria-label': 'Move ' + item + ' up', disabled: disabled || i === 0, onclick: () => move(-1) }, '↑'),
                  h('button', { type: 'button', class: 'secondary down', 'aria-label': 'Move ' + item + ' down', disabled: disabled || i === items.length - 1, onclick: () => move(1) }, '↓')
                )
              );
            });
          };
          draw();
          return { node: list, getResponse: () => items.slice(), setDisabled: (b) => { disabled = b; draw(); } };
        }
        default: {
          const input = h('input', { type: 'text', id: 'answer', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'your answer' });
          return { node: input, getResponse: () => input.value, setDisabled: (b) => { input.disabled = b; } };
        }
      }
    }

    /**
     * Draws one question. `onSubmit(response, meta)` must return a promise; when it
     * resolves the caller is told via `onAnswered(result)`. If it rejects, the
     * message is shown and the learner can fix their answer and submit again.
     */
    function questionCard({ heading, problem, onSubmit, onAnswered }) {
      const widget = widgetFor(problem);
      const err = errorBox();
      const hintBox = h('div', { id: 'hints' });
      let hintsUsed = 0;
      const startedAt = Date.now();
      const hintBtn = h('button', { type: 'button', class: 'secondary', id: 'hint' }, 'Show a hint');
      hintBtn.addEventListener('click', () => {
        hintBox.append(h('div', { class: 'hint' }, problem.hints[hintsUsed]));
        hintsUsed++;
        if (hintsUsed >= problem.hints.length) hintBtn.disabled = true;
      });
      const submit = h('button', { type: 'submit', id: 'submit' }, 'Check');
      const form = h('form', { id: 'question' }, widget.node, err, hintBox, submit, hintBtn);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        widget.setDisabled(true);
        try {
          const result = await onSubmit(widget.getResponse(), { time_ms: Date.now() - startedAt, hints_used: hintsUsed });
          hintBtn.disabled = true;
          onAnswered(result);
        } catch (e) {
          err.textContent = msg(e);
          submit.disabled = false;
          widget.setDisabled(false);
        }
      });
      return h('div', { class: 'card', 'data-screen': 'question' }, heading, h('div', { class: 'prompt' }, problem.prompt), form);
    }

    // ── practice ─────────────────────────────────────────────────────────────
    async function practiceScreen(skillId) {
      const next = await load(() => api.nextProblem({ learner_id: state.learner.id, skill_id: skillId }), () => practiceScreen(skillId), homeScreen);
      if (!next) return;
      const { problem } = next;
      const why = next.reason === 'review' ? ' · review' : '';
      const card = questionCard({
        heading: h('div', { class: 'muted' }, next.skill.name + why),
        problem,
        onSubmit: (response, meta) => api.submitAnswer({ learner_id: state.learner.id, template_id: problem.template_id, seed: problem.seed, response, ...meta }),
        onAnswered: (result) => {
          show(card, feedbackCard(result, skillId));
          card.querySelector('#submit').disabled = true;
        },
      });
      show(card);
    }

    function feedbackCard(r, skillId) {
      return h(
        'div',
        { class: 'card feedback ' + (r.is_correct ? 'good' : 'bad'), id: 'feedback', 'data-screen': 'feedback' },
        h('h2', null, r.is_correct ? 'Correct!' : 'Not quite'),
        r.is_correct ? null : h('p', null, 'The answer is ' + r.correct_answer + '.'),
        r.misconception ? h('p', { id: 'misconception' }, r.misconception.message) : null,
        h('p', null, r.explanation),
        r.newly_mastered ? h('p', null, 'You mastered this skill!' + (r.unlocked_skills.length ? ' Unlocked: ' + r.unlocked_skills.join(', ') + '.' : '')) : null,
        h('button', { id: 'next', onclick: () => practiceScreen(skillId) }, 'Next question'),
        h('button', { class: 'secondary', onclick: homeScreen }, 'Done for now')
      );
    }

    // ── placement ────────────────────────────────────────────────────────────
    async function placementScreen() {
      const started = await load(() => api.startPlacement({ learner_id: state.learner.id }), placementScreen, homeScreen);
      if (started) placementStep(started.placement_id);
    }

    /** Fetch (or re-fetch) the pending placement question. Safe to repeat. */
    async function placementStep(placementId) {
      const res = await load(() => api.nextPlacementProblem({ placement_id: placementId }), () => placementStep(placementId), homeScreen);
      if (!res) return;
      if (res.finished) return placementDone(res);
      const card = questionCard({
        heading: h('div', { class: 'muted' }, 'Placement check · question ' + res.number),
        problem: res.problem,
        onSubmit: (response, meta) => api.submitPlacementAnswer({ placement_id: placementId, response, ...meta }),
        onAnswered: () => {
          // The answer is saved. Continuing only re-fetches the next question, so a failure here can be retried.
          show(card, h('div', { class: 'card', 'data-screen': 'placement-saved' }, h('p', null, 'Answer saved.'), h('button', { id: 'continue', onclick: () => placementStep(placementId) }, 'Continue')));
          card.querySelector('#submit').disabled = true;
        },
      });
      show(card);
    }

    function placementDone(res) {
      show(
        h(
          'div',
          { class: 'card', 'data-screen': 'placement-done' },
          h('h1', null, 'All done!'),
          h('p', null, res.skills_known ? 'You already know ' + res.skills_known + ' skill(s). We will start you at the next one.' : 'We will start you at the very beginning.'),
          h('button', { id: 'go', onclick: () => practiceScreen() }, 'Start practising'),
          h('button', { class: 'secondary', onclick: homeScreen }, 'Home')
        )
      );
    }

    profilesScreen();
    return { profilesScreen, homeScreen };
  }

  window.MathPathApp = { start };
  document.addEventListener('DOMContentLoaded', () => {
    if (window.mathpath) start(window.mathpath, document.getElementById('app'), document.getElementById('who'));
  });
})();
