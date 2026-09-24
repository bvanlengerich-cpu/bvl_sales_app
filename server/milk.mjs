const BASE_URL = 'https://api.tech.ec.europa.eu/agrifood/api/rawMilk/prices';
export const MILK_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = MILK_REFRESH_MS + 24 * 60 * 60 * 1000;

export function nextMilkRefreshDelay(fetchedAt, nowMs = Date.now()) {
  const lastFetchMs = Date.parse(fetchedAt || '');
  return Number.isFinite(lastFetchMs) ? Math.min(MILK_REFRESH_MS, Math.max(0, MILK_REFRESH_MS - (nowMs - lastFetchMs))) : 0;
}

function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return Number.isFinite(date.getTime()) && date.getUTCDate() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCFullYear() === Number(match[3]) ? date : null;
}

function priceRecord(row) {
  if (row.memberStateCode !== 'DE' || String(row.product).toLowerCase() !== 'raw milk' || row.unit !== '100KG') return null;
  const price = Number(String(row.price || '').replace(/[€\s]/g, '').replace(',', '.'));
  const end = parseDate(row.endDate);
  if (!Number.isFinite(price) || price <= 0 || price > 200 || !end || end.getTime() > Date.now()) return null;
  const centsPerKg = (price / 100) * 100; // EUR/100 kg -> EUR/kg -> cents/kg.
  return { value: Number(centsPerKg.toFixed(2)), period: `${row.year}-${String(row.month).padStart(2, '0')}`, endDate: end.toISOString().slice(0, 10) };
}

export function createMilkFeed(config = process.env, fetcher = fetch, db = null) {
  const cached = db?.prepare('SELECT * FROM milk_cache WHERE id=1').get();
  let latest = cached ? { value: cached.value_ct_per_kg, period: cached.period, endDate: cached.end_date } : null;
  let fetchedAt = cached?.fetched_at || null;
  let lastError = cached ? null : 'not-loaded';

  async function refresh() {
    const year = new Date().getUTCFullYear();
    const years = [year, year - 1];
    const results = await Promise.allSettled(years.map(async selectedYear => {
      const url = `${BASE_URL}?products=raw%20milk&memberStateCodes=DE&years=${selectedYear}`;
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000), cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`EU API HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('EU API format changed');
      return data.map(priceRecord).filter(Boolean);
    }));
    const records = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value);
    if (!records.length) {
      lastError = results.find(result => result.status === 'rejected')?.reason?.message || 'No German raw milk price';
      return;
    }
    records.sort((a, b) => b.endDate.localeCompare(a.endDate));
    const next = records[0];
    if (latest && next.endDate < latest.endDate) {
      lastError = 'Most recent period missing from EU API';
      return;
    }
    const nextFetchedAt = new Date().toISOString();
    if (db) db.prepare(`INSERT INTO milk_cache (id,value_ct_per_kg,period,end_date,fetched_at) VALUES (1,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET value_ct_per_kg=excluded.value_ct_per_kg,period=excluded.period,
        end_date=excluded.end_date,fetched_at=excluded.fetched_at`)
      .run(next.value, next.period, next.endDate, nextFetchedAt);
    latest = next;
    fetchedAt = nextFetchedAt;
    lastError = null;
  }

  function current() {
    if (!latest || !fetchedAt) {
      return { status: 'unavailable', value: null, unit: 'ct/kg', period: null, fetchedAt: null, source: 'European Commission', sourceUrl: BASE_URL };
    }
    const stale = Boolean(lastError) || Date.now() - Date.parse(fetchedAt) > STALE_AFTER_MS;
    return { status: stale ? 'stale' : 'fresh', ...latest, unit: 'ct/kg', fetchedAt, source: 'European Commission', sourceUrl: BASE_URL };
  }

  return { refresh, current };
}
