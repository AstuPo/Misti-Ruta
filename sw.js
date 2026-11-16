const CACHE_NAME = 'misti-ruta-v1';
const APP_SHELL = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet-polylinedecorator/1.6.0/leaflet.polylineDecorator.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// 1. Instalación: Guarda los archivos base en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Guardando App Shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting(); // Fuerza al nuevo SW a activarse inmediatamente
});

// 2. Activación: Limpia cachés antiguos si cambias la versión
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Borrando caché antigua', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Intercepción de Peticiones (Fetch)
self.addEventListener('fetch', (e) => {
  // No interceptar peticiones que no sean GET (como las de planificación de rutas POST)
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Estrategia para los Mapas (Tiles de ArcGIS): Cache First (Red si falla)
  if (url.hostname.includes('arcgisonline.com')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(e.request).then((networkResponse) => {
          // Guardar dinámicamente cada cuadro del mapa que el usuario vea
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          // Si falla la red, retornar un tile gris transparente para que no se rompa el mapa
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" style="background:#e2e8f0;"></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });
      })
    );
    return;
  }

  // Estrategia para el resto (App Shell, CDNs, Fuentes): Cache First
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
