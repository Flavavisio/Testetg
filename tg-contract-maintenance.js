/* Maintenance contracts: scoped coverage, system plans, commercial terms and original OS history. */
(function () {
    'use strict';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const read = id => document.getElementById(id)?.value || '';
    const number = (id, integer = false) => {
        const value = read(id); if (value === '') return null;
        const n = Number(value); if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw Error('Indica um número válido, igual ou superior a zero.');
        return n;
    };
    const manager = c => c && ['admin','subadmin'].includes(usuarioLogado?.role) && c.adminId === (usuarioLogado.adminId || usuarioLogado.id) && moduloContratosAtivo(adminAtual());
    const option = (labels, value) => Object.entries(labels).map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
    const input = (id,label,value,type='text') => `<div class="form-group"><label>${esc(label)}<input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="1"':''}></label></div>`;
    const textarea = (id,label,value) => `<div class="form-group ff-span2"><label>${esc(label)}<textarea id="${id}" rows="3">${esc(value)}</textarea></label></div>`;
    const select = (id,label,labels,value) => `<div class="form-group"><label>${esc(label)}<select id="${id}">${option(labels,value)}</select></label></div>`;
    const section = (id,title,html) => `<section id="${id}" class="ff-secao"><div class="ff-secao-head">${esc(title)}</div><div class="ff-secao-body">${html}</div></section>`;
    let draft = {}, editing = null, historySerial = 0;
    const plans = c => Array.isArray(c?.gestaoManutencao?.plano) ? c.gestaoManutencao.plano.filter(p=>p && p.ativo!==false) : [];
    function draftContract() {
        return {adminId:usuarioLogado?.adminId || usuarioLogado?.id,clienteId:read('ct_cliente'),localId:read('ct_local'),locaisIds:[read('ct_local')],equipamentosIds:[..._ctEquipamentosAtuais]};
    }
    function capturePlan() {
        const rows=[...document.querySelectorAll('[data-ct-system]')]; if (!rows.length) return draft.plano || [];
        return rows.map(row=>{
            const tipo=row.dataset.ctSystem, old=(draft.plano || []).find(p=>p.tipo===tipo) || {};
            const periodicidade=row.querySelector('[data-period]').value;
            const intervencao=row.querySelector('[data-intervention]').value;
            if (tipoExigePresencialAnual(tipo) && (periodicidade!=='anual' || intervencao!=='presencial')) throw Error('Este sistema exige manutenção anual presencial.');
            const linhas=row.querySelector('textarea').value.split('\n').map(t=>t.trim()).filter(Boolean);
            if (linhas.length>100 || linhas.some(t=>t.length>500)) throw Error('Usa até 100 tarefas por sistema, com até 500 caracteres por tarefa.');
            return {...old,id:old.id || gerarId(),tipo,ativo:true,periodicidade,intervencao,tarefas:linhas.map((texto,i)=>({id:old.tarefas?.[i]?.texto===texto?old.tarefas[i].id:gerarId(),texto}))};
        });
    }
    function refreshPlan() {
        const root=document.getElementById('ct_plano_sistemas'); if (!root) return;
        try {draft.plano=capturePlan();} catch (_) {return;}
        const c=draftContract();
        const types=[...new Set([..._contratoEquipamentos(c),...(dados.equipamentos || []).filter(e=>e.adminId===c.adminId && e.localId==='__novo__' && e.clienteId===c.clienteId && c.equipamentosIds.includes(e.id))].map(e=>e.tipo))];
        root.innerHTML=types.map(tipo=>{
            const p=(draft.plano || []).find(p=>p.tipo===tipo) || {}, forced=tipoExigePresencialAnual(tipo);
            return `<div data-ct-system="${esc(tipo)}" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;grid-column:1/-1"><strong>${esc(EQUIP_TIPOS[tipo] || tipo)}</strong><div class="ff-secao-body"><div class="form-group"><label>Periodicidade<select data-period ${forced?'disabled':''}>${option(PERIODICIDADE_LABEL,forced?'anual':p.periodicidade || read('ct_period') || 'anual')}</select></label></div><div class="form-group"><label>Intervenção<select data-intervention ${forced?'disabled':''}>${option({presencial:'Presencial',remota:'Remota'},forced?'presencial':p.intervencao || read('ct_interv') || 'presencial')}</select></label></div><div class="form-group ff-span2"><label>Tarefas de manutenção (uma por linha)<textarea rows="4">${esc((p.tarefas || []).map(t=>t.texto).join('\n'))}</textarea></label></div></div></div>`;
        }).join('') || '<p class="help-text">Seleciona primeiro os equipamentos abrangidos.</p>';
    }
    function mount(c) {
        editing=c || null;draft=JSON.parse(JSON.stringify(obj(c?.gestaoManutencao)));
        const root=document.querySelector('#modalContratoCampos .ff-wrap'); if (!root) return;
        root.querySelector('#ct_tipos_trabalho_cont')?.closest('.ff-secao')?.remove();
        if(_contratoLocalIds(c || {}).length>1)root.querySelector('#ct_cobertura')?.insertAdjacentHTML('afterend','<p class="help-text">Este contrato antigo abrangia várias instalações. Para guardar, escolhe uma instalação e mantém apenas os equipamentos dessa instalação. O histórico anterior é preservado.</p>');
        const srv=obj(draft.servicos),com=obj(draft.comercial);
        root.insertAdjacentHTML('beforeend',section('ct_plano_extra','Plano de manutenção por sistema','<div class="form-group ff-span2 help-text">Define a frequência e as tarefas de cada sistema. A agenda considera cada instalação e as intervenções realizadas.</div><div id="ct_plano_sistemas" class="form-group ff-span2"></div>'));
        refreshPlan();
        root.insertAdjacentHTML('beforeend',section('ct_servicos_extra','Serviços incluídos',
            input('ct_visitas','Visitas incluídas por ano (vazio: não definido)',srv.visitasAno,'number')+
            select('ct_labor','Mão de obra',{indefinido:'Não definido',incluida:'Incluída',limitada:'Incluída até ao limite',excluida:'Não incluída'},srv.maoObra || 'indefinido')+
            input('ct_horas','Limite de horas de mão de obra por ano',srv.horasAno,'number')+
            select('ct_viagens','Deslocações',{indefinido:'Não definido',incluidas:'Incluídas',limitadas:'Incluídas na zona definida',excluidas:'Não incluídas'},srv.deslocacoes || 'indefinido')+
            input('ct_zona','Zona / condições das deslocações',srv.zona)+
            select('ct_material','Materiais',{indefinido:'Não definido',incluidos:'Incluídos',parcial:'Apenas os materiais descritos',excluidos:'Não incluídos'},srv.materiais || 'indefinido')+
            textarea('ct_srv_notas','Materiais abrangidos, limites e exclusões',srv.notas)));
        root.insertAdjacentHTML('beforeend',section('ct_alertas_extra','Avisos de manutenção',input('ct_alerta_dias','Avisar com antecedência (dias)',draft.alertas?.avisoDias ?? 30,'number')+input('ct_urgente_dias','Marcar como urgente quando faltar (dias)',draft.alertas?.urgenteDias ?? 7,'number')));
        root.insertAdjacentHTML('beforeend',section('ct_comercial_extra','Condições comerciais',
            select('ct_faturacao','O valor indicado corresponde a',{indefinido:'Período não definido',mensal:'Mensal',trimestral:'Trimestral',semestral:'Semestral',anual:'Anual',pontual:'Pagamento único'},com.faturacao || 'indefinido')+
            input('ct_pagamento','Prazo de pagamento (dias)',com.prazoPagamento,'number')+
            input('ct_metodo','Forma de pagamento',com.metodo)+
            select('ct_renovacao','Renovação',{manual:'Revisão manual',automatica:'Automática, conforme as condições acordadas'},com.renovacao || 'manual')+
            input('ct_aviso','Antecedência do aviso de renovação (dias)',com.avisoDias ?? 30,'number')+
            textarea('ct_com_notas','Condições de renovação e pagamento',com.notas)+
            '<p class="form-group ff-span2 help-text">As condições ficam registadas no contrato. A renovação e a emissão de faturas são confirmadas pelo administrador.</p>'));
        // Existing fields stay in their original sections; tabs simply organize the complete form.
        const sections=[...root.querySelectorAll(':scope > .ff-secao')];
        sections.forEach(s=>s.dataset.contractTab=s.querySelector('#ct_local')?'cobertura':s.querySelector('#ct_period') || s.id==='ct_plano_extra'?'plano':'resumo');
        root.insertAdjacentHTML('afterbegin','<nav id="ct_contract_tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px" aria-label="Contrato">'+Object.entries({resumo:'Resumo',cobertura:'Cobertura',plano:'Plano de manutenção',intervencoes:'Intervenções'}).map(([id,label])=>`<button type="button" class="btn btn-outline" data-ct-tab="${id}">${label}</button>`).join('')+'</nav>');
        root.insertAdjacentHTML('beforeend',section('ct_intervencoes_extra','Intervenções','<div id="ct_intervencoes" class="form-group ff-span2"></div>'));
        document.getElementById('ct_intervencoes_extra').dataset.contractTab='intervencoes';
        root.querySelector('#ct_contract_tabs').onclick=e=>{const b=e.target.closest('[data-ct-tab]');if(b)tab(b.dataset.ctTab);};tab('resumo');
        root.querySelectorAll('#ct_inicio,#ct_validade,#ct_valor,#ct_faturacao').forEach(el=>el.addEventListener('change',summary));
        summary();
    }
    function summary() {
        const old=document.getElementById('ct_summary');old?.remove();
        const c=draftContract();
        const root=document.getElementById('ct_contract_tabs');if(!root)return;
        root.insertAdjacentHTML('afterend',`<p id="ct_summary" class="help-text">${esc(_contratoInstalacoesLabel(c))} · ${c.equipamentosIds.length} equipamento(s) · início ${esc(read('ct_inicio') || 'por definir')}${read('ct_validade')?' · validade '+esc(read('ct_validade')):''}</p>`);
    }
    function tab(id) {
        document.querySelectorAll('#modalContratoCampos [data-contract-tab]').forEach(s=>{s.hidden=s.dataset.contractTab!==id;s.style.display=s.hidden?'none':'';});
        document.querySelectorAll('[data-ct-tab]').forEach(b=>{b.classList.toggle('btn-primary',b.dataset.ctTab===id);b.setAttribute('aria-selected',b.dataset.ctTab===id?'true':'false');});
        if(id==='plano')refreshPlan();if(id==='intervencoes'){
            if(editing)history(editing.id,'ct_intervencoes');else document.getElementById('ct_intervencoes').textContent='Guarda o contrato para começar a associar intervenções.';
        }
        summary();
    }
    function collect() {
        if(!document.getElementById('ct_plano_sistemas'))return null;
        if(read('ct_validade') && read('ct_inicio') && read('ct_validade')<read('ct_inicio'))throw Error('A validade não pode ser anterior ao início do contrato.');
        const valor=Number(read('ct_valor'));if(!Number.isFinite(valor) || valor<0)throw Error('Indica um valor válido para o contrato.');
        const plano=capturePlan(),srv={...obj(draft.servicos),visitasAno:number('ct_visitas',true),maoObra:read('ct_labor'),horasAno:number('ct_horas'),deslocacoes:read('ct_viagens'),zona:read('ct_zona').trim(),materiais:read('ct_material'),notas:read('ct_srv_notas').trim()};
        if(srv.maoObra==='limitada' && srv.horasAno===null)throw Error('Indica o limite de horas de mão de obra.');
        if(srv.deslocacoes==='limitadas' && !srv.zona)throw Error('Indica a zona ou condições das deslocações.');
        if(srv.materiais==='parcial' && !srv.notas)throw Error('Descreve os materiais abrangidos.');
        const avisoDias=number('ct_alerta_dias',true) ?? 30,urgenteDias=number('ct_urgente_dias',true) ?? 7;
        if(urgenteDias>avisoDias)throw Error('O aviso urgente deve ser igual ou inferior à antecedência do aviso.');
        return {...draft,versao:1,plano,servicos:srv,alertas:{...obj(draft.alertas),avisoDias,urgenteDias},comercial:{...obj(draft.comercial),faturacao:read('ct_faturacao'),prazoPagamento:number('ct_pagamento',true),metodo:read('ct_metodo').trim(),renovacao:read('ct_renovacao'),avisoDias:number('ct_aviso',true) ?? 30,notas:read('ct_com_notas').trim()}};
    }
    function recordLocation(r,c) {
        if(r.localId != null || Array.isArray(r.sistemasIds))return r.localId || '';
        const os=r.servicoId && (dados.servicos || []).find(os=>os.id===r.servicoId && os.adminId===c.adminId && os.contratoId===c.id);
        return os ? (os.localId || '') : (c.localId || '');
    }
    function schedule(c) {
        return _contratoInstalacoes(c).flatMap(l=>{
            const eq=_contratoEquipamentos(c,l.id),types=new Set(eq.map(e=>e.tipo));
            return plans(c).filter(p=>types.has(p.tipo)).map(p=>{
                const regs=(dados.registosManutencao || []).filter(r=>r.adminId===c.adminId && r.contratoId===c.id && recordLocation(r,c)===(l.id || '') && r.dataRealizacao && (Array.isArray(r.sistemasIds)?r.sistemasIds.includes(p.id):true)).sort((a,b)=>b.dataRealizacao.localeCompare(a.dataRealizacao));
                return {localId:l.id,localNome:l.nome,plan:p,data:avancarPeriodicidade(regs[0]?.dataRealizacao || c.dataInicio,p.periodicidade)};
            });
        });
    }
    function nextDate(c) {return schedule(c).map(x=>x.data).filter(Boolean).sort()[0] || null;}
    function due(c,localId,data) {return schedule(c).filter(s=>s.localId===(localId || '') && s.data && s.data<=data).map(s=>s.plan.id);}
    function choices(c,localId,data) {
        const rows=schedule(c).filter(s=>s.localId===(localId || '')),selected=new Set(due(c,localId,data));
        return rows.map(s=>`<label style="display:flex;gap:8px;align-items:center;padding:5px 0"><input type="checkbox" class="ct-os-system" value="${esc(s.plan.id)}" ${selected.has(s.plan.id)?'checked':''} style="width:auto">${esc(EQUIP_TIPOS[s.plan.tipo] || s.plan.tipo)} · próxima ${esc(s.data || 'por definir')}</label>`).join('');
    }
    function osPicker(c) {
        if(!plans(c).length)return;
        const local=document.getElementById('os_gerar_local'),date=document.getElementById('os_data');
        const row=document.createElement('div');row.id='ct_os_planos';row.className='form-group';local.closest('.form-group').after(row);
        const update=()=>{row.innerHTML='<label>Sistemas desta intervenção *</label>'+choices(c,local.value,date.value)+'<p class="help-text">Estão selecionados os sistemas com manutenção devida até esta data. Podes ajustar a seleção.</p>';};
        local.addEventListener('change',update);date.addEventListener('change',update);update();
    }
    function selectedOS(c,localId,rootId='ct_os_planos') {
        if(!plans(c).length)return [];
        const ids=[...document.querySelectorAll('#'+rootId+' .ct-os-system:checked')].map(el=>el.value);
        const available=new Set(schedule(c).filter(s=>s.localId===(localId || '')).map(s=>s.plan.id));
        if(!ids.length || ids.some(id=>!available.has(id)))throw Error('Seleciona pelo menos um sistema abrangido nesta instalação.');
        return ids;
    }
    function equipmentForOS(c,localId,ids) {
        const types=new Set(plans(c).filter(p=>ids.includes(p.id)).map(p=>p.tipo));
        return _contratoEquipamentos(c,localId).filter(e=>!plans(c).length || types.has(e.tipo));
    }
    function recordNext(c,data,ids) {
        return plans(c).filter(p=>ids.includes(p.id)).map(p=>avancarPeriodicidade(data,p.periodicidade)).filter(Boolean).sort()[0] || avancarPeriodicidade(data,c.periodicidade);
    }
    function snapshot(os,c,ids) {
        window.TGEquipmentReports?.snapshot(os,equipmentForOS(c,os.localId,ids));
        if(!plans(c).length)return;
        const available=schedule(c).filter(s=>s.localId===(os.localId || '') && ids.includes(s.plan.id)).map(s=>s.plan);
        if(!available.length)throw Error('Sem sistemas abrangidos nesta instalação.');
        const types=new Set(available.map(p=>p.tipo));
        os.planoManutencao={...os.planoManutencao,sistemasIds:available.map(p=>p.id),equipamentosIds:_contratoEquipamentos(c,os.localId).filter(e=>types.has(e.tipo)).map(e=>e.id),tarefas:available.flatMap(p=>(p.tarefas || []).map(t=>({id:'contrato-'+p.id+'-'+t.id,texto:(EQUIP_TIPOS[p.tipo] || p.tipo)+' — '+t.texto,sistemaId:p.id})))};
        os.observacoes=[os.observacoes,'Sistemas: '+available.map(p=>EQUIP_TIPOS[p.tipo] || p.tipo).join(', ')].filter(Boolean).join('\n');
    }
    function registerMaintenance(os,sheet) {
        if(!os || !sheet || os.adminId!==sheet.adminId || sheet.servicoId!==os.id || !completedTasks(os) || window.TGEquipmentReports?.pending(os).length)return false;
        const c=(dados.contratos || []).find(c=>c.id===os.contratoId && c.adminId===os.adminId && c.clienteId===os.clienteId);
        if(!c || (dados.registosManutencao || []).some(r=>r.adminId===os.adminId && r.servicoId===os.id))return false;
        const date=sheet.data || getDataHoje(),ids=os.planoManutencao?.sistemasIds || [];
        (dados.registosManutencao ||= []).push({id:gerarId(),adminId:c.adminId,clienteId:c.clienteId,contratoId:c.id,localId:os.localId || null,equipamentoId:c.equipamentoId,servicoId:os.id,...(os.planoManutencao?.sistemasIds?{sistemasIds:ids}:{}),dataRealizacao:date,tecnicoId:sheet.funcionarioId || c.tecnicoId || null,observacoes:'Manutenção concluída via OS '+(os.numeroRegisto || '')+'.',proximaData:recordNext(c,date,ids),dataCriacao:Date.now()});
        sheet.contratoId=c.id;c.proximaManutencao=calcularProximaManutencao(c);
        if(typeof _notificarFuncionario==='function')_notificarFuncionario(c.clienteId,'✅ Manutenção realizada','A manutenção do contrato '+(c.numero || '')+' foi concluída com sucesso.',c.adminId);
        return true;
    }
    function checklist(os,admin) {return [...(admin?.obrasChecklistItens || []).filter(i=>i.ativo!==false),...(os?.planoManutencao?.tarefas || [])];}
    function registoPicker(c) {
        if(!plans(c).length)return;
        const local=document.getElementById('rg_local'),data=document.getElementById('rg_data');
        const row=document.createElement('div');row.id='ct_rg_planos';row.className='form-group';local.closest('.form-group').after(row);
        const update=()=>{row.innerHTML='<label>Sistemas cuja manutenção foi realizada *</label>'+choices(c,local.value,data.value);};local.addEventListener('change',update);data.addEventListener('change',update);update();
    }
    function completedTasks(os) {return (os?.planoManutencao?.tarefas || []).every(t=>os.checklist?.[t.id]===true);}
    function cache(key,rows,filter) {
        dados[key] ||= [];_snap[key] ||= new Map();
        for(const raw of rows || []){
            const r=M[key].from(raw);if(!filter(r))continue;
            const index=dados[key].findIndex(x=>x.id===r.id);
            if(index>=0){if(_snap[key].get(r.id)!==JSON.stringify(M[key].to(dados[key][index])))continue;dados[key][index]=r;}
            else dados[key].push(r);
            _snap[key].set(r.id,JSON.stringify(M[key].to(r)));
        }
    }
    async function loadHistory(c) {
        const q=t=>supa.from(t).select('*').eq('admin_id',c.adminId).eq('contrato_id',c.id).order('id',{ascending:false});
        const responses=await Promise.all([_buscarPaginadoGenerico(q('servicos')),_buscarPaginadoGenerico(q('registos_manutencao')),_buscarPaginadoGenerico(q('folhas_obra'))]);
        if(!manager(c))throw Error('Sem acesso ao contrato.');
        let incomplete=responses.some(r=>r.error);
        ['servicos','registosManutencao','folhasObra'].forEach((key,i)=>cache(key,responses[i].data,r=>r.adminId===c.adminId && r.contratoId===c.id));
        const ids=(dados.servicos || []).filter(os=>os.adminId===c.adminId && os.contratoId===c.id).map(os=>os.id);
        for(let i=0;i<ids.length;i+=100){
            const subset=ids.slice(i,i+100),r=await _buscarPaginadoGenerico(supa.from('folhas_obra').select('*').eq('admin_id',c.adminId).in('servico_id',subset).order('id',{ascending:false}));
            if(!manager(c))throw Error('Sem acesso ao contrato.');incomplete ||= !!r.error;
            cache('folhasObra',r.data,f=>f.adminId===c.adminId && subset.includes(f.servicoId));
        }
        return incomplete;
    }
    function historyHTML(c,incomplete) {
        const orders=(dados.servicos || []).filter(os=>os.adminId===c.adminId && os.clienteId===c.clienteId && os.contratoId===c.id && !os.apagadoSuperAdmin).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
        const orderIds=new Set(orders.map(os=>os.id));
        const sheets=(dados.folhasObra || []).filter(f=>f.adminId===c.adminId && (f.contratoId===c.id || orderIds.has(f.servicoId)));
        const regs=(dados.registosManutencao || []).filter(r=>r.adminId===c.adminId && r.contratoId===c.id).sort((a,b)=>String(b.dataRealizacao).localeCompare(String(a.dataRealizacao)));
        const sheetButtons=list=>list.map(f=>`<div class="help-text">${esc(f.data)} · ${esc(f.descricao || 'Folha de obra')} <button type="button" class="btn btn-sm btn-outline" data-contract-sheet="${esc(f.id)}">Folha de obra</button> <button type="button" class="btn btn-sm btn-outline" data-contract-pdf="${esc(f.id)}">PDF</button></div>`).join('');
        const m=typeof _margemContrato==='function'?_margemContrato(c.id):null;
        const margem=m?.nFolhas?'<p class="help-text">Rentabilidade acumulada: valor '+esc(m.valorContrato.toFixed(2))+' € · custos '+esc(m.custoTotal.toFixed(2))+' € · margem '+esc(m.margem.toFixed(2))+' €</p>':'';
        return margem+(incomplete?'<p role="status">Não foi possível confirmar todo o histórico. <button type="button" class="btn btn-sm" data-contract-retry>Tentar novamente</button></p>':'')+
            `<p class="help-text">${orders.length} OS · ${sheets.length} folhas de obra originais · ${regs.length} manutenções registadas</p>`+
            orders.map(os=>`<article style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>OS ${esc(os.numeroRegisto || '—')}</strong> · ${esc(os.data)} · ${esc(os.status)} · ${esc((dados.locais || []).find(l=>l.id===os.localId)?.nome || 'Sede')}<p>${esc(os.descricao)}</p><button type="button" class="btn btn-sm btn-outline" data-contract-os="${esc(os.id)}">Ver OS</button>${sheetButtons(sheets.filter(f=>f.servicoId===os.id))}</article>`).join('')+
            (sheets.some(f=>!orderIds.has(f.servicoId))?'<h4>Folhas de manutenção</h4>'+sheetButtons(sheets.filter(f=>!orderIds.has(f.servicoId))):'')+
            (regs.length?'<details><summary>Registos de manutenção</summary>'+regs.map(r=>`<p>${esc(r.dataRealizacao)} · ${esc(r.observacoes || 'Manutenção realizada')}</p>`).join('')+'</details>':'')+
            (!orders.length && !sheets.length && !regs.length?'<p>Sem intervenções associadas a este contrato.</p>':'');
    }
    async function history(id,target='modalHistoricoConteudo') {
        const c=(dados.contratos || []).find(c=>c.id===id);if(!manager(c))return;
        const root=document.getElementById(target);if(!root)return;
        const serial=++historySerial;root.innerHTML='<p role="status">A carregar as intervenções e folhas de obra…</p>';
        root.onclick=e=>{
            if(!manager(c))return;const b=e.target.closest('button');if(!b)return;
            if(b.hasAttribute('data-contract-retry')){history(id,target);return;}
            const osId=b.dataset.contractOs,sheetId=b.dataset.contractSheet || b.dataset.contractPdf;
            if(osId && (dados.servicos || []).some(os=>os.id===osId && os.adminId===c.adminId && os.contratoId===c.id)){abrirVerOS(osId);return;}
            const f=(dados.folhasObra || []).find(f=>f.id===sheetId && f.adminId===c.adminId);
            if(f && (f.contratoId===c.id || (dados.servicos || []).some(os=>os.id===f.servicoId && os.adminId===c.adminId && os.contratoId===c.id))) {if(b.dataset.contractPdf)gerarPDFFolha(f.id,'cliente');else abrirFolhaDetalhe(f.id);}
        };
        let incomplete=false;try{incomplete=await loadHistory(c);}catch(_){incomplete=true;}
        if(serial!==historySerial || !root.isConnected || !manager(c))return;
        root.innerHTML=historyHTML(c,incomplete);
    }
    function alerts(c,today) {
        if(!c.validadeContrato)return null;
        const days=obj(c.gestaoManutencao?.comercial).avisoDias ?? 30;
        const delta=Math.round((new Date(c.validadeContrato+'T00:00:00')-new Date(today+'T00:00:00'))/86400000);
        return delta<=days?{dias:delta,data:c.validadeContrato,renovacao:obj(c.gestaoManutencao?.comercial).renovacao || 'manual'}:null;
    }
    const openOS = os => !['concluído','concluido','cancelado','cancelada','anulado','anulada'].includes(String(os.status || '').toLowerCase()) && !os.apagadoSuperAdmin;
    function pendingOS(c,localId,systemId) {
        return (dados.servicos || []).find(os=>os.adminId===c.adminId && os.clienteId===c.clienteId && os.contratoId===c.id && (os.localId || '')===(localId || '') && openOS(os) && (!os.planoManutencao?.sistemasIds?.length || os.planoManutencao.sistemasIds.includes(systemId)));
    }
    function maintenanceRows(clienteId,today=getDataHoje()) {
        const rows=[];
        for(const c of dados.contratos || []) {
            if(!manager(c) || (clienteId && c.clienteId!==clienteId))continue;
            const settings=obj(c.gestaoManutencao?.alertas),notice=settings.avisoDias ?? 30,urgent=settings.urgenteDias ?? 7;
            const scheduled=plans(c).length?schedule(c):_contratoInstalacoes(c).map(l=>({localId:l.id,localNome:l.nome,plan:{id:'legacy',tipo:c.tipo || 'Manutenção'},data:calcularProximaManutencao(c)}));
            for(const s of scheduled){
                if(!s.data)continue;const days=Math.round((new Date(s.data+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);
                if(!Number.isFinite(days) || days>notice)continue;
                const os=pendingOS(c,s.localId,s.plan.id),expired=!!c.validadeContrato && c.validadeContrato<today;
                rows.push({...s,contrato:c,cliente:(dados.clientes || []).find(cl=>cl.id===c.clienteId && cl.adminId===c.adminId),days,urgent,os,expired,state:expired?'Contrato expirado':os?'OS agendada':days<0?'Em atraso':days===0?'Vence hoje':days<=urgent?'Urgente':'A vencer'});
            }
        }
        return rows.sort((a,b)=>a.data.localeCompare(b.data) || a.localNome.localeCompare(b.localNome));
    }
    function maintenanceHTML(clienteId) {
        if(!['admin','subadmin'].includes(usuarioLogado?.role) || !moduloContratosAtivo(adminAtual()))return '';
        const rows=maintenanceRows(clienteId),groups=new Map();
        for(const r of rows){const key=JSON.stringify([r.contrato.id,r.localId]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
        return '<section class="ff-secao" style="margin:16px 0"><div class="ff-secao-head">Manutenções a tratar · '+rows.length+'</div><div style="padding:12px">'+[...groups.values()].map(list=>{
            const first=list[0],c=first.contrato;
            return `<article data-maint-contract="${esc(c.id)}" data-maint-local="${esc(first.localId)}" style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px"><strong>${esc(first.cliente?.nome || 'Cliente')} · Contrato ${esc(c.numero || '—')}</strong><p class="help-text">Instalação: ${esc(first.localNome)}</p>`+list.map(r=>{
                const selectable=!r.os && !r.expired,color=r.days<0?'#b91c1c':r.days<=r.urgent?'#b45309':'#475569';
                return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid #e2e8f0">${selectable?`<input type="checkbox" class="ct-maint-select" value="${esc(r.plan.id)}" aria-label="Selecionar ${esc(EQUIP_TIPOS[r.plan.tipo] || r.plan.tipo)}" style="width:auto">`:''}<span style="flex:1;min-width:150px"><strong>${esc(EQUIP_TIPOS[r.plan.tipo] || r.plan.tipo)}</strong> · ${esc(r.data)}<br><small style="color:${color}">${esc(r.state)}${r.os?' · OS '+esc(r.os.numeroRegisto || '—')+' · '+esc(r.os.data || 'sem data'):r.days<0?' · '+(-r.days)+' dia(s)':r.days===0?'':' · faltam '+r.days+' dia(s)'}</small></span><button type="button" class="btn btn-sm btn-outline" data-maint-action="${r.os?'os':r.expired?'plan':'create'}" data-maint-system="${esc(r.plan.id)}">${r.os?'Ver OS':r.expired?'Rever contrato':'Criar OS'}</button><button type="button" class="btn btn-sm btn-outline" data-maint-action="plan">Ver plano</button></div>`;
            }).join('')+(list.filter(r=>!r.os&&!r.expired).length>1?'<button type="button" class="btn btn-sm btn-primary" data-maint-action="group">Criar OS para as selecionadas</button>':'')+'</article>';
        }).join('')+(rows.length?'':'<p class="help-text">Não há manutenções a vencer ou em atraso no período de aviso.</p>')+'</div></section>';
    }
    function renderMaintenance() {
        for(const id of ['tg_maintenance_dashboard','tg_maintenance_agenda','tg_maintenance_home'])document.getElementById(id)?.remove();
        for(const id of ['alertasPendencias','homeAlertas']){
            const target=document.getElementById(id);if(!target)continue;
            target.querySelectorAll('[data-maint-alert-host]').forEach(el=>el.remove());
            const html=maintenanceRows().length?maintenanceHTML():'';
            if(!html)continue;
            let card=target.querySelector('.alertas-card');
            if(!card){target.innerHTML='<div class="alertas-card"><div class="alertas-h">Alertas e Pendências</div><div class="alertas-corpo"></div></div>';card=target.firstElementChild;}
            const host=document.createElement('div');host.dataset.maintAlertHost='';host.innerHTML=html;(card.querySelector('.alertas-corpo') || card).append(host);
            if(id==='alertasPendencias')target.style.display='block';
        }
        const workspace=document.getElementById('wsClienteOverlay');
        if(workspace?.classList.contains('open')) {
            const existing=document.getElementById('tg_maintenance_customer');if(existing)existing.innerHTML=maintenanceHTML(workspace.dataset.clienteAtual);
        }
    }
    async function openMaintenance(c,localId,ids) {
        if(!manager(c))return;
        if(c.validadeContrato && c.validadeContrato<getDataHoje()){alert('Reveja a validade do contrato antes de criar uma nova manutenção.');return;}
        let incomplete=false;try{incomplete=await loadHistory(c);}catch(_){incomplete=true;}
        if(!manager(c))return;
        if(incomplete){alert('Não foi possível confirmar as OS existentes. Verifica a ligação e tenta novamente para evitar duplicações.');return;}
        const existing=ids.map(id=>pendingOS(c,localId,id)).find(Boolean);if(existing){alert('Já existe uma OS aberta para esta manutenção.');abrirVerOS(existing.id);return;}
        if(typeof _wsSairPara==='function' && document.getElementById('wsClienteOverlay')?.classList.contains('open'))_wsSairPara(c.clienteId);
        abrirGerarOSContrato(c.id);const local=document.getElementById('os_gerar_local');if(!local)return;local.value=localId || '';local.dispatchEvent(new Event('change'));
        document.querySelectorAll('#ct_os_planos .ct-os-system').forEach(el=>el.checked=ids.includes(el.value));
    }
    async function availability(c,localId,ids) {
        if(!manager(c))throw Error('Sem acesso ao contrato.');
        if(c.validadeContrato && c.validadeContrato<getDataHoje())throw Error('Reveja a validade do contrato antes de criar uma nova manutenção.');
        if(await loadHistory(c))throw Error('Não foi possível confirmar as OS existentes. Verifica a ligação e tenta novamente.');
        if(!manager(c))throw Error('Sem acesso ao contrato.');
        const existing=(ids.length?ids:['legacy']).map(id=>pendingOS(c,localId,id)).find(Boolean);
        if(existing)throw Error('Já existe uma OS aberta para esta manutenção: '+(existing.numeroRegisto || existing.id)+'.');
    }
    document.addEventListener('click',async e=>{
        const b=e.target.closest('[data-maint-action]');if(!b || b.disabled)return;
        const group=b.closest('[data-maint-contract]');if(!group)return;
        const c=(dados.contratos || []).find(c=>c.id===group.dataset.maintContract);if(!manager(c))return;
        const localId=group.dataset.maintLocal,action=b.dataset.maintAction;
        if(action==='plan' || action==='os'){
            if(typeof _wsSairPara==='function' && document.getElementById('wsClienteOverlay')?.classList.contains('open'))_wsSairPara(c.clienteId);
            if(action==='plan'){abrirModalContrato(c.id);tab('plano');return;}
            const os=pendingOS(c,localId,b.dataset.maintSystem);if(os)abrirVerOS(os.id);return;
        }
        const ids=action==='group'?[...group.querySelectorAll('.ct-maint-select:checked')].map(x=>x.value):[b.dataset.maintSystem];
        if(!ids.length){alert('Seleciona os sistemas que queres juntar na mesma OS.');return;}
        b.disabled=true;try{await openMaintenance(c,localId,ids);}catch(_){alert('Não foi possível abrir a manutenção. Tenta novamente.');}finally{if(b.isConnected)b.disabled=false;}
    });
    document.addEventListener('tg:interface-updated',renderMaintenance);

    window.TGContractMaintenance={mount,collect,refreshPlan,plans,schedule,nextDate,due,osPicker,selectedOS,equipmentForOS,recordNext,snapshot,checklist,registerMaintenance,registoPicker,completedTasks,history,historyHTML,loadHistory,alerts,maintenanceRows,maintenanceHTML,renderMaintenance,pendingOS,availability};
    renderMaintenance();
})();
