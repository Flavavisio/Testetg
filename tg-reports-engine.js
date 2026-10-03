/* Operational reporting only: never reads specialty/custom document collections. */
(function(host){
 'use strict';
 const definitions = {
  os:{title:'Ordens de serviço',icon:'fa-wrench',section:'servicos',note:'Período pela data da OS. Horas efetivamente registadas nas folhas de obra.'},
  assistencias:{title:'Assistências',icon:'fa-headset',section:'assistencias',management:true,note:'Período pela data de criação. A origem identifica os pedidos do portal do cliente.'},
  clientes:{title:'Clientes e locais',icon:'fa-map-marker-alt',section:'clientes',management:true,note:'Atividade no período: OS pela data agendada e assistências pela criação. Inclui a sede e locais sem atividade.'},
  tecnicos:{title:'Técnicos e equipas',icon:'fa-users',section:'servicos',note:'OS atribuídas no período e horas registadas por pessoa nas folhas de obra. Uma OS com vários técnicos conta para cada técnico; não somar estes totais como OS únicas.'},
  obras:{title:'Obras',icon:'fa-hard-hat',section:'obras-longa',management:true,note:'Período pelo início previsto (ou criação). Horas e saídas de material no período escolhido.'},
  manutencoes:{title:'Manutenções e contratos',icon:'fa-calendar-check',section:'contratos',management:true,note:'Contratos pela próxima manutenção. Intervenções realizadas pela data de realização. A validade comercial é apresentada separadamente.'},
  stock:{title:'Stock e materiais',icon:'fa-boxes',section:'artigos',management:true,note:'Saldo atual calculado com todos os movimentos. As datas filtram os movimentos e consumos; não representam um saldo histórico. Quantidades de artigos com unidades diferentes não são somadas.'}
 };
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const number=v=>Number.isFinite(Number(v))?Number(v):0;
 const round=v=>Math.round(v*1000)/1000;
 const date=v=>{if(!v)return ''; if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);const d=new Date(v);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const assigned=s=>s.funcionariosIds?.length?s.funcionariosIds:[s.funcionarioId].filter(Boolean);
 const done=s=>['concluido','concluida','fechada'].includes(norm(s));
 const cancelled=s=>['cancelado','cancelada'].includes(norm(s));
 function scope(data,user,options={}){
  const empty={tenant:null,allowed:[],os:[],clients:[],locals:[],people:[],sheets:[],assistance:[],works:[],articles:[],movements:[],contracts:[],maintenance:[]};
  if(!user || options.licensed!==true || !['admin','subadmin','encarregado'].includes(user.role))return empty;
  const management=['admin','subadmin'].includes(user.role), staff=(data.encarregados||[]).find(x=>x.id===user.id);
  const tenant=user.role==='admin'?user.id:management?user.adminId:staff?.adminId;
  if(!tenant)return empty;
  const own=key=>(data[key]||[]).filter(x=>x.adminId===tenant);
  const denied=new Set([...(user.permissoesNegadas||[]),...((data.funcionarios||[]).find(x=>x.id===user.id)?.permissoesNegadas||[])]);
  if(denied.has('relatorio-os') || !(options.sections||[]).includes('relatorio-os'))return empty;
  const sections=(options.sections||[]).filter(x=>!denied.has(x));
  const allowed=Object.keys(definitions).filter(k=>sections.includes(definitions[k].section)&&(!definitions[k].management||management));
  const os=sections.includes('servicos')?own('servicos').filter(s=>management||s.funcionarioId===null||assigned(s).includes(user.id)||assigned(s).some(id=>staff.funcionariosIds?.includes(id))):[];
  const ids=new Set(os.map(x=>x.id));
  const clients=own('clientes').filter(c=>management||os.some(s=>s.clienteId===c.id));
  const clientIds=new Set(clients.map(x=>x.id));
  const people=[...own('funcionarios'),...own('encarregados'),...(data.administradores||[]).filter(x=>x.id===tenant)].filter(p=>management||p.id===user.id||staff.funcionariosIds?.includes(p.id));
  return {tenant,management,allowed,os,clients,locals:own('locais').filter(l=>clientIds.has(l.clienteId)),people:[...new Map(people.map(p=>[p.id,p])).values()],
   sheets:own('folhasObra').filter(f=>management?(!f.servicoId||ids.has(f.servicoId)):ids.has(f.servicoId)),
   assistance:management&&sections.includes('assistencias')?own('assistencias').filter(a=>!a.apagadoSuperAdmin):[],
   works:management&&sections.includes('obras-longa')?own('obras'):[],articles:management&&sections.includes('artigos')?own('artigos'):[],
   movements:management&&sections.includes('artigos')?own('movimentosStock'):[],contracts:management&&sections.includes('contratos')?own('contratos'):[],
   maintenance:management&&sections.includes('contratos')?own('registosManutencao'):[]};
 }
 function build(s,type,f={},options={}){
  if(!s.allowed.includes(type))throw Error('Sem acesso a este relatório.');
  if(f.start&&f.end&&f.start>f.end)throw Error('A data de início não pode ser posterior à data de fim.');
  const use=v=>v&&v!=='__todos';
  const period=v=>{const d=date(v);return (!f.start&&!f.end)||!!d&&(!f.start||d>=f.start)&&(!f.end||d<=f.end);};
  const state=v=>!use(f.state)||norm(v)===norm(f.state);
  const locality=x=>x.localId||'__sede';
  const common=x=>(!use(f.client)||x.clienteId===f.client)&&(!use(f.local)||locality(x)===f.local);
  const person=x=>!use(f.person)||assigned(x).includes(f.person)||x.atribuidoId===f.person||x.responsavelId===f.person||x.responsaveisIds?.includes(f.person);
  const client=id=>s.clients.find(x=>x.id===id)?.nome||'Sem cliente';
  const local=x=>x.localId?(s.locals.find(l=>l.id===x.localId&&l.clienteId===x.clienteId)?.nome||x.morada||'Local não identificado'):'Sede';
  const name=id=>s.people.find(x=>x.id===id)?.nome||'Sem responsável';
  const os=s.os.filter(x=>common(x)&&person(x)&&state(x.status||'pendente')&&period(x.data)).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const hours=(list)=>round(list.reduce((v,x)=>v+number(x.horasTrabalhadas),0));
  const sheets=s.sheets.filter(x=>period(x.data));
  const tables=[],summary=[];
  const table=(title,headers,rows)=>tables.push({title,headers,rows});
  const metric=(label,value)=>summary.push({label,value});
  const selectedSheets=list=>{const ids=new Set(list.map(x=>x.id));return sheets.filter(x=>ids.has(x.servicoId));};
  if(type==='os'){
   table('Ordens de serviço',['Nº','Data','Cliente','Local','Descrição','Responsáveis','Estado','Horas registadas'],os.map(x=>[x.numeroRegisto||x.id,x.data||'—',client(x.clienteId),local(x),x.descricao||'—',assigned(x).map(name).join(', ')||'Todos',x.status||'pendente',hours(selectedSheets([x]))]));
   if(s.movements.length){
    const osIds=new Set(os.map(x=>x.id)), fs=selectedSheets(os), folioIds=new Set(fs.map(x=>x.id));
    const materials=s.movements.filter(m=>m.tipo==='saida'&&period(m.data)&&((m.origemTipo==='os'&&osIds.has(m.origemId))||(m.origemTipo==='folha'&&folioIds.has(m.origemId))));
    table('Materiais utilizados',['OS','Data','Artigo','Quantidade','Unidade'],materials.map(m=>{const o=os.find(x=>x.id===(m.origemTipo==='os'?m.origemId:fs.find(f=>f.id===m.origemId)?.servicoId));const a=s.articles.find(x=>x.id===m.artigoId);return [o?.numeroRegisto||o?.id||'—',m.data||'—',a?.nome||'Artigo não identificado',number(m.quantidade),a?.unidade||'un'];}));
   }
   metric('Total de OS',os.length);metric('Por concluir',os.filter(x=>!done(x.status)&&!cancelled(x.status)).length);metric('Concluídas',os.filter(x=>done(x.status)).length);metric('Horas registadas',hours(selectedSheets(os)));
  }
  if(type==='assistencias'){
   const list=s.assistance.filter(x=>common(x)&&person(x)&&state(x.estado||'aberta')&&period(x.dataCriacao)&&(!use(f.urgency)||x.prioridade===f.urgency)&&(!use(f.origin)||(f.origin==='interna'?x.origem!=='portal':x.origem===f.origin)));
   table('Assistências',['Nº','Criação','Cliente','Local','Urgência','Origem','Estado','Responsável','Problema','OS'],list.map(x=>[x.numero||x.id,date(x.dataCriacao)||'—',client(x.clienteId),local(x),x.prioridade||'normal',x.origem==='portal'?'Portal do cliente':'Interna',x.estado||'aberta',name(x.atribuidoId),x.assunto||x.descricao||'—',s.os.find(o=>o.id===x.osGeradaId)?.numeroRegisto||'Sem OS']));
   metric('Total',list.length);metric('Por tratar / realizar',list.filter(x=>!done(x.estado)&&!cancelled(x.estado)).length);metric('Concluídas',list.filter(x=>done(x.estado)).length);metric('Do portal',list.filter(x=>x.origem==='portal').length);
  }
  if(type==='clientes'){
   const sites=s.clients.filter(c=>!use(f.client)||c.id===f.client).flatMap(c=>[{clienteId:c.id,localId:null,morada:c.morada},...s.locals.filter(l=>l.clienteId===c.id).map(l=>({...l,localId:l.id}))]).filter(common);
   const rows=sites.map(l=>{const list=os.filter(x=>x.clienteId===l.clienteId&&locality(x)===locality(l));const a=s.assistance.filter(x=>common(x)&&x.clienteId===l.clienteId&&locality(x)===locality(l)&&period(x.dataCriacao));return [client(l.clienteId),local(l),l.morada||'—',list.length,list.filter(x=>done(x.status)).length,list.filter(x=>!done(x.status)&&!cancelled(x.status)).length,a.length,hours(selectedSheets(list))];});
   table('Atividade por local',['Cliente','Local','Morada','OS','OS concluídas','OS por concluir','Assistências','Horas registadas'],rows);metric('Clientes',new Set(sites.map(x=>x.clienteId)).size);metric('Locais (inclui sede)',sites.length);metric('OS no período',os.length);
  }
  if(type==='tecnicos'){
   const rows=s.people.filter(p=>!use(f.person)||p.id===f.person).map(p=>{const list=os.filter(x=>assigned(x).includes(p.id));const ids=new Set(os.map(x=>x.id));const fs=sheets.filter(x=>x.funcionarioId===p.id&&ids.has(x.servicoId));return [p.nome||'—',p.role||(p.id===s.tenant?'admin':p.funcionariosIds?'encarregado':'técnico'),list.length,list.filter(x=>done(x.status)).length,list.filter(x=>!done(x.status)&&!cancelled(x.status)).length,hours(fs),s.people.filter(e=>e.funcionariosIds?.includes(p.id)||e.id===p.id&&e.funcionariosIds).map(e=>e.nome).join(', ')||'Sem equipa definida'];});
   table('Atividade por pessoa',['Pessoa','Função','OS atribuídas','OS concluídas','OS por concluir','Horas registadas','Equipa / encarregado'],rows);metric('Pessoas',rows.length);metric('OS únicas',os.length);metric('Horas registadas',round(rows.reduce((v,r)=>v+r[5],0)));
  }
  if(type==='obras'){
   const list=s.works.filter(x=>common(x)&&person(x)&&state(x.estado)&&period(x.dataInicioPrevista||x.dataCriacao));
   table('Obras',['Obra','Cliente','Local','Estado','Início previsto','Fim previsto','Responsáveis','OS associadas','Horas registadas','Saídas de material'],list.map(x=>{const fs=sheets.filter(y=>y.obraId===x.id||s.os.some(o=>o.id===y.servicoId&&o.obraId===x.id));return [x.nome||'—',client(x.clienteId),local(x),x.estado||'—',x.dataInicioPrevista||'—',x.dataFimPrevista||'—',[...new Set([x.responsavelId,...(x.responsaveisIds||[])].filter(Boolean))].map(name).join(', ')||'—',os.filter(y=>y.obraId===x.id).length,hours(fs),s.movements.filter(y=>y.obraId===x.id&&y.tipo==='saida'&&period(y.data)).length];}));
   metric('Obras',list.length);metric('Concluídas',list.filter(x=>done(x.estado)).length);metric('Em curso',list.filter(x=>!done(x.estado)&&!cancelled(x.estado)).length);
  }
  if(type==='manutencoes'){
   const today=options.today||date(new Date());
   const next=x=>date(options.nextMaintenance?.[x.id]||x.proximaManutencao);
   const status=x=>!next(x)?'sem agenda':next(x)<today?'em atraso':'prevista';
   const list=s.contracts.filter(x=>common(x)&&period(next(x))&&state(status(x)));
   table('Próximas manutenções',['Contrato','Cliente','Local','Periodicidade','Próxima manutenção','Situação','Validade do contrato'],list.map(x=>[x.numero||x.id,client(x.clienteId),local(x),x.periodicidade||'—',next(x)||'Sem agenda',status(x),x.validadeContrato||'—']));
   const contracts=s.contracts.filter(common);const ids=new Set(contracts.map(x=>x.id));
   const performed=s.maintenance.filter(x=>ids.has(x.contratoId)&&period(x.dataRealizacao)&&(!use(f.state)||f.state==='realizada'));
   table('Manutenções realizadas',['Contrato','Cliente','Local','Data','Descrição'],performed.map(x=>{const c=contracts.find(c=>c.id===x.contratoId);return [c.numero||c.id,client(c.clienteId),local(c),x.dataRealizacao||'—',x.observacoes||x.descricao||'—'];}));
   metric('Contratos na seleção',list.length);metric('Manutenções em atraso',list.filter(x=>status(x)==='em atraso').length);metric('Realizadas no período',performed.length);
  }
  if(type==='stock'){
   const list=s.articles.filter(x=>!use(f.article)||x.id===f.article);
   const balance=a=>round(number(a.stockInicial)+s.movements.filter(x=>x.artigoId===a.id).reduce((v,m)=>v+(m.tipo==='saida'?-number(m.quantidade):['entrada','devolucao','ajuste'].includes(m.tipo)?number(m.quantidade):0),0));
   const low=a=>a.stockMinimo!=null&&balance(a)<number(a.stockMinimo);
   const arts=list.filter(x=>!use(f.state)||f.state==='baixo'&&low(x)||f.state==='normal'&&!low(x));
   table('Saldo atual',['Referência','Artigo','Unidade','Stock atual','Mínimo','Situação'],arts.map(x=>[x.referencia||'—',x.nome||'—',x.unidade||'un',balance(x),x.stockMinimo??'—',low(x)?'Abaixo do mínimo':'Normal']));
   const ids=new Set(arts.map(x=>x.id));const moves=s.movements.filter(x=>ids.has(x.artigoId)&&period(x.data)&&(!use(f.movement)||x.tipo===f.movement));
   table('Movimentos no período',['Data','Artigo','Tipo','Quantidade','Unidade','Obra / serviço','Nota'],moves.map(x=>{const a=arts.find(a=>a.id===x.artigoId);return [x.data||'—',a.nome||'—',x.tipo,number(x.quantidade),a.unidade||'un',s.works.find(w=>w.id===x.obraId)?.nome||s.os.find(o=>o.id===x.origemId)?.numeroRegisto||x.origemTipo||'—',x.nota||'—'];}));
   metric('Artigos',arts.length);metric('Abaixo do mínimo',arts.filter(low).length);metric('Movimentos',moves.length);
  }
  return {type,title:definitions[type].title,note:definitions[type].note,tables,summary,filters:{...f},period:(f.start||f.end)?`${f.start||'Início'} a ${f.end||'Hoje'}`:'Todas as datas'};
 }
 const api={definitions,scope,build,date};
 if(typeof module==='object'&&module.exports)module.exports=api;else host.TGReports=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
