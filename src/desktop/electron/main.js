'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { Store } = require('../core/store');
const { Engine } = require('../core/engine');
const { createApi } = require('../core/api');
const { windowOptions, registerIpc, lockNavigation } = require('./shell');

const SMOKE = process.argv.includes('--smoke');

function dataFile() {
  const dir = SMOKE ? fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-smoke-')) : process.env.MATHPATH_DATA_DIR || app.getPath('userData');
  return path.join(dir, 'mathpath-data.json');
}

async function smokeCheck(win) {
  // Runs in the real renderer: the bridge exists and the first screen is drawn.
  const result = await win.webContents.executeJavaScript(`(async () => {
    if (typeof window.mathpath?.listSkills !== 'function') return 'missing bridge';
    if (typeof require !== 'undefined') return 'node leaked into renderer';
    const skills = await window.mathpath.listSkills();
    if (!skills.length) return 'no skills';
    if (!document.querySelector('[data-screen="profiles"]')) return 'profiles screen not drawn';
    return 'ok';
  })()`);
  if (result !== 'ok') throw new Error('smoke check failed: ' + result);
}

function createWindow() {
  const win = new BrowserWindow(windowOptions(path.join(__dirname, 'preload.js')));
  lockNavigation(win.webContents);
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  if (SMOKE) {
    win.webContents.once('did-finish-load', () => {
      smokeCheck(win).then(
        () => {
          console.log('MathPath smoke test passed');
          app.exit(0);
        },
        (e) => {
          console.error(e.message);
          app.exit(1);
        }
      );
    });
  }
  return win;
}

app.whenReady().then(() => {
  let store;
  try {
    store = new Store(dataFile());
  } catch (e) {
    dialog.showErrorBox('MathPath cannot open your data', e.message);
    app.exit(1);
    return;
  }
  if (store.recoveredFrom) console.warn('Unreadable data file was kept at ' + store.recoveredFrom);
  registerIpc(ipcMain, createApi(new Engine({ store })));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
