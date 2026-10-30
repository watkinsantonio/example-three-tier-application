'use strict';

// Sandboxed preload: it can only require 'electron', so the method list is
// repeated here. test/shell.test.js checks it matches core/api.js.
const { contextBridge, ipcRenderer } = require('electron');

const METHODS = [
  'listSkills',
  'listLearners',
  'createLearner',
  'deleteLearner',
  'getProgress',
  'nextProblem',
  'submitAnswer',
  'startPlacement',
  'nextPlacementProblem',
  'submitPlacementAnswer',
];

const bridge = {};
for (const name of METHODS) {
  bridge[name] = async (args) => {
    const res = await ipcRenderer.invoke('mathpath:' + name, args);
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Something went wrong.');
    return res.value;
  };
}

contextBridge.exposeInMainWorld('mathpath', Object.freeze(bridge));
