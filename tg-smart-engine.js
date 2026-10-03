/* Motor TG Smart: consultas locais, sem escrita e sem serviços de IA. */
(function (host) {
  'use strict';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const shift = (day,n) => { const d=new Date(day+'T12:00:00'); d.setDate(d.getDate()+n); return dateKey(d); };
  const valid = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00').valueOf()) && dateKey(new Date(d+'T12:00:00')) === d;
  function snapshot(data,user,sections,options={}) {
    const empty = {ready:false,os:[],contracts:[],stock:[],clients:[],assistance:[],drafts:[],today:options.today || dateKey(new Date()),sections:[],tenant:null};
    if (!data || !user || options.licensed === false || !['admin','subadmin','funcionario','encarregado'].includes(user.role)) return empty;
    const management = ['admin','subadmin'].includes(user.role);
    const staff = user.role === 'funcionario' ? (data.funcionarios || []).find(x=>x.id===user.id) : user.role === 'encarregado' ? (data.encarregados || []).find(x=>x.id===user.id) : null;
    const tenant = management ? (user.role==='admin' ? user.id : user.adminId) : staff?.adminId;
    if (!tenant) return empty;
    const allowed=new Set(sections), own = arr => (arr || []).filter(x=>x.adminId===tenant);
    const assigned = s => {
      if (management) return true;
      const ids=s.funcionariosIds?.length ? s.funcionariosIds : [s.funcionarioId].filter(Boolean);
      return s.funcionarioId===null || ids.includes(user.id) || (user.role==='encarregado' && ids.some(id=>staff?.funcionariosIds?.includes(id)));
    };
    const os=allowed.has('servicos') ? own(data.servicos).filter(assigned) : [];
    const contracts=management && allowed.has('contratos') ? own(data.contratos) : [];
    const stock=management && allowed.has('artigos') ? own(data.artigos).map(a=>{
      let quantity=Number(a.stockInicial)||0;
      own(data.movimentosStock).filter(m=>m.artigoId===a.id).forEach(m=>{
        const q=Number(m.quantidade)||0;
        if (['entrada','devolucao','ajuste'].includes(m.tipo)) quantity+=q;
        else if(m.tipo==='saida') quantity-=q;
      });
      return {...a,quantity:Math.round(quantity*1000)/1000};
    }) : [];
    const clients=management && allowed.has('clientes') ? own(data.clientes) : [];
    const labels = new Map(own(data.clientes).map(c=>[c.id,c.nome || c.empresa]));
    const osWithClient=os.map(x=>({...x,clientName:labels.get(x.clienteId) || '',localName:x.morada || ''}));
    const assistance=management && allowed.has('assistencias') ? own(data.assistencias).map(x=>({...x,clientName:labels.get(x.clienteId) || ''})) : [];
    const ids=new Set(os.map(x=>x.id));
    const drafts=own(data.relatoriosEspecialidade).filter(r=>r.rascunho && ids.has(r.servicoId)).map(r=>({...r,osNumber:os.find(x=>x.id===r.servicoId)?.numeroRegisto || r.servicoId}));
    return {ready:true,os:osWithClient,contracts,stock,clients,assistance,drafts,today:empty.today,sections:[...allowed],tenant,management};
  }
  const open = s => !['concluido','concluida','cancelado','cancelada'].includes(norm(s.status));
  function alerts(s) {
    if(!s.ready)return [];
    const a=[];
    const late=s.os.filter(x=>open(x)&&valid(x.data)&&x.data<s.today).sort((a,b)=>a.data.localeCompare(b.data));
    const expired=s.contracts.filter(x=>valid(x.validadeContrato)&&x.validadeContrato<s.today).sort((a,b)=>a.validadeContrato.localeCompare(b.validadeContrato));
    const due=s.contracts.filter(x=>valid(x.validadeContrato)&&x.validadeContrato>=s.today&&x.validadeContrato<=shift(s.today,30)).sort((a,b)=>a.validadeContrato.localeCompare(b.validadeContrato));
    const low=s.stock.filter(x=>x.alertaStock===true&&x.stockMinimo!==null&&x.stockMinimo!==undefined&&x.stockMinimo!==''&&Number.isFinite(Number(x.stockMinimo))&&x.quantity<Number(x.stockMinimo));
    const portal=(s.assistance || []).filter(x=>x.origem==='portal' && x.estado==='aberta');
    const urgent=(s.assistance || []).filter(x=>x.origem!=='portal' && !['concluida','concluido','cancelada','cancelado','fechada'].includes(norm(x.estado)) && ['alta','urgente'].includes(norm(x.prioridade || x.urgencia)));
    if(portal.length)a.push({kind:'portal',section:'assistencias',title:'Pedidos do portal por tratar',items:portal,severity:'high'});
    if(urgent.length)a.push({kind:'urgent',section:'assistencias',title:'Assistências urgentes ou de prioridade alta',items:urgent,severity:'high'});
    if((s.drafts || []).length)a.push({kind:'drafts',section:'servicos',title:'Relatórios em rascunho por concluir',items:s.drafts,severity:'medium'});
    if(late.length)a.push({kind:'late',section:'servicos',title:'OS atrasadas',items:late,severity:'high'});
    if(expired.length)a.push({kind:'expired',section:'contratos',title:'Contratos expirados',items:expired,severity:'high'});
    if(due.length)a.push({kind:'due',section:'contratos',title:'Contratos a vencer em 30 dias',items:due,severity:'medium'});
    if(low.length)a.push({kind:'stock',section:'artigos',title:'Artigos abaixo do stock mínimo',items:low,severity:'medium'});
    return a;
  }
  const fmt = d => valid(d)?d.split('-').reverse().join('/'):'Sem data';
  function row(item,type) {
    if(type==='os')return `OS ${item.numeroRegisto || item.id} · ${fmt(item.data)}${item.hora?' às '+item.hora:''}${item.clientName?' · '+item.clientName:''}${item.localName?' · '+item.localName:''} · ${item.status || 'Sem estado'}${item.descricao?' · '+String(item.descricao).slice(0,120):''}`;
    if(type==='assistance')return `${item.numero || item.id} · ${item.clientName || 'Cliente'} · ${item.prioridade || item.urgencia || 'normal'} · ${item.assunto || item.descricao || ''}`;
    if(type==='drafts')return `${item.tipo || 'Relatório'} · OS ${item.osNumber} · por concluir/assinar`;
    if(type==='contracts')return `Contrato ${item.numero || item.id} · validade ${fmt(item.validadeContrato)}`;
    if(type==='stock')return `${item.nome || item.referencia || item.id}: ${item.quantity} ${item.unidade || 'un'}${item.stockMinimo!=null?' · mínimo '+item.stockMinimo:''}`;
    return `${item.nome || item.empresa || item.id}${item.numeroCliente?' · nº '+item.numeroCliente:''}`;
  }
  function list(items,type,title,section) {
    return {text:`${title}: ${items.length}.`+(items.length?'\n'+items.slice(0,6).map(x=>'• '+row(x,type)).join('\n')+(items.length>6?`\nMais ${items.length-6} registos. Abre a área para consultar todos.`:''):''),actions:[...items.slice(0,3).filter(x=>['os','clients','assistance','drafts'].includes(type)).map(x=>({recordType:type,recordId:type==='drafts'?x.servicoId:x.id,label:'Abrir '+(type==='os'?'OS '+(x.numeroRegisto || x.id):type==='clients'?(x.nome || 'cliente'):type==='drafts'?'relatório da OS '+x.osNumber:(x.numero || 'assistência'))})),{id:section,label:'Abrir '+({servicos:'Ordens de Serviço',contratos:'Contratos',artigos:'Armazém',clientes:'Clientes'}[section]||section)}],state:items.length?'success':'idle'};
  }
  function reply(query,s,context='') {
    let q=norm(query).replace(/^teco\s*/, '').replace(/^(podes|pode|consegues)\s+/, '').replace(/\s+por favor$/, '');
    if(context==='assistance' && /^(e )?(urgentes|abertas|do portal|concluidas)$/.test(q))q='assistencias '+q;
    if(!s.ready)return {text:'Ainda não tenho dados autorizados para este perfil. Podes usar os atalhos disponíveis.',actions:[],state:'idle'};
    if(/^(cria|criar|apaga|apagar|elimina|eliminar|altera|alterar|conclui|concluir|envia|enviar)\b/.test(q))return {text:'Posso consultar dados e abrir áreas. Para criar, alterar ou concluir registos, usa o formulário do módulo correspondente.',actions:[],state:'idle'};
    const a=alerts(s);
    if(/^(alertas|avisos|prioridades|o que precisa de atencao|o que devo tratar|por onde comeco|o que e urgente|o que tenho por fazer)/.test(q)) {
      return {text:a.length?'Precisa de atenção:\n'+a.map(x=>`• ${x.items.length} — ${x.title}`).join('\n'):'Não encontrei pedidos do portal por tratar, assistências urgentes, relatórios em rascunho, OS atrasadas ou alertas de contrato/stock nos dados disponíveis ao teu perfil.',actions:a.map(x=>({query:x.kind==='portal'?'pedidos do portal':x.kind==='urgent'?'assistencias urgentes':x.kind==='drafts'?'relatorios por assinar':x.kind==='late'?'OS atrasadas':x.kind==='expired'?'contratos expirados':x.kind==='due'?'contratos a vencer':'stock baixo',label:`${x.title} (${x.items.length})`})),state:a.length?'alert':'success'};
    }
    if(/^(resumo|bom dia|boa tarde|boa noite|o meu dia|meu dia|como esta a empresa)/.test(q)) {
      const today=s.os.filter(x=>x.data===s.today&&open(x));
      return {text:`Nos dados disponíveis: ${today.length} OS por concluir agendadas para hoje.\n`+(a.length?a.map(x=>`• ${x.items.length} — ${x.title}`).join('\n'):'Sem alertas de prazo ou stock.'),actions:[...(s.sections.includes('servicos')?[{query:'OS de hoje',label:'Ver o dia de hoje'}]:[]),{query:'alertas',label:'Consultar alertas'}],state:a.length?'alert':'success'};
    }
    if(/^(como|onde|ajuda a)\b/.test(q)) {
      const how=[[/assistencia/, 'assistencias', 'Os pedidos do portal entram nas Assistências em aberto. Abra o pedido, confirme cliente, local e urgência e atribua o trabalho.'],[/relatorio|assin/, 'servicos', 'Abra a OS e o separador Relatórios. Preencha o relatório, recolha as assinaturas e conclua-o antes de finalizar o serviço.'],[/stock|material/, 'artigos', 'Consulte os artigos e os movimentos no Armazém. Registe os materiais na folha de obra para manter o histórico do trabalho.'],[/os|servico|intervencao/, 'servicos', 'Abra a OS, registe a intervenção, materiais e fotos e preencha os relatórios. A conclusão respeita as permissões do seu perfil.']];
      const found=how.find(x=>x[0].test(q));if(found && s.sections.includes(found[1]))return {text:found[2],actions:[{id:found[1],label:'Abrir área'}],state:'success'};
    }
    if(/\b(portal|assistencia|assistencias)\b/.test(q)) {
      if(!s.management || !s.sections.includes('assistencias'))return {text:'O teu perfil ou módulo não permite consultar assistências no Teco.',actions:[],state:'idle'};
      let items=s.assistance || [], title='Assistências';
      if(/portal/.test(q)){items=items.filter(x=>x.origem==='portal' && x.estado==='aberta');title='Pedidos do portal por tratar';}
      else if(/urgent|prioridade alta/.test(q)){items=items.filter(x=>['alta','urgente'].includes(norm(x.prioridade || x.urgencia)) && !['concluida','concluido','cancelado','cancelada','fechada'].includes(norm(x.estado)));title='Assistências urgentes ou de prioridade alta';}
      else if(!/concluid|todas/.test(q))items=items.filter(x=>!['concluida','concluido','cancelado','cancelada','fechada'].includes(norm(x.estado)));
      else if(/concluid/.test(q))items=items.filter(x=>['concluida','concluido','fechada'].includes(norm(x.estado)));
      return {...list(items,'assistance',title,'assistencias'),context:'assistance'};
    }
    if(/relatorio|rascunho|por assinar/.test(q)) {
      if(!s.sections.includes('servicos'))return {text:'Não tenho acesso aos relatórios das OS neste perfil.',actions:[],state:'idle'};
      return {...list(s.drafts || [],'drafts','Relatórios em rascunho por concluir/assinar','servicos'),context:'drafts'};
    }
    const follow=/^(e )?(hoje|amanha|ontem|esta semana|atrasadas|pendentes|concluidas)$/.test(q);
    if((/\b(os|ordens|servicos|agenda|hoje|amanha|semana)\b/.test(q)||follow&&context==='os') && !/contrat|stock|armazem|disponiv/.test(q)) {
      if(!s.sections.includes('servicos'))return {text:'O teu perfil não permite consultar Ordens de Serviço.',actions:[],state:'idle'};
      let items=s.os, title='Ordens de Serviço';
      const search=q.match(/(?:os|servicos|ordens de servico) (?:do cliente|da cliente|de|do|da|numero|n) (.+)/);
      if(search && !/^(hoje|amanha|ontem|esta semana)$/.test(search[1])){items=items.filter(x=>norm([x.numeroRegisto,x.clientName,x.descricao].join(' ')).includes(search[1]));title='OS encontradas';}
      if(/atras|atraso/.test(q)){items=items.filter(x=>open(x)&&valid(x.data)&&x.data<s.today);title='OS atrasadas';}
      else if(/amanha/.test(q)){items=items.filter(x=>x.data===shift(s.today,1));title='OS de amanhã';}
      else if(/ontem/.test(q)){items=items.filter(x=>x.data===shift(s.today,-1));title='OS de ontem';}
      else if(/semana/.test(q)){const d=new Date(s.today+'T12:00:00'), end=shift(s.today,7-(d.getDay()||7));items=items.filter(x=>valid(x.data)&&x.data>=s.today&&x.data<=end);title='OS de hoje até domingo';}
      else if(/hoje/.test(q)){items=items.filter(x=>x.data===s.today);title='OS de hoje';}
      if(/concluid/.test(q))items=items.filter(x=>['concluido','concluida'].includes(norm(x.status)));
      else items=items.filter(open);
      if(/pendente/.test(q))items=items.filter(x=>norm(x.status)==='pendente');
      const result=list([...items].sort((a,b)=>(a.data||'9999').localeCompare(b.data||'9999')||(a.hora||'').localeCompare(b.hora||'')),'os',title+' (exceto canceladas'+(/concluid/.test(q)?'': ' e concluídas')+')','servicos');
      return {...result,context:'os'};
    }
    if(/contrat/.test(q)) {
      if(!s.management || !s.sections.includes('contratos'))return {text:'O teu perfil não permite consultar contratos no assistente.',actions:[],state:'idle'};
      const expired=/expirad|vencid/.test(q), all=!/venc|termin|renov|expir/.test(q);
      return {...list(all?s.contracts:(a.find(x=>x.kind===(expired?'expired':'due'))?.items||[]),'contracts',all?'Contratos':expired?'Contratos expirados':'Contratos a vencer nos próximos 30 dias','contratos'),context:'contracts'};
    }
    if(/stock|armazem|material/.test(q) && (!s.management || !s.sections.includes('artigos')))return {text:'O teu perfil não permite consultar stock no assistente.',actions:[],state:'idle'};
    if(/stock|armazem|material/.test(q)){const search=q.match(/(?:stock|material) (?:de|do|da) (.+)/);const items=search?s.stock.filter(x=>norm([x.nome,x.referencia].join(' ')).includes(search[1])):(a.find(x=>x.kind==='stock')?.items||[]);return {...list(items,'stock',search?'Stock encontrado':'Artigos com alerta ativo abaixo do mínimo','artigos'),context:'stock'};}
    if(/cliente/.test(q)) {
      if(!s.management || !s.sections.includes('clientes'))return {text:'O teu perfil não permite pesquisar clientes no assistente.',actions:[],state:'idle'};
      const term=q.replace(/\b(procura|procurar|pesquisa|pesquisar|encontra|encontrar|abre|abrir|cliente|clientes|o|a|os|as|um|uma|chamado|chamada|quantos|quantas|tenho|temos|mostra|lista|todos|todas)\b/g,' ').replace(/\s+/g,' ').trim();
      return {...list(term?s.clients.filter(c=>norm([c.nome,c.empresa,c.numeroCliente].join(' ')).includes(term)):s.clients,'clients',term?'Clientes encontrados':'Clientes','clientes'),context:'clients'};
    }
    if(/disponiv|livre/.test(q))return {text:'Ainda não cruzo horários, férias e serviços para confirmar disponibilidade. Consulta o calendário da equipa.',actions:[{id:'calendario-equipa',label:'Abrir calendário da equipa'}],state:'idle'};
    return null;
  }
  const api={snapshot,alerts,reply,norm,dateKey};
  if(typeof module==='object'&&module.exports)module.exports=api;else host.TGSmartData=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
