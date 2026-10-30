'use strict';

const { API_METHODS } = require('../core/api');
const { UserError } = require('../core/errors');

const CHANNEL_PREFIX = 'mathpath:';

/** BrowserWindow options. Keep the renderer isolated: no Node, sandboxed, preload only. */
function windowOptions(preloadPath) {
  return {
    width: 1000,
    height: 760,
    minWidth: 640,
    minHeight: 520,
    title: 'MathPath',
    backgroundColor: '#f6f7fb',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  };
}

/**
 * Expose each API method on ipcMain. Results are wrapped as {ok, value} or
 * {ok:false, error, user} so the learner sees a friendly message and
 * internal errors never leak stack traces to the screen.
 */
function registerIpc(ipcMain, api, log = console.error) {
  for (const name of API_METHODS) {
    ipcMain.handle(CHANNEL_PREFIX + name, async (_event, args) => {
      try {
        return { ok: true, value: await api[name](args) };
      } catch (e) {
        if (e instanceof UserError) return { ok: false, error: e.message, user: true };
        log('MathPath internal error in ' + name + ':', e);
        return { ok: false, error: 'Something went wrong. Your progress is safe. Please try again.', user: false };
      }
    });
  }
}

/** Never let the window navigate away from the app or open new windows. */
function lockNavigation(webContents) {
  webContents.on('will-navigate', (event) => event.preventDefault());
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

module.exports = { CHANNEL_PREFIX, windowOptions, registerIpc, lockNavigation };
