const CACHE_VERSION = '9.8.0';
const CACHE_NAME = 'ato-sukoshi-' + CACHE_VERSION;
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.ico',
  'favicon-96.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

const ANALYTICS_HOSTS = ['www.googletagmanager.com', 'www.google-analytics.com', 'region1.google-analytics.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('ato-sukoshi-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function precacheName(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'index.html';
  return path.replace(/^\//, '');
}

function isAppShellRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const name = precacheName(url.pathname);
  return PRECACHE_URLS.some((entry) => entry.replace(/^\.\//, '') === name);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (!isSameOrigin(url)) return;
  if (ANALYTICS_HOSTS.includes(url.hostname)) return;
  if (!isAppShellRequest(event.request, url)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    } catch (_err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return (await caches.match('index.html')) || (await caches.match('./'));
      }
      return cached;
    }
  })());
});
