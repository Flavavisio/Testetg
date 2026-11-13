/* TesteTG — Dashboard configurável v1. Apenas leitura de dados operacionais.
   Preferências por utilizador neste navegador; sem alterar registos de trabalho. */
(function(root){
'use strict';
if(root.TGDashboardCustom)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const DAY=86400000;
const START=['os','team','works','pending','attention','live','activity','planning','satisfaction','shortcuts'];
const WIDGETS=[
 ['os','OS no período','fa-clipboard-list'],['team','Técnicos agora','fa-users'],['works','Obras ativas','fa-hard-hat'],
 ['pending','Pendências','fa-triangle-exclamation'],['attention','Precisa da tua atenção','fa-bell'],
 ['live','Equipa em tempo real','fa-people-group'],['activity','Atividade recente','fa-wave-square'],
 ['planning','Planeamento','fa-calendar-days'],['satisfaction','Satisfação dos clientes','fa-star'],
 ['shortcuts','Acesso rápido','fa-bolt'],['assist','Assistências','fa-headset'],['finance','Financeiro','fa-wallet']
];
const names=Object.fromEntries(WIDGETS.map(([id,name,icon])=>[id,{name,icon}]));
const defaults=()=>({period:'monthly',start:'',end:'',visible:[...START],order:WIDGETS.map(x=>x[0]),sizes:{},collapsed:[]});
let key='',state=null,editing=false,chosen=null,lastSig='',pendingSave=false;
function auth(){
 const u=typeof usuarioLogado==='undefined'?null:usuarioLogado;
 if(!u||!['admin','subadmin'].includes(u.role)||!u.id||typeof dados==='undefined')return null;
 return {user:String(u.id),tenant:String(u.role==='admin'?u.id:u.adminId),role:u.role};
}
const d=()=>typeof dados==='undefined'?{}:dados||{};
function prefKey(a){return 'tg:test:dash:v1:'+a.tenant+':'+a.user;}
function allowed(id){
 if(id==='finance') {
  const card=document.querySelector('#cardsGrid [data-card="financeiro"]');
  return !!card&&!card.hidden&&!card.classList.contains('card-bloqueado')&&!card.classList.contains('hidden-card');
 }
 return true;
}
function load(a){
 key=prefKey(a);
 let raw={};try{raw=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){}
 const base=defaults();
 state={...base,period:['weekly','monthly','annual','custom'].includes(raw.period)?raw.period:base.period,
 start:/^\d{4}-\d{2}-\d{2}$/.test(raw.start||'')?raw.start:'',
 end:/^\d{4}-\d{2}-\d{2}$/.test(raw.end||'')?raw.end:'',
 visible:Array.isArray(raw.visible)?raw.visible.filter(x=>names[x]&&allowed(x)):base.visible,
 order:[...new Set([...(Array.isArray(raw.order)?raw.order:[]),...base.order].filter(x=>names[x]))],
 sizes:Object.fromEntries(Object.entries(raw.sizes||{}).filter(([k,v])=>names[k]&&['normal','wide'].includes(v))),
 collapsed:Array.isArray(raw.collapsed)?raw.collapsed.filter(x=>names[x]):[]};
}
function save(){try{localStorage.setItem(key,JSON.stringify(state));return true;}catch(e){console.warn('Dashboard: não foi possível guardar neste navegador.',e);return false;}}
function bounds(){
 const now=new Date(),current=today(),year=now.getFullYear(),month=now.getMonth();
 let first,last=current;
 if(state.period==='weekly'){const offset=(now.getDay()+6)%7;first=new Date(now.getTime()-offset*DAY).toLocaleDateString('sv-SE');}
 if(state.period==='monthly'){first=[year,String(month+1).padStart(2,'0'),'01'].join('-');}
 if(state.period==='annual'){first=year+'-01-01';}
 if(state.period==='custom'){first=state.start||current;last=state.end||current;}
 return {first,last,invalid:first>last};
}
function inPeriod(v,b){
 if(!v||b.invalid)return false;
 let value=String(v);
 if(/^\d{13}$/.test(value))value=new Date(Number(value)).toISOString();
 if(/^\d{10}$/.test(value))value=new Date(Number(value)*1000).toISOString();
 const part=value.slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(part)&&part>=b.first&&part<=b.last;
}
function recordDate(v){return v?.data||v?.dataCriacao||v?.dataInicio||v?.criadoEm||v?.created_at||v?.dataCriado||'';}
function scoped(list,a){return (Array.isArray(list)?list:[]).filter(x=>String(x.adminId)===a.tenant);}
function group(a,b){
 const source=d(),os=scoped(source.servicos,a),works=scoped(source.obras,a),
 assist=scoped(source.assistencias,a),clock=scoped(source.ponto,a),workClock=scoped(source.obraPontoLonga,a);
 const employees=[...scoped(source.funcionarios,a),...scoped(source.encarregados,a)];
 const unique=new Map(employees.map(e=>[String(e.id),e]));
 const clientMap=new Map(scoped(source.clientes,a).map(c=>[String(c.id),c.nome||c.nomeFiscal||'Cliente']));
 const osById=new Map(os.map(x=>[String(x.id),x])),workById=new Map(works.map(x=>[String(x.id),x]));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const osPeriod=os.filter(x=>inPeriod(x.data||recordDate(x),b));
 const activeWorks=works.filter(x=>{const v=norm(x.estado||x.status);return !/inativ|desativ|concluid|cancelad|suspens/.test(v)&&/ativ|andamento|execuc/.test(v);});
 const openAssist=assist.filter(x=>!/resolvid|concluid|fechad/.test(norm(x.estado||x.status)));
 const pendingOs=os.filter(x=>/reagend|penden|prepar/.test(norm(x.status)));
 const unassigned=assist.filter(x=>!/resolvid|concluid|fechad/.test(norm(x.estado||x.status))&&!x.osGeradaId&&!x.atribuidoId);
 const team=[],activity=[];
 const current=today();
 for(const e of unique.values()){
  const p=clock.filter(x=>String(x.funcionarioId)===String(e.id)&&String(x.data)===current);
  const wp=workClock.filter(x=>String(x.funcionarioId)===String(e.id)&&String(x.data)===current);
  const openOs=p.find(x=>x.servicoId&&x.entrada&&!x.saida);
  const openWork=wp.find(x=>x.obraId&&x.entrada&&!x.saida);
  const general=p.filter(x=>!x.servicoId&&!x.obraId&&x.entrada).at(-1);
  let type='off',detail='Fora de serviço';
  if(openOs){type='active';detail='OS '+(osById.get(String(openOs.servicoId))?.numeroRegisto||'em curso');}
  else if(openWork){type='active';detail='Obra '+(workById.get(String(openWork.obraId))?.nome||'em curso');}
  else if(general?.pausaAlmoco&&general.saida){type='pause';detail='Em almoço';}
  else if(general&&!general.saida){type='active';detail='Em serviço';}
  team.push({name:e.nome||'Técnico',type,detail});
 }
 for(const [kind,rows,field] of [['OS',clock,'servicoId'],['Obra',workClock,'obraId']]){
  for(const x of rows.filter(x=>x[field]&&inPeriod(x.data,b))){
   const job=(kind==='OS'?osById:workById).get(String(x[field]));if(!job)continue;
   const person=unique.get(String(x.funcionarioId));
   const client=clientMap.get(String(job.clienteId))||'Cliente';
   activity.push({kind,id:job.id,time:String(x.entrada||'').slice(0,5),date:String(x.data||''),client,
    person:person?.nome||'Técnico',state:x.saida?(x.motivoSaida==='pausa'?'Em pausa':'Terminou'):'Em curso',working:!x.saida});
  }
 }
 activity.sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
 const agenda=os.filter(x=>inPeriod(x.data,b)).sort((a,c)=>String(a.data||'').localeCompare(String(c.data||''))||String(a.hora||'').localeCompare(String(c.hora||''))).slice(0,6);
 const openWorkIds=new Set([...workClock.filter(x=>!x.saida&&x.obraId).map(x=>String(x.obraId))]);
 const openOsIds=new Set(clock.filter(x=>!x.saida&&x.servicoId).map(x=>String(x.servicoId)));
 return {osPeriod,activeWorks,openAssist,pendingOs,unassigned,team,activity:activity.slice(0,6),agenda,clientMap,openWorkIds,openOsIds,totals:team.reduce((v,x)=>(v[x.type]++,v),{active:0,pause:0,off:0})};
}
function boxValue(value,label,note='',tone='blue'){return '<div class="tgd-stat tgd-'+tone+'"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span><small>'+esc(note)+'</small></div>';}
function listRows(items,empty){
 if(!items.length)return '<p class="tgd-empty">'+esc(empty)+'</p>';
 return '<div class="tgd-list">'+items.map(x=>'<div class="tgd-line">'+x+'</div>').join('')+'</div>';
}
function widget(id,info,b){
 const count=info.team.length,periodLabel=state.period==='weekly'?'semana':state.period==='monthly'?'mês':state.period==='annual'?'ano':'período';
 switch(id){
  case 'os':return boxValue(info.osPeriod.length,'OS no '+periodLabel,info.openOsIds.size+' em execução','blue');
  case 'team':return boxValue(info.totals.active,'Técnicos em serviço',info.totals.pause+' em almoço/pausa','green');
  case 'works':return boxValue(info.activeWorks.length,'Obras ativas',info.openWorkIds.size+' com trabalho em curso','purple');
  case 'pending':return boxValue(info.pendingOs.length+info.unassigned.length,'Pendências prioritárias',info.pendingOs.length+' OS e '+info.unassigned.length+' assistências','red');
  case 'attention':return listRows([
   '<span><i class="fas fa-calendar-xmark"></i> OS pendentes / por reagendar</span><b>'+info.pendingOs.length+'</b>',
   '<span><i class="fas fa-headset"></i> Assistências sem atribuição</span><b>'+info.unassigned.length+'</b>',
   '<span><i class="fas fa-headset"></i> Assistências abertas</span><b>'+info.openAssist.length+'</b>'
  ],'Sem alertas.');
  case 'live':return '<div class="tgd-team-count">'+boxValue(info.totals.active,'Em serviço','','green')+boxValue(info.totals.pause,'Em almoço/pausa','','amber')+boxValue(info.totals.off,'Sem serviço ativo','','muted')+'</div>'+
    listRows(info.team.slice(0,5).map(x=>'<span><i class="tgd-dot tgd-dot-'+x.type+'"></i> '+esc(x.name)+'</span><small>'+esc(x.detail)+'</small>'),'Sem equipa registada.');
  case 'activity':return listRows(info.activity.map(x=>'<span><b>'+esc(x.time)+'</b> · '+esc(x.kind)+' · '+esc(x.client)+'</span><small>'+esc(x.person)+' · '+esc(x.state)+'</small>'),'Sem atividade no período.');
  case 'planning':return listRows(info.agenda.map(x=>'<span><b>'+esc(String(x.hora||'').slice(0,5))+'</b> · '+esc(x.numeroRegisto||'OS')+'</span><small>'+esc(info.clientMap.get(String(x.clienteId))||'Cliente')+' · '+esc(x.data||'')+'</small>'),'Sem OS agendadas no período.');
  case 'satisfaction':return '<div class="tgd-shortcuts"><button data-open="relatorio-os"><i class="fas fa-file-lines"></i> Satisfação dos reports</button><button data-open="dashboard-analitico"><i class="fas fa-star"></i> Consultar indicadores</button></div><p class="tgd-caption">Os resultados são consultados nos módulos originais; não se misturam inquéritos com reports.</p>';
  case 'shortcuts':return '<div class="tgd-shortcuts"><button data-open="servicos">Ordens de serviço</button><button data-open="assistencias">Assistências</button><button data-open="obras-longa">Obras</button><button data-open="agenda-obras">Planeamento</button></div>';
  case 'assist':return boxValue(info.openAssist.length,'Assistências abertas',info.unassigned.length+' sem atribuição','blue');
  case 'finance':return '<div class="tgd-shortcuts"><button data-open="financeiro"><i class="fas fa-wallet"></i> Abrir Financeiro</button></div><p class="tgd-caption">Valores financeiros permanecem no módulo autorizado.</p>';
  default:return '';
 }
}
function render(){
 const a=auth(),section=$('secao-dashboard-central');
 if(!a||!a.tenant||!section)return;
 if(prefKey(a)!==key)load(a);
 const mount=ensure(section);
 const b=bounds(),info=group(a,b);
 const period=state.period;
 const actions='<div class="tgd-period" role="group" aria-label="Período">'+
   [['weekly','Semanal'],['monthly','Mensal'],['annual','Anual'],['custom','Personalizado']].map(([v,t])=>'<button type="button" data-period="'+v+'" class="'+(period===v?'selected':'')+'">'+t+'</button>').join('')+'</div>';
 const pick=period==='custom'?'<div class="tgd-range"><label>De <input type="date" data-date="start" value="'+esc(state.start||today())+'"></label><label>Até <input type="date" data-date="end" value="'+esc(state.end||today())+'"></label></div>':'';
 const header='<div class="tgd-top"><div><h2>Dashboard principal</h2><p>Resumo da operação e gestão da tua equipa</p></div><div class="tgd-controls">'+actions+pick+'<button type="button" class="tgd-edit" data-editor-toggle><i class="fas fa-sliders"></i> '+(editing?'Concluir personalização':'Personalizar Dashboard')+'</button></div></div>';
 const ids=state.order.filter(id=>state.visible.includes(id)&&allowed(id));
 const cards=ids.map(id=>{
  const meta=names[id],wide=state.sizes[id]==='wide',collapse=state.collapsed.includes(id);
  const editable=editing?'draggable="true"':'';
  return '<section class="tgd-widget '+(wide?'tgd-wide ':'')+(collapse?'tgd-collapsed':'')+'" data-widget="'+id+'" '+editable+'>'+
    '<header><h3><i class="fas '+meta.icon+'"></i> '+esc(meta.name)+'</h3><div class="tgd-tools">'+
    (editing?'<button type="button" data-move="-1" aria-label="Mover para trás">↑</button><button type="button" data-move="1" aria-label="Mover para a frente">↓</button><button type="button" data-size title="Alterar tamanho">↔</button><button type="button" data-hide title="Ocultar bloco">×</button>':
    '<button type="button" data-collapse aria-label="'+(collapse?'Expandir':'Recolher')+'">'+(collapse?'▾':'▴')+'</button>')+
    '</div></header><div class="tgd-body">'+widget(id,info,b)+'</div></section>';
 }).join('');
 const editor=editing?'<aside class="tgd-editor"><h3><i class="fas fa-sliders"></i> Personalizar layout</h3><p>Escolhe os blocos, arrasta para ordenar ou usa as setas. O tamanho pode ser normal ou alargado.</p>'+
 WIDGETS.filter(([id])=>allowed(id)).map(([id,name,icon])=>'<label class="tgd-option"><input type="checkbox" data-visible="'+id+'" '+(state.visible.includes(id)?'checked':'')+'><i class="fas '+icon+'"></i> '+esc(name)+'</label>').join('')+
 '<div class="tgd-editor-actions"><button type="button" data-reset>Repor layout</button><button type="button" data-save>Guardar layout</button></div><small>Preferências guardadas por utilizador neste navegador do TesteTG.</small></aside>':'';
 const msg=b.invalid?'<div class="tgd-warning" role="alert">A data inicial tem de ser anterior ou igual à data final.</div>':'';
 mount.innerHTML=header+msg+'<div class="tgd-stage"><div class="tgd-grid">'+cards+'</div>'+editor+'</div>';
 lastSig=signature();
}
function ensure(section){
 let el=$('tgdCustomRoot');if(el?.parentElement===section)return el;
 el=document.createElement('div');el.id='tgdCustomRoot';section.classList.add('tgd-custom-active');
 const native=$('dashboardCentralConteudo');
 if(native)native.before(el);else section.append(el);
 return el;
}
function signature(){
 const a=auth(),d0=d();
 if(!a)return '';
 const counts=['servicos','obras','assistencias','ponto','obraPontoLonga','funcionarios','encarregados'].map(k=>(d0[k]||[]).length);
 const flags=['ponto','obraPontoLonga'].flatMap(k=>(d0[k]||[]).filter(x=>String(x.adminId)===a.tenant).slice(-100).map(x=>[x.id,x.saida,x.motivoSaida,x.pausaAlmoco].join(':')));
 const statuses=['servicos','obras','assistencias'].flatMap(k=>(d0[k]||[]).filter(x=>String(x.adminId)===a.tenant).slice(-100).map(x=>[x.id,x.status,x.estado,x.atribuidoId].join(':')));
 return [a.user,a.tenant,today(),...counts,...flags,...statuses,state?.period,state?.start,state?.end].join('|');
}
function activate(){
 const a=auth();if(!a)return;
 const section=$('secao-dashboard-central');if(!section)return;
 if(prefKey(a)!==key)load(a);
 if(!$('tgdCustomRoot'))render();
}
function update(){
 const a=auth();if(!a)return;
 if(prefKey(a)!==key){editing=false;load(a);render();return;}
 if(!$('tgdCustomRoot')){activate();return;}
 if(!editing&&signature()!==lastSig)render();
}
function shift(id,delta){
 const order=state.order.filter(x=>state.visible.includes(x)&&allowed(x));
 const index=order.indexOf(id),newIndex=index+delta;
 if(index<0||newIndex<0||newIndex>=order.length)return;
 [order[index],order[newIndex]]=[order[newIndex],order[index]];
 const rest=state.order.filter(x=>!order.includes(x));state.order=[...order,...rest];save();render();
}
function openModule(id){
 const card=[...document.querySelectorAll('#cardsGrid [data-card]')].find(x=>x.dataset.card===id);
 if(!card||card.hidden||card.classList.contains('card-bloqueado')||card.classList.contains('hidden-card'))return;
 if(typeof abrirSecao==='function')abrirSecao(id);
 else card.click();
}
function onClick(e){
 const rootEl=e.target.closest('#tgdCustomRoot');if(!rootEl)return;
 const action=e.target.closest('button');if(!action)return;
 const period=action.dataset.period;if(period){state.period=period;save();render();return;}
 if(action.hasAttribute('data-editor-toggle')){editing=!editing;render();return;}
 if(action.hasAttribute('data-save')){save();editing=false;render();return;}
 if(action.hasAttribute('data-reset')){state=defaults();save();render();return;}
 if(action.dataset.open){openModule(action.dataset.open);return;}
 const card=action.closest('[data-widget]');if(!card)return;
 const id=card.dataset.widget;
 if(action.hasAttribute('data-collapse')){state.collapsed=state.collapsed.includes(id)?state.collapsed.filter(x=>x!==id):[...state.collapsed,id];save();render();}
 if(action.hasAttribute('data-size')){state.sizes[id]=state.sizes[id]==='wide'?'normal':'wide';save();render();}
 if(action.hasAttribute('data-hide')){state.visible=state.visible.filter(x=>x!==id);save();render();}
 if(action.hasAttribute('data-move'))shift(id,Number(action.dataset.move));
}
function onChange(e){
 const input=e.target;if(!input.closest('#tgdCustomRoot'))return;
 if(input.hasAttribute('data-visible')){const id=input.dataset.visible;state.visible=input.checked?[...new Set([...state.visible,id])]:state.visible.filter(x=>x!==id);save();render();}
 if(input.hasAttribute('data-date')){state[input.dataset.date]=input.value;save();render();}
}
function start(){
 document.addEventListener('click',onClick);
 document.addEventListener('change',onChange);
 document.addEventListener('dragstart',e=>{
  if(!editing)return;const card=e.target.closest('#tgdCustomRoot [data-widget]');if(!card)return;
  chosen=card.dataset.widget;e.dataTransfer?.setData('text/plain',chosen);if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
 });
 document.addEventListener('dragover',e=>{if(chosen&&e.target.closest('#tgdCustomRoot [data-widget]'))e.preventDefault();});
 document.addEventListener('drop',e=>{
  if(!chosen)return;const target=e.target.closest('#tgdCustomRoot [data-widget]');if(!target)return;
  e.preventDefault();const a=state.order.indexOf(chosen),b=state.order.indexOf(target.dataset.widget);
  if(a>=0&&b>=0&&a!==b){state.order.splice(a,1);state.order.splice(b,0,chosen);save();render();}chosen=null;
 });
 document.addEventListener('dragend',()=>chosen=null);
 document.addEventListener('tg:interface-updated',()=>{if(auth()&&!editing)render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
 activate();setInterval(update,7000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.TGDashboardCustom={bounds,group,load,render,save,update,defaults,prefKey};
})(window);
