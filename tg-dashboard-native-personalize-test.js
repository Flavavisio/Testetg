/* TesteTG — personalização do Dashboard Central ORIGINAL.
   Conserva os widgets e os eventos nativos; só oculta/reordena os elementos existentes.
   As preferências são locais ao navegador e isoladas por empresa e utilizador. */
(function(root){
 'use strict';
 if(root.TGNativeDashboardPersonalizer)return;
 const $=id=>document.getElementById(id);
 const groups=[
  {id:'indicadores',label:'Indicadores principais',selector:'.hdc-kpis',prefix:'kpi'},
  {id:'resultados',label:'Resultados e atividade',selector:'.hdc-row4',prefix:'result'},
  {id:'operacao',label:'Operação e equipa',selector:'.hdc-row3',prefix:'operation'},
  {id:'gestao',label:'Satisfação e gestão',selector:'.hdc-row4b',prefix:'management'}
 ];
 const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 let userKey='',preferences=null,editing=false,watch=null,frame=null,applying=false,drag=null;
 const current=()=>{
  const user=typeof usuarioLogado==='undefined'?null:usuarioLogado;
  if(!user||!['admin','subadmin'].includes(user.role)||!user.id)return null;
  return {id:String(user.id),tenant:String(user.role==='admin'?user.id:user.adminId||'')};
 };
 const prefKey=a=>'tg:test:native-dashboard:v1:'+a.tenant+':'+a.id;
 const defaultPrefs=()=>({hidden:[],groups:groups.map(x=>x.id),orders:{}});
 function load(a){
  const newKey=prefKey(a);if(userKey===newKey&&preferences)return;
  userKey=newKey;let raw={};
  try{raw=JSON.parse(localStorage.getItem(userKey)||'{}')||{};}catch(_){}
  const base=defaultPrefs();
  preferences={
   hidden:Array.isArray(raw.hidden)?raw.hidden.filter(x=>typeof x==='string'):[],
   groups:[...new Set([...(Array.isArray(raw.groups)?raw.groups:[]),...base.groups].filter(x=>base.groups.includes(x)))],
   orders:raw.orders&&typeof raw.orders==='object'&&!Array.isArray(raw.orders)?raw.orders:{}
  };
  editing=false;
 }
 function save(){
  try{localStorage.setItem(userKey,JSON.stringify(preferences));return true;}catch(err){
   console.warn('Total Gest: não foi possível guardar a organização do Dashboard.',err);return false;
  }
 }
 function nodeList(g){
  return Array.from(g.querySelectorAll(':scope > .hdc-card, :scope > .hdc-kpi'));
 }
 function describe(el,g,i){
  const title=el.querySelector('h4,.lbl,.hdc-title,[class*=title]')?.textContent?.trim()||'';
  if(title)return title.replace(/\s+/g,' ').slice(0,72);
  if(el.id==='hdcSatisfacao')return 'Satisfação dos clientes';
  if(el.classList.contains('hdc-acoes'))return 'Ações rápidas';
  if(el.classList.contains('hdc-feed'))return 'Atividade em tempo real';
  if(el.classList.contains('hdc-top5'))return 'Top clientes';
  const body=el.textContent.replace(/\s+/g,' ').trim();
  return body.slice(0,46)||'Bloco '+(i+1);
 }
 function inventory(){
  const native=$('dashboardCentralConteudo');
  const holder=native?.querySelector('.hdc-frame');
  if(!holder)return [];
  const all=[];
  for(const group of groups){
   const node=holder.querySelector(':scope > '+group.selector);
   if(!node)continue;
   const widgets=nodeList(node).map((el,i)=>({el,id:group.prefix+'-'+i,label:describe(el,group,i)}));
   all.push({...group,node,widgets});
  }
  return all;
 }
 function ordered(arr,ids){const ranks=new Map((ids||[]).map((x,i)=>[x,i]));return [...arr].sort((a,b)=>{
  const ia=ranks.has(a.id)?ranks.get(a.id):1e6;
  const ib=ranks.has(b.id)?ranks.get(b.id):1e6;
  return ia-ib||arr.indexOf(a)-arr.indexOf(b);
 });}
 function apply(){
  if(applying||!current())return;
  const list=inventory();
  if(!list.length)return;
  applying=true;
  try{
   // Native renderer may recreate all nodes on a date or data refresh.
   const holder=list[0].node.parentElement;
   const orderedGroups=ordered(list,preferences.groups);
   for(const group of orderedGroups)holder.appendChild(group.node);
   for(const group of orderedGroups){
    const rows=ordered(group.widgets,preferences.orders[group.id]);
    for(const item of rows)group.node.appendChild(item.el);
    let visible=0;
    for(const item of rows){
     const hidden=preferences.hidden.includes(item.id);
     item.el.dataset.nativeHidden=hidden?'1':'0';
     if(!hidden)visible++;
    }
    group.node.dataset.nativeEmpty=visible?'0':'1';
    // Only change column sizing when blocks are hidden. Default 6/4/3/4
    // column layouts and all original graphs remain intact otherwise.
    if(visible&&visible<rows.length){
     group.node.dataset.nativeReduced='1';
     group.node.style.gridTemplateColumns='repeat('+visible+',minmax(0,1fr))';
    }else{
     delete group.node.dataset.nativeReduced;
     group.node.style.removeProperty('grid-template-columns');
    }
   }
   frame=holder;
  }finally{applying=false;}
 }
 function renderEditor(){
  const section=$('secao-dashboard-central'),head=section?.querySelector(':scope > .section-header');
  if(!head)return;
  let bar=$('tgNativeDashControls');
  if(!bar){
   bar=document.createElement('div');bar.id='tgNativeDashControls';
   head.insertAdjacentElement('afterend',bar);
  }
  if(!editing){
   bar.innerHTML='<button type="button" class="tgnd-primary" data-native-toggle><i class="fas fa-sliders"></i> Personalizar Dashboard</button>';
   return;
  }
  const inv=inventory();
  bar.innerHTML='<div class="tgnd-panel" role="region" aria-label="Personalização do Dashboard original">'+
  '<div class="tgnd-heading"><div><strong>Organizar o meu Dashboard</strong><p>Escolhe os blocos visíveis e altera a ordem. Mantemos o desenho original do Total Gest.</p></div>'+
  '<button type="button" data-native-toggle aria-label="Fechar personalização">×</button></div>'+
  '<div class="tgnd-groups">'+ordered(inv,preferences.groups).map(group=>
    '<section data-native-group="'+group.id+'"><header><strong>'+safe(group.label)+'</strong>'+
    '<div><button type="button" data-group-move="-1" aria-label="Subir secção">↑</button>'+
    '<button type="button" data-group-move="1" aria-label="Descer secção">↓</button></div></header>'+
    ordered(group.widgets,preferences.orders[group.id]).map(item=>
     '<div class="tgnd-item" data-native-item="'+item.id+'" draggable="true">'+
     '<span class="tgnd-grip" aria-hidden="true">⠿</span><label><input type="checkbox" data-native-visibility="'+item.id+'" '+(!preferences.hidden.includes(item.id)?'checked':'')+'> '+safe(item.label)+'</label>'+
     '<button type="button" data-item-move="-1" aria-label="Subir bloco">↑</button>'+
     '<button type="button" data-item-move="1" aria-label="Descer bloco">↓</button></div>'
    ).join('')+'</section>'
  ).join('')+'</div>'+
  '<div class="tgnd-footer"><button type="button" data-native-reset>Repor original</button>'+
  '<button type="button" class="tgnd-primary" data-native-save>Guardar organização</button></div>'+
  '<small>Preferências independentes por Admin/Subadmin neste navegador. Dados, mapas e gráficos originais não são alterados.</small></div>';
 }
 function refresh(){apply();if(editing)renderEditor();}
 function moveGroup(id,delta){
  const order=preferences.groups.slice(),i=order.indexOf(id),j=i+delta;
  if(i<0||j<0||j>=order.length)return;
  [order[i],order[j]]=[order[j],order[i]];preferences.groups=order;
  save();refresh();
 }
 function moveItem(id,groupId,delta){
  const info=inventory().find(g=>g.id===groupId);if(!info)return;
  const order=ordered(info.widgets,preferences.orders[groupId]).map(x=>x.id);
  const i=order.indexOf(id),j=i+delta;if(i<0||j<0||j>=order.length)return;
  [order[i],order[j]]=[order[j],order[i]];preferences.orders[groupId]=order;
  save();refresh();
 }
 function onClick(event){
  const bar=event.target.closest('#tgNativeDashControls');if(!bar)return;
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-native-toggle')){editing=!editing;renderEditor();return;}
  if(button.hasAttribute('data-native-save')){save();editing=false;renderEditor();return;}
  if(button.hasAttribute('data-native-reset')){preferences=defaultPrefs();save();refresh();return;}
  if(button.hasAttribute('data-group-move')){moveGroup(button.closest('[data-native-group]')?.dataset.nativeGroup,Number(button.dataset.groupMove));return;}
  if(button.hasAttribute('data-item-move')){
   moveItem(button.closest('[data-native-item]')?.dataset.nativeItem,button.closest('[data-native-group]')?.dataset.nativeGroup,Number(button.dataset.itemMove));
  }
 }
 function onChange(event){
  const input=event.target;if(!input.matches?.('#tgNativeDashControls [data-native-visibility]'))return;
  const id=input.dataset.nativeVisibility;
  preferences.hidden=input.checked?preferences.hidden.filter(x=>x!==id):[...new Set([...preferences.hidden,id])];
  save();refresh();
 }
 function onDragStart(event){
  const row=event.target.closest('#tgNativeDashControls [data-native-item]');if(!row)return;
  drag={id:row.dataset.nativeItem,group:row.closest('[data-native-group]').dataset.nativeGroup};
  if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',drag.id);}
 }
 function onDragOver(event){
  if(drag&&event.target.closest('#tgNativeDashControls [data-native-item]'))event.preventDefault();
 }
 function onDrop(event){
  if(!drag)return;
  const row=event.target.closest('#tgNativeDashControls [data-native-item]');
  const group=row?.closest('[data-native-group]')?.dataset.nativeGroup;
  if(!row||group!==drag.group)return;
  event.preventDefault();
  const list=ordered(inventory().find(g=>g.id===group)?.widgets||[],preferences.orders[group]).map(x=>x.id);
  const from=list.indexOf(drag.id),to=list.indexOf(row.dataset.nativeItem);
  if(from!==to&&from>=0&&to>=0){list.splice(from,1);list.splice(to,0,drag.id);preferences.orders[group]=list;save();refresh();}
  drag=null;
 }
 function connect(){
  const native=$('dashboardCentralConteudo'),a=current();
  if(!native||!a)return;
  load(a);
  if(!watch||watch.root!==native){
   watch?.observer.disconnect();
   const observer=new MutationObserver(()=>{
    // dashboardCentralConteudo.innerHTML is replaced by the original renderer
    // when period, OS, GPS or satisfaction state changes.
    if(applying)return;
    queueMicrotask(()=>{if(!current())return;apply();if(editing)renderEditor();});
   });
   observer.observe(native,{childList:true});watch={root:native,observer};
  }
  apply();
  if(!$('tgNativeDashControls'))renderEditor();
 }
 function start(){
  document.addEventListener('click',onClick);
  document.addEventListener('change',onChange);
  document.addEventListener('dragstart',onDragStart);
  document.addEventListener('dragover',onDragOver);
  document.addEventListener('drop',onDrop);
  document.addEventListener('dragend',()=>drag=null);
  document.addEventListener('tg:interface-updated',connect);
  const ready=()=>{
   const a=current();
   if(a&&prefKey(a)!==userKey){watch?.observer.disconnect();watch=null;frame=null;load(a);renderEditor();}
   connect();
  };
  ready();setInterval(ready,2500);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 root.TGNativeDashboardPersonalizer={connect,apply,inventory,defaultPrefs,prefKey,load,save,moveGroup,moveItem};
})(window);