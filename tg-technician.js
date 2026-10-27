/* Teste TG: the same essential employee workspace on phone and PC. All writes use the native flows. */
(function () {
    'use strict';
    if (window.TGTechnician) return;
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const u = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const enabled = () => (u()?.role === 'funcionario' || innerWidth <= 900 && u()?.role === 'encarregado')
        && !(typeof expressAtivo==='function' && expressAtivo(adminDoUtilizador()));
    const tenant = () => u()?.adminId;
    const rows = key => (typeof dados === 'undefined' ? [] : dados[key] || []).filter(row => row.adminId === tenant());
    const today = () => getDataHoje();
    const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const done = value => /^(concluid|terminad|cancelad|fechad)/.test(normal(value));
    const assigned = (row, key, fallback) => (Array.isArray(row[key]) && row[key].length ? row[key] : [row[fallback]].filter(Boolean)).includes(u()?.id);
    const permitted = id => {
        const card = [...document.querySelectorAll('#cardsGrid .card-principal[data-card]')].find(el => el.dataset.card === id);
        return !!card && !card.hidden && !card.classList.contains('hidden-card') && !card.classList.contains('card-bloqueado') && card.style.display !== 'none';
    };
    const icon = name => `<i class="fas fa-${name}" aria-hidden="true"></i>`;
    const button = (text, action, job, primary = false) => `<button type="button" class="tgt-button${primary?' tgt-primary':''}" data-tgt-action="${action}"${job?` data-tgt-kind="${job.kind}" data-tgt-id="${esc(job.id)}"`:''}>${text}</button>`;
    let view = 'home', identity = '', selected = '', weekDay = '', wasEnabled = false, refreshing = false;
    const wizards = new Map();

    function jobs() {
        if (!enabled() || !tenant() || !_licencaValidaTenant()) return [];
        const list = [];
        for (const [key,kind,permission,people,fallback,pointKey,pointId] of [
            ['servicos','os','servicos','funcionariosIds','funcionarioId','ponto','servicoId'],
            ['obras','obra','obras-longa','responsaveisIds','responsavelId','obraPontoLonga','obraId']
        ]) {
            if (!permitted(permission)) continue;
            rows(key).forEach(row => {
                // An existing personal clock remains reachable after midnight or completion
                // by a colleague. Team members never acquire each other's personal actions.
                const open = rows(pointKey).find(p => p[pointId] === row.id && p.funcionarioId === u().id && p.entrada && !p.saida);
                if (!assigned(row,people,fallback)) return;
                const state=kind==='os'?row.status:row.estado;
                if(!open && /cancelad/.test(normal(state)))return;
                if(kind==='os' && row.data!==today() && !open)return;
                if(kind==='obra' && !open && (done(state)||row.dataInicioPrevista&&row.dataInicioPrevista>today()))return;
                const client = rows('clientes').find(c => c.id === row.clienteId);
                const date = kind==='os'?row.data:row.dataInicioPrevista;
                list.push({id:row.id,kind,row,open,date:date||'',hour:row.hora||'',client:client?.nome||client?.empresa||'Cliente não indicado',
                    title:kind==='os'?(row.descricao||'Ordem de serviço'):(row.nome||'Obra'),
                    address:row.morada || (client?[client.morada,client.codigoPostal,client.localidade].filter(Boolean).join(', '):'')});
            });
        }
        return list.sort((a,b) => Number(!!b.open)-Number(!!a.open) || (a.date||'9999').localeCompare(b.date||'9999') || (a.hour||'99:99').localeCompare(b.hour||'99:99') || a.title.localeCompare(b.title,'pt'));
    }
    const findJob = el => jobs().find(job => job.id === el.dataset.tgtId && job.kind === el.dataset.tgtKind);
    const label = job => job.kind==='os'?'OS'+(job.row.numeroRegisto?' #'+job.row.numeroRegisto:''):'Obra';
    const personalClock = () => rows('ponto').find(p => p.funcionarioId===u()?.id && !p.servicoId && !p.obraId && p.data===today() && p.entrada && !p.saida);
    function resumingLunch(job) {
        const pause=typeof _pausaAlmocoPendente==='function'?_pausaAlmocoPendente():null;
        return !!pause && (job.kind==='os'?pause.tipo==='os'&&pause.servicoId===job.id:pause.tipo==='obra'&&pause.obraId===job.id);
    }
    const express = () => expressAtivo(adminDoUtilizador());
    const attendance = () => pontoAssiduidadeAtivo();
    function mark(name) {
        document.querySelectorAll('#menuInferiorMobile [data-tgt-nav]').forEach(el => {
            el.classList.toggle('ativo',el.dataset.tgtNav===name);
            if (el.dataset.tgtNav===name) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
        });
    }
    function menu() {
        const nav=$('menuInferiorMobile');if (!enabled() || !nav) return;
        nav.classList.add('tgt-nav');nav.style.display='grid';document.body.classList.add('tem-menu-inferior');
        if (!nav.querySelector('[data-tgt-nav]')) nav.innerHTML=[['home','house','Hoje'],['jobs','calendar-week','Trabalhos'],['works','helmet-safety','Obras'],['more','user','Perfil']].map(([key,ico,text])=>`<button type="button" class="menu-inf-item" data-tgt-nav="${key}"${key==='home'?' id="menuInfHome"':''}>${icon(ico)}<span>${text}</span></button>`).join('');
        document.body.classList.toggle('tgt-profile',view==='more');
        mark(view==='home'?'home':view==='jobs'?'jobs':view==='works'?'works':view==='records'?'records':['more','group','leave'].includes(view)?'more':'');
    }
    function prepareHome() {
        const grid=$('cardsGrid'),home=$('tgHome'),dia=$('omeudia');
        if(grid)grid.style.display='';if(home)home.style.display='none';
        if (dia && grid && dia.parentElement!==grid)grid.prepend(dia);
        document.body.classList.remove('com-sidebar');
        const groups=$('dashboardGrupos')||document.querySelector('#cardsGrid .dashboard-grupos');if(groups)groups.style.display='none';
    }
    const completed = job => done(job.kind==='os'?job.row.status:job.row.estado);
    function todayJobs(list=jobs()) {
        return list.filter(job=>job.kind==='os'&&job.date===today())
            .sort((a,b)=>(a.hour||'99:99').localeCompare(b.hour||'99:99')||a.title.localeCompare(b.title,'pt'));
    }
    function jobState(job) {
        const state=normal(job.row.status||job.row.estado);
        return job.open?['live','Em curso']:completed(job)?['done','Concluído']:state.includes('almoco')?['paused','Almoço']:['stand by','suspensa'].includes(state)?['paused','Em pausa']:['pending','Por iniciar'];
    }
    function rowHTML(job,action) {
        const [state,text]=jobState(job);
        return `<button type="button" class="tgt-job tgt-job--${state}" data-tgt-action="${action|| (completed(job)?'details':'choose')}" data-tgt-kind="${job.kind}" data-tgt-id="${esc(job.id)}"><span class="tgt-job-time">${esc(job.hour|| (job.kind==='obra'?'Obra':'Sem hora'))}</span><span><strong>${esc(job.title)}</strong><small>${esc(job.client)} · ${esc(label(job))}</small></span><span class="tgt-job-state">${esc(text)}</span></button>`;
    }
    function todayListHTML(list,title='OS de hoje',readOnly=false) {
        return `<section class="tgt-today-list" aria-label="${esc(title)}"><div class="tgt-section-head"><h3>${esc(title)}</h3><span>${list.length} ${list.length===1?'serviço':'serviços'}</span></div>${list.length?list.map(job=>rowHTML(job,readOnly?'weekly-details':null)).join(''):'<p class="tgt-message">Sem serviços atribuídos para este dia.</p>'}</section>`;
    }
    function focusHTML(job) {
        if (!job) return `<section class="tgt-empty">${icon('circle-check')}<h3>Sem OS por iniciar</h3><p>Consulta as OS de hoje abaixo ou a agenda da semana em Trabalhos.</p>${button('Ver a agenda da semana','jobs')}</section>`;
        const open=!!job.open, clock=!!personalClock();
        let map=null;
        if (typeof _osMapaInfo==='function')map=_osMapaInfo(job.row.clienteId,job.address,job.row.localId);
        // Keep navigation URLs supplied by the existing location resolver, never arbitrary schemes.
        const mapLink=map && /^https:\/\//i.test(map.url||'')?`<a class="tgt-button" href="${esc(map.url)}" target="_blank" rel="noopener"${job.kind==='os'?` data-tgt-travel="${esc(job.id)}"`:''}>${icon('route')} Navegar</a>`:'';
        const resume=resumingLunch(job);
        const status=open?'EM CURSO':resume?'REGRESSAR DO ALMOÇO':'A SEGUIR';
        const startLabel=open?'Registar saída':resume?'Regressar à intervenção':attendance()&&!clock?'Picar entrada no dia':'Iniciar intervenção';
        const info=open?'Entrada registada às '+job.open.entrada+(job.open.data!==today()?' · '+job.open.data.split('-').reverse().join('/'):''):attendance()&&!clock&&!resume?'Regista primeiro a entrada no dia para iniciares a intervenção.':'';
        return `<section class="tgt-focus" aria-label="Intervenção em destaque"><div class="tgt-focus-head"><span class="tgt-badge">${status}${job.hour?' · '+esc(job.hour):''}</span><span>${esc(label(job))}</span></div><h3>${esc(job.title)}</h3><p class="tgt-client">${esc(job.client)}</p>
            ${job.address?`<div class="tgt-location">${icon('location-dot')}<span>${esc(job.address)}</span></div>`:''}
            ${job.row.observacoes?`<div class="tgt-access">${icon('circle-info')}<p>${esc(job.row.observacoes)}</p></div>`:''}
            ${info?`<p class="tgt-focus-info">${esc(info)}</p>`:''}
            ${open?`<div class="tgt-tools">${job.kind==='os'?button(icon('camera')+' Fotografias','photos',job):''}${button(icon('boxes-stacked')+' Materiais','materials',job)}${passportTarget(job)?button(icon('id-card')+' Passaporte','passport',job):''}</div>`:''}
            <div class="tgt-focus-actions">${button(startLabel+' '+icon('arrow-right'),open?'exit':'start',job,true)}<div class="tgt-detail-actions">${button('Ver '+(job.kind==='os'?'ordem de serviço':'obra'),'details',job)}${mapLink}</div></div></section>`;
    }
    function recordsHTML() {
        if(!permitted('folhas'))return '';
        const count=rows('folhasObra').filter(f=>f.funcionarioId===u().id).length;
        return `<button type="button" class="tgt-record-card" data-tgt-action="sheets">${icon('clipboard-list')}<span><strong>Folhas de obra</strong><small>${u()?.role==='funcionario'?'Por verificar pela empresa':count?count+' '+(count===1?'registo teu':'registos teus'):'Consultar os meus registos'}</small></span>${icon('chevron-right')}</button>`;
    }
    function draftsHTML(list) {
        const draft=rows('relatoriosEspecialidade').find(r=>r.rascunho&&r.tecnicoId===u().id&&list.some(job=>job.kind==='os'&&job.id===r.servicoId));
        const job=draft&&list.find(job=>job.kind==='os'&&job.id===draft.servicoId);
        return job?`<button type="button" class="tgt-draft-card" data-tgt-action="reports" data-tgt-kind="os" data-tgt-id="${esc(job.id)}">${icon('file-pen')}<span><strong>Relatório por terminar</strong><small>${esc(label(job))} · ${esc(draft.tipo||'Relatório')} em rascunho</small></span>${icon('chevron-right')}</button>`:'';
    }

    function avatarHTML() {
        const person = rows('funcionarios').find(p => p.id === u()?.id) || rows('encarregados').find(p => p.id === u()?.id);
        const name = String(person?.nome || u()?.nome || 'Técnico').trim();
        const parts = name.split(/\s+/).filter(Boolean);
        const initials = (Array.from(parts[0] || 'T')[0] + (parts.length > 1 ? [...parts[parts.length - 1]][0] : '')).toLocaleUpperCase('pt-PT');
        const photo = String(person?.foto || '').trim();
        const safe = /^(https?:\/\/|\/[^/])/.test(photo) || /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(photo);
        return `<span class="tgt-avatar" role="img" aria-label="${esc(name)}"><span aria-hidden="true">${esc(initials)}</span>${safe ? `<img data-tgt-avatar src="${esc(photo)}" alt="" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
    }
    function renderHome() {
        if (!enabled()) return;
        const dia=$('omeudia');if(!dia)return;
        const list=jobs(),available=todayJobs(list);
        const focus=available.find(job=>job.open)||available.find(job=>job.kind+':'+job.id===selected&&!completed(job))||available.find(job=>!completed(job));
        const openWork=list.find(job=>job.kind==='obra'&&job.open);
        const oldSession=list.some(job=>job.kind==='os'&&job.open&&job.date!==today());
        const day=new Date(today()+'T12:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
        const general=personalClock();
        const team=u()?.role==='encarregado' && window.TGSupervisorHome ? `<details class="tgt-team"><summary>${icon('users')} A minha equipa</summary>${TGSupervisorHome.html(tenant(),today())}</details>`:'';

        const html=`<div class="tgt-home"><header class="tgt-day-head"><p class="tgt-eyebrow">ÁREA DO TÉCNICO</p><h2>O meu dia</h2><p>Hoje · ${esc(day)}</p>${avatarHTML()}</header>${attendance()?`<div class="tgt-clock"><span>${icon('fingerprint')}<span><strong>Ponto de hoje</strong><small>${general?'Entrada às '+esc(general.entrada):'Sem entrada registada'}</small></span></span>${button(general?'Ver ponto':'Picar entrada',general?'point':'clock')}</div>`:''}${openWork?button('Tens uma obra em curso · Abrir Obras','works'):''}${focusHTML(focus)}${recordsHTML()}${todayListHTML(available)}${draftsHTML(list)}${team}</div>`;
        const finalHTML=oldSession?html.replace('</header>','</header>'+button('Entrada anterior por encerrar · Abrir Trabalhos','jobs')):html;
        if(dia.dataset.tgtHtml!==finalHTML){dia.innerHTML=finalHTML;dia.dataset.tgtHtml=finalHTML;}
        dia.style.display=view==='home'&&!document.querySelector('.section-container.active')?'block':'none';
        menu();
    }
    function home() {
        view='home';selected='';_fecharSecaoAbertaMobile();
        if($('painelGrupoMobile'))$('painelGrupoMobile').style.display='none';
        prepareHome();renderHome();mark('home');
        if(typeof _ultimoGrupoMobileAberto!=='undefined')_ultimoGrupoMobileAberto=null;
    }
    function panel(title) {
        _fecharSecaoAbertaMobile();prepareHome();if($('omeudia'))$('omeudia').style.display='none';
        const panel=$('painelGrupoMobile'),content=$('painelGrupoMobileConteudo');if(!panel||!content)return null;
        panel.style.display='block';content.classList.remove('tgn-more');content.classList.add('tgt-panel');
        content.innerHTML=`<div class="tgt-day-head"><p class="tgt-eyebrow">ÁREA DO TÉCNICO</p><h2>${title}</h2></div>`;
        return content;
    }
    function weekDays() {
        const start=new Date(today()+'T12:00:00');start.setDate(start.getDate()-(start.getDay()+6)%7);
        return Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return {date:date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'),label:['seg','ter','qua','qui','sex','sáb','dom'][i],day:date.getDate()};});
    }
    function weekJobs() {
        if(!enabled()||!tenant()||!_licencaValidaTenant()||!permitted('servicos'))return [];
        const days=weekDays().map(day=>day.date);
        return rows('servicos').filter(os=>days.includes(os.data)&&assigned(os,'funcionariosIds','funcionarioId')&&!normal(os.status).includes('cancelad')).map(row=>{
            const client=rows('clientes').find(c=>c.id===row.clienteId),open=rows('ponto').find(p=>p.servicoId===row.id&&p.funcionarioId===u().id&&p.entrada&&!p.saida);
            return {id:row.id,kind:'os',row,date:row.data,hour:row.hora||'',title:row.descricao||'Ordem de serviço',client:client?.nome||client?.empresa||'Cliente não indicado',open};
        }).sort((a,b)=>a.date.localeCompare(b.date)||(a.hour||'99:99').localeCompare(b.hour||'99:99'));
    }
    function workList() {
        view='jobs';const content=panel('Agenda da semana');if(!content)return;
        const days=weekDays(),list=weekJobs();if(!days.some(day=>day.date===weekDay))weekDay=today();
        content.insertAdjacentHTML('beforeend',`<p class="tgt-week-range">${days[0].date.split('-').reverse().slice(0,2).join('/')} – ${days[6].date.split('-').reverse().slice(0,2).join('/')}</p><nav class="tgt-week-days" role="tablist" aria-label="Dias desta semana">${days.map(day=>`<button type="button" role="tab" id="tgt-day-${day.date}" data-tgt-day="${day.date}" aria-controls="tgt-week-day-content" aria-selected="${day.date===weekDay}" ${day.date===today()?'class="tgt-is-today"':''}><span>${esc(day.label)}</span><strong>${day.day}</strong><small>${list.filter(job=>job.date===day.date).length} OS</small></button>`).join('')}</nav><p class="tgt-week-note">${weekDay===today()?'Hoje: podes abrir a OS e iniciar a intervenção.':'Só consulta. A entrada só está disponível nas OS de hoje.'}</p><div id="tgt-week-day-content" role="tabpanel" aria-labelledby="tgt-day-${weekDay}">${todayListHTML(list.filter(job=>job.date===weekDay),weekDay===today()?'OS de hoje':'OS de '+weekDay.split('-').reverse().slice(0,2).join('/'),weekDay!==today())}</div>`);menu();
        const strip=content.querySelector('.tgt-week-days'),tab=strip.querySelector('[aria-selected="true"]');
        strip.scrollLeft=tab.offsetLeft-strip.offsetLeft-(strip.clientWidth-tab.clientWidth)/2;
        const oldSession=jobs().find(job=>job.kind==='os'&&job.open&&job.date!==today());
        if(oldSession)content.insertAdjacentHTML('beforeend','<h3 class="tgt-pending-title">Entrada anterior por encerrar</h3>'+focusHTML(oldSession));
    }
    function worksList() {
        view='works';const content=panel('Obras ativas');if(!content)return;
        const list=jobs().filter(job=>job.kind==='obra'),focus=list.find(job=>job.open)||list.find(job=>job.kind+':'+job.id===selected);
        if(focus)content.insertAdjacentHTML('beforeend',focusHTML(focus));
        content.insertAdjacentHTML('beforeend',list.length?list.map(job=>rowHTML(job)).join(''):'<p class="tgt-message">Sem obras ativas atribuídas a ti.</p>');menu();
    }
    function more() {
        view='more';const content=panel('O meu perfil');if(!content)return;
        const actions=document.createElement('div');actions.className='tgt-shortcuts';
        actions.innerHTML=button(icon('user')+' Editar o meu perfil','profile')+(permitted('pedidos')?button(icon('umbrella-beach')+' Férias e faltas','leave'):'')+(attendance()&&permitted('ponto')?button(icon('clock')+' O meu registo de ponto','point'):'')+(permitted('folhas')?button(icon('clipboard-list')+' As minhas folhas de obra','sheets'):'');
        if(permitted('ferramentas')){const b=document.createElement('button');b.type='button';b.className='tgt-button';b.dataset.tgtCard='ferramentas';b.textContent='Equipamentos e QR';actions.append(b);}
        content.append(actions);menu();
    }
    function navigate(open) {const result=open();window.scrollTo({top:0,behavior:'auto'});return result;}
    function passportTarget(job) {
        const customerId = job?.row?.clienteId, localId = job?.row?.localId || '';
        if (!customerId || !window.TGPassport?.scope(customerId, localId)) return null;
        return { customerId, localId };
    }
    function openPassport(job) {
        const target = passportTarget(job); if (!target) return;
        $('modalGenericoOverlay')?.classList.remove('open');
        return window.TGPassport.open(target.customerId, target.localId);
    }
    function notes(job) {
        const overlay=$('modalGenericoOverlay'),fields=$('modalGenericoCampos'),form=$('modalGenericoForm');if(!overlay||!fields||!form)return;
        $('modalGenericoTitulo').textContent='Notas · '+label(job);
        fields.innerHTML=`<section class="tgt-notes"><h3>${esc(job.title)}</h3><p class="tgt-message">Observações da ${job.kind==='os'?'ordem de serviço':'obra'}</p><p class="tgt-note-text">${esc(job.row.observacoes||'Sem observações registadas.')}</p><div class="tgt-note-actions">${passportTarget(job)?button(icon('id-card')+' Ver passaporte de instalação','passport',job):'<p class="tgt-message">Passaporte de instalação indisponível neste trabalho.</p>'}${button('Abrir relatórios','reports',job)}</div></section>`;
        form.onsubmit=event=>{event.preventDefault();_fecharModalGenerico();};
        const close=overlay.querySelector('.modal-actions .btn-success');if(close){close.style.display='';close.textContent='Fechar';}
        overlay.classList.add('open');
    }
    function details(job,tab) {
        if(job.kind==='os'){abrirVerOS(job.id);if(tab&&typeof _verOsMostrar==='function')_verOsMostrar(job.id,tab);}
        else abrirObraLongaDetalhe(job.id,tab==='relatorios'?'relatorios':tab==='materiais'?'materiais':'resumo');
    }

    // A wizard groups the existing fields without copying them or replacing native save,
    // cancellation, material consumption, clock rollback or report completion handlers.
    function protectFieldFont(field, wizard) {
        if (!field.matches?.('input,textarea,select') || ['hidden','checkbox','radio','range','color'].includes(field.type)) return;
        if (!wizard.fonts.has(field)) wizard.fonts.set(field, [field.style.getPropertyValue('font-size'), field.style.getPropertyPriority('font-size')]);
        const size = Math.max(16, parseFloat(getComputedStyle(field).fontSize) || 16);
        field.style.setProperty('font-size', size + 'px', 'important');
    }
    function installWizard() {
        if(!enabled())return;
        const form=$('modalForm'),fields=$('modalCampos'),overlay=$('modalOverlay');
        if(!form||!fields||!overlay?.classList.contains('open')||!$('fo_descricao')||wizards.has(form))return;
        const children=[...fields.children];if(!children.length)return;
        const submit=$('modalSubmitBtn');if(!submit)return;
        const wizard={form,fields,submit,submitText:submit.innerHTML,noValidate:form.noValidate,step:0,parts:[],root:null,fonts:new Map()};
        const root=document.createElement('div');root.className='tgt-wizard';
        root.innerHTML='<p class="tgt-eyebrow">FOLHA DE OBRA</p><nav class="tgt-wizard-tabs" aria-label="Etapas da folha"><button type="button" data-tgt-step="0">1 · Trabalho</button><button type="button" data-tgt-step="1">2 · Materiais</button><button type="button" data-tgt-step="2">3 · Rever</button></nav>';
        const pages=[0,1,2].map(i=>{const page=document.createElement('section');page.className='tgt-wizard-page';page.dataset.tgtPage=i;root.append(page);return page;});
        const review=document.createElement('div');review.className='tgt-review';review.setAttribute('aria-live','polite');pages[2].append(review);
        children.forEach(node=>{
            let step=0;
            if(node.id==='fo_assinatura_cont')step=2;
            else if(node.id==='fo_plano_materiais'||node.querySelector('#fo_mat_sim,#fo_materiais'))step=1;
            wizard.parts.push({node,step});pages[step].append(node);
        });
        const actions=document.createElement('div');actions.className='tgt-wizard-actions';actions.innerHTML=button('Voltar','wizard-back')+button('Continuar','wizard-next',null,true);root.append(actions);
        fields.append(root);wizard.root=root;wizard.pages=pages;wizard.review=review;form.noValidate=true;
        root.querySelectorAll('input,textarea,select').forEach(field => protectFieldFont(field, wizard));
        wizards.set(form,wizard);setStep(wizard,0);
    }
    function validate(wizard,step) {
        const invalid=[...wizard.pages[step].querySelectorAll('input,textarea,select')].find(el=>el.willValidate&&!el.validity.valid);
        if(invalid){setStep(wizard,step);invalid.reportValidity();return false;}
        if(step===1&&$('fo_mat_sim')&&!$('fo_mat_sim').classList.contains('ativo')&&!$('fo_mat_nao')?.classList.contains('ativo')){
            setStep(wizard,1);let error=wizard.pages[1].querySelector('.tgt-error');
            if(!error){error=document.createElement('p');error.className='tgt-error';error.setAttribute('role','alert');wizard.pages[1].prepend(error);}
            error.textContent='Indica se usaste materiais: Sim ou Não.';$('fo_mat_sim').focus();return false;
        }
        wizard.pages[step].querySelector('.tgt-error')?.remove();return true;
    }
    function setStep(wizard,step) {
        wizard.step=step;
        wizard.pages.forEach((page,i)=>{page.hidden=i!==step;});
        wizard.root.querySelectorAll('[data-tgt-step]').forEach((b,i)=>{b.setAttribute('aria-current',i===step?'step':'false');});
        wizard.root.querySelector('[data-tgt-action="wizard-back"]').hidden=step===0;
        wizard.root.querySelector('[data-tgt-action="wizard-next"]').hidden=step===2;
        wizard.submit.hidden=step!==2;
        wizard.submit.innerHTML='Confirmar e guardar folha';
        if(step===2){
            const materialRows=[...document.querySelectorAll('#fo_plano_materiais .fo-consumo, #fo_plano_materiais .fo-consumo-extra')].filter(input=>Number(input.value)>0).map(input=>{
                const art=rows('artigos').find(a=>a.id===input.dataset.artigo);
                const name=art?.nome||input.parentElement?.parentElement?.firstElementChild?.textContent||'Material';
                return name+': '+input.value+(art?.unidade?' '+art.unidade:'');
            });
            const notes=$('fo_materiais')?.value?.trim();
            const used=$('fo_mat_sim')?.classList.contains('ativo');
            wizard.review.innerHTML=`<h3>Confirma antes de guardar</h3><dl><dt>Obra / OS</dt><dd>${esc($('fo_obra_desc')?.value)}</dd><dt>Data</dt><dd>${esc($('fo_data')?.value?.split('-').reverse().join('/')||'')}</dd><dt>Trabalho realizado</dt><dd>${esc($('fo_descricao')?.value)}</dd><dt>Horas trabalhadas</dt><dd>${esc($('fo_horas')?.value||'0')} h</dd><dt>Materiais</dt><dd>${esc(materialRows.join(' · ')|| (used?'Sem quantidades de material indicadas':'Sem materiais'))}${notes?'<br>'+esc(notes):''}</dd></dl><p>A folha só fica guardada depois de confirmares.</p>`;
            // The native "Assinar" button measures the visible canvas before drawing.
            // Never initialize it again here: going back or rotating must retain the ink.
        }
    }
    function removeWizard(wizard) {
        wizard.fonts.forEach(([value, priority], field) => { if (value) field.style.setProperty('font-size', value, priority); else field.style.removeProperty('font-size'); });
        if(wizard.root.parentElement===wizard.fields)wizard.parts.forEach(({node})=>wizard.fields.append(node));wizard.root.remove();
        wizard.submit.hidden=false;wizard.submit.innerHTML=wizard.submitText;wizard.form.noValidate=wizard.noValidate;wizards.delete(wizard.form);
    }
    function refresh() {
        if(refreshing)return;refreshing=true;
        try {
            const on=enabled(),key=JSON.stringify([u()?.id,u()?.adminId,u()?.role]);
            if(key!==identity){identity=key;view='home';selected='';weekDay='';wizards.forEach(removeWizard);}
            document.body.classList.toggle('tgt-active',on);
            if(on){prepareHome();menu();renderHome();if(view==='jobs')workList();if(view==='works')worksList();installWizard();}
            else if(wasEnabled){
                document.body.classList.remove('tgt-profile');$('menuInferiorMobile')?.classList.remove('tgt-nav');$('painelGrupoMobileConteudo')?.classList.remove('tgt-panel');
                wizards.forEach(removeWizard);if($('omeudia'))delete $('omeudia').dataset.tgtHtml;
                _montarMenuInferiorMobile();renderizarOMeuDia();
                if(!document.querySelector('.section-container.active')&&view==='home')_mostrarInicioConteudo();
            }
            wasEnabled=on;
        }finally{refreshing=false;}
    }
    function wrap(name,fn) {const original=window[name];if(typeof original==='function')window[name]=function(...args){return fn.call(this,original,args);};}
    wrap('_ehPerfilMobile',function(original,args){return enabled()||original.apply(this,args);});
    wrap('_layoutUsaSidebarShell',function(original,args){return enabled()?false:original.apply(this,args);});
    wrap('_obraLongaPontoAberto',function(original,args){return enabled()?rows('obraPontoLonga').find(p=>p.funcionarioId===u().id&&p.obraId===args[0]&&p.entrada&&!p.saida)||null:original.apply(this,args);});
    wrap('_obraLongaPontoAbertoQualquer',function(original,args){return enabled()?rows('obraPontoLonga').find(p=>p.funcionarioId===u().id&&p.entrada&&!p.saida)||null:original.apply(this,args);});
    // The same guards cover entry actions reached from old cards or a stale modal.
    function entryAllowed(id,kind) {return jobs().some(job=>job.kind===kind&&job.id===id&&!completed(job)&&(kind!=='os'||job.date===today()));}
    function denyOtherDay() {const text='Só podes iniciar os trabalhos atribuídos para hoje.';if(typeof mostrarErro==='function')mostrarErro(text);else alert(text);}
    wrap('picarPontoOS',function(original,args){if(enabled()&&args[1]==='entrada'&&!entryAllowed(args[0],'os'))return denyOtherDay();return original.apply(this,args);});
    wrap('obraLongaPicarEntrada',function(original,args){if(enabled()&&!entryAllowed(args[0],'obra'))return denyOtherDay();return original.apply(this,args);});
    wrap('renderizarOMeuDia',function(original,args){if(enabled())return renderHome();return original.apply(this,args);});
    wrap('_mostrarInicioConteudo',function(original,args){if(enabled()){view='home';prepareHome();renderHome();return;}return original.apply(this,args);});
    wrap('_montarMenuInferiorMobile',function(original,args){const result=original.apply(this,args);if(enabled()){document.body.classList.add('tgt-active');menu();}return result;});
    wrap('_voltarMeuDia',function(original,args){if(enabled())return home();return original.apply(this,args);});
    wrap('_abrirGrupoMobile',function(original,args){if(enabled()){view='group';prepareHome();}const result=original.apply(this,args);if(enabled())menu();return result;});
    wrap('abrirSecao',function(original,args){if(enabled()&&args[0]==='obras-longa')return worksList();if(enabled()&&['agenda-obras','servicos'].includes(args[0]))return workList();if(enabled())view=args[0]==='folhas'?'records':args[0]==='pedidos'?'leave':'section';const result=original.apply(this,args);if(enabled())menu();return result;});
    for(const name of ['criarFolhaDaOS','criarFolhaDaObra'])wrap(name,function(original,args){wizards.forEach(removeWizard);const result=original.apply(this,args);installWizard();return result;});
    wrap('abrirModal',function(original,args){wizards.forEach(removeWizard);return original.apply(this,args);});
    document.addEventListener('submit',event=>{
        const wizard=wizards.get(event.target);if(!wizard)return;
        if(wizard.step<2){event.preventDefault();event.stopImmediatePropagation();if(validate(wizard,wizard.step))setStep(wizard,wizard.step+1);return;}
        for(const i of [0,1,2])if(!validate(wizard,i)){event.preventDefault();event.stopImmediatePropagation();return;}
        // Preserve the original submit handler and its error reporting. Do not mark a job
        // complete or claim a save locally; server confirmation stays with the native flow.
    },true);
    document.addEventListener('click',event=>{
        const control=event.target.closest('[data-tgt-nav],[data-tgt-action],[data-tgt-card],[data-tgt-step],[data-tgt-travel],[data-tgt-day]');
        if(!control||!enabled())return;
        if(control.dataset.tgtDay){if(weekDays().some(day=>day.date===control.dataset.tgtDay)){weekDay=control.dataset.tgtDay;workList();document.querySelector('[data-tgt-day="'+weekDay+'"]')?.focus({preventScroll:true});}return;}
        if(control.dataset.tgtAction==='weekly-details'){const job=weekJobs().find(job=>job.id===control.dataset.tgtId);if(job)return details(job);return;}
        if(control.dataset.tgtTravel){const job=jobs().find(j=>j.kind==='os'&&j.id===control.dataset.tgtTravel);if(job&&typeof _registarKmViagemOS==='function')_registarKmViagemOS(job.id);return;}
        if(control.dataset.tgtNav){switch(control.dataset.tgtNav){case'home':return navigate(home);case'jobs':weekDay=today();return navigate(workList);case'works':return navigate(worksList);case'records':if(permitted('folhas'))return abrirSecao('folhas');return;case'more':return navigate(more);}}
        if(control.dataset.tgtCard){if(permitted(control.dataset.tgtCard))document.querySelector(`#cardsGrid [data-card="${CSS.escape(control.dataset.tgtCard)}"]`)?.click();return;}
        const wizard=wizards.get(control.closest('form'));
        if(control.dataset.tgtStep!==undefined&&wizard){const target=Number(control.dataset.tgtStep);if(target<=wizard.step){setStep(wizard,target);return;}for(let i=wizard.step;i<target;i++)if(!validate(wizard,i))return;setStep(wizard,target);return;}
        switch(control.dataset.tgtAction){
            case'jobs':weekDay=today();return navigate(workList);case'works':return navigate(worksList);case'profile':return abrirEditarPerfil();case'point':if(permitted('ponto'))abrirSecao('ponto');return;
            case'sheets':if(permitted('folhas'))abrirSecao('folhas');return;
            case'leave':if(permitted('pedidos'))return navigate(()=>abrirSecao('pedidos'));return;
            case'clock':return picarPonto();
            case'wizard-back':if(wizard)setStep(wizard,Math.max(0,wizard.step-1));return;
            case'wizard-next':if(wizard&&validate(wizard,wizard.step))setStep(wizard,Math.min(2,wizard.step+1));return;
        }
        const job=findJob(control);if(!job)return;
        switch(control.dataset.tgtAction){
            case'choose':if(jobs().some(other=>other.open&&(other.id!==job.id||other.kind!==job.kind)))return details(job);selected=job.kind+':'+job.id;if(job.kind==='obra')return navigate(worksList);view='home';_fecharSecaoAbertaMobile();if($('painelGrupoMobile'))$('painelGrupoMobile').style.display='none';prepareHome();renderHome();window.scrollTo({top:0,behavior:'auto'});return;
            case'details':return details(job);
            case'photos':return details(job,'fotos');
            case'notes':return notes(job);
            case'passport':return openPassport(job);
            case'reports':return details(job,'relatorios');
            case'materials':return details(job,'materiais');
            case'start':if(completed(job))return;if(express()&&job.kind==='os')return criarFolhaDaOS(job.id);if(attendance()&&!personalClock()&&!resumingLunch(job))return picarPonto();if(job.open)return;return job.kind==='os'?picarPontoOS(job.id,'entrada'):obraLongaPicarEntrada(job.id);
            case'exit':if(!job.open)return;return job.kind==='os'?picarPontoOS(job.id,'saida'):obraLongaPicarSaida(job.id);
        }
    });
    // Watch only modal open/close. Native constructors are synchronous, so background
    // renders never reconstruct a wizard or overwrite text, materials or signatures.
    if($('modalOverlay'))new MutationObserver(()=>{
        if(!$('modalOverlay').classList.contains('open'))wizards.forEach(removeWizard);else installWizard();
    }).observe($('modalOverlay'),{attributes:true,attributeFilter:['class']});
    const protectFocusedField = event => {
        if (!enabled()) return;
        const wizard = wizards.get(event.target.form);
        if (wizard) protectFieldFont(event.target, wizard);
    };
    document.addEventListener('pointerdown', protectFocusedField, true);
    document.addEventListener('focusin', protectFocusedField, true);
    document.addEventListener('error', event => {
        if (event.target.matches?.('img[data-tgt-avatar]')) event.target.hidden = true;
    }, true);
    document.addEventListener('tg:interface-updated',refresh);
    let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(refresh,180);});
    window.TGTechnician={refresh,jobs,todayJobs,weekJobs,enabled};refresh();
}());
