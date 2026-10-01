/* Motor TG Smart: consultas locais, sem escrita e sem serviços de IA. */
(function (host) {
  'use strict';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const shift = (day,n) => { const d=new Date(day+'T12:00:00'); d.setDate(d.getDate()+n); return dateKey(d); };
  const valid = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00').valueOf()) && dateKey(new Date(d+'T12:00:00')) === d;
  function snapshot(data,user,sections,options={}) {
    const empty = {ready:false,os:[],contracts:[],stock:[],clients:[],today:options.today || dateKey(new Date()),sections:[],tenant:null};
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
    return {ready:true,os,contracts,stock,clients,today:empty.today,sections:[...allowed],tenant,management};
  }
  const open = s => !['concluido','concluida','cancelado','cancelada'].includes(norm(s.status));
  function alerts(s) {
    if(!s.ready)return [];
    const a=[];
    const late=s.os.filter(x=>open(x)&&valid(x.data)&&x.data<s.today).sort((a,b)=>a.data.localeCompare(b.data));
    const expired=s.contracts.filter(x=>valid(x.validadeContrato)&&x.validadeContrato<s.today).sort((a,b)=>a.validadeContrato.localeCompare(b.validadeContrato));
    const due=s.contracts.filter(x=>valid(x.validadeContrato)&&x.validadeContrato>=s.today&&x.validadeContrato<=shift(s.today,30)).sort((a,b)=>a.validadeContrato.localeCompare(b.validadeContrato));
    const low=s.stock.filter(x=>x.alertaStock===true&&x.stockMinimo!==null&&x.stockMinimo!==undefined&&x.stockMinimo!==''&&Number.isFinite(Number(x.stockMinimo))&&x.quantity<Number(x.stockMinimo));
    if(late.length)a.push({kind:'late',section:'servicos',title:'OS atrasadas',items:late,severity:'high'});
    if(expired.length)a.push({kind:'expired',section:'contratos',title:'Contratos expirados',items:expired,severity:'high'});
    if(due.length)a.push({kind:'due',section:'contratos',title:'Contratos a vencer em 30 dias',items:due,severity:'medium'});
    if(low.length)a.push({kind:'stock',section:'artigos',title:'Artigos abaixo do stock mínimo',items:low,severity:'medium'});
    return a;
  }
  const fmt = d => valid(d)?d.split('-').reverse().join('/'):'Sem data';
  function row(item,type) {
    if(type==='os')return `OS ${item.numeroRegisto || item.id} · ${fmt(item.data)}${item.hora?' às '+item.hora:''} · ${item.status || 'Sem estado'}${item.descricao?' · '+String(item.descricao).slice(0,120):''}`;
    if(type==='contracts')return `Contrato ${item.numero || item.id} · validade ${fmt(item.validadeContrato)}`;
    if(type==='stock')return `${item.nome || item.referencia || item.id}: ${item.quantity} ${item.unidade || 'un'} · mínimo ${item.stockMinimo}`;
    return `${item.nome || item.empresa || item.id}${item.numeroCliente?' · nº '+item.numeroCliente:''}`;
  }
  function list(items,type,title,section) {
    return {text:`${title}: ${items.length}.`+(items.length?'\n'+items.slice(0,6).map(x=>'• '+row(x,type)).join('\n')+(items.length>6?`\nMais ${items.length-6} registos. Abre a área para consultar todos.`:''):''),actions:[{id:section,label:'Abrir '+({servicos:'Ordens de Serviço',contratos:'Contratos',artigos:'Armazém',clientes:'Clientes'}[section]||section)}],state:items.length?'success':'idle'};
  }
  function reply(query,s,context='') {
    const q=norm(query);
    if(!s.ready)return {text:'Ainda não tenho dados autorizados para este perfil. Podes usar os atalhos disponíveis.',actions:[],state:'idle'};
    if(/^(cria|criar|apaga|apagar|elimina|eliminar|altera|alterar|conclui|concluir|envia|enviar)\b/.test(q))return {text:'Posso consultar dados e abrir áreas. Para criar, alterar ou concluir registos, usa o formulário do módulo correspondente.',actions:[],state:'idle'};
    const a=alerts(s);
    if(/^(alertas|avisos|prioridades|o que precisa de atencao|o que devo tratar)/.test(q)) {
      return {text:a.length?'Precisa de atenção:\n'+a.map(x=>`• ${x.items.length} — ${x.title}`).join('\n'):'Não encontrei OS atrasadas, contratos com validade até 30 dias nem alertas de stock nos dados disponíveis ao teu perfil.',actions:a.map(x=>({query:x.kind==='late'?'OS atrasadas':x.kind==='expired'?'contratos expirados':x.kind==='due'?'contratos a vencer':'stock baixo',label:`${x.title} (${x.items.length})`})),state:a.length?'alert':'success'};
    }
    if(/^(resumo|bom dia|boa tarde|boa noite|o meu dia|meu dia|como esta a empresa)/.test(q)) {
      const today=s.os.filter(x=>x.data===s.today&&open(x));
      return {text:`Nos dados disponíveis: ${today.length} OS por concluir agendadas para hoje.\n`+(a.length?a.map(x=>`• ${x.items.length} — ${x.title}`).join('\n'):'Sem alertas de prazo ou stock.'),actions:[...(s.sections.includes('servicos')?[{query:'OS de hoje',label:'Ver o dia de hoje'}]:[]),{query:'alertas',label:'Consultar alertas'}],state:a.length?'alert':'success'};
    }
    const follow=/^(e )?(hoje|amanha|ontem|esta semana|atrasadas|pendentes|concluidas)$/.test(q);
    if((/\b(os|ordens|servicos|agenda|hoje|amanha|semana)\b/.test(q)||follow&&context==='os') && !/contrat|stock|armazem|cliente|disponiv/.test(q)) {
      if(!s.sections.includes('servicos'))return {text:'O teu perfil não permite consultar Ordens de Serviço.',actions:[],state:'idle'};
      let items=s.os, title='Ordens de Serviço';
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
    if(/stock|armazem|material/.test(q))return {...list(a.find(x=>x.kind==='stock')?.items||[],'stock','Artigos com alerta ativo abaixo do mínimo','artigos'),context:'stock'};
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
