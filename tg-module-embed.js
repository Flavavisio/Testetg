/* Shared presentation and host checks for the existing module pages. */
(function () {
    'use strict';
    const requested = new URLSearchParams(location.search).get('embedded') === '1';
    const embedded = requested && window.parent !== window;
    const name = document.documentElement.dataset.tgModule;
    let hostIdentity = '';
    function allowed() {
        if (!embedded) return !requested;
        try {
            const host = window.parent;
            if (host.location.origin !== location.origin || !host.TGModules?.authorizeFrame(name, window)) return false;
            return host.TGModules.allowed(name) && (!hostIdentity || hostIdentity === host.TGModules.identity());
        } catch (_) { return false; }
    }
    window._tgModuleAssertAccess = function () {
        if (!allowed()) throw new Error('O módulo já não está disponível para esta sessão ou licença.');
        if (embedded && typeof usuarioLogado !== 'undefined' && usuarioLogado) {
            const actor = JSON.stringify([usuarioLogado.adminId || usuarioLogado.id, usuarioLogado.id]);
            if (actor !== hostIdentity) throw new Error('A conta do módulo não corresponde à conta atual da aplicação.');
        }
    };
    window._tgModuleSaved = function (columns) {
        if (embedded && allowed()) window.parent.postMessage({type:'tg-module-saved', name, columns}, location.origin);
    };
    window._tgModuleEmbedded = embedded;
    if (embedded) {
        try { hostIdentity = window.parent.TGModules?.identity() || ''; } catch (_) {}
        document.documentElement.classList.add('tg-module-embedded');
        document.addEventListener('DOMContentLoaded', () => {
            try { document.body.classList.toggle('dark-mode', window.parent.document.body.classList.contains('dark-mode')); } catch (_) {}
            document.addEventListener('click', event => {
                const link = event.target.closest('a[href]');
                if (!link || !/\/(?:index|login)\.html$/.test(new URL(link.href).pathname)) return;
                event.preventDefault();
                try { window.parent.irParaInicio(); } catch (_) {}
            });
        });
    }
})();
