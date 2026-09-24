import { openDatabase } from './db.mjs';
import { createApp } from './app.mjs';
import { MILK_REFRESH_MS, nextMilkRefreshDelay } from './milk.mjs';

const db = openDatabase();
const { server, milk, refreshMilkAndNotify } = createApp({ db });
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const MILK_RETRY_MS = 6 * 60 * 60 * 1000;

async function refreshMilk() {
  try {
    const result = await refreshMilkAndNotify();
    if (!result.ok) console.warn('Milk price refresh unavailable:', result.reason);
    if (result.push?.failed) console.warn(`Milk price push failed for ${result.push.failed} subscriptions.`);
    return result.ok;
  } catch (error) {
    console.error('Milk price refresh failed:', error);
    return false;
  }
}
let timer;
function scheduleMilkRefresh(delay) {
  timer = setTimeout(async () => {
    const ok = await refreshMilk();
    scheduleMilkRefresh(ok ? MILK_REFRESH_MS : MILK_RETRY_MS);
  }, delay);
  timer.unref();
}
const initialDelay = nextMilkRefreshDelay(milk.current().fetchedAt);
if (initialDelay === 0) {
  const ok = await refreshMilk();
  scheduleMilkRefresh(ok ? MILK_REFRESH_MS : MILK_RETRY_MS);
} else {
  scheduleMilkRefresh(initialDelay);
}
server.listen(port, host, () => console.log(`BvL Sales App listening on ${host}:${port}`));

function shutdown() {
  clearTimeout(timer);
  server.close(() => { db.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
