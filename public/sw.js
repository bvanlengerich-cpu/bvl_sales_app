const SHELL_CACHE = 'bvl-sales-shell-v7';
const SHELL_FILES = ['/', '/index.html', '/styles.css?v=6', '/app.js?v=6', '/icons.js', '/bvl-logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // Never cache private API responses.
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(SHELL_CACHE);
    return await cache.match(event.request, { ignoreSearch: true }) || await cache.match('/index.html');
  }));
});

self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { message = { title: 'BvL Sales', body: event.data?.text() || '' }; }
  const url = message.url === '/#/home' || (typeof message.url === 'string' && message.url.startsWith('/#/messages/')) ? message.url : '/#/messages';
  event.waitUntil(self.registration.showNotification(message.title || 'BvL Sales', {
    body: message.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { url }, tag: `bvl-${url}`, renotify: false
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
