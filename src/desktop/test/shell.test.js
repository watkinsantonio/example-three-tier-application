'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { API_METHODS } = require('../core/api');
const { UserError } = require('../core/errors');
const { windowOptions, registerIpc, lockNavigation } = require('../electron/shell');

const root = path.join(__dirname, '..');

/** Load a file with a fake `electron` module, as the real one only exists inside Electron. */
function loadWithElectron(file, fakeElectron) {
  const original = Module._load;
  Module._load = function (request, ...rest) {
    return request === 'electron' ? fakeElectron : original.call(this, request, ...rest);
  };
  delete require.cache[require.resolve(file)];
  try {
    return require(file);
  } finally {
    Module._load = original;
  }
}

test('preload exposes exactly the methods in core/api.js, and unwraps IPC results', async () => {
  let exposed;
  const calls = [];
  const fake = {
    contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
    ipcRenderer: {
      invoke: async (channel, args) => {
        calls.push([channel, args]);
        return channel.endsWith('listSkills') ? { ok: true, value: [1] } : { ok: false, error: 'Nope' };
      },
    },
  };
  loadWithElectron(path.join(root, 'electron', 'preload.js'), fake);
  assert.equal(exposed.name, 'mathpath');
  assert.deepEqual(Object.keys(exposed.api).sort(), [...API_METHODS].sort());
  assert.ok(Object.isFrozen(exposed.api));
  assert.deepEqual(await exposed.api.listSkills({ a: 1 }), [1]);
  assert.deepEqual(calls[0], ['mathpath:listSkills', { a: 1 }]);
  await assert.rejects(() => exposed.api.getProgress({}), /Nope/);
});

test('window options keep the renderer isolated', () => {
  const o = windowOptions('/x/preload.js');
  assert.equal(o.webPreferences.contextIsolation, true);
  assert.equal(o.webPreferences.nodeIntegration, false);
  assert.equal(o.webPreferences.sandbox, true);
  assert.equal(o.webPreferences.preload, '/x/preload.js');
});

test('registerIpc: success, user errors, and internal errors that do not leak details', async () => {
  const handlers = {};
  const ipcMain = { handle: (ch, fn) => { handlers[ch] = fn; } };
  const logged = [];
  const api = Object.fromEntries(API_METHODS.map((n) => [n, async () => ({ n })]));
  api.createLearner = () => { throw new UserError('Please enter a name.'); };
  api.getProgress = () => { throw new Error('ENOENT /secret/path/file.json'); };
  registerIpc(ipcMain, api, (...a) => logged.push(a));
  assert.deepEqual(Object.keys(handlers).sort(), API_METHODS.map((n) => 'mathpath:' + n).sort());
  assert.deepEqual(await handlers['mathpath:listSkills']({}, 1), { ok: true, value: { n: 'listSkills' } });
  assert.deepEqual(await handlers['mathpath:createLearner']({}, {}), { ok: false, error: 'Please enter a name.', user: true });
  const internal = await handlers['mathpath:getProgress']({}, {});
  assert.equal(internal.ok, false);
  assert.equal(internal.user, false);
  assert.ok(!/secret|ENOENT/.test(internal.error));
  assert.equal(logged.length, 1);
});

test('lockNavigation blocks navigation and new windows', () => {
  const events = {};
  let opener;
  lockNavigation({ on: (e, fn) => { events[e] = fn; }, setWindowOpenHandler: (fn) => { opener = fn; } });
  let prevented = false;
  events['will-navigate']({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(opener({ url: 'https://example.com' }), { action: 'deny' });
});

function fakeElectronApp(userData) {
  const record = { windows: [], handlers: {}, exits: [], errors: [], loaded: [] };
  class BrowserWindow {
    constructor(opts) {
      record.windows.push(opts);
      this.webContents = { on() {}, once() {}, setWindowOpenHandler() {} };
    }
    removeMenu() {}
    loadFile(f) { record.loaded.push(f); }
    once() {}
    static getAllWindows() { return []; }
  }
  const electron = {
    app: { whenReady: () => Promise.resolve(), getPath: () => userData, on() {}, exit: (c) => record.exits.push(c), quit() {} },
    BrowserWindow,
    ipcMain: { handle: (ch, fn) => { record.handlers[ch] = fn; } },
    dialog: { showErrorBox: (t, m) => record.errors.push([t, m]) },
  };
  return { electron, record };
}

test('main.js: opens one secure window, wires IPC, and stores data under userData', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-main-'));
  const { electron, record } = fakeElectronApp(dir);
  loadWithElectron(path.join(root, 'electron', 'main.js'), electron);
  await new Promise((r) => setImmediate(r));
  assert.equal(record.windows.length, 1);
  assert.equal(record.windows[0].webPreferences.sandbox, true);
  assert.ok(record.loaded[0].endsWith(path.join('renderer', 'index.html')) && fs.existsSync(record.loaded[0]));
  assert.ok(fs.existsSync(path.join(root, 'electron', 'preload.js')));
  assert.deepEqual(Object.keys(record.handlers).sort(), API_METHODS.map((n) => 'mathpath:' + n).sort());
  // Real engine behind the IPC: create a learner, which persists to disk.
  const res = await record.handlers['mathpath:createLearner']({}, { display_name: 'Ada', birth_year: 1990 });
  assert.equal(res.ok, true);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'mathpath-data.json'), 'utf8'));
  assert.equal(Object.keys(saved.learners).length, 1);
  assert.deepEqual(record.exits, []);
});

test('main.js: data from a newer version shows an error and quits instead of overwriting', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-main-'));
  const file = path.join(dir, 'mathpath-data.json');
  const original = JSON.stringify({ version: 99, learners: {}, attempts: [], mastery: {} });
  fs.writeFileSync(file, original);
  const { electron, record } = fakeElectronApp(dir);
  loadWithElectron(path.join(root, 'electron', 'main.js'), electron);
  await new Promise((r) => setImmediate(r));
  assert.equal(record.windows.length, 0);
  assert.deepEqual(record.exits, [1]);
  assert.match(record.errors[0][1], /newer version/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('index.html: strict content security policy, no inline script, local assets only', () => {
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy[^>]*default-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'no inline scripts');
  assert.ok(!/https?:\/\//.test(html.replace(/<!doctype.*?>/i, '')), 'no remote assets');
  for (const f of ['app.js', 'styles.css']) assert.ok(fs.existsSync(path.join(root, 'renderer', f)));
});

test('package.json: declares the entry point, Node engine and packaging files', () => {
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  assert.equal(pkg.main, 'electron/main.js');
  assert.ok(fs.existsSync(path.join(root, pkg.main)));
  // Must allow the locked jsdom's minimum Node.
  assert.equal(pkg.engines.node, lock.packages['node_modules/jsdom'].engines.node);
  for (const dir of ['electron', 'renderer', 'core']) assert.ok(pkg.build.files.some((f) => f.startsWith(dir + '/')));
  // Electron and the packager are pinned dev dependencies, not fetched with npx at run time.
  for (const name of ['electron', 'electron-builder']) {
    assert.match(pkg.devDependencies[name], /^\d+\.\d+\.\d+$/, name + ' is pinned exactly');
    assert.equal(lock.packages['node_modules/' + name].version, pkg.devDependencies[name]);
  }
  for (const script of ['start', 'smoke', 'dist', 'pack']) assert.ok(!/npx/.test(pkg.scripts[script]), script);
});
