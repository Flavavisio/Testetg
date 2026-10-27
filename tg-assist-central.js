/* Presentation only: editing, notes, OS creation and persistence use Assist's existing handlers. */
(function () {
    'use strict';
    let selected = null, tenant = '', tab = 'details', closed = false, bound = false;
    const drafts = new Map();
    const el = id => document.getElementById(id);
    const esc = value => escapeHtmlSimples(String(value ?? ''));
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const mobile = () => matchMedia('(max-width:760px)').matches;
    const scoped = () => (dados.assistencias || []).filter(a => a.adminId === _tenantId() && !a.apagadoSuperAdmin);
    const current = () => scoped().find(a => a.id === selected);
    const badge = a => `<span class="ac-badge ${['aberta','andamento','resolvida','fechada'].includes(a.estado) ? a.estado : 'aberta'}">${esc((ASSIST_ESTADOS[a.estado] || ASSIST_ESTADOS.aberta).label)}</span>`;
    const priority = a => `<span class="ac-priority ${['urgente','alta','normal','baixa'].includes(a.prioridade) ? a.prioridade : 'normal'}">${a.prioridade === 'urgente' ? '● ' : ''}${esc((ASSIST_PRIORIDADES[a.prioridade] || ASSIST_PRIORIDADES.normal).label)}</span>`;
    const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Data não registada';
    const person = a => a.atribuidoId ? obterNomeFuncionario(a.atribuidoId) : 'Por atribuir';
    function initials(name) { const words = String(name || '').trim().split(/\s+/); return words.length > 1 ? (words[0][0] + words[words.length-1][0]).toUpperCase() : (words[0] || '—').slice(0,2).toUpperCase(); }
    function age(a) {
        if (!a.dataCriacao) return 'Data não registada';
        const hours = Math.max(0, Math.floor((Date.now()-a.dataCriacao)/3600000));
        return hours < 1 ? 'Criada há menos de 1h' : hours < 24 ? `Criada há ${hours}h` : `Criada há ${Math.floor(hours/24)} dia(s)`;
    }
    function options(id, entries, label) {
        const field = el(id), value = field.value;
        const sorted = [...entries].sort((a,b) => a[1].localeCompare(b[1],'pt'));
        const html = `<option value="">${label}</option>`+sorted.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
        if (field.innerHTML !== html) { field.innerHTML = html; field.value = value; }
    }
    function render() {
        if (!el('assistCentral')) return;
        if (tenant !== _tenantId()) { tenant = _tenantId(); selected = null; closed = false; drafts.clear(); }
        const all = scoped();
        const clients = new Map(), places = new Map(), people = new Map();
        all.forEach(a => {
            const summary = _assistResumoDados(a);
            if (a.clienteId) clients.set(a.clienteId,summary.cliente);
            places.set(summary.local,summary.local);
            if (a.atribuidoId) people.set(a.atribuidoId,person(a));
        });
        options('assistFiltroCliente',clients,'Todos os clientes');
        options('assistFiltroLocal',places,'Todas as instalações');
        options('assistFiltroTecnico',people,'Todos os técnicos');
        el('acMetrics').innerHTML = [
            [all.filter(a=>(a.estado||'aberta')==='aberta').length,'Abertas',''],
            [all.filter(a=>a.estado==='andamento').length,'Em atendimento',''],
            [all.filter(a=>a.estado==='resolvida').length,'Resolvidas',''],
            [all.filter(a=>a.prioridade==='urgente'&&!['resolvida','fechada'].includes(a.estado)).length,'Urgentes por tratar',' ac-urgent']
        ].map(([n,label,cls])=>`<div class="ac-metric${cls}"><strong>${n}</strong><span>${label}</span></div>`).join('');
        const q = normalize(el('assistPesquisa').value.trim());
        const filter = id => el(id).value;
        const list = all.filter(a => {
            const d = _assistResumoDados(a);
            return (!filter('assistFiltroEstado') || (a.estado||'aberta')===filter('assistFiltroEstado')) &&
                (!filter('assistFiltroPrioridade') || (a.prioridade||'normal')===filter('assistFiltroPrioridade')) &&
                (!filter('assistFiltroCliente') || a.clienteId===filter('assistFiltroCliente')) &&
                (!filter('assistFiltroLocal') || d.local===filter('assistFiltroLocal')) &&
                (!filter('assistFiltroTecnico') || a.atribuidoId===filter('assistFiltroTecnico')) &&
                (!q || normalize([a.numero,a.assunto,d.cliente,d.local,person(a)].join(' ')).includes(q));
        }).sort((a,b)=>(b.dataCriacao||0)-(a.dataCriacao||0));
        if (selected && !list.some(a=>a.id===selected)) selected = null;
        if (!selected && !closed && !mobile() && list.length) selected = list[0].id;
        el('acListCount').textContent = `${list.length} de ${all.length}`;
        el('acList').innerHTML = list.length ? list.map(a => {
            const d = _assistResumoDados(a), name=person(a);
            return `<button type="button" class="ac-request" data-ac-action="select" data-id="${esc(a.id)}" aria-pressed="${a.id===selected}">
                <span class="ac-row"><span class="ac-number">${esc(a.numero||'Assistência')}</span>${priority(a)}</span>
                <strong>${esc(d.cliente)}</strong><span class="ac-subject">${esc(a.assunto||'Sem assunto')}</span>
                <span class="ac-location"><i class="fas fa-location-dot" aria-hidden="true"></i> ${esc(d.local)}</span>
                <span class="ac-row"><span class="ac-person"><span class="ac-avatar" aria-hidden="true">${esc(a.atribuidoId ? initials(name) : '—')}</span>${esc(name)}</span>${badge(a)}</span>
                <span class="ac-age">${esc(age(a))}</span></button>`;
        }).join('') : `<div class="ac-empty"><i class="fas fa-inbox" aria-hidden="true"></i><strong>${all.length ? 'Sem resultados' : 'Ainda sem pedidos'}</strong>${all.length ? 'Experimenta ajustar os filtros ou a pesquisa.' : 'Cria uma assistência para começar o acompanhamento.'}</div>`;
        renderDetail();
        if (!bound) { el('assistCentral').addEventListener('click', action); el('assistCentral').addEventListener('input', event=>{if(event.target.id==='acNote')drafts.set(selected,event.target.value)}); bound=true; }
    }
    function timeline(a) {
        const events = [{text:'Pedido recebido',by:a.origem==='portal'?'Portal do Cliente':'Registo da assistência',time:a.dataCriacao}];
        const os=(dados.servicos||[]).find(s=>s.id===a.osGeradaId && s.adminId===a.adminId);
        if (os) events.push({text:`OS ${os.numeroRegisto||''} criada`,by:'Ordem de serviço associada',time:os.dataCriacao});
        (a.notas||[]).forEach(n=>events.push({text:n.texto,by:n.autor||'',time:n.data}));
        if (a.dataModificacao && a.dataModificacao!==a.dataCriacao) events.push({text:`Última atualização · ${(ASSIST_ESTADOS[a.estado]||ASSIST_ESTADOS.aberta).label}`,by:'Estado atual do pedido',time:a.dataModificacao});
        return `<ol class="ac-timeline">${events.sort((a,b)=>(b.time||0)-(a.time||0)).map(n=>`<li>${esc(n.text)}<small>${esc(n.by)} · ${esc(date(n.time))}</small></li>`).join('')}</ol>`;
    }
    function syncLayout() { document.body.classList.toggle('ac-mobile-detail',!!selected && mobile() && !!el('secao-assistencias')?.classList.contains('ativa')); }
    function renderDetail() {
        const a=current(), panel=el('acDetail');
        el('assistCentral').classList.toggle('ac-detail-open',!!a);
        syncLayout();
        panel.hidden=!a;el('acDetailEmpty').hidden=!!a;
        if (!a) { panel.innerHTML=''; return; }
        const d=_assistResumoDados(a), os=(dados.servicos||[]).find(s=>s.id===a.osGeradaId&&s.adminId===a.adminId);
        const contact=(dados.clientes||[]).find(c=>c.id===a.clienteId&&c.adminId===a.adminId);
        panel.innerHTML=`<header class="ac-detail-head"><div><button type="button" class="ac-mobile-back" data-ac-action="close">← Assistências</button><div class="ac-number">${esc(a.numero||'Assistência')} · ${esc(date(a.dataCriacao))}</div><h3 id="acDetailTitle">${esc(a.assunto||'Sem assunto')}</h3></div><button type="button" class="ac-close" data-ac-action="close" aria-label="Fechar assistência e voltar à lista">×</button></header>
        <div class="ac-detail-body"><div class="ac-client"><strong>${esc(d.cliente)}</strong><small><i class="fas fa-location-dot" aria-hidden="true"></i> ${esc(d.local)}</small><div class="ac-row" style="justify-content:flex-start">${badge(a)}${priority(a)}${a.origem==='portal'?'<span class="ac-badge aberta">Portal do Cliente</span>':''}</div></div>
        <div class="ac-tabs" role="tablist" aria-label="Informação da assistência"><button type="button" role="tab" id="acTabDetails" aria-controls="acTabPanel" aria-selected="${tab==='details'}" data-ac-action="details">Detalhes</button><button type="button" role="tab" id="acTabHistory" aria-controls="acTabPanel" aria-selected="${tab==='history'}" data-ac-action="history">Histórico <span>(${(a.notas||[]).length})</span></button></div>
        <div class="ac-content-grid"><div id="acTabPanel" role="tabpanel" aria-labelledby="${tab==='history'?'acTabHistory':'acTabDetails'}">${tab==='history'?`<section class="ac-history"><h4>Histórico do pedido</h4>${timeline(a)}</section>`:`<section class="ac-problem"><h4>Descrição do problema</h4><p class="ac-description">${esc(a.descricao||'Sem descrição adicional.')}</p><dl class="ac-facts"><div><dt>Técnico responsável</dt><dd>${esc(person(a))}</dd></div><div><dt>Pedido criado</dt><dd>${esc(date(a.dataCriacao))}</dd></div>${a.dataModificacao?`<div><dt>Última atualização</dt><dd>${esc(date(a.dataModificacao))}</dd></div>`:''}</dl></section>`}
        <section class="ac-note"><label for="acNote">Adicionar nota</label><textarea id="acNote" rows="3" placeholder="Regista o acompanhamento deste pedido…">${esc(drafts.get(a.id)||'')}</textarea><div id="acNotes" hidden></div><button type="button" class="btn btn-outline" data-ac-action="note"><i class="fas fa-plus" aria-hidden="true"></i> Guardar nota</button></section></div>
        <aside class="ac-actions" aria-label="Ações da assistência"><h4>Acompanhar pedido</h4>${a.osGeradaId?`<div class="ac-linked"><i class="fas fa-check-circle" aria-hidden="true"></i> OS associada<br><strong>${esc(os?.numeroRegisto||'OS criada')}</strong>${os?.data?`<br>${esc(os.data.split('-').reverse().join('/'))}${os.hora?' · '+esc(os.hora):''}`:''}</div>`:a.estado!=='fechada'?'<button type="button" class="btn btn-primary" data-ac-action="os"><i class="fas fa-helmet-safety" aria-hidden="true"></i> Criar OS</button>':''}
        <button type="button" class="btn btn-outline" data-ac-action="assign"><i class="fas fa-user-plus" aria-hidden="true"></i> ${a.atribuidoId?'Alterar técnico':'Atribuir técnico'}</button><button type="button" class="btn btn-outline" data-ac-action="edit"><i class="fas fa-pen" aria-hidden="true"></i> Editar pedido</button>${_assistContactosRapidosHTML(contact)}<button type="button" class="btn ac-delete" data-ac-action="delete"><i class="fas fa-trash" aria-hidden="true"></i> Eliminar assistência</button></aside></div></div>`;
    }
    async function action(event) {
        const button=event.target.closest('[data-ac-action]');if(!button)return;
        const name=button.dataset.acAction;
        if (name==='select') {
            const a=scoped().find(a=>a.id===button.dataset.id);if(!a)return;
            selected=a.id;closed=false;tab='details';render();
            if(mobile())el('acDetail').querySelector('.ac-close')?.focus({preventScroll:true});
            return;
        }
        if(name==='close') {
            const id=selected;selected=null;closed=true;render();
            [...el('acList').querySelectorAll('[data-id]')].find(b=>b.dataset.id===id)?.focus({preventScroll:true});return;
        }
        const a=current();if(!a)return;
        if(typeof _tgModuleAssertAccess === 'function') _tgModuleAssertAccess();
        if(name==='details'||name==='history'){tab=name;renderDetail();el(name==='history'?'acTabHistory':'acTabDetails').focus({preventScroll:true});return;}
        if(name==='edit'||name==='assign'){abrirModalAssistencia(a.id);if(name==='assign')el('assist_atribuido')?.focus();return;}
        if(name==='os'){if(!a.osGeradaId&&a.estado!=='fechada')criarOSDeAssistencia(a.id);return;}
        if(name==='delete'){excluirAssistencia(a.id);return;}
        if(name==='note'){
            if(!el('acNote').value.trim()) { el('acNote').focus();return; }
            button.disabled=true;
            try{await adicionarNotaAssistencia(a.id,'acNote','acNotes');drafts.delete(a.id);if(selected===a.id)renderDetail();}finally{if(button.isConnected)button.disabled=false;}
        }
    }
    window.addEventListener('resize',syncLayout);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected&&!document.querySelector('.modal-overlay.open'))el('acDetail').querySelector('[data-ac-action=close]')?.click()});
    window.TGAssistCentral=Object.freeze({render,syncLayout,hasDraft:()=>[...drafts.values()].some(value=>value.trim())});
})();
