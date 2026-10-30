import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_SOURCE_TOOLS, type Resource } from './resources.ts';

const groups: [string, Resource[]][] = [['tools', OPEN_SOURCE_TOOLS]];

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

test('only GitHub links are listed, since those are the ones checked from the sandbox', () => {
  for (const item of OPEN_SOURCE_TOOLS) {
    assert.equal(new URL(item.url).hostname, 'github.com', `${item.name} must be a GitHub link`);
  }
});
