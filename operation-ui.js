/* Actionable home and service shortcuts. Existing permissions and save flows remain authoritative. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const done = state => ['concluido','concluida','cancelado','cancelada','fechada'].includes(String(state || '').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  const allowed = section => { const el=document.querySelector(`#cardsGrid [data-card="${section}"]`);return !!el && !el.classList.contains('hidden-card') && !el.classList.contains('card-bloqueado'); };
  function scopeServices(user, data) {
    if (!user || !['admin','subadmin','encarregado','funcionario'].includes(user.role)) return [];
    const person = user.role==='funcionario' ? data.funcionarios?.find(f=>f.id===user.id) : user.role==='encarregado' ? data.encarregados?.find(f=>f.id===user.id) : user;
    const tenant=user.role==='admin' ? user.id : person?.adminId;
    if (!tenant) return [];
    return (data.servicos || []).filter(s=>{
      if(s.adminId!==tenant)return false;
      if(['admin','subadmin'].includes(user.role))return true;
      const assigned=s.funcionariosIds?.length ? s.funcionariosIds : [s.funcionarioId].filter(Boolean);
      return s.funcionarioId===null || assigned.includes(user.id) || (user.role==='encarregado' && assigned.some(id=>person.funcionariosIds?.includes(id)));
    });
  }
  window.tgOperationModel = (user,data,today,assistActive) => {
    const services=scopeServices(user,data), active=services.filter(s=>!done(s.status));
    const ids=new Set(services.map(s=>s.id));
    const drafts=(data.relatoriosEspecialidade || []).filter(r=>r.rascunho && ids.has(r.servicoId));
    const draftIds=new Set(drafts.map(r=>r.servicoId));
    const tenant=user?.role==='admin' ? user.id : user?.adminId;
    const requests=assistActive && ['admin','subadmin'].includes(user?.role) ? (data.assistencias || []).filter(a=>a.adminId===tenant && a.origem==='portal' && a.estado==='aberta') : [];
    const urgent=assistActive && ['admin','subadmin'].includes(user?.role) ? (data.assistencias || []).filter(a=>a.adminId===tenant && a.origem!=='portal' && !done(a.estado) && ['alta','urgente'].includes(a.prioridade || a.urgencia)) : [];
    return {services,active,drafts,requests,urgent,today:active.filter(s=>s.data===today),late:active.filter(s=>s.data && s.data<today),reports:services.filter(s=>draftIds.has(s.id))};
  };
  let filter='today';
  function model() {return window.tgOperationModel(usuarioLogado,dados,getDataHoje(),allowed('assistencias') && moduloAssistAtivo(adminDoUtilizador()));}
  function service(id) {return allowed('servicos') && model().services.find(s=>s.id===id);}
  function run(action,id) {
    if(action==='request') {
      const request=[...model().requests,...model().urgent].find(a=>a.id===id);if(!request)return;
      abrirWorkspaceCliente(request.clienteId);_wsClienteAba(request.clienteId,'assistencias');return;
    }
    const s=service(id);if(!s)return;
    if(action==='open'){abrirVerOS(id);return;}
    if(action==='report'){abrirVerOS(id);_verOsMostrar(id,'relatorios');return;}
    if(action==='work'){_fecharModalGenerico();criarFolhaDaOS(id);return;}
    if(action==='photos'){_verOsMostrar(id,'fotos');return;}
    if(action==='materials'){_verOsMostrar(id,'materiais');return;}
    if(action==='finish'){if(usuarioLogado.role==='funcionario')return;finalizarEGerarReportOS(id);return;}
    if(action==='point') {
      const assigned=s.funcionariosIds?.length ? s.funcionariosIds : [s.funcionarioId].filter(Boolean);
      if(!assigned.includes(usuarioLogado.id) || expressAtivo(adminDoUtilizador()) || done(s.status))return;
      const open=(dados.ponto || []).some(p=>p.servicoId===id && p.funcionarioId===usuarioLogado.id && p.entrada && !p.saida);
      picarPontoOS(id,open?'saida':'entrada');
    }
  }
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-op-action]');if(target){e.preventDefault();run(target.dataset.opAction,target.dataset.opId);}
    const tab=e.target.closest('[data-op-filter]');if(tab){filter=tab.dataset.opFilter;refreshHome();}
  });
  const button=(label,action,id)=>`<button type="button" data-op-action="${action}" data-op-id="${esc(id)}">${esc(label)}</button>`;
  function refreshHome() {
    let root=document.getElementById('tgOperationHome');
    if(!root){root=document.createElement('section');root.id='tgOperationHome';root.className='tg-op-home';}
    const user=typeof usuarioLogado==='undefined'?null:usuarioLogado;
    if(!user || !['admin','subadmin','funcionario','encarregado'].includes(user.role)){root.remove();return;}
    const home=document.getElementById('tgHome'),cards=document.getElementById('cardsGrid');
    const host=home && getComputedStyle(home).display!=='none'?home:cards;if(!host)return;
    if(root.parentElement!==host)host.prepend(root);
    root.hidden=!!document.querySelector('.section-container.active');if(root.hidden)return;
    const m=model(),canOS=allowed('servicos');
    if(!canOS && !m.requests.length && !m.urgent.length){root.hidden=true;return;}
    const rows=canOS?m[filter] || m.today:[];
    const customer=id=>(dados.clientes || []).find(c=>c.id===id)?.nome || 'Cliente';
    root.innerHTML=`<div class="tg-op-heading"><div><span class="tg-op-eyebrow">${['admin','subadmin'].includes(user.role)?'A SUA OPERAÇÃO':'O SEU TRABALHO'}</span><h2>O que precisa de tratar</h2><p>Prioridades e acesso direto aos serviços.</p></div><span class="tg-op-date">${new Date(getDataHoje()+'T12:00:00').toLocaleDateString('pt-PT',{day:'numeric',month:'long'})}</span></div>
      ${m.urgent.length?`<div class="tg-op-requests"><h3>${m.urgent.length} assistência(s) com prioridade alta ou urgente</h3>${m.urgent.slice(0,3).map(a=>`<article><div><strong>${esc(a.numero || a.assunto || 'Assistência')}</strong><p>${esc(customer(a.clienteId))} · ${esc(a.prioridade || a.urgencia)}</p></div>${button('Abrir assistência','request',a.id)}</article>`).join('')}</div>`:''}
      ${m.requests.length?`<div class="tg-op-requests"><h3>${m.requests.length} pedido${m.requests.length===1?'':'s'} do portal por tratar</h3>${m.requests.slice(0,4).map(a=>`<article><div><strong>${esc(a.numero || a.assunto || 'Assistência')}</strong><p>${esc(customer(a.clienteId))} · ${esc(typeof _assistResumoDados==='function'?_assistResumoDados(a).local:(a.localNome || a.morada || 'Local na ficha'))} · ${esc(a.prioridade || a.urgencia || 'normal')}</p></div>${button('Tratar pedido','request',a.id)}</article>`).join('')}${m.requests.length>4?'<p>Os restantes pedidos estão na área de Assistências.</p>':''}</div>`:''}
      ${canOS?`<div class="tg-op-tabs" role="group" aria-label="Prioridades"><button type="button" data-op-filter="today" aria-pressed="${filter==='today'}">Hoje <b>${m.today.length}</b></button><button type="button" data-op-filter="late" aria-pressed="${filter==='late'}">Em atraso <b>${m.late.length}</b></button><button type="button" data-op-filter="reports" aria-pressed="${filter==='reports'}">Relatórios em rascunho <b>${m.reports.length}</b></button></div><div class="tg-op-list">${rows.length?rows.slice().sort((a,b)=>(a.data || '').localeCompare(b.data || '') || (a.hora || '99').localeCompare(b.hora || '99')).slice(0,8).map(s=>`<article><div class="tg-op-service"><strong>${esc(s.numeroRegisto || 'OS')} · ${esc(customer(s.clienteId))}</strong><p>${esc(s.descricao || 'Serviço')}<br>${esc(s.data || 'Sem data')} ${esc(s.hora || '')}${s.morada?' · '+esc(s.morada):''}</p></div>${button(filter==='reports'?'Continuar relatório':'Abrir serviço',filter==='reports'?'report':'open',s.id)}</article>`).join(''):`<p class="tg-op-empty">${filter==='today'?'Sem serviços agendados para hoje.':filter==='late'?'Sem serviços em atraso.':'Sem relatórios em rascunho nos serviços a que tem acesso.'}</p>`}${rows.length>8?'<p class="tg-op-empty">A mostrar os 8 primeiros serviços. Consulte os restantes em Ordens de Serviço.</p>':''}</div>`:''}`;
  }
  function refreshMenu() {
    const nav=document.getElementById('tgSidebarNav');if(!nav)return; if(!nav.querySelector('.tg-nav-item')){document.querySelector('.tg-op-menu-search')?.remove();return;}
    let input=document.getElementById('tgMenuSearch');
    if(!input){const wrap=document.createElement('div');wrap.className='tg-op-menu-search';wrap.innerHTML='<label for="tgMenuSearch">Procurar no menu</label><input id="tgMenuSearch" type="search" placeholder="Clientes, serviços…" autocomplete="off">';nav.before(wrap);input=wrap.querySelector('input');input.addEventListener('input',applyMenuSearch);}
    applyMenuSearch();
  }
  function applyMenuSearch(){
    const nav=document.getElementById('tgSidebarNav'),q=(document.getElementById('tgMenuSearch')?.value || '').trim().toLocaleLowerCase('pt-PT');if(!nav)return;
    nav.querySelectorAll('.tg-nav-item').forEach(el=>el.hidden=!!q && !el.textContent.toLocaleLowerCase('pt-PT').includes(q));
    nav.querySelectorAll('.tg-nav-submenu').forEach(sub=>{const visible=[...sub.querySelectorAll('.tg-nav-item')].some(el=>!el.hidden);sub.hidden=!visible;const group=[...nav.querySelectorAll('[data-grupo-btn]')].find(b=>b.dataset.grupoBtn===sub.dataset.grupoSub);if(group)group.hidden=!visible;if(q && visible)sub.classList.add('tg-op-search-open');else sub.classList.remove('tg-op-search-open');});
  }
  window.tgOperationOS = id => {
    document.getElementById('tgOperationSteps')?.remove();const s=service(id);if(!s)return;
    const fields=document.getElementById('modalGenericoCampos');if(!fields)return;
    const root=document.createElement('div');root.id='tgOperationSteps';root.className='tg-op-steps';
    const assigned=s.funcionariosIds?.length?s.funcionariosIds:[s.funcionarioId].filter(Boolean);
    const open=(dados.ponto || []).some(p=>p.servicoId===id && p.funcionarioId===usuarioLogado.id && p.entrada && !p.saida);
    const closed=done(s.status),hasWork=(dados.folhasObra || []).some(f=>f.servicoId===id);
    root.innerHTML=`<div class="tg-op-status"><strong>${closed?'Serviço concluído':open?'Intervenção em curso':'Preparar intervenção'}</strong><span>${hasWork?'Trabalho registado':'Folha de obra por preencher'} · ${(s.fotos || []).length} foto(s)</span></div><div class="tg-op-step-actions">${!closed && assigned.includes(usuarioLogado.id) && !expressAtivo(adminDoUtilizador())?button(open?'Registar saída':'Iniciar intervenção','point',id):''}${!closed?button('1 · Registar trabalho','work',id):''}${document.getElementById('verOsBtnMateriais')?button('2 · Materiais','materials',id):''}${document.getElementById('verOsBtnFotos')?button('3 · Fotos','photos',id):''}${button('4 · Relatórios','report',id)}${!closed && usuarioLogado.role!=='funcionario'?button('Concluir serviço','finish',id):''}</div><p>Preencha e assine os relatórios necessários antes de concluir.${usuarioLogado.role==='funcionario'?' A conclusão é feita pelo encarregado ou administrador.':''}</p>`;
    fields.prepend(root);
  };
  window.tgOperationRefresh=()=>{refreshMenu();refreshHome();};
  document.addEventListener('tg:interface-updated',window.tgOperationRefresh);
  window.tgOperationRefresh();
})();
