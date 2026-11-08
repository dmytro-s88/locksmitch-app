// App shell cache. index.html and navigations are network-first (a deploy reaches the phone on the next open);
// css/js/assets are cache-first by their ?v= name. The bot API is never cached (POST, other origin).
const CACHE = 'lm-app-v6';
const SHELL = ['./', 'index.html', 'app.css?v=6', 'app.js?v=6', 'core.js?v=6', 'manifest.webmanifest', 'assets/logo.webp', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png', 'assets/favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  const isPage = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname);
  if (isPage) {   // сеть, при неудаче кэш: свежий index.html после деплоя, офлайн всё равно открывается
    e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put('index.html', r.clone())); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })));
});
