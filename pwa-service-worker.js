        // PWA: registo do service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('sw.js').then(function (reg) {
                    // Se, logo ao registar, já existe uma versão nova "à espera" (waiting), é
                    // porque foi instalada numa visita anterior e ficou parada — mostra já o
                    // aviso, senão o utilizador podia nunca chegar a vê-lo.
                    if (reg.waiting && navigator.serviceWorker.controller) {
                        _mostrarAvisoNovaVersao();
                    }
                    // Deteção de nova versão: quando o browser encontra um sw.js diferente do
                    // que já tinha em cache, este evento dispara. Assim que essa nova versão
                    // acabar de instalar (fica "installed"), se já havia uma versão anterior a
                    // controlar a página, é porque é mesmo uma atualização — mostra o aviso.
                    reg.addEventListener('updatefound', function () {
                        const novoWorker = reg.installing;
                        if (!novoWorker) return;
                        novoWorker.addEventListener('statechange', function () {
                            if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                _mostrarAvisoNovaVersao();
                            }
                        });
                    });
                    // O browser só verifica automaticamente se há versão nova em certos
                    // momentos (ex.: ao recarregar a página) — como esta app pode ficar aberta
                    // horas seguidas, força uma verificação extra a cada 30 minutos.
                    setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
                }).catch(function (err) {
                    console.warn('Service worker não registado (precisa de HTTPS):', err);
                });
                navigator.serviceWorker.addEventListener('message', function (ev) {
                    if (ev.data && ev.data.type === 'SW_UPDATED') {
                        _mostrarAvisoNovaVersao();
                    }
                });
            });
        }
        let _avisoNovaVersaoMostrado = false;
        function _mostrarAvisoNovaVersao() {
            if (_avisoNovaVersaoMostrado) return;
            _avisoNovaVersaoMostrado = true;
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:420px;margin:0 auto;background:#152a52;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:999999;display:flex;align-items:center;gap:12px;font-family:inherit;';
            div.innerHTML = '<div style="flex:1;font-size:.88rem;"><strong>Nova versão disponível.</strong><br>Atualiza para veres as últimas melhorias.</div>' +
                '<button style="background:#f4520e;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:.85rem;cursor:pointer;white-space:nowrap;" onclick="_atualizarParaNovaVersao()">Atualizar</button>';
            document.body.appendChild(div);
        }
        async function _atualizarParaNovaVersao() {
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.waiting) {
                    reg.waiting.postMessage('SKIP_WAITING');
                    navigator.serviceWorker.addEventListener('controllerchange', function () { location.reload(); }, { once: true });
                    setTimeout(function () { location.reload(); }, 1500); // rede de segurança, caso o sw.js não trate da mensagem
                    return;
                }
            } catch (e) {}
            location.reload();
        }
        // PWA: banner de instalação customizado (Android/Chrome/Edge desktop)
        let deferredPrompt = null;
        function _pwaBannerFoiDispensadoRecentemente() {
            try {
                const ate = parseInt(localStorage.getItem('tg_pwa_banner_dispensado_ate') || '0', 10);
                return Date.now() < ate;
            } catch (e) { return false; }
        }
        function _pwaDispensarBanner() {
            const b = document.getElementById('bannerInstalarPWA');
            if (b) b.style.display = 'none';
            try { localStorage.setItem('tg_pwa_banner_dispensado_ate', String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch (e) {}
        }
        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredPrompt = e;
            const landing = document.getElementById('tg-landing');
            if (landing && getComputedStyle(landing).display !== 'none') return;
            if (_pwaBannerFoiDispensadoRecentemente()) return;
            const b = document.getElementById('bannerInstalarPWA');
            if (b) b.style.display = 'flex';
        });
        function mostrarInstrucoesInstalacao(platform) {
            let dialog = document.getElementById('tg-install-dialog');
            if (!dialog) {
                dialog = document.createElement('dialog'); dialog.id = 'tg-install-dialog';
                dialog.setAttribute('aria-labelledby', 'tg-install-title'); document.body.appendChild(dialog);
                dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });
            }
            const installed = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
            const ios = platform === 'ios';
            dialog.innerHTML = installed
              ? '<h2 id="tg-install-title">Já está na app</h2><p>A Total Gest já está aberta como aplicação neste dispositivo.</p><button type="button">Fechar</button>'
              : '<h2 id="tg-install-title">Instalar no ' + (ios ? 'iPhone' : 'Android') + '</h2>' +
                (ios ? '<p>No Safari, siga estes três passos:</p><ol><li>Toque em <strong>Partilhar</strong> (quadrado com seta para cima; pode estar no menu do navegador).</li><li>Escolha <strong>Adicionar ao ecrã principal</strong>. Se aparecer, ative <strong>Abrir como app web</strong>.</li><li>Toque em <strong>Adicionar</strong>. Abra a Total Gest pelo novo ícone.</li></ol>' : '<p>Quando disponível, o navegador pede-lhe para confirmar a instalação.</p><ol><li>Abra esta página no <strong>Chrome</strong> do seu Android.</li><li>No menu <strong>⋮</strong>, escolha <strong>Instalar app</strong> ou <strong>Adicionar ao ecrã principal</strong>.</li><li>Confirme a instalação e abra a Total Gest pelo novo ícone.</li></ol><p>Se a opção não aparecer, a app pode já estar instalada ou este navegador não permitir a instalação.</p>') + '<button type="button">Entendido</button>';
            dialog.querySelector('button').onclick = () => dialog.close(); dialog.showModal();
        }
        async function instalarPWA(platform) {
            if (platform === 'ios' && !location.pathname.endsWith('/login.html')) {
                location.href = new URL('login.html?install=ios', location.href); return;
            }
            if (platform === 'ios' || navigator.standalone || matchMedia('(display-mode: standalone)').matches || !deferredPrompt) {
                mostrarInstrucoesInstalacao(platform); return;
            }
            const prompt = deferredPrompt; deferredPrompt = null;
            try { await prompt.prompt(); await prompt.userChoice; }
            catch (_) { mostrarInstrucoesInstalacao('android'); }
            finally { const b=document.getElementById('bannerInstalarPWA'); if(b)b.style.display='none'; }
        }
        if (new URLSearchParams(location.search).get('install') === 'ios') {
            mostrarInstrucoesInstalacao('ios');
            const url = new URL(location.href); url.searchParams.delete('install'); history.replaceState(null, '', url);
        }
        window.addEventListener('appinstalled', function () {
            deferredPrompt = null;
            const b = document.getElementById('bannerInstalarPWA');
            if (b) b.style.display = 'none';
        });
