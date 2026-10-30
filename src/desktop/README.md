# MathPath (desktop)

An offline desktop app that helps people learn maths one skill at a time. It is an
[Electron](https://www.electronjs.org/) app, not a web app: there is no server and no
network access. Everything runs and is stored on the user's own computer.

It is separate from the three-tier web demo elsewhere in this repository.

## What it does

- **14 skills** in three tracks (Number & Operations, Fractions, Algebra) with a
  prerequisite graph. A skill is locked until its prerequisites are mastered.
- **33 problem templates** across five types: numeric, multiple choice, drag (put in
  order), fraction and expression. Each template generates a problem from a seed, so a
  problem can always be rebuilt from `(template_id, seed)`.
- **Hints, explanations and misconception checks.** Wrong answers are matched against
  known patterns (for example "added the denominators") and the learner gets a targeted
  message.
- **Mastery tracking** per learner and skill (`p_mastery`, streak, next review date,
  `locked | learning | mastered`), updated after every attempt, with spaced review.
- **Placement check** that walks the skill graph and stops at the first gap.
- **Learner profiles.** Learners under 13 need a parent or guardian name.

The data model follows the starting design (Skill, SkillPrereq, ProblemTemplate, Learner,
Attempt, SkillMastery, PlacementSession; a Guardian record is added for under-13s).

## Layout

| Path | What |
| --- | --- |
| `core/` | Pure Node.js logic: skills, templates, grading, mastery, engine, JSON store. No Electron imports. |
| `electron/` | `main.js` (window and IPC), `preload.js` (the only bridge to the page), `shell.js` (testable helpers). |
| `renderer/` | The UI: plain HTML, CSS and one script. Strict content security policy, no remote assets. |
| `test/` | Node's built-in test runner plus jsdom for the UI. |

The page never sees answers before it submits: it gets a "public" problem (prompt,
choices, hints) and sends back a response; grading happens in the main process.

## Run it

Needs Node 22.14 or newer.

```bash
cd src/desktop
npm ci
npm test            # unit, engine, shell and UI tests (no Electron needed)
npm start           # open the app (downloads Electron the first time)
npm run smoke       # launch Electron headlessly, load the UI and exit 0/1
```

## Package an installer

```bash
npm run dist        # installer for the current OS in dist/ (NSIS, dmg or AppImage)
npm run pack        # unpacked app folder only, faster
```

Build on the OS you are targeting. `npm start`, `npm run smoke`, `npm run dist` and
`npm run pack` fetch Electron / electron-builder from npm, so they need network access
once. They were not run in the development sandbox, which has no display, so run
`npm run smoke` and `npm run dist` on a real machine before relying on the packaging
settings in `package.json` (an app icon and author/homepage are not set yet).

## Where data lives

One JSON file, `mathpath-data.json`, in Electron's per-user data folder
(`MATHPATH_DATA_DIR` overrides it). Writes are atomic. An unreadable file is moved
aside, not deleted; a file written by a newer version stops the app rather than being
overwritten.
