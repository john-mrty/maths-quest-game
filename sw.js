const CACHE = "maths-quest-everyone-v74";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js?v=74",
  "./math-models.js?v=74",
  "./learning.css?v=74",
  "./adventure.js?v=74",
  "./adventure.css?v=74",
  "./island.js?v=74",
  "./island.css?v=74",
  "./racer.js?v=74",
  "./racer.css?v=74",
  "./turbo-tables.js?v=74",
  "./turbo-tables.css?v=74",
  "./turbo-tables/index.html",
  "./turbo-tables/menu.css",
  "./turbo-tables/js/audio.js",
  "./turbo-tables/js/game.js",
  "./turbo-tables/js/host.js",
  "./turbo-tables/js/karts.js",
  "./turbo-tables/js/main.js",
  "./turbo-tables/js/tap-steering.js",
  "./turbo-tables/js/maths.js",
  "./turbo-tables/js/textures.js",
  "./turbo-tables/js/track.js",
  "./turbo-tables/vendor/three/build/three.module.min.js",
  "./turbo-tables/vendor/three/examples/jsm/environments/RoomEnvironment.js",
  "./turbo-tables/vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js",
  "./turbo-tables/vendor/three/examples/jsm/math/SimplexNoise.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/EffectComposer.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/GTAOPass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/MaskPass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/OutputPass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/Pass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/RenderPass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/ShaderPass.js",
  "./turbo-tables/vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js",
  "./turbo-tables/vendor/three/examples/jsm/shaders/CopyShader.js",
  "./turbo-tables/vendor/three/examples/jsm/shaders/GTAOShader.js",
  "./turbo-tables/vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js",
  "./turbo-tables/vendor/three/examples/jsm/shaders/OutputShader.js",
  "./turbo-tables/vendor/three/examples/jsm/shaders/PoissonDenoiseShader.js",
  "./turbo-tables/vendor/three/examples/jsm/utils/BufferGeometryUtils.js",
  "./assets/turbo-trail-preview.png",
  "./assets/turbo-tables-preview.jpg",
  "./assets/turbo-track-meadow.jpg",
  "./assets/turbo-track-candy.jpg",
  "./assets/turbo-track-moon.jpg",
  "./assets/cloud-crossing-preview.jpg",
  "./assets/beat-quest-preview.svg",
  "./vendor/three.module.min.js",
  "./vendor/three.core.min.js",
  "./cloud-config.js",
  "./cloud.js",
  "./vendor/supabase.js",
  "./manifest.webmanifest",
  "./assets/avatars/fox.png",
  "./assets/avatars/panda.png",
  "./assets/avatars/cat.png",
  "./assets/avatars/dog.png",
  "./assets/avatars/unicorn.png",
  "./assets/avatars/owl.png",
  "./assets/avatars/turtle.png",
  "./assets/avatars/shark.png",
  "./assets/avatars/badger.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL.map(path => new Request(new URL(path, self.location.href), { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Auth/API responses and private photos must never enter the app-shell cache.
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("code") || url.searchParams.has("error")) return;
  const assets = new Set(APP_SHELL.map(path => new URL(path, self.location.href).pathname));
  if (!assets.has(url.pathname)) return;

  if (event.request.mode === "navigate") {
    const shell=url.pathname.endsWith('/turbo-tables/index.html')?'./turbo-tables/index.html':'./index.html';
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then(cache => cache.put(shell, copy));
          return response;
        })
        .catch(() => caches.match(shell))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
