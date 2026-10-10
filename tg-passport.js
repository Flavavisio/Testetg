/* Installation passport. Reuses customer/local/equipment/OS records and never replaces history. */
(function () {
    'use strict';
    let current = null, serial = 0;
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const actor = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    const identity = () => JSON.stringify([actor()?.id,actor()?.adminId,actor()?.role]);
    const types = {cctv:'Videovigilância',intrusao:'Intrusão',acessos:'Controlo de acessos',incendio:'Incêndio',rede:'Rede / PoE',outro:'Outro'};
    const statuses = {operacional:'Operacional',avaria:'Com avaria',verificar:'A verificar',desativado:'Desativado'};
    const assigned = (r,u) => r.funcionarioId === u.id || (r.funcionariosIds || []).includes(u.id) || r.relatorioResponsavelId === u.id;
    const url = v => {
        if (!v || !/^(https?:\/\/|\/[^/])/.test(String(v).trim())) return '';
        try { const u = new URL(String(v).trim(),location.href); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; }
    };
    const day = v => { if(!v)return 'Sem data';const d=new Date(typeof v==='number'?v:/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v);return isNaN(d)?'Sem data':d.toLocaleDateString('pt-PT'); };
    function scope(customerId,localId='') {
        const u=actor(); if(!u || !['admin','subadmin','funcionario','encarregado'].includes(u.role) || !_licencaValidaTenant() || typeof moduloPassaporteAtivo!=='function' || !moduloPassaporteAtivo(adminDoUtilizador()))return null;
        const tenant=u.adminId || u.id;
        const customer=(dados.clientes || []).find(c=>c.id===customerId && c.adminId===tenant); if(!customer)return null;
        const local=localId ? (dados.locais || []).find(l=>l.id===localId && l.adminId===tenant && l.clienteId===customerId) : null;
        if(localId && !local)return null;
        const manager=['admin','subadmin'].includes(u.role);
        if(!manager && !(dados.servicos || []).some(r=>r.adminId===tenant && r.clienteId===customerId && (r.localId || '')===localId && assigned(r,u)))return null;
        return {tenant,customer,local,customerId,localId,manager,identity:identity(),meta:object((local || customer).passaporteTecnico)};
    }
    function equipment(s) {
        const allowed=typeof moduloContratosAtivo==='function' && moduloContratosAtivo(adminDoUtilizador());
        const contracts=allowed ? (dados.contratos || []).filter(c=>c.adminId===s.tenant && c.clienteId===s.customerId && _contratoAbrangeLocal(c,s.localId)) : [];
        const ids=new Set(contracts.flatMap(c=>_contratoEquipamentos(c,s.localId).map(e=>e.id)));
        return (dados.equipamentos || []).filter(e=>e.adminId===s.tenant && !e.apagadoSuperAdmin && (
            (e.clienteId===s.customerId && (e.localId || '')===s.localId) ||
            (allowed && e.localId && e.localId===s.localId && (!e.clienteId || e.clienteId===s.customerId)) ||
            (ids.has(e.id) && (!e.localId || e.localId===s.localId) && (!e.clienteId || e.clienteId===s.customerId))
        ));
    }
    function records(s,services) {
        return services.filter(r=>r.adminId===s.tenant && r.clienteId===s.customerId && (r.localId || '')===s.localId && !r.apagadoSuperAdmin)
            .sort((a,b)=>String(b.data || '').localeCompare(String(a.data || '')) || String(b.id).localeCompare(String(a.id)));
    }
    const valid = st => current===st && st.serial===serial && st.identity===identity() && !!scope(st.customerId,st.localId) && st.host?.isConnected && (!st.workspace || (window._wsAbaAtual==='locais' && document.getElementById('wsClienteOverlay')?.classList.contains('open') && document.getElementById('wsClienteOverlay').dataset.clienteAtual===st.customerId));
    function sites(customerId) {
        const s=scope(customerId);if(!s)return [];
        return [{id:'',nome:'Sede',morada:s.customer.morada || s.customer.endereco,passaporteTecnico:s.customer.passaporteTecnico},...(dados.locais || []).filter(l=>l.adminId===s.tenant && l.clienteId===customerId)];
    }
    const image = (v,alt,cls='') => url(v) ? `<img class="${cls}" src="${esc(url(v))}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="tg-pp-placeholder ${cls}"><i class="fas fa-building" aria-hidden="true"></i><span>${esc(alt)}</span></div>`;
    const button = (action,label,id='',cls='btn-outline') => `<button type="button" class="btn ${cls}" data-pp-action="${action}"${id?` data-pp-id="${esc(id)}"`:''}>${label}</button>`;
    const text = (label,value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || 'Não registado')}</dd></div>`;
    const photoURL = f => typeof f==='string'?f:f?.url;
    function osButton(os) {
        if(!scope(os.clienteId,os.localId || ''))return '';
        return `<button type="button" class="btn btn-sm btn-outline" data-pp-os="${esc(os.id)}"><i class="fas fa-id-card" aria-hidden="true"></i> Consultar instalação</button>`;
    }
    function ensureOverlay() {
        let overlay=document.getElementById('tgPassportOverlay');
        if(!overlay){overlay=document.createElement('div');overlay.id='tgPassportOverlay';overlay.className='modal-overlay';overlay.innerHTML='<div class="modal tg-pp-modal" role="dialog" aria-modal="true" aria-label="Passaporte de Instalação"><button type="button" class="close-modal" data-pp-close aria-label="Fechar passaporte">×</button><div id="tgPassportContent"></div></div>';document.body.appendChild(overlay);}
        overlay.classList.add('open');return overlay.querySelector('#tgPassportContent');
    }
    async function open(customerId,localId='') {
        if(!scope(customerId,localId))return;
        const manager=['admin','subadmin'].includes(actor().role), ws=document.getElementById('wsClienteOverlay');
        if(manager && ws?.classList.contains('open')){await _wsClienteAba(customerId,'locais');if(current && current.workspace && current.customerId===customerId)await select(localId);}
        else await mount(customerId,localId,ensureOverlay(),false);
    }
    async function show(customerId) {
        const host=document.getElementById('wsClienteConteudo');if(!host)return;
        const s=scope(customerId);if(!s?.manager){host.textContent='Sem acesso às instalações deste cliente.';return;}
        const st={serial:++serial,customerId,localId:'',identity:identity(),host,workspace:true,services:[]};current=st;
        host.innerHTML='<section class="tg-passport"><div class="tg-pp-heading"><div><span class="tg-pp-eyebrow">PASSAPORTE DE INSTALAÇÃO</span><h2>Conhecer o local antes de começar</h2><p>Equipamentos, ligações e intervenções reunidos por instalação.</p></div>'+button('new-site','<i class="fas fa-plus"></i> Nova instalação','','btn-primary')+'</div><div class="tg-pp-sites">'+sites(customerId).map(l=>{
            const ls=scope(customerId,l.id),eq=equipment(ls),os=records(ls,dados.servicos || []);return `<div class="tg-pp-site-entry"><button type="button" class="tg-pp-site" style="width:100%;" data-pp-site="${esc(l.id)}">${image(object(l.passaporteTecnico).foto,l.nome)}<div><h3>${esc(l.nome)}</h3><p>${esc(l.morada || 'Morada por registar')}</p><span>${eq.length} equipamentos · ${os.length} OS carregadas</span><strong>Abrir passaporte <i class="fas fa-arrow-right"></i></strong></div></button><div class="tg-pp-actions" style="margin-top:8px;">${button('edit-address','<i class="fas fa-pen"></i> Editar instalação',l.id)}${l.id?button('delete-site','<i class="fas fa-trash"></i> Apagar',l.id,'btn-danger'):''}</div></div>`;
        }).join('')+'</div></section>';
        host.onclick=async event=>{
            if(!valid(st))return;
            const site=event.target.closest('[data-pp-site]'),action=event.target.closest('[data-pp-action]');
            if(site)select(site.dataset.ppSite);
            else if(action?.dataset.ppAction==='new-site'){_wsSairPara(customerId);abrirModalNovoLocalCliente(customerId);}
            else if(action?.dataset.ppAction==='delete-site'){
                const localId=action.dataset.ppId;if(localId && scope(customerId,localId))await eliminarLocalCliente(localId,customerId);
            }
            else if(action?.dataset.ppAction==='edit-address'){
                const localId=action.dataset.ppId || '';if(!scope(customerId,localId))return;
                _wsSairPara(customerId);
                if(localId)abrirModalLocalCliente(customerId,localId);else abrirModal('cliente',customerId);
            }
        };
    }
    async function select(localId) {
        if(!current || !scope(current.customerId,localId))return;
        await mount(current.customerId,localId,current.host,current.workspace);
    }
    async function mount(customerId,localId,host,workspace) {
        const s=scope(customerId,localId);if(!s)return;
        const st={serial:++serial,customerId,localId,host,workspace,identity:identity(),services:[],limit:20,term:'',type:''};current=st;
        host.innerHTML='<div class="tg-passport" role="status">A carregar o passaporte e as intervenções anteriores…</div>';
        let rows=(dados.servicos || []).filter(r=>r.adminId===s.tenant && r.clienteId===customerId);
        try {
            const q=supa.from('servicos').select('*').eq('admin_id',s.tenant).eq('cliente_id',customerId).order('data',{ascending:false}).order('id',{ascending:false});
            const {data,error}=await _buscarPaginadoGenerico(q);if(error)throw error;
            if(!valid(st))return;
            rows=[...new Map([...(data || []).map(M.servicos.from),...rows].map(r=>[r.id,r])).values()];
        } catch (_) {st.incomplete=true;}
        if(!valid(st))return;
        st.services=rows;render(st);
    }
    function render(st=current) {
        if(!st || !valid(st))return;
        const s=scope(st.customerId,st.localId),m=s.meta,local=s.local || s.customer,eq=equipment(s),history=records(s,st.services),last=history[0];
        const name=s.local?.nome || 'Sede',faults=eq.filter(e=>object(e.fichaTecnica).estado==='avaria');
        const lastPhotos=(last?.fotos || []).filter(f=>url(photoURL(f))).slice(-4),lastNote=object(last?.passaporteIntervencao).proximoTecnico;
        st.host.innerHTML=`<section class="tg-passport">
            <div class="tg-pp-heading"><div>${st.workspace?button('sites','← Instalações'):''}<span class="tg-pp-eyebrow">PASSAPORTE DE INSTALAÇÃO</span><h2>${esc(name)}</h2><p>${esc(s.customer.nome)} · ${esc([local.morada || local.endereco,local.numeroPorta,local.cidade].filter(Boolean).join(', ') || 'Morada por registar')}</p></div><div class="tg-pp-actions">${s.manager?button('edit-site','<i class="fas fa-pen"></i> Editar ficha'):''}${s.manager?button('new-os','<i class="fas fa-plus"></i> Nova intervenção','','btn-primary'):''}</div></div>
            ${st.incomplete?'<p class="tg-pp-warning" role="status">Não foi possível obter todas as OS antigas. A mostrar os registos disponíveis. '+button('retry','Tentar novamente')+'</p>':''}
            <div class="tg-pp-overview"><div class="tg-pp-cover">${image(m.foto,name)}<span>${eq.length} equipamentos · ${history.length} intervenções</span></div><div class="tg-pp-before"><span class="tg-pp-eyebrow">ANTES DE COMEÇAR</span><h3>O que o próximo técnico precisa de saber</h3><dl>${text('Armário técnico / acesso',m.armario)}${text('Notas de acesso',m.acesso)}${text('Contacto no local',m.contacto)}${text('Pendências conhecidas',m.pendencias || (faults.length?faults.length+' equipamento(s) com avaria':''))}${text('Última nota para o técnico',lastNote || m.notas)}</dl></div></div>
            <div class="tg-pp-main"><div><section class="tg-pp-panel"><div class="tg-pp-heading"><div><span class="tg-pp-eyebrow">INVENTÁRIO</span><h3>Equipamentos e ligações</h3></div>${s.manager?button('edit-equipment','+ Equipamento'):''}</div><div class="tg-pp-filters"><label>Pesquisar<input type="search" data-pp-search value="${esc(st.term)}" placeholder="Nome, modelo, IP, porta…"></label><label>Sistema<select data-pp-type><option value="">Todos os sistemas</option>${Object.entries(types).map(([k,v])=>`<option value="${k}" ${st.type===k?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="tg-pp-equipment" data-pp-equipment></div></section>
            <section class="tg-pp-panel"><div class="tg-pp-heading"><div><span class="tg-pp-eyebrow">CONTINUIDADE</span><h3>Intervenções nesta instalação</h3><p>Os mesmos registos das ordens de serviço e do histórico atual.</p></div>${st.workspace?button('history','Histórico completo do cliente'):''}</div><div class="tg-pp-timeline">${history.slice(0,st.limit).map(r=>{const detail=object(r.passaporteIntervencao);return `<article><time>${day(r.data)}</time><div><h4>OS ${esc(r.numeroRegisto || '—')} <span class="tg-pp-badge">${esc(r.status || 'Pendente')}</span></h4><p>${esc(r.descricao || 'Intervenção')}</p>${detail.trabalho?'<p>'+esc(detail.trabalho)+'</p>':''}${detail.proximoTecnico?'<p><strong>Para o próximo técnico:</strong> '+esc(detail.proximoTecnico)+'</p>':''}<div class="tg-pp-actions">${button('view-os','Ver OS',r.id)}${button('work-sheet','Folha de obra',r.id)}${button('work-sheet-pdf','PDF da folha',r.id)}</div></div></article>`;}).join('') || '<p class="tg-pp-empty">Sem intervenções registadas nesta instalação.</p>'}</div>${history.length>st.limit?button('more','Mostrar mais intervenções'):''}</section></div>
            <aside><section class="tg-pp-panel"><span class="tg-pp-eyebrow">ÚLTIMA INTERVENÇÃO</span><h3>${last?'OS '+esc(last.numeroRegisto || '—'):'Sem registos'}</h3><p>${last?day(last.data)+' · '+esc(last.status || ''):'As fotografias aparecerão aqui quando forem anexadas a uma OS.'}</p><div class="tg-pp-photos">${lastPhotos.map((f,i)=>`<a href="${esc(url(photoURL(f)))}" target="_blank" rel="noopener noreferrer">${image(photoURL(f),'Foto '+(i+1)+' da última intervenção')}</a>`).join('')}</div>${last && canEditOS(last,s)?button('photos','Adicionar foto à OS',last.id):''}</section>
            ${contractPanel(s)}<section class="tg-pp-panel"><div class="tg-pp-heading"><h3>Documentos e esquemas</h3>${s.manager?button('edit-site','Gerir'):''}</div>${documents(s).map(d=>`<a class="tg-pp-document" href="${esc(url(d.url))}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-lines"></i><span>${esc(d.nome || 'Documento')}</span><i class="fas fa-arrow-up-right-from-square"></i></a>`).join('') || '<p class="tg-pp-empty">Sem documentos associados.</p>'}</section><section class="tg-pp-panel"><h3>Consulta no terreno</h3><p>Na OS, use “Consultar instalação” para abrir este passaporte.</p>${button('link','Copiar ligação desta instalação')}<p class="tg-pp-muted">A ligação exige uma sessão com acesso à instalação.</p></section></aside></div><div data-pp-editor></div></section>`;
        st.host.onclick=event=>handle(event,st);
        st.host.oninput=event=>{if(event.target.matches('[data-pp-search]')){st.term=event.target.value;renderEquipment(st);}};
        st.host.onchange=event=>{if(event.target.matches('[data-pp-type]')){st.type=event.target.value;renderEquipment(st);}};
        renderEquipment(st);
    }
    function renderEquipment(st) {
        if(!valid(st))return;const s=scope(st.customerId,st.localId),root=st.host.querySelector('[data-pp-equipment]');if(!root)return;
        const norm=v=>String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const eq=equipment(s).filter(e=>(!st.type || e.tipo===st.type) && norm([e.tipo,e.marca,e.numeroSerie,...Object.values(object(e.fichaTecnica))].join(' ')).includes(norm(st.term)));
        root.innerHTML=eq.map(e=>{const f=object(e.fichaTecnica);return `<button type="button" class="tg-pp-equipment-card" data-pp-action="equipment" data-pp-id="${esc(e.id)}">${image(f.foto,f.nome || types[e.tipo] || e.tipo)}<div><span class="tg-pp-badge tg-pp-${esc(f.estado || 'verificar')}">${esc(statuses[f.estado] || 'Estado por confirmar')}</span><h4>${esc(f.nome || types[e.tipo] || e.tipo || 'Equipamento')}</h4><p>${esc([e.marca,f.modelo].filter(Boolean).join(' · ') || 'Modelo por registar')}</p><dl>${text('Localização',f.posicao)}${text('IP / porta', [f.ip,f.porta].filter(Boolean).join(' · '))}</dl></div></button>`;}).join('') || '<p class="tg-pp-empty">Sem equipamentos para esta pesquisa. Pode registar equipamentos diretamente no passaporte.</p>';
    }
    function contracts(s) {
        if(typeof moduloContratosAtivo!=='function' || !moduloContratosAtivo(adminDoUtilizador()))return [];
        return (dados.contratos || []).filter(c=>c.adminId===s.tenant && c.clienteId===s.customerId && _contratoAbrangeLocal(c,s.localId));
    }
    function contractPanel(s) {
        if(!s.manager || !contracts(s).length)return '';
        return '<section class="tg-pp-panel"><h3>Contratos desta instalação</h3>'+contracts(s).map(c=>'<div class="tg-pp-document"><span>Contrato '+esc(c.numero || '—')+'</span>'+button('contract','Ver contrato',c.id)+'</div>').join('')+'</section>';
    }
    function documents(s) {
        const all=Array.isArray(s.meta.documentos)?s.meta.documentos.slice():[];
        if(typeof moduloContratosAtivo==='function' && moduloContratosAtivo(adminDoUtilizador()))(dados.contratos || []).filter(c=>c.adminId===s.tenant && c.clienteId===s.customerId && _contratoAbrangeLocal(c,s.localId) && c.documentoUrl).forEach(c=>all.push({nome:c.documentoNome || 'Contrato '+(c.numero || ''),url:c.documentoUrl}));
        return all.filter(d=>url(d.url));
    }
    const canEditOS=(r,s)=>s.manager || (r.status!=='concluído' && assigned(r,actor()));
    function getOS(st,id) {return records(scope(st.customerId,st.localId),st.services).find(r=>r.id===id);}
    function cacheOS(r) {
        const existing=(dados.servicos || []).find(x=>x.id===r.id);if(existing)return existing;
        dados.servicos=dados.servicos || [];dados.servicos.push(r);_snap.servicos=_snap.servicos || new Map();_snap.servicos.set(r.id,JSON.stringify(M.servicos.to(r)));return r;
    }
    async function handle(event,st) {
        const b=event.target.closest('[data-pp-action]');if(!b || !valid(st))return;
        const s=scope(st.customerId,st.localId),action=b.dataset.ppAction,id=b.dataset.ppId;
        if(action==='sites'){show(st.customerId);return;}
        if(action==='retry'){mount(st.customerId,st.localId,st.host,st.workspace);return;}
        if(action==='history'){_wsClienteAba(st.customerId,'historico');return;}
        if(action==='more'){st.limit+=20;render(st);return;}
        if(action==='cancel'){st.host.querySelector('[data-pp-editor]').innerHTML='';return;}
        if(action==='link'){
            const u=new URL('login.html',location.href);u.searchParams.set('tg_cliente',st.customerId);u.searchParams.set('tg_local',st.localId);u.searchParams.set('tg_passaporte','1');
            try{await navigator.clipboard.writeText(u.href);alert('✅ Ligação copiada.');}catch(_){editor(st,'Ligação de consulta','<label>Copie a ligação<input readonly value="'+esc(u.href)+'"></label>');}return;
        }
        if(action==='new-os' && s.manager){
            const cid=st.customerId,lid=st.localId;_wsMarcarOS(cid);
            setTimeout(()=>{if(identity()!==st.identity)return;const c=document.getElementById('s_cliente'),select=document.getElementById('s_local');if(c?.value!==cid || !select)return;select.value=lid;_osPreencherMoradaDoLocal(lid);},180);return;
        }
        if(action==='contract' && s.manager && contracts(s).some(c=>c.id===id)){if(st.workspace)_wsSairPara(st.customerId);else document.getElementById('tgPassportOverlay')?.classList.remove('open');abrirModalContrato(id);return;}
        if(action==='edit-site' && s.manager){siteEditor(st);return;}
        if(action==='edit-equipment' && s.manager){equipmentEditor(st,id);return;}
        if(action==='equipment'){equipmentDetail(st,id);return;}
        const os=getOS(st,id);
        if(action==='view-os' && os){cacheOS(os);if(st.workspace)_wsSairPara(st.customerId);else document.getElementById('tgPassportOverlay')?.classList.remove('open');abrirVerOS(id);return;}
        if(action==='photos' && os && canEditOS(os,s)){cacheOS(os);_osPedirFoto(id);return;}
        if((action==='work-sheet' || action==='work-sheet-pdf') && os){await workSheets(st,os,action==='work-sheet-pdf');return;}
        if(action==='open-sheet' || action==='pdf-sheet'){
            const sheet=(dados.folhasObra || []).find(f=>f.id===id && f.adminId===s.tenant);
            const linked=sheet && getOS(st,sheet.servicoId);
            if(linked)await openSheet(st,linked,sheet,action==='pdf-sheet');
        }
    }
    function editor(st,title,body) {
        if(!valid(st))return;
        const root=st.host.querySelector('[data-pp-editor]');root.innerHTML='<section class="tg-pp-panel tg-pp-editor"><div class="tg-pp-heading"><h3>'+esc(title)+'</h3>'+button('cancel','Fechar')+'</div>'+body+'</section>';
        root.scrollIntoView({behavior:'smooth',block:'nearest'});return root;
    }
    const field=(name,label,value='',kind='text',required=false) => `<label>${esc(label)}${required?' *':''}${kind==='textarea'?`<textarea name="${name}" rows="3" maxlength="8000" ${required?'required':''}>${esc(value)}</textarea>`:`<input name="${name}" type="${kind}" value="${esc(value)}" maxlength="1000" ${required?'required':''}>`}</label>`;
    const options=(name,label,values,value) => `<label>${label}<select name="${name}">${Object.entries(values).map(([k,v])=>`<option value="${k}" ${value===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
    const saveFooter='<p data-pp-save-status role="status"></p><div class="tg-pp-actions"><button type="submit" class="btn btn-primary">Guardar</button>'+button('cancel','Cancelar')+'</div>';
    function formValues(form){return Object.fromEntries(new FormData(form).entries());}
    async function saveForm(st,form,operation,success) {
        if(!valid(st))return;const submit=form.querySelector('[type="submit"]'),status=form.querySelector('[data-pp-save-status]');submit.disabled=true;status.textContent='A guardar…';
        try {await operation();if(!valid(st))return;render(st);alert(navigator.onLine ? '✅ '+success : '⚠️ Guardado neste dispositivo. A aguardar ligação para sincronizar.');}
        catch(e){if(valid(st)){status.textContent='Não foi possível confirmar a gravação. As alterações locais ficam pendentes de sincronização; tente novamente. '+(e.message || '');submit.disabled=false;}}
    }
    function photoPicker(root,st,fieldName) {
        const input=root.querySelector('[data-pp-photo-file]');if(!input)return;
        input.onchange=async()=>{const file=input.files?.[0];if(!file || !valid(st))return;const status=root.querySelector('[data-pp-upload-status]'),submit=root.querySelector('[type="submit"]');submit.disabled=true;
            try{if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size>15*1024*1024)throw Error('Selecione uma imagem até 15 MB.');status.textContent='A enviar fotografia…';const data=await _comprimirImagem(file),link=await uploadDataURL(data,'passaportes/'+scope(st.customerId,st.localId).tenant+'/'+st.customerId);if(valid(st) && root.isConnected){root.querySelector('[name="'+fieldName+'"]').value=link;status.textContent='Fotografia enviada. Guarde a ficha para a associar.';}}
            catch(e){if(root.isConnected)status.textContent=e.message || 'Erro ao enviar fotografia.';}finally{if(root.isConnected)submit.disabled=false;}};
    }
    function siteEditor(st) {
        const s=scope(st.customerId,st.localId);if(!s?.manager)return;const m=s.meta;
        const root=editor(st,'Ficha da instalação',`<form class="tg-pp-form"><div class="tg-pp-field-grid">${field('foto','Fotografia do local (URL)',m.foto,'url')}<label>Carregar fotografia<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-pp-photo-file></label><p data-pp-upload-status role="status"></p>${field('armario','Armário técnico e localização',m.armario)}${field('contacto','Contacto no local',m.contacto)}${field('acesso','Como aceder ao local',m.acesso,'textarea')}${field('pendencias','Pendências conhecidas',m.pendencias,'textarea')}${field('notas','Notas para o próximo técnico',m.notas,'textarea')}</div><p class="tg-pp-muted">Registe instruções de acesso sem palavras-passe nem códigos secretos.</p><label>Documentos e esquemas (um por linha: Nome | https://… )<textarea name="documentos" rows="4">${esc(documents({...s,meta:m}).filter(d=>(m.documentos || []).some(x=>x.url===d.url)).map(d=>(d.nome || 'Documento')+' | '+d.url).join('\n'))}</textarea></label><label>Carregar PDF ou imagem<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-pp-doc-file></label><p data-pp-doc-status role="status"></p>${saveFooter}</form>`);
        photoPicker(root,st,'foto');
        root.querySelector('[data-pp-doc-file]').onchange=async ev=>{
            const file=ev.target.files?.[0];if(!file || !valid(st))return;const status=root.querySelector('[data-pp-doc-status]'),submit=root.querySelector('[type="submit"]');submit.disabled=true;
            try{if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size>15*1024*1024)throw Error('Selecione um PDF ou imagem até 15 MB.');status.textContent='A enviar documento…';const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Erro na leitura do ficheiro.'));r.readAsDataURL(file);});const link=await uploadDataURL(data,'passaportes/'+s.tenant+'/'+s.customerId+'/documentos');if(valid(st) && root.isConnected){const input=root.querySelector('[name="documentos"]');input.value+=(input.value?'\n':'')+file.name.replace(/[|\r\n]/g,' ')+' | '+link;status.textContent='Documento enviado. Guarde a ficha para o associar.';}}
            catch(e){if(root.isConnected)status.textContent=e.message;}finally{if(root.isConnected)submit.disabled=false;}
        };
        root.querySelector('form').onsubmit=ev=>{ev.preventDefault();const form=ev.currentTarget,v=formValues(form);saveForm(st,form,async()=>{
            const live=scope(st.customerId,st.localId);if(!live?.manager)throw Error('Sem permissão.');
            const docs=String(v.documentos).split('\n').filter(l=>l.trim()).map(line=>{const p=line.indexOf('|');if(p<1 || !url(line.slice(p+1).trim()))throw Error('Use Nome | https://… em cada documento.');return {nome:line.slice(0,p).trim(),url:url(line.slice(p+1).trim())};});
            if(v.foto && !url(v.foto))throw Error('URL de fotografia inválido.');
            const target=live.local || live.customer;target.passaporteTecnico={...live.meta,...v,foto:url(v.foto),documentos:docs,atualizadoEm:Date.now(),atualizadoPor:actor().id};await guardarDados(dados);
        },'Ficha da instalação guardada.');};
    }
    function equipmentDetail(st,id) {
        const s=scope(st.customerId,st.localId),e=equipment(s).find(x=>x.id===id);if(!e)return;const f=object(e.fichaTecnica);
        const root=editor(st,f.nome || 'Ficha do equipamento',`<div class="tg-pp-equipment-detail">${image(f.foto,f.nome || 'Equipamento')}<dl>${text('Sistema',types[e.tipo] || e.tipo)}${text('Marca / modelo',[e.marca,f.modelo].filter(Boolean).join(' · '))}${text('Número de série',e.numeroSerie)}${text('Localização',f.posicao)}${text('Endereço IP',f.ip)}${text('Porta / ligação',f.porta)}${text('Cabo / alimentação',f.cabo)}${text('Estado',statuses[f.estado])}${text('Instalação',e.dataInstalacao?day(e.dataInstalacao):'')}${text('Garantia até',e.garantiaAte?day(e.garantiaAte):'')}${text('Notas',e.observacoes)}</dl></div>${s.manager?button('edit-equipment','Editar equipamento',id):''}`);
        return root;
    }
    function equipmentEditor(st,id) {
        const s=scope(st.customerId,st.localId);if(!s?.manager)return;const e=id?equipment(s).find(x=>x.id===id):{};if(!e)return;const f=object(e.fichaTecnica);
        const root=editor(st,id?'Editar equipamento':'Novo equipamento',`<form class="tg-pp-form"><div class="tg-pp-field-grid">${field('nome','Nome / identificação',f.nome,'text',true)}${options('tipo','Sistema',types,e.tipo || 'cctv')}${field('marca','Marca',e.marca)}${field('modelo','Modelo',f.modelo)}${field('numeroSerie','Número de série',e.numeroSerie)}${options('estado','Estado',statuses,f.estado || 'verificar')}${field('posicao','Localização no edifício',f.posicao)}${field('ip','Endereço IP',f.ip)}${field('porta','Switch / porta / ligação',f.porta)}${field('cabo','Cabo / alimentação',f.cabo)}${field('foto','Fotografia (URL)',f.foto,'url')}<label>Carregar fotografia<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-pp-photo-file></label><p data-pp-upload-status role="status"></p>${field('dataInstalacao','Data de instalação',e.dataInstalacao,'date')}${field('garantiaAte','Garantia até',e.garantiaAte,'date')}${field('observacoes','Notas',e.observacoes,'textarea')}</div>${saveFooter}</form>`);
        photoPicker(root,st,'foto');let newId=null;
        root.querySelector('form').onsubmit=ev=>{ev.preventDefault();const form=ev.currentTarget,v=formValues(form);saveForm(st,form,async()=>{
            const live=scope(st.customerId,st.localId);if(!live?.manager)throw Error('Sem permissão.');if(v.foto && !url(v.foto))throw Error('URL de fotografia inválido.');
            let target=id?equipment(live).find(x=>x.id===id):(dados.equipamentos || []).find(x=>x.id===newId);if(id && !target)throw Error('Equipamento indisponível.');
            if(!target){newId=gerarId();target={id:newId,adminId:live.tenant,clienteId:live.customerId,localId:live.localId || null,dataCriacao:Date.now()};dados.equipamentos=dados.equipamentos || [];dados.equipamentos.push(target);}
            Object.assign(target,{tipo:v.tipo,marca:v.marca,numeroSerie:v.numeroSerie,observacoes:v.observacoes,dataInstalacao:v.dataInstalacao || null,garantiaAte:v.garantiaAte || null,fichaTecnica:{...object(target.fichaTecnica),nome:v.nome,modelo:v.modelo,estado:v.estado,posicao:v.posicao,ip:v.ip,porta:v.porta,cabo:v.cabo,foto:url(v.foto),atualizadoEm:Date.now()}});
            await guardarDados(dados);
        },'Equipamento guardado.');};
    }
    async function workSheets(st,os,pdf=false) {
        if(!valid(st))return;
        const s=scope(st.customerId,st.localId);
        const root=editor(st,'Folhas de obra · OS '+(os.numeroRegisto || '—'),'<p role="status">A carregar as folhas de obra desta OS…</p>');
        let failed=false;
        try {
            const q=supa.from('folhas_obra').select('*').eq('admin_id',s.tenant).eq('servico_id',os.id).order('data',{ascending:false}).order('id',{ascending:false});
            const {data,error}=await _buscarPaginadoGenerico(q);if(error)throw error;
            if(!valid(st) || !root.isConnected)return;
            const loaded=(data || []).map(M.folhasObra.from).filter(f=>f.adminId===s.tenant && f.servicoId===os.id);
            dados.folhasObra=dados.folhasObra || [];_snap.folhasObra=_snap.folhasObra || new Map();
            loaded.forEach(f=>{if(!dados.folhasObra.some(x=>x.id===f.id)){dados.folhasObra.push(f);_snap.folhasObra.set(f.id,JSON.stringify(M.folhasObra.to(f)));}});
        } catch (_) {failed=true;}
        if(!valid(st) || !root.isConnected)return;
        const sheets=(dados.folhasObra || []).filter(f=>f.adminId===s.tenant && f.servicoId===os.id).sort((a,b)=>String(b.data || '').localeCompare(String(a.data || '')) || String(b.id).localeCompare(String(a.id)));
        if(sheets.length===1 && !failed){await openSheet(st,os,sheets[0],pdf);return;}
        const warning=failed?'<p class="tg-pp-warning" role="status">Não foi possível confirmar todas as folhas desta OS. '+button(pdf?'work-sheet-pdf':'work-sheet','Tentar novamente',os.id)+'</p>':'';
        editor(st,'Folhas de obra · OS '+(os.numeroRegisto || '—'),warning+(sheets.length?sheets.map(f=>'<article class="tg-pp-panel"><h4>Folha de obra · '+esc(day(f.data))+'</h4><p>'+esc(f.descricao || f.obraDescricao || 'Sem descrição')+'</p><div class="tg-pp-actions">'+button('open-sheet','Ver folha de obra',f.id)+button('pdf-sheet','PDF da folha',f.id)+'</div></article>').join(''):failed?'':'<p class="tg-pp-empty">Ainda não existe uma folha de obra para esta OS.</p>'));
    }
    async function openSheet(st,os,sheet,pdf) {
        if(!valid(st))return;
        const s=scope(st.customerId,st.localId);
        if(sheet.adminId!==s.tenant || sheet.servicoId!==os.id || !getOS(st,os.id))return;
        cacheOS(os);
        if(pdf){await gerarPDFFolha(sheet.id,'cliente');return;}
        if(st.workspace)_wsSairPara(st.customerId);else document.getElementById('tgPassportOverlay')?.classList.remove('open');
        await abrirFolhaDetalhe(sheet.id);
    }
    document.addEventListener('click',event=>{
        const b=event.target.closest('[data-pp-os]');if(b){event.stopPropagation();const os=(dados.servicos || []).find(r=>r.id===b.dataset.ppOs);if(os && scope(os.clienteId,os.localId || ''))open(os.clienteId,os.localId || '');}
        if(event.target.closest('[data-pp-close]')){document.getElementById('tgPassportOverlay')?.classList.remove('open');if(current && !current.workspace){current=null;++serial;}}
    },true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape' && current && !current.workspace){document.getElementById('tgPassportOverlay')?.classList.remove('open');current=null;++serial;}});
    document.addEventListener('tg:passport-photo-updated',()=>{if(current && valid(current) && !current.host.querySelector('[data-pp-editor] form'))render(current);});
    document.addEventListener('tg:interface-updated',()=>{
        if(current && !valid(current)){if((current.identity!==identity() || !scope(current.customerId,current.localId)) && current.host.querySelector('.tg-passport'))current.host.innerHTML='';if(!current.workspace)document.getElementById('tgPassportOverlay')?.classList.remove('open');current=null;++serial;}
        const q=new URLSearchParams(location.search);if(q.get('tg_passaporte')==='1' && actor() && scope(q.get('tg_cliente'),q.get('tg_local') || '')){const cid=q.get('tg_cliente'),lid=q.get('tg_local') || '';q.delete('tg_passaporte');q.delete('tg_cliente');q.delete('tg_local');window.history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);open(cid,lid);}
    });
    window.TGPassport={show,open,scope,equipment,records,osButton,url};
})();
