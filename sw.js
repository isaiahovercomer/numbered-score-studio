const prefix = 'numbered-score-studio:' + self.registration.scope + ':';
const cacheName = prefix + 'ad24038b3cde5227ea71';
const scope = self.registration.scope;
const index = new URL('index.html', scope).href;
const assets = new Set(["LAME-LICENSE","analysis-worker.js","app.js","audio-analysis.js","audio-review.js","audio.js","cello-41.mp3","cello-43.mp3","cello-45.mp3","cello-46.mp3","cello-48.mp3","cello-50.mp3","config.json","credits.txt","dom.js","encode-worker.js","example.json","flute-72.mp3","flute-76.mp3","flute-81.mp3","font-metrics.js","index.html","lame.min.js","lyrics-diagnose.js","manifest.webmanifest","mixer.js","mobile-workspace.js","music.js","musicxml.js","piano-42.mp3","piano-45.mp3","piano-48.mp3","piano-51.mp3","piano-54.mp3","piano-57.mp3","piano-60.mp3","piano-63.mp3","piano-66.mp3","piano-69.mp3","piano-72.mp3","piano-75.mp3","project-history.js","project-session.js","samples.json","score-bridge.js","score-edit.js","studio-192.png","studio-512.png","studio-analysis.js","studio-chords.js","studio-lyrics.js","studio-word.js","studio.js","style.css","tour-steps.js","tour.js","violin-55.mp3","violin-60.mp3","violin-64.mp3","violin-69.mp3","violin-72.mp3","webmcp.js","word-chords.js","word-docx.js","word-export.js","word-notation.js","word-options.js","wording-rules.js","wording.js"].map(f => new URL(f, scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [...assets].map(url => new Request(url, {cache: 'reload'}))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('Range')) return;
  const url = new URL(req.url);
  const path = url.origin + url.pathname;
  const navigation = req.mode === 'navigate' && (path === scope || path === index);
  const key = navigation ? index : url.href;
  if (!assets.has(key)) return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) || fetch(req)));
});
