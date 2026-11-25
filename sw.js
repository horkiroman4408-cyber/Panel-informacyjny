/* Mr. Robot — Service Worker (PWA)
 * Strategy: atomically precached, versioned app shell.
 * - install: precache ALL core assets with cache:'reload' (no stale HTTP cache);
 *   if any fetch fails, the update is never activated (atomic release)
 * - cache name is scoped to this app AND its registration scope (path), so
 *   several installations on the same github.io origin never clash
 * - activate: delete only obsolete caches of this scope
 * - fetch: NETWORK-FIRST for the app shell — every online visit gets the
 *   fresh version (no Ctrl+F5 needed); the cache is only a fallback for
 *   offline use and is refreshed in the background on every successful load
 * - update banner is kept for tabs that stay open across a deploy
 *
 * CACHE_REVISION is replaced automatically by the GitHub Actions workflow
 * (content hash of the deployed files) on every deploy. If you host the app
 * elsewhere, bump it manually on every change.
 */
'use strict';

const APP_PREFIX = 'Mr.-Robot-App';
const CACHE_REVISION = 'v3.27.0-overnight-shift-day-20261125-8';
const SCOPE_KEY = new URL(self.registration.scope).pathname;
const CACHE = APP_PREFIX + '@' + SCOPE_KEY + '@' + CACHE_REVISION;

const PRECACHE_URLS = [
  'css/obsada-module.css?v=3.27.0-procesy-native-20261125-4',
  'js/obsada.js?v=3.24.0-obsada-roster-20261113',
  'js/obsada-module.js?v=3.26.0-local-sync-conflict-ui-1',
  'js/obsada-merge.js?v=3.26.0-obsada-file-exchange-1',
  'js/obsada-planner.js?v=3.26.0-merge-folder-help-1',
  'js/obsada-team-intelligence.js?v=3.26.0-last-workdays-1',
  'js/obsada-unified-history.js?v=3.26.0-worker-actions-1',
  './',
  'index.html',
  'css/styles.css',
  'css/mrbot.css',
  'js/i18n.js',
  'js/theme.js',
  'js/vendor-tailwind.js',
  'js/cptable.js',
  'js/xlsx.js',
  'js/vue.global.js',
  'js/data/shifts.js',
  'js/changelog.js',
  'js/workers/kpi.js',
  'js/workers/tote.js',
  'js/workers/audyt.js?v=3.22.0-audyt-intel-detail-20261108',
  'js/workers/mdt.js',
  'js/workers/stock.js',
  'js/workers/przestoje.js',
  'js/workers/pracownicy.js',
  'js/workers/geek.js',
  'js/workers/common.js',
  'js/code128.js',
  'js/mrbot-intelligence.js',
  'js/stock-intelligence.js',
  'js/employee-processes.js?v=3.27.0-procesy-native-20261125-5',
  'js/obsada-controls.js?v=3.26.1-source-help-1',
  'js/app.js?v=3.27.0-procesy-native-20261125-4',
  'js/bridge-setup.js?v=3.26.0-bridge-storage-2',
  'js/mrbot-dialogue-data.js',
  'js/mrbot.js',
  'js/mrbot-knowledge.js',
  'assets/mrbot-pet/wait.webp',
  'assets/mrbot-pet/stretch.webp',
  'assets/mrbot-pet/sit.webp',
  'assets/mrbot-pet/lookaround.webp',
  'assets/mrbot-pet/headscratch.webp',
  'assets/mrbot-pet/antenna.webp',
  'assets/mrbot-pet/surprise.webp',
  'assets/mrbot-pet/rest.webp',
  'assets/mrbot-pet/sway.webp',
  'assets/mrbot-pet/nod.webp',

  'assets/mrbot-pet/think.webp',
  'assets/mrbot-pet/success.webp',
  'assets/mrbot-pet/idle.webp',
  'assets/mrbot-pet/hello.webp',
  'assets/mrbot-pet/head-think.webp',
  'assets/mrbot-pet/head-success.webp',
  'assets/mrbot-pet/head-idle.webp',
  'assets/mrbot-pet/head-hello.webp',
  'assets/mrbot-pet/confused.webp',
  'js/pwa-register.js',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const requests = PRECACHE_URLS.map(
      (path) => new Request(new URL(path, self.location.href), { cache: 'reload' })
    );
    await cache.addAll(requests); // atomic: any failure aborts the release
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const prefix = APP_PREFIX + '@' + SCOPE_KEY + '@';
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(prefix) && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const shellUrl = (p) => new URL(p, self.location.href).href;
  const isShell = PRECACHE_URLS.some((p) => shellUrl(p) === url.href);
  if (!isShell) return; // not part of the shell: plain network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // 1) network first → every online visit is the current version.
      // 'no-cache' = revalidate with the server (like Ctrl+F5, but automatic):
      // no stale browser HTTP cache; 304 replies keep it cheap.
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone()); // refresh the offline copy in background
        return fresh;
      }
      // network said error (e.g. 404): fall back to the cached copy if any
      const cached = await cache.match(req);
      if (cached) return cached;
      return fresh;
    } catch (err) {
      // 2) offline / no network: serve from cache (PWA keeps working)
      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const fallback = await cache.match('index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    if (event.source) event.source.postMessage({ type: 'VERSION', revision: CACHE_REVISION });
  }
});

