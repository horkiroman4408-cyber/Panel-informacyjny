/* Bump VERSION with every patch; paths work beneath any GitHub Pages repository. */
const VERSION = '1.1.5';
const PREFIX = 'incydenty-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + VERSION;
const FILES = ['./','index.html','style.css','data.js','app.js','workers.js','pwa.js','manifest.webmanifest','version.json','fonts/NotoSansDisplay-Regular.ttf','fonts/NotoSansDisplay-Bold.ttf','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path,self.registration.scope),{cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(request.mode==='navigate'){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('index.html'))||fetch(request)));
    return;
  }
  if(!FILES.some(file=>new URL(file,self.registration.scope).href===url.href))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
