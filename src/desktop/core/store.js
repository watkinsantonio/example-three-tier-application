'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = 1;

function emptyData() {
  return { version: VERSION, learners: {}, guardians: {}, attempts: [], mastery: {}, placements: {} };
}

/**
 * A tiny JSON-file database. Writes are atomic (temp file then rename) so a
 * crash or power cut cannot leave half a file. With no path it is in-memory.
 */
class Store {
  constructor(filePath) {
    this.filePath = filePath || null;
    this.data = emptyData();
    if (this.filePath) this._load();
  }

  _load() {
    let text;
    try {
      text = fs.readFileSync(this.filePath, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    // Check the version first: a newer file may have a different shape and must be refused, not moved aside.
    if (parsed && typeof parsed === 'object' && Number.isInteger(parsed.version) && parsed.version > VERSION) {
      throw new Error('This data was saved by a newer version of MathPath (data version ' + parsed.version + '). Please update the app.');
    }
    const valid = parsed && typeof parsed === 'object' && Number.isInteger(parsed.version) && parsed.learners && parsed.attempts && parsed.mastery;
    if (!valid) {
      // Keep the unreadable file for recovery instead of overwriting it.
      this.recoveredFrom = this.filePath + '.corrupt-' + Date.now();
      fs.renameSync(this.filePath, this.recoveredFrom);
      return;
    }
    this.data = { ...emptyData(), ...parsed };
  }

  save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }
}

module.exports = { Store, VERSION };
