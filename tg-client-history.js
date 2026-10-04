/* Read-only customer timeline, scoped to the current company and customer. */
(function () {
    'use strict';
    let current = null, sequence = 0;
    const kinds = {os:['Ordens de serviço','fa-wrench'],assist:['Assistências','fa-headset'],obra:['Obras','fa-hard-hat'],contrato:['Contratos','fa-file-contract'],relatorio:['Relatórios','fa-file-signature'],crm:['Comercial','fa-handshake']};
    const actor = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const identity = () => JSON.stringify([actor()?.adminId || actor()?.id, actor()?.id]);
    function scope(id) {
        const user = actor();
        if (!user || !['admin','subadmin'].includes(user.role) || !_licencaValidaTenant()) return null;
        const tenant = user.adminId || user.id;
        const customer = (dados.clientes || []).find(c => c.id === id && c.adminId === tenant);
        if (!customer) return null;
        const admin = adminDoUtilizador();
        return {id, tenant, customer, identity:identity(), assist:moduloAssistAtivo(admin), obras:moduloArmazemAtivo(admin), contratos:moduloContratosAtivo(admin), crm:moduloCrmAtivo(admin), especialidade:admin?.segurancaAtivo === true};
    }
    const date = value => {
        if (!value) return '';
        const d = new Date(typeof value === 'number' ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value+'T12:00:00' : value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
    };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clean = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function events(s, data, services) {
        const belongs = r => r.adminId === s.tenant && r.clienteId === s.id && !r.apagadoSuperAdmin;
        const result = [];
        const add = (kind,r,title,description,when,status,action) => result.push({kind,id:r.id,title,description:description||'',date:date(when),status:status||'',action,row:r});
        services.filter(belongs).forEach(r=>add('os',r,'OS '+(r.numeroRegisto||'—'),r.descricao,r.data,r.status,'os'));
        if(s.assist) (data.assistencias||[]).filter(belongs).forEach(r=>add('assist',r,'Assistência '+(r.numero||'—'),r.assunto||r.descricao,r.dataCriacao,r.estado,'assist'));
        if(s.obras) (data.obras||[]).filter(belongs).forEach(r=>add('obra',r,r.nome||'Obra',r.observacoes,r.dataConclusao||r.dataCriacao||r.dataInicioPrevista,r.estado,'obra'));
        if(s.contratos) (data.contratos||[]).filter(belongs).forEach(r=>add('contrato',r,'Contrato '+(r.numero||'—'),r.nome||r.observacoes,r.dataCriacao,r.ativo===false?'Inativo':'Ativo','contrato'));
        (data.relatoriosEspecialidade||[]).filter(belongs).filter(r=>String(r.tipo||'').startsWith('CUSTOM_')||s.especialidade).forEach(r=>add('relatorio',r,(String(r.tipo||'').startsWith('CUSTOM_')?'Relatório personalizado':'Relatório de especialidade')+' '+(r.numeroDocumento||''),r.tipo,r.data||r.criadoEm,r.rascunho?'Rascunho':'Emitido',r.rascunho?'':'relatorio'));
        if(s.crm) {
            const opportunities=(data.oportunidades||[]).filter(belongs), ids=new Set(opportunities.map(r=>r.id));
            opportunities.forEach(r=>add('crm',r,r.nome||'Oportunidade comercial',r.descricao,r.dataFecho||r.dataCriacao,r.estado,'crm'));
            (data.propostas||[]).filter(r=>!r.apagadoSuperAdmin&&r.adminId===s.tenant&&(r.clienteId===s.id||ids.has(r.oportunidadeId))).forEach(r=>add('crm',r,'Proposta '+(r.numero||'—'),r.produtosServicos||r.observacoes,r.dataEnvio||r.dataCriacao,r.estado,'crm'));
        }
        return result.sort((a,b)=>b.date.localeCompare(a.date)||a.kind.localeCompare(b.kind)||String(a.id).localeCompare(String(b.id)));
    }
    function visible(state) {
        const overlay=document.getElementById('wsClienteOverlay');
        return current===state && state.sequence===sequence && identity()===state.scope.identity && !!scope(state.scope.id) && overlay?.classList.contains('open') && overlay.dataset.clienteAtual===state.scope.id && window._wsAbaAtual==='historico';
    }
    function render() {
        const state=current;if(!state||!visible(state))return;
        const permitted=scope(state.scope.id);
        // Recompute on every filter/action so a revoked add-on immediately loses its records.
        state.events=events(permitted,dados,state.services);
        const root=document.getElementById('tgCustomerHistory');if(!root)return;
        const term=clean(root.querySelector('[data-history-search]')?.value);
        const kind=root.querySelector('[data-history-type]')?.value||'';
        const from=root.querySelector('[data-history-from]')?.value||'';
        const to=root.querySelector('[data-history-to]')?.value||'';
        const list=state.events.filter(e=>(!kind||e.kind===kind)&&(!from||e.date>=from)&&(!to||e.date&&e.date<=to)&&clean(e.title+' '+e.description+' '+e.status).includes(term));
        root.querySelector('[data-history-count]').textContent=list.length+' registo'+(list.length===1?'':'s');
        let month='';
        root.querySelector('[data-history-events]').innerHTML=list.slice(0,state.limit).map(e=>{
            const key=e.date.slice(0,7), heading=key!==month?`<h3 class="tg-history-month">${e.date?esc(new Date(e.date+'T12:00:00').toLocaleDateString('pt-PT',{month:'long',year:'numeric'})):'Sem data registada'}</h3>`:'';month=key;
            return `${heading}<article class="tg-history-event tg-history-${e.kind}"><span class="tg-history-icon"><i class="fas ${kinds[e.kind][1]}" aria-hidden="true"></i></span><div class="tg-history-record"><div class="tg-history-meta"><span>${kinds[e.kind][0]}</span><time datetime="${esc(e.date)}">${e.date?esc(e.date.split('-').reverse().join('/')):'Sem data'}</time></div><h4>${esc(e.title)}</h4>${e.description?`<p>${esc(e.description)}</p>`:''}<span class="tg-history-status">${esc(e.status||'Registado')}</span></div>${e.action?`<button type="button" class="btn btn-outline" data-history-open="${esc(e.kind+':'+e.id)}">${e.action==='crm'?'Abrir CRM':e.action==='assist'?'Abrir Assistências':'Ver registo'}</button>`:''}</article>`;
        }).join('')||'<div class="tg-history-empty"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i><h3>Sem registos para estes filtros</h3><p>Altere a pesquisa, o tipo ou as datas.</p></div>';
        root.querySelector('[data-history-more]').hidden=list.length<=state.limit;
    }
    async function show(id) {
        const s=scope(id), content=document.getElementById('wsClienteConteudo');if(!content)return;
        if(!s){content.innerHTML='<p class="help-text">Não tem acesso ao histórico deste cliente.</p>';current=null;return;}
        const state={scope:s,sequence:++sequence,services:[],events:[],limit:100};current=state;
        content.innerHTML='<div class="tg-history-loading" role="status">A carregar o histórico do cliente…</div>';
        let services=(dados.servicos||[]).filter(r=>r.adminId===s.tenant&&r.clienteId===id), incomplete=false;
        try {
            const query=supa.from('servicos').select('*').eq('admin_id',s.tenant).eq('cliente_id',id).order('data',{ascending:false}).order('id',{ascending:false});
            const {data,error}=await _buscarPaginadoGenerico(query);if(error)throw error;
            if(!visible(state))return;
            // Local records take precedence while unsynchronized edits are in progress.
            services=[...new Map([...(data||[]).map(M.servicos.from),...services].map(r=>[r.id,r])).values()];
        } catch (_) { incomplete=true; }
        if(!visible(state))return;
        state.services=services;state.events=events(s,dados,services);
        const types=Object.keys(kinds).filter(k=>state.events.some(e=>e.kind===k));
        content.innerHTML=`<section id="tgCustomerHistory" class="tg-customer-history"><div class="tg-history-head"><div><span class="tg-history-eyebrow">FICHA DO CLIENTE</span><h2>Histórico</h2><p>Intervenções, pedidos e documentos reunidos por data.</p></div><span class="tg-history-total" data-history-count></span></div>${incomplete?'<p class="tg-history-warning" role="status">Não foi possível carregar as OS antigas. A mostrar os registos disponíveis. <button type="button" class="btn btn-outline" data-history-retry>Tentar novamente</button></p>':''}<div class="tg-history-filters"><label class="tg-history-search">Pesquisar<input type="search" data-history-search placeholder="Número, descrição ou estado…"></label><label>Tipo<select data-history-type><option value="">Todos os registos</option>${types.map(k=>`<option value="${k}">${kinds[k][0]}</option>`).join('')}</select></label><label>Desde<input type="date" data-history-from></label><label>Até<input type="date" data-history-to></label></div><div data-history-events></div><button type="button" class="btn btn-outline tg-history-more" data-history-more>Mostrar mais registos</button></section>`;
        const root=document.getElementById('tgCustomerHistory');
        root.addEventListener('input',()=>{state.limit=100;render();});root.addEventListener('change',()=>{state.limit=100;render();});
        root.addEventListener('click',e=>{
            if(e.target.closest('[data-history-more]')){state.limit+=100;render();}
            if(e.target.closest('[data-history-retry]'))show(id);
            const button=e.target.closest('[data-history-open]');if(!button||!visible(state))return;
            const entry=events(scope(id),dados,state.services).find(r=>r.kind+':'+r.id===button.dataset.historyOpen);if(!entry)return;
            if(entry.action==='crm'){window.TGModules.open('crm');return;}
            if(entry.action==='assist'){window.TGModules.open('assistencias');return;}
            if(entry.action==='os' && !(dados.servicos||[]).some(r=>r.id===entry.id)) {
                if(!dados.servicos)dados.servicos=[];
                dados.servicos.push(entry.row);
                if(!_snap.servicos)_snap.servicos=new Map();
                _snap.servicos.set(entry.id,JSON.stringify(M.servicos.to(entry.row)));
            }
            if(entry.action==='relatorio'){_verRelatorioEspecialidadeSnapshot(entry.id,false);return;}
            _wsSairPara(id);
            if(entry.action==='os')abrirVerOS(entry.id);
            if(entry.action==='obra')abrirObraLongaDetalhe(entry.id);
            if(entry.action==='contrato')abrirModalContrato(entry.id);
        });render();
    }
    document.addEventListener('tg:interface-updated',()=>{
        if(current && (identity()!==current.scope.identity || !scope(current.scope.id))){document.getElementById('tgCustomerHistory')?.remove();current=null;++sequence;}
        else if(current)render();
    });
    window.TGClientHistory={show,events,scope};
})();
