/* Teste TG: task-based navigation. Source cards remain the permission authority. */
(function () {
    'use strict';
    if (window.TGNavigation) return;
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const user = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const active = () => !!user() && user().role !== 'cliente';
    const card = id => [...document.querySelectorAll('#cardsGrid .card-principal[data-card]')].find(el => el.dataset.card === id);
    const permitted = el => active() && el && !el.hidden && !el.classList.contains('hidden-card') && !el.classList.contains('card-bloqueado') && el.style.display !== 'none';
    const visible = el => permitted(el) && !el.hasAttribute('data-tgn-secondary');
    // A estrutura é comum a Admin e Sub-Admin; permissões apenas filtram acessos.
    const groups = [
        ['comercial','Comercial','fa-handshake-angle',['clientes','crm','contratos','distribuicao']],
        ['equipa','Equipa','fa-users-gear',['funcionarios','encarregados','ponto','assiduidade','pedidos','calendario-equipa','mapa-equipa','alertas-geofence','quiosque']],
        ['operacoes','Obras e Serviços','fa-gears',['obras-longa','servicos','assistencias','folhas','agenda-obras','agenda']],
        ['frota','Frota','fa-car',['frota']],
        ['rondas','Rondas','fa-route',['rondas']],
        ['armazem','Armazém','fa-warehouse',['artigos','encomendas','fornecedores','requisicoes','levantamento-qr','ferramentas']],
        ['financeiro','Financeiro','fa-landmark',['financeiro','despesas','dashboard-analitico']],
        ['relatorios','Relatórios','fa-file-lines',['relatorio-os']],
        ['configuracoes','Sistema e Suporte','fa-gear',['relatorios-personalizados','minha-licenca','auditoria','exportar-dados','guia','ajuda-peticoes']],
        ['sistema','Administração do Sistema','fa-shield-halved',['superadmin','reports','analytics','licencas','licencas-vencer','pedidos-renovacao','licencas-distribuidor','historico-licencas','uso-cards','online-admins','contactos']]
    ];
    const calendars = [['agenda-obras','Planeamento'],['calendario-equipa','Equipa'],['agenda','Prazos e vencimentos']];
    const originalCards = new Map(), originalGroups = [];
    const legacyMobile = () => !!window.TGTechnician?.enabled() || (innerWidth <= 900 && !(['admin','subadmin'].includes(user()?.role) && typeof obterLayout === 'function' && obterLayout() === 'aurora'));
    const originalVisibility = window.ajustarVisibilidadeCards;
    let groupedMode = null, originalReportsTitle = '', pendingLayoutRefresh = false;
    let identity = '', current = 'home', returnToMore = false, moreGroup = '', refreshing = false;
    function regroup() {
        const parent = document.querySelector('#cardsGrid .dashboard-grupos');
        if (!parent) return;
        if (!originalGroups.length) {
            parent.querySelectorAll('.grupo-cards').forEach(section => {
                const cards=[...section.querySelectorAll('.card-principal[data-card]')];
                originalGroups.push({section,cards});
                cards.forEach(el=>originalCards.set(el.dataset.card,{el,title:el.querySelector('h3')?.textContent||'',onclick:el.getAttribute('onclick')}));
            });
            originalReportsTitle=$('secao-reports')?.querySelector('.section-header h2')?.textContent || '';
        }
        const mode=legacyMobile()?'mobile':'desktop', previous=groupedMode;
        originalCards.forEach(({el,title,onclick})=>{
            el.removeAttribute('data-tgn-secondary');
            if(el.querySelector('h3'))el.querySelector('h3').textContent=title;
            if(onclick!==null)el.setAttribute('onclick',onclick);else el.removeAttribute('onclick');
        });
        if(mode!==groupedMode){
            if(mode==='mobile'){
                originalGroups.forEach(({section,cards})=>{
                    const grid=section.querySelector('.grupo-grid');cards.forEach(el=>grid.append(el));
                    section.hidden=false;section.style.display='';
                });
                parent.replaceChildren(...originalGroups.map(item=>item.section));
            }else{
                const destinations=new Map(),placed=new Set();
                groups.forEach(([key,title,icon])=>{
                    const section=document.createElement('div');section.className='grupo-cards';section.dataset.grupo=key;
                    section.innerHTML=`<div class="grupo-header"><h3><i class="fas ${icon}" aria-hidden="true"></i> ${title}</h3><div class="linha"></div></div><div class="grupo-grid"></div>`;
                    destinations.set(key,section);
                });
                groups.forEach(([key,,,ids])=>ids.forEach(id=>{const el=originalCards.get(id)?.el;if(el){destinations.get(key).querySelector('.grupo-grid').append(el);placed.add(el);}}));
                originalCards.forEach(({el})=>{if(!placed.has(el))destinations.get('configuracoes').querySelector('.grupo-grid').append(el);});
                parent.replaceChildren(...destinations.values());
            }
            groupedMode=mode;
            if(active()&&typeof originalVisibility==='function')originalVisibility();
            $('tgnSettings')?.close();returnToMore=false;moreGroup='';
            if(previous!==null&&active()&&!pendingLayoutRefresh){
                pendingLayoutRefresh=true;
                queueMicrotask(()=>{
                    pendingLayoutRefresh=false;
                    if(!active())return;
                    if(!document.querySelector('.section-container.active')&&$('painelGrupoMobile')?.style.display==='block')_voltarMeuDia();
                    construirSidebar();_montarMenuInferiorMobile();
                });
            }
        }
        const heading=$('secao-reports')?.querySelector('.section-header h2');
        if(mode==='mobile'){
            parent.querySelectorAll('.grupo-cards').forEach(section=>section.hidden=false);
            if(heading)heading.textContent=originalReportsTitle;
            return;
        }
        const selected=calendars.find(([id])=>permitted(card(id)))?.[0];
        calendars.forEach(([id])=>{
            const el=card(id);if(!el)return;
            if(id!==selected)el.setAttribute('data-tgn-secondary','');
            else {el.querySelector('h3').textContent='Agenda';el.setAttribute('onclick','return TGNavigation.agenda()');}
        });
        const models=card('relatorios-personalizados');if(models?.querySelector('h3'))models.querySelector('h3').textContent='Modelos de relatório';
        const reports=card('reports');if(reports){
            if(user()?.role==='superadmin')reports.classList.remove('hidden-card');
            reports.toggleAttribute('data-tgn-secondary',user()?.role!=='superadmin');reports.querySelector('h3').textContent='Visão Global';
        }
        parent.querySelectorAll('.grupo-cards').forEach(group=>{group.hidden=![...group.querySelectorAll('.card-principal')].some(visible);});
        if(heading)heading.textContent='Visão Global';
    }
    function entries(key) { const group=groups.find(g=>g[0]===key); if(!group)return []; return group[3].map(id=>card(id)).filter(visible); }
    function openCard(id) {
        const el = card(id); if (!visible(el)) return false;
        $('tgnSettings')?.close(); el.click(); return false;
    }
    function tile(el) {
        const button=document.createElement('button');button.type='button';button.className='tgn-tile';button.dataset.tgnCard=el.dataset.card;
        button.innerHTML=`<span class="tgn-tile-icon">${el.querySelector('.icon')?.innerHTML || ''}</span><span><strong>${esc(el.querySelector('h3')?.textContent)}</strong><small>${esc(el.querySelector('.info p')?.textContent?.trim())}</small></span><span aria-hidden="true">›</span>`;
        return button;
    }
    function sectionList(target, keys, collapsible = false) {
        target.replaceChildren();
        keys.forEach(key=>{
            const list=entries(key);if(!list.length&&key!=='configuracoes')return;
            const section=document.createElement(collapsible?'details':'section');section.className='tgn-menu-section';
            const heading=document.createElement(collapsible?'summary':'h3');heading.textContent=groups.find(g=>g[0]===key)[1];section.append(heading);
            if(collapsible){section.dataset.tgnMenuGroup=key;section.open=moreGroup===key;const count=document.createElement('span');count.className='tgn-group-count';const total=list.length+(key==='configuracoes'?1+(permitted(card('funcionarios'))?1:0):0);count.textContent=total+' '+(total===1?'acesso':'acessos');heading.append(count);section.addEventListener('toggle',()=>{if(section.open){moreGroup=key;target.querySelectorAll('details').forEach(other=>{if(other!==section)other.open=false;});}});}
            const grid=document.createElement('div');grid.className='tgn-menu-grid';if(key==='configuracoes'){const profile=document.createElement('button');profile.type='button';profile.className='tgn-tile';profile.dataset.tgnProfile='';profile.innerHTML='<span class="tgn-tile-icon"><i class="fas fa-user-gear" aria-hidden="true"></i></span><span><strong>'+(['admin','subadmin'].includes(user()?.role)?'Perfil e empresa':'O meu perfil')+'</strong><small>Dados da conta e preferências</small></span><span>›</span>';grid.append(profile);if(permitted(card('funcionarios'))){const people=tile(card('funcionarios'));people.querySelector('strong').textContent='Utilizadores e permissões';people.querySelector('small').textContent='Gerir contas e acessos da equipa';grid.append(people);}}list.forEach(el=>grid.append(tile(el)));section.append(grid);target.append(section);
        });
    }
    function settings() {
        if (!active() || legacyMobile()) return;
        let dialog=$('tgnSettings');
        if(!dialog){dialog=document.createElement('dialog');dialog.id='tgnSettings';dialog.className='tgn-menu-dialog';dialog.setAttribute('aria-labelledby','tgnSettingsTitle');dialog.innerHTML='<header><h2 id="tgnSettingsTitle">Configurações e ajuda</h2><button type="button" data-tgn-close aria-label="Fechar configurações">×</button></header><div class="tgn-settings-content"></div>';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});}
        sectionList(dialog.querySelector('.tgn-settings-content'),['configuracoes']);if(!dialog.open)dialog.showModal();
    }
    function mark(name) {current=name;document.querySelectorAll('#menuInferiorMobile [data-tgn-nav]').forEach(el=>{el.classList.toggle('ativo',el.dataset.tgnNav===name);el.setAttribute('aria-current',el.dataset.tgnNav===name?'page':'false');});}
    function more() {
        if(!active()||(legacyMobile()&&!['admin','subadmin'].includes(user()?.role)))return;
        _fecharSecaoAbertaMobile();const panel=$('painelGrupoMobile'),content=$('painelGrupoMobileConteudo');if(!panel||!content)return;
        if($('omeudia'))$('omeudia').style.display='none';if($('tgHome'))$('tgHome').style.display='none';if($('cardsGrid'))$('cardsGrid').style.display='';
        if(typeof _ultimoGrupoMobileAberto!=='undefined')_ultimoGrupoMobileAberto=null;
        panel.style.display='block';content.classList.add('tgn-more');
        const head=document.createElement('div');head.className='tgn-more-title';head.innerHTML='<h2>Mais</h2><p>As áreas disponíveis para o teu perfil.</p>';
        const body=document.createElement('div');sectionList(body,groups.map(g=>g[0]),true);content.replaceChildren(head,body);
        if(['admin','subadmin'].includes(user()?.role)){
            const button=document.createElement('button');button.type='button';button.className='btn btn-outline';button.dataset.tgnDashboard='';button.textContent='Dashboard Central';head.append(button);
        }
        returnToMore=true;mark('more');window.scrollTo({top:0,behavior:'smooth'});
    }
    function workMenu() {
        if(!['admin','subadmin'].includes(user()?.role))return _abrirGrupoMobile('operacoes');
        more();const content=$('painelGrupoMobileConteudo');if(!content)return;
        const head=content.querySelector('.tgn-more-title');if(head)head.querySelector('h2').textContent='Obras e Serviços';
        const body=content.querySelector('.tgn-menu-section')?.parentElement;
        if(body)sectionList(body,['operacoes']);returnToMore=true;mark('work');
    }
    function agenda(preferred) {
        const target=calendars.find(([id])=>id===preferred&&permitted(card(id))) || calendars.find(([id])=>permitted(card(id)));
        if(!target)return false;
        abrirSecao(target[0]);mark('agenda');return false;
    }
    function calendarTabs() {
        if(legacyMobile()){document.querySelectorAll('.tgn-calendar-tabs').forEach(el=>el.remove());return;}
        calendars.forEach(([id])=>{
            const section=$('secao-'+id);if(!section)return;
            let nav=section.querySelector('.tgn-calendar-tabs');
            if(!nav){nav=document.createElement('nav');nav.className='tgn-calendar-tabs';nav.setAttribute('aria-label','Vistas da agenda');const heading=section.querySelector('.section-header');if(heading)heading.after(nav);else section.prepend(nav);}
            nav.innerHTML=calendars.filter(([key])=>permitted(card(key))).map(([key,label])=>`<button type="button" data-tgn-calendar="${key}" ${key===id?'aria-current="page" class="ativo"':''}>${label}</button>`).join('');
        });
    }
    function alerts(navigate = true) {
        if(!active())return;
        let section=$('secao-tgn-alertas');
        if(!section){section=document.createElement('section');section.id='secao-tgn-alertas';section.className='section-container';$('cardsGrid')?.after(section);}
        if(navigate)abrirSecao('tgn-alertas');section.innerHTML='<div class="section-header"><h2>Alertas e notificações</h2></div><div class="tgn-alert-content"></div>';
        const content=section.querySelector('.tgn-alert-content');
        // Reuse the existing role-filtered renderers and their original actions.
        ['alertasPendencias','notifPessoalBanner'].forEach(id=>{const source=$(id);if(source?.innerHTML.trim()){const copy=source.cloneNode(true);copy.removeAttribute('id');copy.removeAttribute('style');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));content.append(copy);}});
        if(!content.children.length)content.innerHTML='<p class="help-text">Sem alertas ou notificações por ler.</p>';
        mark('alerts');
    }
    function mobile() {
        const nav=$('menuInferiorMobile');if(!nav)return;
        const managerMobile=active()&&['admin','subadmin'].includes(user()?.role)&&innerWidth<=900;
        document.body.classList.toggle('tgn-manager-sidebar-mobile',managerMobile);
        if(managerMobile){
            // Admin e Sub-Admin usam o menu lateral Nexus, nunca a barra inferior.
            nav.classList.remove('tgn-mobile');
            nav.style.display='none';
            return;
        }
        nav.style.removeProperty('display');
        if(!active()||legacyMobile()||!_ehPerfilMobile()){nav.classList.remove('tgn-mobile');return;}
        const items=[['home','fa-sun','O Meu Dia',true],['agenda','fa-calendar-days','Agenda',calendars.some(([id])=>permitted(card(id)))],['work','fa-briefcase','Trabalhos',entries('operacoes').length>0],['alerts','fa-bell','Alertas',true],['more','fa-bars','Mais',true]];
        nav.classList.add('tgn-mobile');nav.innerHTML=items.map(([id,icon,label,enabled])=>`<button type="button" class="menu-inf-item" data-tgn-nav="${id}" ${id==='home'?'id="menuInfHome"':''} ${enabled?'':'disabled'}><i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span></button>`).join('');mark(current);
    }
    function decorateSidebar() {
        if(legacyMobile())return;
        const nav=$('tgSidebarNav');if(!nav)return;
        nav.querySelectorAll('[data-tgn-settings]').forEach(el=>el.remove());
        nav.querySelectorAll('[data-secao]').forEach(el=>{const source=card(el.dataset.secao);if(source?.hasAttribute('data-tgn-secondary')||source?.closest('[data-grupo="configuracoes"]'))el.remove();});
        nav.querySelectorAll('[data-grupo-btn="configuracoes"],[data-grupo-sub="configuracoes"]').forEach(el=>el.remove());
        // Flat sidebar layouts use an unkeyed heading for each group.
        nav.querySelectorAll('.tg-nav-group').forEach(el=>{if(el.textContent.trim()==='Configurações'||!el.nextElementSibling||el.nextElementSibling.classList.contains('tg-nav-group'))el.remove();});
        if(active()){const button=document.createElement('button');button.type='button';button.className='tg-nav-item tgn-settings-button';button.dataset.tgnSettings='';button.innerHTML='<i class="fas fa-gear" aria-hidden="true"></i><span>Configurações e ajuda</span>';nav.append(button);}
    }
    function refresh() {
        if(refreshing)return;refreshing=true;
        try {
            const key=user()?JSON.stringify([user().id,user().adminId,user().role]):'';
            if(key!==identity){identity=key;current='home';returnToMore=false;moreGroup='';$('tgnSettings')?.close();$('secao-tgn-alertas')?.remove();$('painelGrupoMobileConteudo')?.replaceChildren();if($('painelGrupoMobile'))$('painelGrupoMobile').style.display='none';}
            document.body.classList.toggle('tgn-navigation',active()&&!legacyMobile());regroup();calendarTabs();decorateSidebar();mobile();
            let gear=$('tgnHeaderSettings');
            if(!gear&&$('headerExtras')){gear=document.createElement('button');gear.id='tgnHeaderSettings';gear.type='button';gear.className='btn-sino';gear.dataset.tgnSettings='';gear.title='Configurações e ajuda';gear.setAttribute('aria-label','Configurações e ajuda');gear.innerHTML='<i class="fas fa-gear" aria-hidden="true"></i>';$('headerExtras').append(gear);}
            if(gear)gear.hidden=!active()||legacyMobile();
            if(current==='alerts'&&$('secao-tgn-alertas')?.classList.contains('active'))alerts(false);
        } finally {refreshing=false;}
    }
    function workContext(id) {
        const u=user();if(!active()||!['admin','subadmin','encarregado','funcionario'].includes(u.role))return null;
        const tenant=u.role==='admin'?u.id:u.adminId;
        const work=(dados.obras||[]).find(w=>w.id===id&&w.adminId===tenant);if(!work)return null;
        const manager=['admin','subadmin'].includes(u.role), ids=new Set([u.id]);
        if(u.role==='encarregado'){
            const supervisor=(dados.encarregados||[]).find(e=>e.id===u.id&&e.adminId===tenant);
            (dados.funcionarios||[]).filter(f=>f.adminId===tenant&&supervisor?.funcionariosIds?.includes(f.id)).forEach(f=>ids.add(f.id));
        }
        const assigned=os=>os.funcionariosIds?.length?os.funcionariosIds:[os.funcionarioId].filter(Boolean);
        const allOS=(dados.servicos||[]).filter(os=>os.adminId===tenant&&os.obraId===id);
        const ownOS=allOS.filter(os=>manager||!assigned(os).length||assigned(os).some(person=>ids.has(person)));
        const workPeople=work.responsaveisIds?.length?work.responsaveisIds:[work.responsavelId].filter(Boolean);
        if(!manager&&!workPeople.some(person=>ids.has(person))&&!ownOS.some(os=>assigned(os).some(person=>ids.has(person)))&&!(dados.obraPontoLonga||[]).some(p=>p.adminId===tenant&&p.obraId===id&&ids.has(p.funcionarioId)))return null;
        const os=permitted(card('servicos'))?ownOS:[], osIds=new Set(os.map(row=>row.id));
        const sheets=(dados.folhasObra||[]).filter(f=>f.adminId===tenant&&f.obraId===id&&(manager||ids.has(f.funcionarioId)));
        const reports=(dados.relatoriosEspecialidade||[]).filter(r=>r.adminId===tenant&&(osIds.has(r.servicoId)||(r.obraId===id&&(manager||ids.has(r.funcionarioId)))));
        return {work,os,sheets,reports};
    }
    function workSelection(tab) {
        const legacy={folhas:'verObraBtnFolhas',materiais:'verObraBtnMateriais',documentos:'verObraBtnDocumentos',autos:'verObraBtnAutos',financeiro:'verObraBtnFinanceiro',marcos:'verObraBtnMarcos',checklist:'verObraBtnChecklist'};
        document.querySelectorAll('#modalGenericoCampos [id^="verObraBtn"]').forEach(button=>{const selected=button.dataset.tgnWorkTab===tab||button.id===legacy[tab];button.style.background=selected?'#1a5f7a':'#f1f5f9';button.style.color=selected?'#fff':'#334155';button.setAttribute('aria-pressed',String(selected));});
    }
    function workTab(id, tab) {
        const ctx=workContext(id),content=$('verObraConteudo');if(!ctx||!content)return false;
        workSelection(tab);
        if(tab==='resumo'){
            const hours=ctx.sheets.reduce((sum,f)=>sum+(Number(f.horasTrabalhadas)||0),0);
            content.innerHTML=`<section class="tgn-work-summary"><h3>Resumo da obra</h3><div class="tgn-work-kpis"><div><strong>${ctx.os.length}</strong><span>OS associadas</span></div><div><strong>${ctx.sheets.length}</strong><span>Folhas registadas</span></div><div><strong>${hours.toLocaleString('pt-PT',{maximumFractionDigits:2})} h</strong><span>Horas registadas</span></div></div><p class="help-text">Consulta as OS, folhas, relatórios e materiais nos separadores desta obra.</p></section>`;
        } else if(tab==='os'){
            content.innerHTML='<h3>Ordens de serviço da obra</h3><div class="tgn-work-list">'+(ctx.os.map(os=>`<button type="button" class="tgn-tile" data-tgn-work-os="${esc(os.id)}"><span><strong>${esc(os.numeroRegisto||os.descricao||'Ordem de serviço')}</strong><small>${esc(os.data||'Por agendar')} · ${esc(os.status||'Pendente')}</small></span><span>Ver OS ›</span></button>`).join('')||'<p class="help-text">Sem OS disponíveis para o teu perfil nesta obra.</p>')+'</div>';
        } else if(tab==='relatorios'){
            content.innerHTML='<h3>Relatórios da obra</h3><div class="tgn-work-list">'+(ctx.reports.map(r=>`<button type="button" class="tgn-tile" data-tgn-work-report="${esc(r.id)}"><span><strong>${esc(r.numeroDocumento||r.tipo||'Relatório')}</strong><small>${esc(r.data||'')} · ${r.rascunho?'Rascunho':'Concluído'}</small></span><span>${r.rascunho?'Retomar na OS':'Ver relatório'} ›</span></button>`).join('')||'<p class="help-text">Sem relatórios disponíveis nesta obra.</p>')+'</div>';
        } else return false;
        return true;
    }
    function enhanceWork(id, initial) {
        const first=$('verObraBtnFolhas');if(!first||!workContext(id))return;
        const parent=first.parentElement;
        [['resumo','Resumo','fa-building'],['os','OS','fa-wrench'],['relatorios','Relatórios','fa-file-lines']].forEach(([key,label,icon])=>{
            const button=document.createElement('button');button.type='button';button.className='btn btn-sm';button.id='verObraBtnTgn'+key;button.dataset.tgnWorkTab=key;button.innerHTML=`<i class="fas ${icon}" aria-hidden="true"></i> ${label}`;button.onclick=()=>_verObraMostrar(id,key);parent.append(button);
        });
        ['Tgnresumo','Tgnos','Folhas','Tgnrelatorios','Materiais','Autos'].forEach(key=>{const button=$('verObraBtn'+key);if(button)parent.append(button);});
        const options=document.createElement('details');options.className='tgn-work-options';options.innerHTML='<summary>Mais opções da obra</summary><div class="tgn-work-extra"></div>';
        ['Documentos','Financeiro','Marcos','Checklist'].forEach(key=>{const button=$('verObraBtn'+key);if(button)options.querySelector('div').append(button);});
        options.addEventListener('click',event=>{if(event.target.closest('button'))options.open=false;});parent.after(options);
        parent.classList.add('tgn-work-tabs');workSelection(initial);
        if(['resumo','os','relatorios'].includes(initial))workTab(id,initial);
    }
    function wrap(name, callback) {const original=window[name];if(typeof original==='function')window[name]=function(...args){return callback.call(this,original,args);};}
    // Install after the existing navigation adapters; retain their handlers and permission checks.
    wrap('ajustarVisibilidadeCards',function(original,args){const result=original.apply(this,args);if(!legacyMobile()&&user()?.role==='superadmin')card('reports')?.classList.remove('hidden-card');regroup();return result;});
    wrap('construirSidebar',function(original,args){regroup();const result=original.apply(this,args);decorateSidebar();return result;});
    wrap('_montarMenuInferiorMobile',function(original,args){regroup();const result=original.apply(this,args);mobile();return result;});
    wrap('abrirSecao',function(original,args){const result=original.apply(this,args);calendarTabs();if(calendars.some(([id])=>id===args[0]))mark('agenda');else if(args[0]!=='tgn-alertas')mark(entries('operacoes').some(el=>el.dataset.card===args[0])?'work':'more');return result;});
    wrap('_abrirGrupoMobile',function(original,args){
        const result=original.apply(this,args),content=$('painelGrupoMobileConteudo');
        if(legacyMobile())return result;
        if(content){content.classList.remove('tgn-more');sectionList(content,[args[0]]);}
        mark(args[0]==='operacoes'?'work':'more');return result;
    });
    wrap('_voltarMeuDia',function(original,args){returnToMore=false;const result=original.apply(this,args);mark('home');return result;});
    wrap('_voltarAoMenuAnterior',function(original,args){if(!legacyMobile()&&returnToMore&&_ehPerfilMobile())return more();return original.apply(this,args);});
    wrap('abrirObraLongaDetalhe',function(original,args){if(args.length<2)args.push('resumo');return original.apply(this,args);});
    wrap('_abrirObraLongaDetalheReal',function(original,args){const initial=args[1]||'resumo';const result=original.call(this,args[0],['resumo','os','relatorios'].includes(initial)?'folhas':initial);enhanceWork(args[0],initial);return result;});
    wrap('_verObraMostrar',function(original,args){if(['resumo','os','relatorios'].includes(args[1])&&workTab(args[0],args[1]))return;document.querySelectorAll('[data-tgn-work-tab]').forEach(button=>{button.style.background='#f1f5f9';button.style.color='#334155';button.setAttribute('aria-pressed','false');});const result=original.apply(this,args);workSelection(args[1]);return result;});
    document.addEventListener('click',event=>{
        const workAction=event.target.closest('[data-tgn-work-os],[data-tgn-work-report]');
        if(workAction){const ctx=workContext($('modalGenericoOverlay')?.dataset.obraAtual);if(!ctx)return;
            if(workAction.dataset.tgnWorkOs&&ctx.os.some(os=>os.id===workAction.dataset.tgnWorkOs))return abrirVerOS(workAction.dataset.tgnWorkOs);
            const report=ctx.reports.find(r=>r.id===workAction.dataset.tgnWorkReport);if(report){if(report.rascunho){if(ctx.os.some(os=>os.id===report.servicoId))return abrirVerOS(report.servicoId);}else return _verRelatorioEspecialidadeSnapshot(report.id,false);}return;
        }
    });
    document.addEventListener('click',event=>{
        const control=event.target.closest('[data-tgn-nav],[data-tgn-card],[data-tgn-calendar],[data-tgn-settings],[data-tgn-close],[data-tgn-dashboard],[data-tgn-profile]');if(!control||!active())return;
        if(control.hasAttribute('data-tgn-close')){$('tgnSettings')?.close();return;}
        if(control.hasAttribute('data-tgn-settings'))return settings();
        if(control.hasAttribute('data-tgn-profile')){$('tgnSettings')?.close();if(typeof abrirEditarPerfil==='function')return abrirEditarPerfil();return;}
        if(control.hasAttribute('data-tgn-dashboard')){returnToMore=true;return _abrirDashboardCentralMobile();}
        if(control.dataset.tgnCard)return openCard(control.dataset.tgnCard);
        if(control.dataset.tgnCalendar)return agenda(control.dataset.tgnCalendar);
        switch(control.dataset.tgnNav){case 'home':return _voltarMeuDia();case 'agenda':return agenda();case 'work':returnToMore=false;return workMenu();case 'alerts':return alerts();case 'more':return more();}
    });
    document.addEventListener('tg:interface-updated',refresh);
    let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{
        _montarMenuInferiorMobile();
        // Safari changes the viewport height as its toolbar expands on scroll.
        // The technician workspace owns its active tab; a resize must never navigate.
        const technician=!!window.TGTechnician?.enabled();
        const panel=$('painelGrupoMobile'),panelOpen=panel && panel.style.display!=='none' && getComputedStyle(panel).display!=='none';
        if(active()&&!technician&&!panelOpen&&!document.querySelector('.section-container.active')&&current==='home'&&typeof _mostrarInicioConteudo==='function')_mostrarInicioConteudo();
        refresh();
    },100);});
    window.TGNavigation={refresh,agenda,settings,more,openCard,entries,workContext};
    refresh();
})();
