const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.js')).sort();

// Records the calls a migration makes so the schema it builds can be checked without Postgres.
function recordingPgm() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    func: (text) => ({ __func: text }),
    createTable: record('createTable'),
    createIndex: record('createIndex'),
    dropTable: record('dropTable'),
    dropIndex: record('dropIndex'),
    addColumn: record('addColumn'),
    dropColumn: record('dropColumn'),
    sql: record('sql'),
  };
}

test('every migration exports up and down functions', () => {
  assert.ok(migrationFiles.length > 0);
  for (const file of migrationFiles) {
    const migration = require(path.join(migrationsDir, file));
    assert.equal(typeof migration.up, 'function', `${file} up`);
    assert.equal(typeof migration.down, 'function', `${file} down`);
  }
});

test('migration file names are timestamp-prefixed and ordered', () => {
  const timestamps = migrationFiles.map((f) => Number(f.split('_')[0]));
  for (const ts of timestamps) assert.ok(Number.isInteger(ts), 'timestamp prefix');
  assert.deepEqual([...timestamps].sort((a, b) => a - b), timestamps);
  assert.equal(new Set(timestamps).size, timestamps.length, 'unique timestamps');
});

test('create-drinks up builds drinks and drink_ratings with the expected constraints', () => {
  const migration = require(path.join(migrationsDir, '1718500003000_create-drinks.js'));
  const pgm = recordingPgm();
  migration.up(pgm);

  const tables = pgm.calls.filter(([name]) => name === 'createTable').map(([, table]) => table);
  assert.deepEqual(tables, ['drinks', 'drink_ratings']);

  const ratings = pgm.calls.find(([name, table]) => name === 'createTable' && table === 'drink_ratings')[2];
  assert.equal(ratings.score.check, 'score BETWEEN 1 AND 5');
  assert.equal(ratings.drink_id.references, 'drinks');
  assert.equal(ratings.drink_id.onDelete, 'CASCADE');

  assert.ok(
    pgm.calls.some(
      ([name, sql]) => name === 'sql' && /CREATE UNIQUE INDEX drinks_name_lower_key ON drinks \(lower\(name\)\)/.test(sql)
    ),
    'case-insensitive unique index'
  );
  assert.ok(pgm.calls.some(([name, table, col]) => name === 'createIndex' && table === 'drink_ratings' && col === 'drink_id'));
});

test('create-drinks down drops both tables', () => {
  const migration = require(path.join(migrationsDir, '1718500003000_create-drinks.js'));
  const pgm = recordingPgm();
  migration.down(pgm);
  assert.deepEqual(
    pgm.calls.map(([name, table]) => [name, table]),
    [
      ['dropTable', 'drink_ratings'],
      ['dropTable', 'drinks'],
    ]
  );
});
