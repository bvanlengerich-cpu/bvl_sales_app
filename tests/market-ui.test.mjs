import test from 'node:test';
import assert from 'node:assert/strict';
import { isInternalMarketLink, potentialFor, renderMarketPage } from '../public/market.js';

test('only the own market route is opened inside the PWA', () => {
  assert.equal(isInternalMarketLink('https://sales.bvlki.cloud/#/market/deutschland', 'https://sales.bvlki.cloud/#/home'), true);
  assert.equal(isInternalMarketLink('http://localhost:3000/#/market/deutschland', 'http://localhost:3000/#/home'), true);
  assert.equal(isInternalMarketLink('https://bvl-group.canto.de/b/VL0QR', 'https://sales.bvlki.cloud/#/home'), false);
  assert.equal(isInternalMarketLink('https://other.example/#/market/deutschland', 'https://sales.bvlki.cloud/#/home'), false);
  assert.equal(isInternalMarketLink('https://sales.bvlki.cloud/other/#/market/deutschland', 'https://sales.bvlki.cloud/#/home'), false);
});

test('the market formula uses the original 20/10/20 assumptions', () => {
  assert.equal(potentialFor({ farms: 100, share50: .5 }), 3.2);
  assert.equal(potentialFor({ farms: 100, share50: .5 }, { alt: 0, years: 10, used: 0 }), 5);
  assert.equal(potentialFor({ farms: null, share50: .5 }), 0);
});

test('dealer view contains no market data', () => {
  const page = renderMarketPage('de', false);
  assert.match(page, /nur für BvL-Mitarbeitende und Admins/);
  assert.doesNotMatch(page, /data-market-map/);
});
