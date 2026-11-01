// Кэш для работы без сети: на кафедре интернета может не быть.
// При первом заходе с сетью сайт целиком (страницы, 3D-модель, three.js, шрифты, кадры случаев) ложится в кэш.
// Дальше сначала сеть — правки видны сразу; сети нет или она дольше ZHDAT мс не отвечает — отдаём из кэша.
const KESH = 'dentalis';
const ZHDAT = 4000;

// Кадры карточек — по номерам случаев из тех же данных, что у страниц: новый случай попадёт в кэш сам
self.window = self;
importScripts('data/sluchai.js');
const FAYLY = [
  './', 'index.html', 'sluchay.html', 'istochniki.html', 'tema.js', 'telo.js', 'data/sluchai.js', 'data/svetofor.js', '3d/prosmotr.js', 'models/polost_rta.glb',
  'vendor/three/three.module.js', 'vendor/three/three.core.js',
  'vendor/three/addons/loaders/GLTFLoader.js', 'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/utils/SkeletonUtils.js',
  'vendor/shrifty/shrifty.css', 'vendor/shrifty/golos-kirillica.woff2', 'vendor/shrifty/golos-latinica.woff2',
  'vendor/shrifty/unbounded-kirillica.woff2', 'vendor/shrifty/unbounded-latinica.woff2',
  ...self.SLUCHAI_DANNYE.sluchai.filter((s) => s.razdel === 'stomat').map((s) => `kartinki/sluchay-${s.kl}.webp`),
];

const bezPoiska = (url) => url.split(/[?#]/)[0]; // ?v=… для проверки свежести — тот же файл

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // по одному: файл, которого нет (случай без кадра), не должен сорвать весь кэш
  e.waitUntil(caches.open(KESH).then((kesh) => Promise.allSettled(FAYLY.map((f) => kesh.add(new Request(f, { cache: 'reload' }))))));
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const z = e.request;
  if (z.method !== 'GET' || !z.url.startsWith(self.registration.scope)) return;
  const klyuch = bezPoiska(z.url);
  const kesh = caches.open(KESH);
  const izSeti = fetch(z);
  // свежий ответ — в кэш; копию снимаем сразу, пока страница не начала читать ответ
  e.waitUntil(izSeti.then((o) => {
    if (o.status !== 200) return;
    const kopiya = o.clone();
    return kesh.then((k) => k.put(klyuch, kopiya));
  }).catch(() => {}));
  e.respondWith((async () => {
    const izKesha = await (await kesh).match(klyuch);
    if (!izKesha) return izSeti;
    return Promise.race([
      izSeti.then((o) => (o.ok ? o : izKesha), () => izKesha),
      new Promise((r) => setTimeout(() => r(izKesha), ZHDAT)),
    ]);
  })());
});
