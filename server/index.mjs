import { openDatabase } from './db.mjs';
import { createApp } from './app.mjs';
import { MILK_REFRESH_MS, nextMilkRefreshDelay } from './milk.mjs';

const db = openDatabase();
const { server, milk } = createApp({ db });
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

const refreshMilk = () => milk.refresh().catch(error => console.error('Milk price refresh failed:', error));
let timer;
function scheduleMilkRefresh(delay) {
  timer = setTimeout(async () => {
    await refreshMilk();
    scheduleMilkRefresh(MILK_REFRESH_MS);
  }, delay);
  timer.unref();
}
const initialDelay = nextMilkRefreshDelay(milk.current().fetchedAt);
if (initialDelay === 0) {
  await refreshMilk();
  scheduleMilkRefresh(MILK_REFRESH_MS);
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
