// Cenza service worker — minimal, enables PWA installability
const CACHE = 'cenza-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Network-first strategy: always try network, fall back to cache
self.addEventListener('fetch', e => {
  // Only handle GET requests for same-origin
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses for static assets
        if (res.ok && e.request.url.includes('/_next/static/')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
