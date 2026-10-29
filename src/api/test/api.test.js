const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub the database pool so the API can be exercised without PostgreSQL.
const calls = [];
let nextResults = [];
const fakeDb = {
  query: async (text, params) => {
    calls.push({ text, params });
    return nextResults.length ? nextResults.shift() : { rows: [] };
  },
};
const dbPath = require.resolve(path.join(__dirname, '..', 'db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const app = require('..');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  calls.length = 0;
  nextResults = [];
});

function request(method, url, body) {
  return fetch(baseUrl + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('GET /calendar/:year/:month queries the month range ordered by due date', async () => {
  const rows = [
    { id: 2, title: 'a', completed: false, due_date: '2025-02-03' },
    { id: 1, title: 'b', completed: true, due_date: '2025-02-28' },
  ];
  nextResults = [{ rows }];
  const res = await request('GET', '/calendar/2025/2');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), rows);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [2025, 2]);
  assert.match(calls[0].text, /due_date >= make_date\(\$1, \$2, 1\)/);
  assert.match(calls[0].text, /ORDER BY due_date ASC/);
});

test('GET /calendar/:year/:month rejects invalid year or month with 400', async () => {
  for (const url of ['/calendar/2025/13', '/calendar/2025/0', '/calendar/abcd/1', '/calendar/25/1', '/calendar/2025/1.5', '/calendar/0000/1']) {
    const res = await request('GET', url);
    assert.equal(res.status, 400, url);
  }
  assert.equal(calls.length, 0);
});

test('POST /tasks accepts an optional due_date', async () => {
  nextResults = [{ rows: [{ id: 1, title: 'x', completed: false, due_date: '2025-03-15' }] }];
  const res = await request('POST', '/tasks', { title: ' x ', due_date: '2025-03-15' });
  assert.equal(res.status, 201);
  assert.deepEqual(calls[0].params, ['x', '2025-03-15']);

  const res2 = await request('POST', '/tasks', { title: 'y' });
  assert.equal(res2.status, 201);
  assert.deepEqual(calls[1].params, ['y', null]);
});

test('POST /tasks rejects malformed or impossible due dates', async () => {
  for (const due_date of ['2025-02-30', '03/15/2025', 20250315, '2025-13-01']) {
    const res = await request('POST', '/tasks', { title: 'x', due_date });
    assert.equal(res.status, 400, String(due_date));
  }
  assert.equal(calls.length, 0);
});

test('PATCH /tasks/:id updates due_date and keeps it when omitted', async () => {
  const current = { id: 5, title: 't', completed: false, due_date: '2025-01-01' };

  nextResults = [{ rows: [current] }, { rows: [{ ...current, due_date: '2025-04-01' }] }];
  let res = await request('PATCH', '/tasks/5', { due_date: '2025-04-01' });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[1].params, [false, 't', '2025-04-01', 5]);

  // Toggling completion leaves the due date untouched
  nextResults = [{ rows: [current] }, { rows: [{ ...current, completed: true }] }];
  res = await request('PATCH', '/tasks/5', { completed: true });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[3].params, [true, 't', '2025-01-01', 5]);

  // null clears the due date
  nextResults = [{ rows: [current] }, { rows: [{ ...current, due_date: null }] }];
  res = await request('PATCH', '/tasks/5', { due_date: null });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[5].params, [false, 't', null, 5]);
});

test('PATCH /tasks/:id validates input and returns 404 for unknown tasks', async () => {
  let res = await request('PATCH', '/tasks/5', { due_date: 'tomorrow' });
  assert.equal(res.status, 400);

  res = await request('PATCH', '/tasks/abc', { completed: true });
  assert.equal(res.status, 404);

  nextResults = [{ rows: [] }];
  res = await request('PATCH', '/tasks/99', { completed: true });
  assert.equal(res.status, 404);
});
