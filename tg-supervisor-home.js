/* Teste TG: the supervisor's operational home always uses the current assigned team. */
(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const assignments = os => Array.isArray(os.funcionariosIds) && os.funcionariosIds.length ? os.funcionariosIds : [os.funcionarioId].filter(Boolean);
    function scope(adminId) {
        if (typeof usuarioLogado === 'undefined' || usuarioLogado?.role !== 'encarregado') return null;
        const enc = (dados.encarregados || []).find(e => e.id === usuarioLogado.id && e.adminId === adminId);
        if (!enc || enc.suspenso || usuarioLogado.adminId !== adminId) return null;
        const ids = new Set(enc.funcionariosIds || []), unique = new Map();
        for (const f of dados.funcionarios || []) {
            if (f.adminId === adminId && ids.has(f.id) && f.id !== enc.id && !['admin','superadmin'].includes(f.role)) unique.set(f.id, f);
        }
        const people = [...unique.values()].sort((a,b) => String(a.nome || '').localeCompare(String(b.nome || ''),'pt',{sensitivity:'base'}));
        return { adminId, enc, people, ids: new Set([enc.id, ...people.map(p => p.id)]) };
    }
    function people(adminId, includeSelf = false) {
        const s = scope(adminId);
        return s ? (includeSelf ? [s.enc, ...s.people] : s.people) : [];
    }
    function personState(s, person, today, records) {
        if (person.suspenso) return {label:'Suspenso', color:'#64748b', active:false};
        const name = id => (dados.clientes || []).find(c => c.id === id && c.adminId === s.adminId)?.nome || '';
        const state = _estadoPresencaPessoa(person.id, today, records, name);
        return {label:state.label, color:state.cor, active:state.ativo};
    }
    function dailyOS(s, today) {
        return (dados.servicos || []).filter(os => os.adminId === s.adminId && os.data === today && !normal(os.status).startsWith('cancelad') && assignments(os).some(id => s.ids.has(id)))
            .sort((a,b) => String(a.hora || '99:99').localeCompare(String(b.hora || '99:99')));
    }
    function html(adminId, today) {
        const s = scope(adminId);
        if (!s) return '';
        const records = Object.fromEntries(['ponto','obraPontoLonga','servicos','obras','pedidos'].map(key => [key, (dados[key] || []).filter(row => row.adminId === s.adminId)]));
        const states = s.people.map(p => ({person:p, state:personState(s,p,today,records)}));
        const active = states.filter(row => row.state.active).length;
        const names = new Map([[s.enc.id, s.enc.nome], ...s.people.map(p => [p.id,p.nome])]);
        const teamRows = states.map(({person:p,state:e}) => `<div class="tgm-equipa-linha tgs-person" data-supervisor-person="${esc(p.id)}">
            <span class="tgm-equipa-dot" style="background:${e.color};"></span><span class="tgm-equipa-nome">${esc(p.nome)}</span>
            <span class="tgm-equipa-estado" style="color:${e.color};">${esc(e.label)}</span></div>`).join('');
        const jobs = dailyOS(s,today).map(os => {
            const state = normal(os.status);
            const done = ['concluido','concluida','terminado','terminada'].includes(state);
            const label = done ? 'Concluída' : state === 'em andamento' ? 'Em andamento' : state === 'stand by' ? 'Stand by' : 'Pendente';
            const color = done ? '#15803d' : state === 'em andamento' ? '#b45309' : '#64748b';
            const client = (dados.clientes || []).find(c => c.id === os.clienteId && c.adminId === s.adminId);
            const assigned = [...new Set(assignments(os).filter(id => s.ids.has(id)))].map(id => names.get(id)).filter(Boolean).join(', ');
            return `<button type="button" class="tgm-resumo-linha tgs-os" data-supervisor-os="${esc(os.id)}">
                <span class="tgm-mono tgm-resumo-hora">${esc(os.hora || '--:--')}</span>
                <span class="tgm-resumo-txt"><strong>${esc(client?.nome || os.numeroRegisto || 'OS')}</strong><span class="tgs-assigned">${esc(assigned)}</span></span>
                <span class="tgm-resumo-badge" style="background:${color};">${label}</span></button>`;
        }).join('');
        return `<div class="tgm-panel tgm-panel--admin tgs-supervisor-panel" aria-label="Estado da minha equipa">
            <div class="tgm-eyebrow">Só a equipa atribuída a ti</div>
            <div class="tgm-title tgm-title--sm"><i class="fas fa-users"></i> A minha equipa agora</div>
            <div class="tgs-counts"><span>${s.people.length} ${s.people.length === 1 ? 'pessoa atribuída' : 'pessoas atribuídas'}</span><span>${active} em serviço</span></div>
            <div class="tgs-team-list">${teamRows || '<p class="tgm-vazio">Ainda não tens funcionários atribuídos.</p>'}</div>
            <p class="tgs-note">Estado com base nas picagens de hoje.</p>
        </div><div class="tgm-panel tgm-panel--equipa tgs-supervisor-panel" aria-label="Ordens de serviço da minha equipa">
            <div class="tgm-eyebrow">O teu trabalho e o da tua equipa</div>
            <div class="tgm-title tgm-title--sm"><i class="fas fa-calendar-day"></i> OS da equipa hoje</div>
            <div class="tgm-resumo-lista">${jobs || '<p class="tgm-vazio">Sem OS atribuídas a ti ou à tua equipa para hoje.</p>'}</div>
        </div>`;
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-supervisor-os]');
        if (!button || usuarioLogado?.role !== 'encarregado') return;
        const s = scope(usuarioLogado.adminId), today = getDataHoje();
        if (s && dailyOS(s,today).some(os => os.id === button.dataset.supervisorOs)) abrirVerOS(button.dataset.supervisorOs);
    });
    window.TGSupervisorHome = {html, people};
}());
