/* Keep this device's push registration in sync with the signed-in account. */
(function () {
    'use strict';
    const RETRY_MS = 60000, REFRESH_MS = 5 * 60000;
    let running = null, checkedIdentity = '', checkedAt = 0, attemptedIdentity = '', attemptedAt = 0;
    let status = 'idle', detail = '';
    const user = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const identity = () => { const u = user(); return u ? JSON.stringify([u.id, u.adminId || '', u.role]) : ''; };
    const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
    const enabled = () => {
        const u = user();
        return !!u && (u.role === 'superadmin' || moduloNotificacoesAtivo(adminDoUtilizador()));
    };
    function message() {
        if (!supported()) return 'Abra a Total Gest pela aplicação instalada no ecrã principal, num dispositivo compatível.';
        if (Notification.permission === 'denied') return 'As notificações estão bloqueadas. Autorize a Total Gest nas definições de notificações do dispositivo.';
        if (Notification.permission !== 'granted') return 'Ative os avisos neste dispositivo para os receber também com a app fechada.';
        if (status === 'syncing') return 'A verificar as notificações deste dispositivo…';
        if (status === 'ready' && checkedIdentity === identity()) return 'Este dispositivo está registado para receber notificações.';
        return detail || 'Verifique e volte a ligar as notificações deste dispositivo.';
    }
    function render() {
        const host = document.getElementById('omeudia');
        if (!host) return;
        let card = document.getElementById('tgPushDeviceStatus');
        if (!enabled()) { card?.remove(); return; }
        if (!card) {
            card = document.createElement('div'); card.id = 'tgPushDeviceStatus';
            card.className = 'home-card tg-push-row';
            card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 16px;margin-bottom:14px;border-radius:12px;';
            const copy = document.createElement('div'); copy.style.cssText = 'flex:1;min-width:180px;';
            const title = document.createElement('strong'); title.textContent = 'Notificações da app';
            const text = document.createElement('p'); text.dataset.pushDetail = '1'; text.style.cssText = 'margin:4px 0 0;font-size:.8rem;opacity:.85;';
            text.setAttribute('role', 'status');
            const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-sm btn-primary';
            button.style.cssText = 'flex-shrink:0;min-height:36px;';
            button.onclick = () => { void activate(); };
            copy.append(title, text); card.append(copy, button); host.prepend(card);
        }
        card.querySelector('[data-push-detail]').textContent = message();
        const btn = card.querySelector('button');
        btn.textContent = supported() && Notification.permission === 'granted' ? 'Verificar notificações' : 'Ativar notificações';
        btn.disabled = !!running;
    }
    function sameAccount(expected) {
        if (!expected || identity() !== expected) throw new Error('A conta mudou durante a configuração. Volte a verificar as notificações.');
    }
    async function readyRegistration() {
        let timer;
        try {
            const existing = await navigator.serviceWorker.getRegistration();
            if (!existing) await navigator.serviceWorker.register('sw.js');
            return await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('A aplicação ainda está a atualizar. Tente novamente dentro de alguns segundos.')), 12000); })
            ]);
        } finally { clearTimeout(timer); }
    }
    async function reconcile(expected) {
        const reg = await readyRegistration(); sameAccount(expected);
        let subscription = await reg.pushManager.getSubscription(); sameAccount(expected);
        if (subscription && subscription.expirationTime != null && subscription.expirationTime <= Date.now()) {
            await subscription.unsubscribe(); subscription = null; sameAccount(expected);
        }
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
            sameAccount(expected);
        }
        const s = subscription.toJSON(), u = user();
        if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) throw new Error('Não foi possível obter a inscrição deste dispositivo.');
        const row = { utilizador_id: u.id, admin_id: u.role === 'admin' ? u.id : (u.adminId || null), endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
        const { data, error } = await supa.from('push_subscriptions').upsert([row], { onConflict: 'endpoint' }).select('utilizador_id').single();
        if (error) throw error;
        sameAccount(expected);
        if (data?.utilizador_id !== u.id) throw new Error('Não foi possível confirmar o registo das notificações no servidor.');
        checkedIdentity = expected; checkedAt = Date.now(); status = 'ready'; detail = '';
        return true;
    }
    async function sync(force = false) {
        const expected = identity();
        if (!expected || !enabled() || !supported() || Notification.permission !== 'granted') { render(); return false; }
        if (running) return running.identity === expected ? running.promise : false;
        if (!force && ((checkedIdentity === expected && Date.now() - checkedAt < REFRESH_MS) || (attemptedIdentity === expected && Date.now() - attemptedAt < RETRY_MS))) { render(); return checkedIdentity === expected && status === 'ready'; }
        attemptedIdentity = expected; attemptedAt = Date.now(); status = 'syncing'; detail = '';
        const job = { identity: expected };
        running = job;
        job.promise = (async () => {
            try { return await reconcile(expected); }
            catch (error) {
                if (identity() === expected) {
                    status = 'error'; detail = 'Não foi possível ligar as notificações. Toque em “Verificar notificações” para tentar novamente.';
                    console.warn('Registo de notificações push:', error?.message || 'Falha na configuração');
                }
                return false;
            } finally { if (running === job) running = null; render(); }
        })();
        render(); return job.promise;
    }
    async function activate() {
        if (!user() || !enabled()) return;
        if (!supported()) { alert(message()); return; }
        try {
            // Permission prompts remain tied to an explicit click, including on iOS.
            if (Notification.permission === 'default') await Notification.requestPermission();
            if (Notification.permission !== 'granted') { render(); alert(message()); return; }
            const ok = await sync(true);
            if (ok) alert('Notificações ligadas neste dispositivo.');
            else alert(message());
        } catch (error) {
            status = 'error'; detail = 'Não foi possível ativar as notificações. Abra a app instalada e tente novamente.';
            render(); alert(message());
        }
    }
    _ativarNotificacoesPush = activate;
    // The daily panel is rebuilt on refresh and moved into the desktop home.
    // Reinsert the separate notification row before its cards on every rebuild.
    if (typeof renderizarOMeuDia === 'function') {
        const originalMeuDia = renderizarOMeuDia;
        renderizarOMeuDia = function (...args) { const result = originalMeuDia.apply(this, args); render(); return result; };
    }
    document.addEventListener('tg:interface-updated', () => { void sync(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
    window.addEventListener('online', () => { attemptedAt = 0; void sync(true); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { void sync(true); });
    window.TGPush = { sync, activate, render, getState: () => ({ status, registered: supported() && Notification.permission === 'granted' && checkedIdentity === identity() && status === 'ready', message: message() }) };
    void sync();
})();
