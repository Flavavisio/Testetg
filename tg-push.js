/* Keep this device's push registration in sync with the signed-in account. */
(function () {
    'use strict';
    const RETRY_MS = 60000, REFRESH_MS = 5 * 60000;
    let running = null, checkedIdentity = '', checkedAt = 0, attemptedIdentity = '', attemptedAt = 0;
    let status = 'idle', detail = '', failure = '', prepared = null, registeredEndpoint = '', testing = false, repairedIdentity = '';
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
        if (status === 'error') return detail;
        if (status === 'needs_activation' && detail) return detail;
        if (Notification.permission !== 'granted') return 'Ative os avisos neste dispositivo para os receber também com a app fechada.';
        if (status === 'syncing' || status === 'preparing') return 'A preparar as notificações deste dispositivo…';
        if (status === 'needs_activation') return detail || 'Toque em Ativar notificações para ligar este dispositivo.';
        if (status === 'ready' && checkedIdentity === identity()) return detail || 'Este dispositivo está registado para receber notificações.';
        return detail || 'Verifique e volte a ligar as notificações deste dispositivo.';
    }
    function render() {
        const host = document.getElementById('omeudia');
        if (!host) return;
        let card = document.getElementById('tgPushDeviceStatus');
        const registered = supported() && Notification.permission === 'granted' && checkedIdentity === identity()
            && status !== 'error' && status !== 'needs_activation';
        const checking = supported() && Notification.permission === 'granted' && status === 'preparing';
        if (!enabled() || registered || checking) { card?.remove(); return; }
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
        btn.textContent = status === 'needs_activation' || !supported() || Notification.permission !== 'granted'
            ? 'Ativar notificações' : (status === 'error' ? 'Reativar notificações' : 'Verificar notificações');
        btn.disabled = !!running;
    }
    function sameAccount(expected) {
        if (!expected || identity() !== expected) throw new Error('A conta mudou durante a configuração. Volte a verificar as notificações.');
    }
    const pushServiceFailed = error => /push service initialization failed/i.test(String(error?.message || ''));
    function fail(error, stage) {
        status = 'error';
        failure = stage + '/' + String(error?.name || (error?.code === 11 ? 'InvalidStateError' : error?.code) || 'Erro').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
        const descriptions = {
            worker: 'A app ainda não conseguiu preparar as notificações. Feche e volte a abrir a app instalada.',
            config: 'Não foi possível obter a configuração das notificações. Confirme a ligação à Internet.',
            subscription: 'O dispositivo não conseguiu consultar a ligação de notificações. Toque em Reativar notificações.',
            subscribe: 'O dispositivo recusou criar a ligação de notificações. Abra a app pelo ícone instalado e volte a tentar.',
            save: 'Não foi possível guardar o registo deste dispositivo. Confirme a ligação e a sessão.',
            test: 'Não foi possível agendar o teste de notificações.'
        };
        const nativeMessage = String(error?.message || '').replace(/https?:\/\/\S+/gi, '[endereço]').replace(/[\r\n\t<>]/g, ' ').slice(0, 220);
        const description = pushServiceFailed(error)
            ? 'O serviço de notificações do dispositivo não conseguiu iniciar. Tente reiniciar o iPhone, desbloqueá-lo e voltar a ativar as notificações na Total Gest.'
            : (descriptions[stage] || 'Não foi possível ligar as notificações.');
        detail = description + ' Detalhe para suporte: ' + failure + '.' + (nativeMessage ? ' Motivo do dispositivo: ' + nativeMessage : '');
        console.warn('Notificações push:', failure);
    }
    function workerActivated(reg, target = null) {
        const active = () => reg?.active?.state === 'activated' && (!target || reg.active === target);
        if (active()) return Promise.resolve(reg);
        return new Promise((resolve, reject) => {
            const watched = new Set();
            const cleanup = () => {
                clearTimeout(timer); reg.removeEventListener('updatefound', check);
                watched.forEach(worker => worker.removeEventListener('statechange', check));
            };
            const check = () => {
                if (active()) { cleanup(); resolve(reg); return; }
                [reg.installing, reg.waiting, reg.active].filter(Boolean).forEach(worker => {
                    if (!watched.has(worker)) { watched.add(worker); worker.addEventListener('statechange', check); }
                });
            };
            const timer = setTimeout(() => { cleanup(); reject(new Error('ServiceWorkerActivationTimeout')); }, 12000);
            reg.addEventListener('updatefound', check); check();
        });
    }
    async function readyRegistration() {
        const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('sw.js');
        return workerActivated(reg);
    }
    async function recoverInvalidState(expected, error) {
        // This error comes from the OS push daemon. Updating/replacing a service worker cannot restart it.
        if (pushServiceFailed(error) || repairedIdentity === expected) return false;
        const config = prepared;
        let old;
        try { old = await config.reg.pushManager.getSubscription(); } catch { return false; }
        sameAccount(expected);
        if (!old) return false;
        repairedIdentity = expected;
        await old.unsubscribe(); sameAccount(expected);
        if (await config.reg.pushManager.getSubscription()) throw new Error('PreviousSubscriptionStillPresent');
        sameAccount(expected);
        checkedIdentity = ''; registeredEndpoint = ''; status = 'needs_activation';
        detail = 'A ligação anterior foi removida. Toque em Ativar notificações para concluir.';
        // Never update the service worker, navigate or reload as part of notification activation.
        return true;
    }
    async function prepare(expected) {
        let reg;
        try { reg = await readyRegistration(); } catch (error) { error.pushStage = 'worker'; throw error; }
        sameAccount(expected);
        let result;
        try { result = await supa.functions.invoke('testar-push', { body: { acao: 'config' } }); }
        catch (error) { error.pushStage = 'config'; throw error; }
        if (result.error || !result.data?.chave_publica) {
            const error = result.error || new Error('MissingPublicKey'); error.pushStage = 'config'; throw error;
        }
        sameAccount(expected);
        prepared = { identity: expected, reg, key: _urlBase64ToUint8Array(result.data.chave_publica) };
        return prepared;
    }
    async function persist(subscription, expected) {
        sameAccount(expected);
        const s = subscription.toJSON(), u = user();
        if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) throw new Error('InvalidSubscription');
        const row = { utilizador_id: u.id, admin_id: u.role === 'admin' ? u.id : (u.adminId || null), endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
        const { data, error } = await supa.from('push_subscriptions').upsert([row], { onConflict: 'endpoint' }).select('utilizador_id').single();
        if (error) throw error;
        sameAccount(expected);
        if (data?.utilizador_id !== u.id) throw new Error('RegistrationNotConfirmed');
        registeredEndpoint = s.endpoint; checkedIdentity = expected; checkedAt = Date.now(); status = 'ready'; detail = ''; failure = '';
        return true;
    }
    async function reconcile(expected) {
        const config = await prepare(expected);
        if (Notification.permission !== 'granted') { status = 'needs_activation'; detail = ''; return false; }
        let subscription;
        try { subscription = await config.reg.pushManager.getSubscription(); }
        catch (error) { error.pushStage = 'subscription'; throw error; }
        sameAccount(expected);
        const key = subscription?.options?.applicationServerKey;
        const wrongKey = key && (new Uint8Array(key).length !== config.key.length || new Uint8Array(key).some((byte, i) => byte !== config.key[i]));
        if (subscription && (wrongKey || (subscription.expirationTime != null && subscription.expirationTime <= Date.now()))) {
            await subscription.unsubscribe(); sameAccount(expected); subscription = null;
        }
        // Safari requires subscribe() directly in a click handler. Background sync must never create a subscription.
        if (!subscription) { status = 'needs_activation'; detail = 'Toque em Ativar notificações para renovar a ligação deste dispositivo.'; return false; }
        try { return await persist(subscription, expected); }
        catch (error) { error.pushStage = 'save'; throw error; }
    }
    async function sync(force = false) {
        const expected = identity();
        if (!expected || !enabled() || !supported() || Notification.permission === 'denied') { render(); return false; }
        if (running) return running.identity === expected ? running.promise : false;
        if (!force && ((checkedIdentity === expected && Date.now() - checkedAt < REFRESH_MS) || (attemptedIdentity === expected && Date.now() - attemptedAt < RETRY_MS))) { render(); return checkedIdentity === expected && status === 'ready'; }
        attemptedIdentity = expected; attemptedAt = Date.now(); status = 'preparing'; detail = '';
        const job = { identity: expected }; running = job;
        job.promise = (async () => {
            try { return await reconcile(expected); }
            catch (error) { if (identity() === expected) fail(error, error.pushStage || 'subscription'); return false; }
            finally { if (running === job) running = null; render(); }
        })();
        render(); return job.promise;
    }
    function activate() {
        const expected = identity();
        if (!expected || !enabled()) return Promise.resolve(false);
        if (!supported() || Notification.permission === 'denied') { alert(message()); return Promise.resolve(false); }
        if (running) return running.promise;
        if (prepared?.identity !== expected) {
            return sync(true).then(ok => { if (!ok && identity() === expected) alert(message()); return ok; });
        }
        let subscriptionPromise;
        try {
            // Must be called synchronously from the user's tap: no permission/read/network awaits before this line.
            subscriptionPromise = prepared.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: prepared.key });
        } catch (error) { fail(error, 'subscribe'); render(); alert(message()); return Promise.resolve(false); }
        status = 'syncing'; detail = '';
        const job = { identity: expected }; running = job;
        job.promise = (async () => {
            let stage = 'subscribe';
            try {
                const subscription = await subscriptionPromise; sameAccount(expected); stage = 'save';
                await persist(subscription, expected);
                alert('Notificações ligadas neste dispositivo.'); return true;
            } catch (error) {
                if (identity() === expected) {
                    fail(error, stage);
                    if (stage === 'subscribe' && (error?.name === 'InvalidStateError' || error?.code === 11)) {
                        try { await recoverInvalidState(expected, error); }
                        catch (recoveryError) {
                            if (identity() === expected) fail(recoveryError, 'worker');
                        }
                    }
                    if (identity() === expected) alert(message());
                }
                return false;
            } finally { if (running === job) running = null; render(); }
        })();
        render(); return job.promise;
    }
    async function testPush() {
        const expected = identity();
        if (testing || checkedIdentity !== expected || status !== 'ready' || !registeredEndpoint) return;
        testing = true; render();
        try {
            const { data, error } = await supa.functions.invoke('testar-push', { body: { acao: 'teste', endpoint: registeredEndpoint } });
            if (identity() !== expected) return;
            if (error || !data?.agendado) throw error || new Error('TestNotScheduled');
            detail = 'Teste agendado. Bloqueie o ecrã agora: o servidor enviará o aviso dentro de 10 segundos.';
            alert(detail);
        } catch (error) { if (identity() === expected) { fail(error, 'test'); alert(message()); } }
        finally { testing = false; render(); }
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
    window.TGPush = { sync, activate, test: testPush, render, getState: () => ({ status, failure, registered: supported() && Notification.permission === 'granted' && checkedIdentity === identity() && status === 'ready', message: message() }) };
    void sync();
})();
