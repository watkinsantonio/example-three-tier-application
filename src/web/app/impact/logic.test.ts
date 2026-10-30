import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, coverage, formatKg, leftoverKg, parseKg, parseRegions, unmetKg } from './logic.ts';

test('parseKg accepts non-negative numbers, including form strings', () => {
  assert.deepEqual(parseKg('250'), { value: 250 });
  assert.deepEqual(parseKg('0'), { value: 0 });
  assert.deepEqual(parseKg(12.5), { value: 12.5 });
  assert.ok('error' in parseKg('-1'));
  assert.ok('error' in parseKg('abc'));
  assert.ok('error' in parseKg(''));
  assert.ok('error' in parseKg(Infinity));
});

test('parseKg accepts only plain decimal digits from forms', () => {
  assert.ok('error' in parseKg('0x10'));
  assert.ok('error' in parseKg('1e3'));
  assert.ok('error' in parseKg('+5'));
  assert.ok('error' in parseKg(' 1 2 '));
  assert.deepEqual(parseKg(' 7.5 '), { value: 7.5 });
});

test('parseRegions rejects oversized text before splitting it', () => {
  const huge = 'a, 1\n'.repeat(2000);
  assert.ok(huge.length > 5000);
  const result = parseRegions(huge);
  assert.ok('error' in result);
  assert.match(result.error, /too long/);
});


test('parseRegions reads "Name, kg" lines and ignores blank lines', () => {
  assert.deepEqual(parseRegions('North, 100\n\n  South ,  50.5 \r\n'), {
    regions: [
      { name: 'North', needKg: 100 },
      { name: 'South', needKg: 50.5 },
    ],
  });
});

test('parseRegions uses the last comma so names may contain commas', () => {
  assert.deepEqual(parseRegions('Valley, upper, 30'), {
    regions: [{ name: 'Valley, upper', needKg: 30 }],
  });
});

test('parseRegions rejects duplicate region names, ignoring case', () => {
  const dup = parseRegions('North, 10\nnorth, 20');
  assert.ok('error' in dup);
  assert.match(dup.error, /^Line 2:/);
});

test('parseRegions rejects malformed input with a line number', () => {
  assert.ok('error' in parseRegions(''));
  assert.ok('error' in parseRegions('no comma here'));
  assert.ok('error' in parseRegions(', 40'));
  assert.ok('error' in parseRegions('North, -5'));
  const bad = parseRegions('North, 10\nSouth, nope');
  assert.ok('error' in bad);
  assert.match(bad.error, /^Line 2:/);
});

test('allocate covers everyone when supply exceeds total need', () => {
  const result = allocate(1000, [
    { name: 'A', needKg: 100 },
    { name: 'B', needKg: 300 },
  ]);
  assert.deepEqual(
    result.map((r) => [r.name, r.allocatedKg, r.coveragePercent]),
    [
      ['A', 100, 100],
      ['B', 300, 100],
    ],
  );
});

test('allocate splits scarce supply equally, capped at each need', () => {
  // Equal share is 100 each. A needs only 40, so the 60 it leaves goes to B and C.
  const result = allocate(300, [
    { name: 'A', needKg: 40 },
    { name: 'B', needKg: 500 },
    { name: 'C', needKg: 500 },
  ]);
  assert.deepEqual(
    result.map((r) => r.allocatedKg),
    [40, 130, 130],
  );
});

test('allocate never exceeds supply or total need, and keeps input order', () => {
  const regions = [
    { name: 'Big', needKg: 900 },
    { name: 'Small', needKg: 10 },
    { name: 'Mid', needKg: 200 },
  ];
  const result = allocate(500, regions);
  const total = result.reduce((sum, r) => sum + r.allocatedKg, 0);
  assert.ok(Math.abs(total - 500) < 1e-9);
  assert.deepEqual(result.map((r) => r.name), ['Big', 'Small', 'Mid']);
  // Small is fully covered, Mid is fully covered from the remaining 490, Big gets the rest.
  assert.deepEqual(result.map((r) => r.allocatedKg), [290, 10, 200]);
});

test('allocate with zero supply gives nothing and zero-need regions count as covered', () => {
  const result = allocate(0, [
    { name: 'A', needKg: 50 },
    { name: 'Nobody', needKg: 0 },
  ]);
  assert.deepEqual(result.map((r) => [r.allocatedKg, r.coveragePercent]), [
    [0, 0],
    [0, 100],
  ]);
});

test('exact supply matching need reports 100% coverage despite float error', () => {
  // 0.3 - 0.1 leaves 0.19999999999999998, which must still fully cover the 0.2 need.
  const result = allocate(0.3, [
    { name: 'A', needKg: 0.1 },
    { name: 'B', needKg: 0.2 },
  ]);
  assert.deepEqual(result.map((r) => r.coveragePercent), [100, 100]);
  assert.equal(leftoverKg(0.3, result), 0);
});

test('leftoverKg and unmetKg report surplus and shortfall', () => {
  const surplus = allocate(1000, [{ name: 'A', needKg: 100 }]);
  assert.equal(leftoverKg(1000, surplus), 900);
  assert.equal(unmetKg(surplus), 0);
  const short = allocate(50, [{ name: 'A', needKg: 100 }]);
  assert.equal(leftoverKg(50, short), 0);
  assert.equal(unmetKg(short), 50);
});

test('coverage rounds down and caps at 100', () => {
  assert.equal(coverage(1, 3), 33);
  assert.equal(coverage(5, 4), 100);
  assert.equal(coverage(0, 0), 100);
});

test('formatKg groups thousands and keeps one decimal', () => {
  assert.equal(formatKg(1200), '1,200 kg');
  assert.equal(formatKg(12.25), '12.3 kg');
});
