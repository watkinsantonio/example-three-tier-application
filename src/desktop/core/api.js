'use strict';

// The single list of operations the screen is allowed to call (over IPC).
const API_METHODS = [
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

function createApi(engine) {
  const api = {};
  for (const name of API_METHODS) api[name] = (args) => engine[name](args);
  return api;
}

module.exports = { API_METHODS, createApi };
