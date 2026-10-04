/* Internal module workspace. Reuses module pages and their existing persistence. */
(function () {
    'use strict';
    const modules = {
        crm: { title: 'CRM Comercial', page: 'TOTALGEST_CRM.html', roles: ['admin','subadmin','vendedor'] },
        assistencias: { title: 'Assistências', page: 'TOTALGEST_ASSIST.html', roles: ['admin','subadmin'] }
    };
    const frames = new Map();
    let pending = null;
    const identity = () => typeof usuarioLogado === 'undefined' || !usuarioLogado ? '' : JSON.stringify([usuarioLogado.adminId || usuarioLogado.id, usuarioLogado.id]);
    function allowed(name) {
        const mod = modules[name];
        if (!mod || typeof usuarioLogado === 'undefined' || !mod.roles.includes(usuarioLogado?.role)) return false;
        if (typeof _licencaValidaTenant !== 'function' || !_licencaValidaTenant()) return false;
        const admin = adminDoUtilizador();
        if (!(name === 'crm' ? moduloCrmAtivo(admin) : moduloAssistAtivo(admin))) return false;
        const card = document.querySelector(`#cardsGrid .card-principal[data-card="${name}"]`);
        return !!card && !card.hidden && !card.classList.contains('hidden-card') && !card.classList.contains('card-bloqueado');
    }
    function prepare(name) {
        if (!allowed(name)) {
            alert('Este módulo não está disponível no pack/licença desta empresa ou para o seu perfil.');
            return false;
        }
        const mod = modules[name];
        let section = document.getElementById('secao-' + name);
        if (!section) {
            section = document.createElement('section'); section.id = 'secao-' + name;
            section.className = 'section-container tg-integrated-module';
            section.setAttribute('aria-label', mod.title);
            const head = document.createElement('div'); head.className = 'tg-module-heading';
            const title = document.createElement('h2'); title.textContent = mod.title;
            const back = document.createElement('button'); back.type = 'button'; back.className = 'btn btn-outline';
            back.textContent = 'Voltar ao início'; back.addEventListener('click', () => irParaInicio());
            head.append(title, back); section.appendChild(head); document.body.appendChild(section);
        }
        const params = new URLSearchParams({embedded:'1', v:'1.0.0'});
        if (name === 'assistencias' && pending?.name === name && pending.id) params.set('criarOS', pending.id);
        pending = null;
        const src = mod.page + '?' + params;
        let state = frames.get(name);
        let hasDraft = false;
        try { hasDraft = !!state && (!!state.frame.contentWindow._tgModuleUnsynced || !!state.frame.contentDocument.querySelector('.modal-overlay.open')); } catch (_) {}
        if (state && (state.identity !== identity() || state.src !== src || (!section.classList.contains('active') && !hasDraft))) { state.frame.remove(); frames.delete(name); state = null; }
        if (!state) {
            const frame = document.createElement('iframe'); frame.className = 'tg-module-frame';
            frame.title = mod.title; frame.src = src;
            section.appendChild(frame);
            state = { frame, src, identity: identity(), name }; frames.set(name, state);
            frame.addEventListener('load', () => {
                if (!allowed(name) || state.identity !== identity()) { validate(); return; }
                try { frame.contentDocument.body.classList.toggle('dark-mode', document.body.classList.contains('dark-mode')); } catch (_) {}
            });
        }
        return true;
    }
    function open(name, id) {
        if (!allowed(name)) { prepare(name); return false; }
        pending = { name, id: typeof id === 'string' ? id : '' };
        if (document.getElementById('wsClienteOverlay')?.classList.contains('open')) _wsClienteFechar();
        abrirSecao(name);
        return false;
    }
    function validate() {
        for (const [name, state] of frames) {
            if (!allowed(name) || state.identity !== identity()) {
                state.frame.remove(); frames.delete(name);
                const section = document.getElementById('secao-' + name);
                const wasActive = section?.classList.contains('active'); section?.classList.remove('active');
                if (wasActive && typeof usuarioLogado !== 'undefined' && usuarioLogado && usuarioLogado.role !== 'cliente') irParaInicio();
            } else {
                try { state.frame.contentDocument.body.classList.toggle('dark-mode', document.body.classList.contains('dark-mode')); } catch (_) {}
            }
        }
    }
    // Calls only from our same-origin, current account frame; no credentials are exchanged.
    function authorizeFrame(name, source) {
        const state = frames.get(name);
        return !!state && state.frame.contentWindow === source && state.identity === identity() && allowed(name);
    }
    window.addEventListener('message', async event => {
        if (event.origin !== location.origin || event.data?.type !== 'tg-module-saved') return;
        const {name, columns} = event.data;
        if (!authorizeFrame(name, event.source) || !Array.isArray(columns)) return;
        if (typeof _contarAlteracoesPendentes !== 'function' || _contarAlteracoesPendentes() > 0 || document.querySelector('.modal-overlay.open')) return;
        const permitted = ['clientes','servicos','notificacoes','assistencias','leads','oportunidades','propostas','atividadesComerciais','contratos','equipamentos','artigos','fornecedores','obras','encomendas','encomendaItens','obraMateriais'];
        const cols = [...new Set(columns)].filter(col => permitted.includes(col));
        if (!cols.length) return;
        try {
            await Promise.all(cols.map(col => carregarTabelaEspecifica(col)));
            if (authorizeFrame(name, event.source)) renderizarTudo();
        } catch (error) { console.warn('Atualização após guardar o módulo:', error); }
    });
    document.addEventListener('tg:interface-updated', validate);
    new MutationObserver(validate).observe(document.body, {attributes:true, attributeFilter:['class']});
    setInterval(validate, 15000);
    window.TGModules = {open, prepare, allowed, authorizeFrame, validate, identity};
})();
