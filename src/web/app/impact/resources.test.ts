import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIND_HELP_RESOURCES, GIVE_RESOURCES, OPEN_SOURCE_TOOLS, type Resource } from './resources.ts';

const groups: [string, Resource[]][] = [
  ['find help', FIND_HELP_RESOURCES],
  ['give', GIVE_RESOURCES],
  ['tools', OPEN_SOURCE_TOOLS],
];

test('every resource has a name, a plain-language purpose and an https URL', () => {
  for (const [group, items] of groups) {
    assert.ok(items.length > 0, `${group} must not be empty`);
    for (const item of items) {
      assert.ok(item.name.trim().length > 0, `${group}: empty name`);
      assert.ok(item.purpose.trim().length > 0, `${item.name}: empty purpose`);
      const url = new URL(item.url);
      assert.equal(url.protocol, 'https:', `${item.name}: URL must be https`);
    }
  }
});

test('resource URLs are unique across all groups', () => {
  const urls = groups.flatMap(([, items]) => items.map((item) => item.url));
  assert.equal(new Set(urls).size, urls.length);
});

test('giving links do not point at the planner itself', () => {
  for (const item of GIVE_RESOURCES) {
    assert.doesNotMatch(item.url, /localhost|\/impact/);
  }
});
