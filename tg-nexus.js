/* Total Gest Nexus: adaptive workspace. Actions delegate to existing permission gates. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const user = () => typeof usuarioLogado !== 'undefined' ? usuarioLogado : null;
    const active = () => !!user() && user().role !== 'cliente' && typeof obterLayout === 'function' && obterLayout() === 'aurora';
    const key = () => 'tg_nexus:' + JSON.stringify([user()?.adminId || user()?.id, user()?.id]);
    const read = () => { try { return JSON.parse(localStorage.getItem(key())) || {}; } catch (_) { return {}; } };
    const save = value => { try { localStorage.setItem(key(), JSON.stringify(value)); return true; } catch (_) { return false; } };
    const defaultShortcuts = ['clientes','servicos','assistencias','agenda','obras-longa','relatorio-os'];
    let shortcutDraft = [], shortcutScope = '';
    function shortcutIds(all, prefs = read()) {
        const requested = Array.isArray(prefs.shortcuts) ? prefs.shortcuts : defaultShortcuts;
        const available = new Set(all.map(e => e.id));
        return [...new Set([...requested, ...defaultShortcuts, ...all.map(e => e.id)])].filter(id => available.has(id)).slice(0, 6);
    }
    const shortcutName = e => e.id === 'agenda' ? 'Agenda de equipa' : e.name;
    const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let opener = null, selection = 0, scope = '', observerPending = false;
    function allowed(card) {
        return card && !card.classList.contains('hidden-card') && !card.classList.contains('card-bloqueado') && !card.hidden && card.style.display !== 'none';
    }
    function entries() {
        if (!active() || (typeof _licencaValidaTenant === 'function' && !_licencaValidaTenant())) return [];
        const seen = new Set();
        return [...document.querySelectorAll('#cardsGrid .card-principal[data-card]')].filter(card => {
            const id = card.dataset.card;
            if (!allowed(card) || seen.has(id)) return false;
            seen.add(id); return true;
        }).map(card => ({
            id: card.dataset.card,
            name: card.querySelector('.info h3')?.textContent.trim() || card.dataset.card,
            subtitle: card.querySelector('.info p')?.textContent.trim() || 'Abrir módulo',
            group: card.closest('.grupo-cards')?.querySelector('.grupo-header h3')?.textContent.trim() || 'Gestão',
            icon: card.querySelector('.icon i')?.className || 'fas fa-layer-group'
        }));
    }
    function go(id) {
        if (!active()) return;
        const entry = entries().find(e => e.id === id);
        if (!entry) { refresh(); if ($('nexusSearchDialog')?.open) results(); return; }
        const card = [...document.querySelectorAll('#cardsGrid .card-principal')].find(c => c.dataset.card === id && allowed(c));
        if (!card) return;
        close();
        const prefs = read(); prefs.recent = [id, ...(Array.isArray(prefs.recent) ? prefs.recent : []).filter(i => i !== id)].slice(0, 6); save(prefs);
        // Keeps CRM/Assist separate tabs, report handlers and the original module checks.
        card.click();
        if (typeof _fecharSidebarMobile === 'function') _fecharSidebarMobile();
    }
    function results() {
        const list = $('nexusResults'); if (!list) return;
        const terms = clean($('nexusQuery').value).trim().split(/\s+/).filter(Boolean);
        const prefs = read(), recent = Array.isArray(prefs.recent) ? prefs.recent : [];
        const all = entries().filter(e => terms.every(t => clean(e.name + ' ' + e.group + ' ' + e.subtitle).includes(t)));
        if (!terms.length) all.sort((a,b) => {
            const rank = id => recent.includes(id) ? recent.indexOf(id) : 99;
            return rank(a.id) - rank(b.id);
        });
        selection = 0;
        list.innerHTML = all.map(e => `<button type="button" class="nx-result" data-nx-open="${esc(e.id)}"><i class="${esc(e.icon)}" aria-hidden="true"></i><span><strong>${esc(e.name)}</strong><small>${esc(e.group)} · ${esc(e.subtitle)}</small></span><i class="fas fa-arrow-right" aria-hidden="true"></i></button>`).join('') || '<p class="nx-empty">Nenhum módulo encontrado. Experimente outro termo.</p>';
        $('nexusResultCount').textContent = `${all.length} módulo${all.length === 1 ? '' : 's'} disponível${all.length === 1 ? '' : 'is'}`;
        highlight();
    }
    function highlight() {
        const buttons = [...$('nexusResults').querySelectorAll('button')];
        selection = Math.max(0, Math.min(selection, buttons.length - 1));
        buttons.forEach((b,i) => b.classList.toggle('nx-selected', i === selection));
    }
    function open() {
        if (!active()) return;
        ensureDialog();
        opener = document.activeElement;
        const dialog = $('nexusSearchDialog');
        $('nexusQuery').value = ''; results();
        if (!dialog.open) dialog.showModal();
        $('nexusQuery').focus();
    }
    function close() { const dialog = $('nexusSearchDialog'); if (dialog?.open) dialog.close(); }
    function closeShortcuts() { const dialog = $('nexusShortcutsDialog'); if (dialog?.open) dialog.close(); }
    function renderShortcuts() {
        const all = entries();
        $('nexusShortcutRows').innerHTML = shortcutDraft.map((id, i) => `<div class="nx-shortcut-row"><label for="nexusSlot${i}">${i + 1}</label><select id="nexusSlot${i}" data-nx-slot="${i}" aria-label="Módulo na posição ${i + 1}">${all.map(e => `<option value="${esc(e.id)}"${id === e.id ? ' selected' : ''}${id !== e.id && shortcutDraft.includes(e.id) ? ' disabled' : ''}>${esc(shortcutName(e))}</option>`).join('')}</select><button type="button" data-nx-move="${i}" data-nx-direction="-1" aria-label="Mover posição ${i + 1} para cima"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-nx-move="${i}" data-nx-direction="1" aria-label="Mover posição ${i + 1} para baixo"${i === shortcutDraft.length - 1 ? ' disabled' : ''}>↓</button></div>`).join('') || '<p class="nx-empty">Não existem módulos disponíveis.</p>';
        $('nexusShortcutsSave').disabled = !shortcutDraft.length;
    }
    function openShortcuts() {
        if (!active()) return;
        close();
        let d = $('nexusShortcutsDialog');
        if (!d) {
            d = document.createElement('dialog'); d.id = 'nexusShortcutsDialog'; d.className = 'nx-dialog';
            d.setAttribute('aria-labelledby', 'nexusShortcutsTitle');
            d.innerHTML = '<div class="nx-dialog-head"><div><span class="nx-eyebrow">O SEU INÍCIO</span><h2 id="nexusShortcutsTitle">Personalizar atalhos</h2></div><button type="button" data-nx-shortcuts-close aria-label="Fechar personalização">×</button></div><p class="nx-shortcuts-help">Escolha os seis módulos e use as setas para mudar a posição. A ordem é da esquerda para a direita, de cima para baixo.</p><div id="nexusShortcutRows"></div><p id="nexusShortcutsStatus" role="status"></p><div class="nx-shortcut-actions"><button type="button" data-nx-shortcuts-reset>Repor padrão</button><button type="button" data-nx-shortcuts-close>Cancelar</button><button type="button" id="nexusShortcutsSave" data-nx-shortcuts-save>Guardar</button></div>';
            document.body.appendChild(d);
            d.addEventListener('click', e => { if (e.target === d) closeShortcuts(); });
            d.addEventListener('change', e => {
                const slot = e.target.closest('[data-nx-slot]'); if (!slot) return;
                const index = Number(slot.dataset.nxSlot), id = slot.value;
                if (entries().some(e => e.id === id) && !shortcutDraft.some((value, i) => value === id && i !== index)) shortcutDraft[index] = id;
                renderShortcuts(); $('nexusSlot' + index)?.focus();
            });
        }
        shortcutDraft = shortcutIds(entries()); shortcutScope = key();
        $('nexusShortcutsStatus').textContent = ''; renderShortcuts();
        if (!d.open) d.showModal();
    }
    function ensureDialog() {
        if ($('nexusSearchDialog')) return;
        const d = document.createElement('dialog'); d.id = 'nexusSearchDialog'; d.className = 'nx-dialog';
        d.setAttribute('aria-labelledby', 'nexusSearchTitle');
        d.innerHTML = '<div class="nx-dialog-head"><div><span class="nx-eyebrow">NAVEGAÇÃO RÁPIDA</span><h2 id="nexusSearchTitle">Onde quer ir?</h2></div><button type="button" data-nx-close aria-label="Fechar pesquisa"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><label class="nx-query"><i class="fas fa-search" aria-hidden="true"></i><input id="nexusQuery" type="search" placeholder="Pesquisar serviços, clientes, relatórios…" aria-label="Pesquisar módulos" autocomplete="off"></label><div class="nx-dialog-meta"><span id="nexusResultCount" role="status"></span><span>↑ ↓ escolher · Enter abrir</span></div><div id="nexusResults" class="nx-results"></div>';
        document.body.appendChild(d);
        d.addEventListener('close', () => { if (opener?.isConnected && active()) opener.focus(); opener = null; });
        d.addEventListener('click', e => { if (e.target === d) close(); });
        $('nexusQuery').addEventListener('input', results);
        $('nexusQuery').addEventListener('keydown', e => {
            const buttons = [...$('nexusResults').querySelectorAll('button')];
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault(); selection += e.key === 'ArrowDown' ? 1 : -1; highlight(); buttons[selection]?.scrollIntoView({block:'nearest'});
            } else if (e.key === 'Enter') { e.preventDefault(); if (buttons[selection]) go(buttons[selection].dataset.nxOpen); }
        });
    }
    function compactPanels() {
        document.querySelectorAll('#tgHome .tgm-panel').forEach((panel,i) => {
            const title = panel.querySelector('.tgm-title'); if (!title) return;
            const panelKey = [...panel.classList].find(c => c.startsWith('tgm-panel--')) || 'panel-' + i;
            const collapsed = Array.isArray(read().collapsed) && read().collapsed.includes(panelKey);
            panel.classList.toggle('nx-folded', collapsed);
            let button = title.querySelector('[data-nx-fold]');
            if (!button) {
                button = document.createElement('button'); button.type = 'button'; button.dataset.nxFold = panelKey;
                title.appendChild(button);
            }
            button.setAttribute('aria-label', (collapsed ? 'Expandir ' : 'Recolher ') + title.textContent.trim());
            button.setAttribute('aria-expanded', String(!collapsed));
            button.innerHTML = '<i class="fas fa-chevron-' + (collapsed ? 'down' : 'up') + '" aria-hidden="true"></i>';
        });
    }
    function refresh() {
        const enabled = active();
        document.body.classList.toggle('tg-nexus', enabled);
        if (!enabled) {
            close(); closeShortcuts(); scope = '';
            document.querySelectorAll('.nx-folded').forEach(p => p.classList.remove('nx-folded'));
            return;
        }
        if (scope !== key()) { close(); closeShortcuts(); scope = key(); }
        document.body.classList.toggle('nx-comfortable', read().density === 'comfortable');
        const home = $('tgHome');
        if (home) {
            let workspace = $('nexusWorkspace');
            if (!workspace) { workspace = document.createElement('div'); workspace.id = 'nexusWorkspace'; home.prepend(workspace); }
            const all = entries();
            const prefs = read();
            const chosen = shortcutIds(all, prefs).map(id => all.find(e => e.id === id));
            const date = new Date().toLocaleDateString('pt-PT', {weekday:'long',day:'numeric',month:'long'});
            const html = `<div class="nx-workspace-head"><div><span class="nx-eyebrow">TOTAL GEST <span class="nx-brand-tag">NEXUS</span></span><h1>A sua operação, à vista.</h1><p>${esc(date)}</p></div><div class="nx-tools"><button type="button" class="nx-search" data-nx-search><i class="fas fa-search" aria-hidden="true"></i><span>Procurar módulo</span><kbd>Ctrl K</kbd></button><button type="button" class="nx-density" data-nx-density aria-label="Alterar densidade da informação" aria-pressed="${prefs.density !== 'comfortable'}" title="Alternar entre compacto e espaçoso"><i class="fas fa-sliders" aria-hidden="true"></i><span>${prefs.density === 'comfortable' ? 'Espaçoso' : 'Compacto'}</span></button></div></div><div class="nx-shortcut-toolbar"><button type="button" data-nx-shortcuts>Personalizar atalhos</button></div><div class="nx-overview">${chosen.map((e,i) => `<button type="button" class="nx-module nx-tone-${i % 3}" data-nx-open="${esc(e.id)}"><span class="nx-module-top"><i class="${esc(e.icon)}" aria-hidden="true"></i><i class="fas fa-arrow-up-right-from-square nx-arrow" aria-hidden="true"></i></span><strong>${esc(shortcutName(e))}</strong><small>${esc(e.subtitle)}</small></button>`).join('')}</div>`;
            // Avoid replacing a focused control on background refreshes.
            if (workspace.dataset.content !== html) { workspace.innerHTML = html; workspace.dataset.content = html; }
        }
        const brand = document.querySelector('#tgSidebar .tg-side-brand');
        if (brand && !$('nexusSideSearch')) {
            const button = document.createElement('button'); button.id = 'nexusSideSearch'; button.type = 'button'; button.className = 'nx-side-search'; button.dataset.nxSearch = '';
            button.innerHTML = '<i class="fas fa-search" aria-hidden="true"></i><span>Pesquisa rápida</span>'; button.title = 'Pesquisa rápida (Ctrl K)'; brand.after(button);
        }
        document.querySelectorAll('#tgSidebarNav a.tg-nav-item:not([href])').forEach(link => {
            link.setAttribute('role', 'button'); link.tabIndex = 0;
            if (!link.dataset.nxKeyboard) {
                link.dataset.nxKeyboard = '1'; link.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); link.click(); } });
            }
        });
        const favorites = $('homeFavoritos');
        if (favorites?.children.length && !favorites.querySelector('details.nx-favorites')) {
            const details = document.createElement('details'); details.className = 'nx-favorites';
            const summary = document.createElement('summary'); summary.textContent = 'Os meus favoritos'; details.appendChild(summary);
            while (favorites.firstChild) details.appendChild(favorites.firstChild);
            details.open = !!read().favoritesOpen;
            details.addEventListener('toggle', () => { if (active()) { const prefs = read(); prefs.favoritesOpen = details.open; save(prefs); } });
            favorites.appendChild(details);
        }
        compactPanels();
        if ($('nexusSearchDialog')?.open) results();
    }
    document.addEventListener('click', e => {
        if (!active()) return;
        if (e.target.closest('[data-nx-shortcuts]')) openShortcuts();
        if (e.target.closest('[data-nx-shortcuts-close]')) closeShortcuts();
        if (e.target.closest('[data-nx-shortcuts-reset]')) {
            shortcutDraft = shortcutIds(entries(), {}); renderShortcuts();
            $('nexusShortcutsStatus').textContent = 'Padrão reposto. Clique em Guardar para aplicar.';
        }
        const move = e.target.closest('[data-nx-move]');
        if (move) {
            const from = Number(move.dataset.nxMove), to = from + Number(move.dataset.nxDirection);
            if (to >= 0 && to < shortcutDraft.length) {
                [shortcutDraft[from], shortcutDraft[to]] = [shortcutDraft[to], shortcutDraft[from]];
                renderShortcuts();
                $('nexusShortcutRows').querySelector(`[data-nx-move="${to}"][data-nx-direction="${move.dataset.nxDirection}"]`)?.focus();
            }
        }
        if (e.target.closest('[data-nx-shortcuts-save]')) {
            if (shortcutScope !== key()) { closeShortcuts(); return; }
            const valid = shortcutIds(entries(), {shortcuts: shortcutDraft});
            if (valid.length !== shortcutDraft.length || valid.some((id, i) => id !== shortcutDraft[i])) {
                shortcutDraft = valid; renderShortcuts();
                $('nexusShortcutsStatus').textContent = 'Os módulos disponíveis mudaram. Confirme a nova seleção.'; return;
            }
            const prefs = read(); prefs.shortcuts = [...shortcutDraft];
            if (save(prefs)) { closeShortcuts(); refresh(); }
            else $('nexusShortcutsStatus').textContent = 'Não foi possível guardar. Verifique o armazenamento do navegador e tente novamente.';
        }
        if (e.target.closest('[data-nx-search]')) open();
        const entry = e.target.closest('[data-nx-open]'); if (entry) go(entry.dataset.nxOpen);
        if (e.target.closest('[data-nx-close]')) close();
        if (e.target.closest('[data-nx-density]')) {
            const prefs = read(); prefs.density = prefs.density === 'comfortable' ? 'compact' : 'comfortable'; save(prefs); refresh();
        }
        const fold = e.target.closest('[data-nx-fold]');
        if (fold) {
            const prefs = read(), list = Array.isArray(prefs.collapsed) ? prefs.collapsed : [], id = fold.dataset.nxFold;
            prefs.collapsed = list.includes(id) ? list.filter(x=>x!==id) : [...list,id]; save(prefs); compactPanels();
        }
    });
    document.addEventListener('keydown', e => {
        if (active() && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    });
    // Hooks follow the existing renderer; no separate data loader or business logic.
    for (const name of ['renderizarHomeDashboard','construirSidebar','renderizarOMeuDia','atualizarUsuarioDisplay']) {
        if (typeof window[name] === 'function') {
            const original = window[name];
            window[name] = function (...args) { const result = original.apply(this,args); refresh(); return result; };
        }
    }
    // Session/layout changes can also happen without a home render.
    new MutationObserver(() => {
        if (observerPending) return;
        observerPending = true; queueMicrotask(() => { observerPending = false; if (active() !== document.body.classList.contains('tg-nexus')) refresh(); });
    }).observe(document.body, {attributes:true,attributeFilter:['class']});
    window.TGNexus = {refresh, open, close};
    refresh();
})();
