'use strict';

/** An error whose message is safe and useful to show to the learner. */
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

module.exports = { UserError };
