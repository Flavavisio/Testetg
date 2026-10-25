/* Teste TG: a personal, guided phone workspace. All writes use the native flows. */
(function () {
    'use strict';
    if (window.TGTechnician) return;
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const u = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const enabled = () => innerWidth <= 900 && ['funcionario','encarregado'].includes(u()?.role)
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
    let view = 'home', identity = '', selected = '', wasEnabled = false, refreshing = false;
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
                if (!assigned(row,people,fallback) || !open && done(kind==='os'?row.status:row.estado)) return;
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
    function mark(name) {
        document.querySelectorAll('#menuInferiorMobile [data-tgt-nav]').forEach(el => {
            el.classList.toggle('ativo',el.dataset.tgtNav===name);
            if (el.dataset.tgtNav===name) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
        });
    }
    function menu() {
        const nav=$('menuInferiorMobile');if (!enabled() || !nav) return;
        nav.classList.add('tgt-nav');nav.style.display='grid';document.body.classList.add('tem-menu-inferior');
        if (!nav.querySelector('[data-tgt-nav]')) nav.innerHTML=[['home','house','Hoje'],['jobs','briefcase','Trabalhos'],['more','bars','Mais']].map(([key,ico,text])=>`<button type="button" class="menu-inf-item" data-tgt-nav="${key}"${key==='home'?' id="menuInfHome"':''}>${icon(ico)}<span>${text}</span></button>`).join('');
        mark(view==='home'?'home':view==='jobs'?'jobs':view==='more'||view==='group'?'more':'');
    }
    function prepareHome() {
        const grid=$('cardsGrid'),home=$('tgHome'),dia=$('omeudia');
        if(grid)grid.style.display='';if(home)home.style.display='none';
        if (dia && grid && dia.parentElement!==grid)grid.prepend(dia);
        document.body.classList.remove('com-sidebar');
        const groups=$('dashboardGrupos')||document.querySelector('#cardsGrid .dashboard-grupos');if(groups)groups.style.display='none';
    }
    function rowHTML(job) {
        return `<button type="button" class="tgt-job" data-tgt-action="choose" data-tgt-kind="${job.kind}" data-tgt-id="${esc(job.id)}"><span class="tgt-job-time">${esc(job.open?'Em curso':job.hour|| (job.kind==='obra'?'Obra':'Sem hora'))}</span><span><strong>${esc(job.title)}</strong><small>${esc(job.client)} · ${esc(label(job))}${job.date&&job.date!==today()?' · '+esc(job.date.split('-').reverse().join('/')):''}</small></span>${icon('chevron-right')}</button>`;
    }
    function focusHTML(job) {
        if (!job) return `<section class="tgt-empty">${icon('circle-check')}<h3>Sem intervenções para hoje</h3><p>Os trabalhos atribuídos aparecem aqui. Consulta os próximos em Trabalhos.</p>${button('Ver os meus trabalhos','jobs')}</section>`;
        const open=!!job.open, ex=express(), clock=!!personalClock();
        let map=null;
        if (typeof _osMapaInfo==='function')map=_osMapaInfo(job.row.clienteId,job.address,job.row.localId);
        // Keep navigation URLs supplied by the existing location resolver, never arbitrary schemes.
        const mapLink=map && /^https:\/\//i.test(map.url||'')?`<a class="tgt-button" href="${esc(map.url)}" target="_blank" rel="noopener"${job.kind==='os'?` data-tgt-travel="${esc(job.id)}"`:''}>${icon('route')} Navegar</a>`:'';
        const status=open?'EM INTERVENÇÃO':normal(job.row.status||job.row.estado).includes('almoco')?'REGRESSAR DO ALMOÇO':'PRÓXIMO TRABALHO';
        const resume=resumingLunch(job);
        const startLabel=ex?'Preencher folha de obra':open?'Registar saída e continuar':resume?'Regressar à intervenção':!clock?'Picar entrada no dia':'Já estou no local · Iniciar';
        const help=ex?'Preenche a folha com o trabalho que realizaste.':open?'Ao sair, escolhe almoço, saída ou conclusão. A folha abre quando for necessária.':!clock?'Começa por registar a tua entrada no dia. Depois podes iniciar a intervenção.':'Confirma a entrada no local para começar a contar o tempo.';
        return `<section class="tgt-focus" aria-label="Intervenção em destaque"><div class="tgt-focus-head"><span class="tgt-badge">${status}${job.hour?' · '+esc(job.hour):''}</span><span>${esc(label(job))}</span></div><h3>${esc(job.title)}</h3><p class="tgt-client">${esc(job.client)}</p>${button('Ver detalhes '+icon('arrow-up-right-from-square'),'details',job)}
            <ol class="tgt-steps"><li class="${open?'tgt-complete':'tgt-current'}"><span class="tgt-step">${open?icon('check'):'1'}</span><div><h4>${ex?'Identificar o trabalho':'Chegar e iniciar'}</h4>${!open?`<p>${esc(help)}</p>${job.address?`<div class="tgt-location">${icon('location-dot')}<span>${esc(job.address)}</span></div>`:''}${job.row.observacoes?`<details class="tgt-observations"><summary>Observações de acesso e trabalho</summary><p>${esc(job.row.observacoes)}</p></details>`:''}${mapLink}${button(startLabel,'start',job,true)}`:`<p>Entrada registada às ${esc(job.open.entrada)}${job.open.data!==today()?' · '+esc(job.open.data):''}</p>`}</div></li>
            <li class="${open?'tgt-current':''}"><span class="tgt-step">2</span><div><h4>Registar o trabalho</h4><p>${open?esc(help):'Folha de obra, materiais e relatórios.'}</p>${open?`<div class="tgt-tools">${job.kind==='os'?button(icon('camera')+' Fotografias','photos',job):''}${button(icon('file-signature')+' Relatórios','reports',job)}</div>${button(startLabel,'exit',job,true)}`:''}</div></li>
            <li><span class="tgt-step">3</span><div><h4>Rever e guardar a folha</h4><p>Confirma os dados antes de guardar.</p></div></li></ol></section>`;
    }
    function renderHome() {
        if (!enabled()) return;
        const dia=$('omeudia');if(!dia)return;
        const list=jobs(),available=list.filter(job=>job.open || job.kind==='obra'&&(!job.date||job.date<=today()) || job.kind==='os'&&job.date===today());
        const focus=list.find(job=>job.open)||list.find(job=>job.kind+':'+job.id===selected)||available[0];
        const name=(u()?.nome||rows(u()?.role==='encarregado'?'encarregados':'funcionarios').find(p=>p.id===u()?.id)?.nome||'').split(' ')[0];
        const day=new Date(today()+'T12:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
        const general=personalClock();
        const team=u()?.role==='encarregado' && window.TGSupervisorHome ? `<details class="tgt-team"><summary>${icon('users')} A minha equipa</summary>${TGSupervisorHome.html(tenant(),today())}</details>`:'';
        const html=`<div class="tgt-home"><header class="tgt-day-head"><p class="tgt-eyebrow">${esc(day)}</p><h2>${focus?.open?'Continuar a intervenção':name?'Olá, '+esc(name):'O meu dia'}</h2><p>Uma tarefa de cada vez.</p></header>${!express()?`<div class="tgt-clock"><span>${icon('clock')} ${general?'Entrada no dia às '+esc(general.entrada):'Ainda não picaste a entrada no dia'}</span>${button(general?'Ver ponto':'Picar entrada',general?'point':'clock')}</div>`:''}${focusHTML(focus)}${available.filter(j=>j!==focus).length?`<section class="tgt-next"><h3>Outros trabalhos de hoje</h3>${available.filter(j=>j!==focus).map(rowHTML).join('')}</section>`:''}${team}</div>`;
        if(dia.dataset.tgtHtml!==html){dia.innerHTML=html;dia.dataset.tgtHtml=html;}
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
    function workList() {
        view='jobs';const content=panel('Os meus trabalhos');if(!content)return;
        const list=jobs();content.insertAdjacentHTML('beforeend',list.length?list.map(rowHTML).join(''):'<p class="tgt-message">Sem trabalhos por concluir atribuídos a ti.</p>');menu();
    }
    function more() {
        view='more';const content=panel('Mais');if(!content)return;
        const actions=document.createElement('div');actions.className='tgt-shortcuts';
        actions.innerHTML=button(icon('user')+' O meu perfil','profile')+(permitted('ponto')?button(icon('clock')+' O meu registo de ponto','point'):'')+(permitted('folhas')?button(icon('clipboard-list')+' As minhas folhas de obra','sheets'):'');content.append(actions);
        // Delegate each original card to its original click/href, preserving module gates.
        document.querySelectorAll('#cardsGrid .grupo-cards').forEach(group=>{
            const cards=[...group.querySelectorAll('.card-principal[data-card]')].filter(el=>permitted(el.dataset.card));if(!cards.length)return;
            const section=document.createElement('details');section.className='tgt-menu-group';
            const heading=document.createElement('summary');heading.textContent=group.querySelector('.grupo-header h3')?.textContent.trim()||'Outras funções';section.append(heading);
            cards.forEach(card=>{const b=document.createElement('button');b.type='button';b.className='tgt-button';b.dataset.tgtCard=card.dataset.card;b.textContent=card.querySelector('h3')?.textContent||card.dataset.card;section.append(b);});content.append(section);
        });menu();
    }
    function details(job,tab) {
        if(job.kind==='os'){abrirVerOS(job.id);if(tab&&typeof _verOsMostrar==='function')_verOsMostrar(job.id,tab);}
        else abrirObraLongaDetalhe(job.id,tab==='relatorios'?'relatorios':'resumo');
    }

    // A wizard groups the existing fields without copying them or replacing native save,
    // cancellation, material consumption, clock rollback or report completion handlers.
    function installWizard() {
        if(!enabled())return;
        const form=$('modalForm'),fields=$('modalCampos'),overlay=$('modalOverlay');
        if(!form||!fields||!overlay?.classList.contains('open')||!$('fo_descricao')||wizards.has(form))return;
        const children=[...fields.children];if(!children.length)return;
        const submit=$('modalSubmitBtn');if(!submit)return;
        const wizard={form,fields,submit,submitText:submit.innerHTML,noValidate:form.noValidate,step:0,parts:[],root:null};
        const root=document.createElement('div');root.className='tgt-wizard';
        root.innerHTML='<p class="tgt-eyebrow">FOLHA DE OBRA · PASSO A PASSO</p><nav class="tgt-wizard-tabs" aria-label="Etapas da folha"><button type="button" data-tgt-step="0">1 · Trabalho</button><button type="button" data-tgt-step="1">2 · Materiais</button><button type="button" data-tgt-step="2">3 · Rever</button></nav>';
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
        if(wizard.root.parentElement===wizard.fields)wizard.parts.forEach(({node})=>wizard.fields.append(node));wizard.root.remove();
        wizard.submit.hidden=false;wizard.submit.innerHTML=wizard.submitText;wizard.form.noValidate=wizard.noValidate;wizards.delete(wizard.form);
    }
    function refresh() {
        if(refreshing)return;refreshing=true;
        try {
            const on=enabled(),key=JSON.stringify([u()?.id,u()?.adminId,u()?.role]);
            if(key!==identity){identity=key;view='home';selected='';wizards.forEach(removeWizard);}
            document.body.classList.toggle('tgt-active',on);
            if(on){prepareHome();menu();renderHome();if(view==='jobs')workList();installWizard();}
            else if(wasEnabled){
                $('menuInferiorMobile')?.classList.remove('tgt-nav');$('painelGrupoMobileConteudo')?.classList.remove('tgt-panel');
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
    wrap('renderizarOMeuDia',function(original,args){if(enabled())return renderHome();return original.apply(this,args);});
    wrap('_mostrarInicioConteudo',function(original,args){if(enabled()){view='home';prepareHome();renderHome();return;}return original.apply(this,args);});
    wrap('_montarMenuInferiorMobile',function(original,args){const result=original.apply(this,args);if(enabled()){document.body.classList.add('tgt-active');menu();}return result;});
    wrap('_voltarMeuDia',function(original,args){if(enabled())return home();return original.apply(this,args);});
    wrap('_abrirGrupoMobile',function(original,args){if(enabled()){view='group';prepareHome();}const result=original.apply(this,args);if(enabled())menu();return result;});
    wrap('abrirSecao',function(original,args){if(enabled())view='section';const result=original.apply(this,args);if(enabled())menu();return result;});
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
        const control=event.target.closest('[data-tgt-nav],[data-tgt-action],[data-tgt-card],[data-tgt-step],[data-tgt-travel]');
        if(!control||!enabled())return;
        if(control.dataset.tgtTravel){const job=jobs().find(j=>j.kind==='os'&&j.id===control.dataset.tgtTravel);if(job&&typeof _registarKmViagemOS==='function')_registarKmViagemOS(job.id);return;}
        if(control.dataset.tgtNav){switch(control.dataset.tgtNav){case'home':return home();case'jobs':return workList();case'more':return more();}}
        if(control.dataset.tgtCard){if(permitted(control.dataset.tgtCard))document.querySelector(`#cardsGrid [data-card="${CSS.escape(control.dataset.tgtCard)}"]`)?.click();return;}
        const wizard=wizards.get(control.closest('form'));
        if(control.dataset.tgtStep!==undefined&&wizard){const target=Number(control.dataset.tgtStep);if(target<=wizard.step){setStep(wizard,target);return;}for(let i=wizard.step;i<target;i++)if(!validate(wizard,i))return;setStep(wizard,target);return;}
        switch(control.dataset.tgtAction){
            case'jobs':return workList();case'profile':return abrirEditarPerfil();case'point':if(permitted('ponto'))abrirSecao('ponto');return;
            case'sheets':if(permitted('folhas'))abrirSecao('folhas');return;
            case'clock':return picarPonto();
            case'wizard-back':if(wizard)setStep(wizard,Math.max(0,wizard.step-1));return;
            case'wizard-next':if(wizard&&validate(wizard,wizard.step))setStep(wizard,Math.min(2,wizard.step+1));return;
        }
        const job=findJob(control);if(!job)return;
        switch(control.dataset.tgtAction){
            case'choose':selected=job.kind+':'+job.id;view='home';_fecharSecaoAbertaMobile();if($('painelGrupoMobile'))$('painelGrupoMobile').style.display='none';prepareHome();renderHome();return;
            case'details':return details(job);
            case'photos':return details(job,'fotos');
            case'reports':return details(job,'relatorios');
            case'start':if(express()&&job.kind==='os')return criarFolhaDaOS(job.id);if(!personalClock()&&!resumingLunch(job))return picarPonto();if(job.open)return;return job.kind==='os'?picarPontoOS(job.id,'entrada'):obraLongaPicarEntrada(job.id);
            case'exit':if(!job.open)return;return job.kind==='os'?picarPontoOS(job.id,'saida'):obraLongaPicarSaida(job.id);
        }
    });
    // Watch only modal open/close. Native constructors are synchronous, so background
    // renders never reconstruct a wizard or overwrite text, materials or signatures.
    if($('modalOverlay'))new MutationObserver(()=>{
        if(!$('modalOverlay').classList.contains('open'))wizards.forEach(removeWizard);else installWizard();
    }).observe($('modalOverlay'),{attributes:true,attributeFilter:['class']});
    document.addEventListener('tg:interface-updated',refresh);
    let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(refresh,180);});
    window.TGTechnician={refresh,jobs,enabled};refresh();
}());
