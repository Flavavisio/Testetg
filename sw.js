// Service Worker — Total Gest PWA
const CACHE = 'totalgest-v65-contract-kiosk';
const ASSETS = ['./styles.css?v=e2e-review-20261015', './tg-assistente.js?v=4.1.0-dock', './tg-assistente.css?v=4.1.0-dock', './tg-smart-engine.js?v=3.1.0-stock', './tg-planner.js?v=1.0.2', './tg-os-planning-ui.js?v=1.0.0', './tg-offline.js', './tg-equipment-reports.js?v=1.1.1', './tg-contract-maintenance.js?v=1.8.2', './tg-passport.js?v=1.3.0', './tg-passport.css?v=1.0.0', './tg-client-history.js?v=1.0.2', './tg-client-history.css?v=1.0.0', './tg-integrated-modules.js?v=1.0.2', './tg-module-embed.js?v=1.0.0', './tg-integrated-modules.css?v=1.1.0', './app-principal.js?v=contract-kiosk-20261018', './tg-nexus.css?v=1.1.2', './tg-nexus.js?v=1.1.1', './tg-reports.css?v=1.0.0', './tg-reports-engine.js?v=1.0.1', './tg-reports-ui.js?v=1.0.0', './responsive-device.css?v=2', './login.html', './access.css', './app-entry.js', './pwa-service-worker.js', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  // IMPORTANTE: NÃO se chama skipWaiting() aqui de propósito.
  // Antes chamava-se, e isso, combinado com o clients.claim() do activate, fazia a versão nova
  // assumir o controlo de uma página que já estava a meio de carregar a versão antiga — ficava
  // uma "mistura" das duas e a app aparecia em branco no primeiro acesso (só um Ctrl+Shift+R
  // resolvia). Agora a versão nova instala-se e FICA À ESPERA ("waiting") até o utilizador
  // clicar no botão "Atualizar" do aviso — que envia SKIP_WAITING (ver abaixo). Assim nunca há
  // mistura: ou se está na versão antiga inteira, ou se passa à nova inteira de uma vez.
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clientsList => {
        // avisa as páginas já abertas que há uma nova versão ativa
        clientsList.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
      })
  );
});

// Quando o utilizador clica em "Atualizar", a página manda esta mensagem — só aí é que a versão
// nova toma o controlo (skipWaiting), de forma limpa e controlada.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// Only static shell files are eligible for caching. Never cache data/API responses.
const staticPaths = new Set(ASSETS.map(p => new URL(p, self.registration.scope).pathname));
self.addEventListener('fetch', e => {
  const req=e.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin || !staticPaths.has(u.pathname) || u.searchParams.has('access_token') || u.searchParams.has('token') || req.headers.has('authorization'))return;
  e.respondWith(fetch(req).then(res=>{
    if(res.ok && res.type==='basic' && !res.headers.has('set-cookie') && !/private|no-store/i.test(res.headers.get('cache-control')||'')){
      const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}));
    }
    return res;
  }).catch(()=>caches.match(req).then(hit=>hit||Response.error())));
});

// ===== Notificações push =====
self.addEventListener('push', e => {
  let dados = {};
  try { dados = e.data ? e.data.json() : {}; } catch (err) { dados = { titulo: 'Total Gest', corpo: e.data ? e.data.text() : '' }; }

  const titulo = dados.titulo || dados.title || 'Total Gest';
  const iconePersonalizado = dados.icone || dados.icon || dados.logo_url || '';
  const opcoes = {
    body: dados.corpo || dados.body || '',
    icon: iconePersonalizado || './icon-192.png',
    badge: './icon-192.png', // o badge (Android, monocromático) mantém-se sempre o do TotalGest
    tag: dados.tag || 'totalgest-notificacao',
    renotify: true,
    data: { url: dados.url || './login.html' },
    vibrate: [120, 60, 120]
  };

  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './login.html';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
      for (const client of clientsList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
