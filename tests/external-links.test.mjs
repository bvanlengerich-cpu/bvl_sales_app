import test from 'node:test';
import assert from 'node:assert/strict';
import { safariUrlForCanto, externalLinkDestination } from '../public/external-links.js';

test('Canto share links keep their path, query and fragment when handed to Safari', () => {
  assert.equal(safariUrlForCanto('https://bvl-group.canto.de/b/VL0QR'), 'x-safari-https://bvl-group.canto.de/b/VL0QR');
  assert.equal(safariUrlForCanto('https://bvl-group.canto.de/b/SO57P?view=1#file'), 'x-safari-https://bvl-group.canto.de/b/SO57P?view=1#file');
});

test('only HTTPS links to the BvL Canto tenant use the Safari handoff', () => {
  for (const url of [
    'https://other.example/b/VL0QR',
    'https://bvl-group.canto.de.evil.example/b/VL0QR',
    'http://bvl-group.canto.de/b/VL0QR',
    'javascript:alert(1)',
    'not a URL'
  ]) assert.equal(safariUrlForCanto(url), null);
});

test('iPhone standalone opens Canto in Safari while other links keep their original behavior', () => {
  const canto = 'https://bvl-group.canto.de/b/NCQUD';
  assert.deepEqual(externalLinkDestination(canto, true), { href: 'x-safari-https://bvl-group.canto.de/b/NCQUD', newTab: false });
  assert.deepEqual(externalLinkDestination(canto, false), { href: canto, newTab: true });
  assert.deepEqual(externalLinkDestination('https://example.com/', true), { href: 'https://example.com/', newTab: true });
});
