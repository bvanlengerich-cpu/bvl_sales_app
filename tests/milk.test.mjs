import test from 'node:test';
import assert from 'node:assert/strict';
import { createMilkFeed, MILK_REFRESH_MS, nextMilkRefreshDelay } from '../server/milk.mjs';
import { openDatabase } from '../server/db.mjs';

test('converts the latest valid German monthly raw-milk price to cents per kilogram', async () => {
  const year = new Date().getUTCFullYear();
  const calls = [];
  const feed = createMilkFeed({}, async url => {
    calls.push(url);
    const selected = Number(new URL(url).searchParams.get('years'));
    return { ok: true, json: async () => selected === year ? [
      { memberStateCode: 'DE', product: 'Raw Milk', unit: '100KG', price: '€40.14', year: year - 1, month: 8, endDate: `31/08/${year - 1}` },
      { memberStateCode: 'FR', product: 'Raw Milk', unit: '100KG', price: '€99.99', year, month: 1, endDate: `31/01/${year}` },
      { memberStateCode: 'DE', product: 'Raw Milk', unit: '100KG', price: '€50.00', year, month: 2, endDate: `31/02/${year}` }
    ] : [] };
  });
  assert.equal(feed.current().status, 'unavailable');
  await feed.refresh();
  assert.equal(feed.current().status, 'fresh');
  assert.equal(feed.current().value, 40.14);
  assert.equal(feed.current().unit, 'ct/kg');
  assert.equal(feed.current().period, `${year - 1}-08`);
  assert.ok(Number.isFinite(Date.parse(feed.current().fetchedAt)));
  assert.equal(MILK_REFRESH_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(nextMilkRefreshDelay(null), 0);
  assert.equal(nextMilkRefreshDelay(new Date(1_000).toISOString(), 1_000 + 2 * 24 * 60 * 60 * 1000), 5 * 24 * 60 * 60 * 1000);
  assert.equal(nextMilkRefreshDelay(new Date(1_000).toISOString(), 1_000 + 8 * 24 * 60 * 60 * 1000), 0);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes('memberStateCodes=DE')));
});

test('labels the last successful value as stale when the EU source fails', async () => {
  let succeed = true;
  const feed = createMilkFeed({}, async () => {
    if (!succeed) throw new Error('offline');
    const year = new Date().getUTCFullYear() - 1;
    return { ok: true, json: async () => [{ memberStateCode: 'DE', product: 'Raw Milk', unit: '100KG', price: '€40.14', year, month: 8, endDate: `31/08/${year}` }] };
  });
  await feed.refresh();
  assert.equal(feed.current().status, 'fresh');
  const successfulUpdate = feed.current().fetchedAt;
  succeed = false;
  await feed.refresh();
  assert.equal(feed.current().status, 'stale');
  assert.equal(feed.current().value, 40.14);
  assert.equal(feed.current().fetchedAt, successfulUpdate);
});

test('retains the last successful fetch time after a server restart', async () => {
  const db = openDatabase(':memory:');
  const year = new Date().getUTCFullYear() - 1;
  const fetcher = async () => ({ ok: true, json: async () => [
    { memberStateCode: 'DE', product: 'Raw Milk', unit: '100KG', price: '€40.14', year, month: 8, endDate: `31/08/${year}` }
  ] });
  try {
    const first = createMilkFeed({}, fetcher, db);
    await first.refresh();
    const timestamp = first.current().fetchedAt;
    assert.equal(db.prepare('SELECT value_ct_per_kg FROM milk_cache WHERE id=1').get().value_ct_per_kg, 40.14);
    const restarted = createMilkFeed({}, async () => { throw new Error('offline'); }, db);
    assert.equal(restarted.current().status, 'fresh');
    assert.equal(restarted.current().fetchedAt, timestamp);
    await restarted.refresh();
    assert.equal(restarted.current().value, 40.14);
  } finally {
    db.close();
  }
});
