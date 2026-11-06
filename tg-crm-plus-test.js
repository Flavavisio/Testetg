/* CRM 360 / follow-up / proposal templates / forecasts / team results — TesteTG only. */
(function(){
'use strict';
if(window.TGCRMPlus) return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euros=v=>Number(v||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const date=v=>v?new Date(v).toLocaleDateString('pt-PT'):'—';
const now=()=>Date.now();
const uid=()=>typeof usuarioLogado!=='undefined'?usuarioLogado:null;
const tid=()=>uid()?.adminId||uid()?.id;
const manager=()=>['admin','subadmin','superadmin'].includes(uid()?.role);
const canSetGoal=()=>['admin','superadmin'].includes(uid()?.role);
const source=()=>typeof dados==='undefined'?null:dados;
const own=(rows)=>rows.filter(r=>r.adminId===tid());
const visible=(rows,field)=>manager()?rows:rows.filter(r=>r[field]===uid()?.id);
const days=v=>{if(!v)return 0;const stamp=typeof v==='number'?v:Date.parse(String(v));return Number.isFinite(stamp)?Math.max(0,Math.floor((now()-stamp)/(24*60*60*1000))):0;};
const first=(...xs)=>xs.find(v=>v!==null&&v!==undefined&&String(v).trim())||'';
const clientName=id=>own(source()?.clientes||[]).find(c=>c.id===id)?.nome||'Sem cliente associado';
const staffName=id=>(source()?.funcionarios||[]).concat(source()?.encarregados||[],source()?.administradores||[]).find(u=>u.id===id)?.nome||'Sem responsável';
const proposalOpen=p=>!['aceite','recusada','expirada'].includes(p.estado);
function all(){
 const d=source();if(!d||!uid()||!tid())return null;
 return {clients:own(d.clientes||[]),leads:visible(own(d.leads||[]),'responsavelComercial'),opps:visible(own(d.oportunidades||[]),'responsavel'),proposals:visible(own(d.propostas||[]),'responsavelComercial'),activities:visible(own(d.atividadesComerciais||[]),'responsavel'),orders:manager()?own(d.encomendas||[]):[],works:manager()?own(d.obras||[]):[],os:manager()?own(d.servicos||[]):[]};
}
const style=document.createElement('style');
style.textContent=`
.crm-plus{margin:18px 0 22px;padding:18px;border:1px solid var(--border,#e6e8f2);border-radius:15px;background:var(--surface,#fff);box-shadow:var(--shadow)}
.crm-plus h3{margin:0 0 8px;font-size:1.02rem;color:var(--text)}.crm-plus small,.crm-plus .muted{color:var(--text-muted)}
.crm-plus-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin:12px 0}
.crm-plus-kpi{border:1px solid var(--border);background:var(--surface-2,#fafbfe);padding:12px;border-radius:11px;min-width:0}
.crm-plus-kpi strong{display:block;font-size:1.2rem;margin-top:5px;overflow-wrap:anywhere}
.crm-plus-list{display:grid;gap:8px;margin-top:12px}
.crm-plus-line{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:9px;padding:10px 12px;background:var(--surface-2,#fafbfe);border:1px solid var(--border);border-radius:9px}
.crm-plus-line>div{min-width:0;flex:1}.crm-plus-line b{display:block;font-size:.85rem}.crm-plus-line small{display:block;margin-top:3px}
.crm-plus-controls{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:11px}
.crm-plus select,.crm-plus input{max-width:100%;min-height:39px;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text);font:inherit}
.crm-plus-pill{background:#eaf0ff;color:#2456d8;border-radius:8px;padding:3px 6px;font-size:.72rem;font-weight:650}
.crm-plus-danger{color:#d1342f}.crm-plus-note{font-size:.75rem;color:var(--text-muted);margin-top:8px;line-height:1.5}
@media(max-width:600px){.crm-plus{padding:13px}.crm-plus-line{align-items:flex-start}.crm-plus-controls select{width:100%}}
`;
function mount(section,id){
 const p=$(section);if(!p)return null;
 let el=$(id);
 if(!el){el=document.createElement('section');el.id=id;el.className='crm-plus';p.insertBefore(el,p.firstElementChild);}
 return el;
}
function kpi(label,value,note){return `<div class="crm-plus-kpi"><small>${esc(label)}</small><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`;}
function renderFollowup(d){
 const box=mount('secao-acompanhamento','crmPlusFollowups');if(!box)return;
 const open=d.proposals.filter(proposalOpen);
 // The existing activity table provides persistence; no new table or permission bypass.
 const lastFor=p=>d.activities.filter(a=>(p.oportunidadeId&&a.oportunidadeId===p.oportunidadeId)||(p.leadId&&a.leadId===p.leadId)).sort((a,b)=>(b.dataCriacao||0)-(a.dataCriacao||0))[0];
 const overdue=open.filter(p=>{const a=lastFor(p);return days(a?.dataCriacao||p.dataEnvio||p.dataModificacao||p.dataCriacao)>=5;});
 const items=open.slice().sort((a,b)=>(lastFor(a)?.dataCriacao||a.dataModificacao||0)-(lastFor(b)?.dataCriacao||b.dataModificacao||0)).slice(0,12);
 box.innerHTML=`<h3><i class="fas fa-bell"></i> Seguimento de propostas</h3>
 <p class="crm-plus-note">Avisa após 5 dias sem atividade registada. O envio de emails é sempre manual e requer confirmação.</p>
 <div class="crm-plus-grid">${kpi('Aguardam decisão',String(open.length))}${kpi('Precisam de acompanhamento',String(overdue.length))}</div>
 <div class="crm-plus-list">${items.length?items.map(p=>{const last=lastFor(p),age=days(last?.dataCriacao||p.dataEnvio||p.dataModificacao||p.dataCriacao);return `<div class="crm-plus-line"><div><b>${esc(p.numero||'Proposta')} · ${esc(clientName(p.clienteId))}</b><small>${euros(p.valor)} · ${age} dias desde o último contacto · ${esc(p.estado||'rascunho')}</small></div><button class="btn btn-sm btn-outline" type="button" data-crmplus-follow="${esc(p.id)}">Registar seguimento</button></div>`}).join(''):'<small>Não existem propostas pendentes.</small>'}</div>`;
}
function follow(id){
 const d=all(),p=d?.proposals.find(x=>x.id===id);if(!p)return;
 const notes=prompt('Resumo do contacto realizado (ex.: chamada, email enviado ou sem resposta):');if(notes===null||!notes.trim())return;
 const associated=p.oportunidadeId||p.leadId;
 if(!associated){alert('Esta proposta ainda não está ligada a uma lead ou oportunidade. Associa-a antes de registar seguimentos para manter o histórico completo.');return;}
 const a={id:typeof gerarId==='function'?gerarId():crypto.randomUUID(),adminId:tid(),leadId:p.leadId||null,oportunidadeId:p.oportunidadeId||null,tipo:'seguimento',resultado:'Proposta '+(p.numero||'')+': '+notes.trim(),proximaAcao:'',responsavel:p.responsavelComercial||uid().id,dataCriacao:now()};
 source().atividadesComerciais.push(a);
 Promise.resolve(guardarDados(source(),['atividadesComerciais'])).then(()=>{render();alert('Seguimento guardado no CRM.');}).catch(()=>{source().atividadesComerciais=source().atividadesComerciais.filter(x=>x.id!==a.id);alert('O seguimento não foi guardado. Tenta novamente.');});
}
function renderClient(d){
 const box=mount('secao-clientes-crm','crmPlusClient');if(!box)return;
 let select=box.querySelector('#crmPlusClientSelect'),selected=select?.value||'';
 const ids=new Set([...d.leads.map(l=>l.clienteId),...d.opps.map(o=>o.clienteId),...d.proposals.map(p=>p.clienteId)]);
 const allowed=d.clients.filter(c=>manager()||ids.has(c.id));
 if(!allowed.some(c=>String(c.id)===selected))selected=allowed[0]?.id||'';
 const client=allowed.find(c=>String(c.id)===String(selected));
 const proposals=d.proposals.filter(p=>p.clienteId===selected);
 const opps=d.opps.filter(o=>o.clienteId===selected);
 const leads=d.leads.filter(l=>l.clienteId===selected);
 const orders=d.orders.filter(e=>e.clienteId===selected);
 const works=d.works.filter(w=>w.clienteId===selected);
 const os=d.os.filter(s=>s.clienteId===selected);
 const linked=d.activities.filter(a=>leads.some(l=>l.id===a.leadId)||opps.some(o=>o.id===a.oportunidadeId)).sort((a,b)=>(b.dataCriacao||0)-(a.dataCriacao||0)).slice(0,8);
 box.innerHTML=`<h3><i class="fas fa-address-card"></i> Ficha comercial 360.º</h3>
 <div class="crm-plus-controls"><label for="crmPlusClientSelect">Cliente</label><select id="crmPlusClientSelect"><option value="">Escolher cliente</option>${allowed.map(c=>`<option value="${esc(c.id)}" ${String(selected)===String(c.id)?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div>
 ${client?`<div class="crm-plus-grid">${kpi('Propostas',String(proposals.length),euros(proposals.reduce((s,p)=>s+Number(p.valor||0),0)))}${kpi('Oportunidades',String(opps.length))}${kpi('Encomendas',String(orders.length))}${kpi('Obras / OS',works.length+' / '+os.length)}</div>
 <div class="crm-plus-list">${[...proposals.map(p=>({at:p.dataModificacao||p.dataCriacao,title:'Proposta '+(p.numero||''),detail:euros(p.valor)+' · '+p.estado})),...opps.map(o=>({at:o.dataCriacao,title:'Oportunidade: '+o.nome,detail:euros(o.valor)+' · '+o.estado})),...leads.map(l=>({at:l.dataCriacao,title:'Lead: '+(l.empresa||l.nomeContato||'Contacto'),detail:l.estado||''})),...linked.map(a=>({at:a.dataCriacao,title:'Contacto comercial',detail:a.resultado||a.tipo||''})),...works.map(w=>({at:w.dataCriacao,title:'Obra: '+(w.nome||''),detail:w.estado||''})),...os.map(s=>({at:s.dataCriacao,title:'OS: '+(s.descricao||s.nome||''),detail:s.status||''}))].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,15).map(x=>`<div class="crm-plus-line"><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><small>${date(x.at)}</small></div>`).join('')||'<small>Sem histórico comercial.</small>'}</div>`:'<p class="crm-plus-note">Seleciona um cliente para consultar propostas, oportunidades e histórico.</p>'}
 <p class="crm-plus-note">Os dados são apresentados a partir dos módulos existentes, respeitando os registos comerciais visíveis à sessão.</p>`;
}
const templates=[
 ['CCTV','Instalação de videovigilância','Âmbito: levantamento, fornecimento de equipamentos, instalação, configuração, testes e entrega. Confirmar quantidades e características técnicas.'],
 ['Intrusão','Sistema de intrusão','Âmbito: central, detetores, dispositivos de aviso, comunicações, instalação e ensaios. Confirmar necessidades de cada instalação.'],
 ['AVAC','Instalação ou manutenção AVAC','Âmbito: equipamentos, tubagens, fluido refrigerante quando aplicável, mão de obra, testes e documentação.'],
 ['Eletricidade','Instalação elétrica','Âmbito: quadro, proteções, cablagem, acessórios, ensaios e documentação aplicável.'],
 ['Manutenção','Contrato de manutenção','Âmbito: equipamentos abrangidos, periodicidade, visitas, exclusões, assistência e condições do serviço.']
];
function renderTemplates(){
 const box=mount('secao-modelos','crmPlusTemplates');if(!box)return;
 box.innerHTML='<h3><i class="fas fa-wand-magic-sparkles"></i> Modelos rápidos de propostas</h3><div class="crm-plus-controls">'+templates.map((t,i)=>`<button type="button" class="btn btn-outline btn-sm" data-crmplus-template="${i}">${esc(t[0])}</button>`).join('')+'</div><p class="crm-plus-note">Abrem o editor já existente com uma estrutura base editável. Não adicionam preços nem artigos fictícios.</p>';
}
function startTemplate(index){
 const t=templates[index];if(!t||typeof abrirEditorProposta!=='function')return;
 abrirEditorProposta(null,null,null,'normal');
 if(typeof _orcAtual==='undefined'||!_orcAtual){alert('Não foi possível abrir o editor.');return;}
 _orcAtual.nome=t[1];_orcAtual.descricao=t[2];
 // Existing editor may have rendered its fields already: update only the safe matching controls.
 for(const [id,value] of [['orc_nome',t[1]],['orc_descricao',t[2]]]){const input=$(id);if(input)input.value=value;}
 if(typeof _orcAtualizarDataValidade==='function')_orcAtualizarDataValidade();
}
function renderForecast(d){
 const box=mount('secao-dashboard-comercial','crmPlusForecast');if(!box)return;
 const won=d.proposals.filter(p=>p.estado==='aceite'),lost=d.proposals.filter(p=>p.estado==='recusada'),pending=d.proposals.filter(proposalOpen);
 const totalWon=won.reduce((s,p)=>s+Number(p.valor||0),0),pendingValue=pending.reduce((s,p)=>s+Number(p.valor||0),0);
 const pwin=won.length+lost.length?Math.round(100*won.length/(won.length+lost.length)):0;
 const byMonth=Array.from({length:6},(_,i)=>{const month=new Date();month.setDate(1);month.setMonth(month.getMonth()-5+i);const key=month.getFullYear()+'-'+month.getMonth();return {label:month.toLocaleDateString('pt-PT',{month:'short',year:'2-digit'}),value:won.filter(p=>{const d=new Date(p.dataModificacao||p.dataCriacao||0);return d.getFullYear()+'-'+d.getMonth()===key}).reduce((s,p)=>s+Number(p.valor||0),0)};});
 const max=Math.max(...byMonth.map(x=>x.value),1);
 box.innerHTML='<h3><i class="fas fa-chart-line"></i> Previsões e evolução comercial</h3><div class="crm-plus-grid">'+kpi('Vendas aceites',euros(totalWon))+kpi('Propostas em aberto',euros(pendingValue))+kpi('Taxa de conversão',pwin+'%',won.length+' aceites / '+lost.length+' recusadas')+kpi('Propostas por acompanhar',String(pending.length))+'</div><div class="crm-plus-controls" style="align-items:end">'+byMonth.map(x=>`<div style="flex:1;min-width:42px;text-align:center" title="${esc(x.label)}: ${euros(x.value)}"><div style="height:68px;display:flex;align-items:end;justify-content:center"><div style="width:75%;height:${Math.max(2,Math.round(x.value/max*68))}px;border-radius:5px 5px 0 0;background:#2456d8"></div></div><small>${esc(x.label)}</small></div>`).join('')+'</div><p class="crm-plus-note">Os montantes em aberto representam oportunidades comerciais, não faturação confirmada.</p>';
}

const goalMonthDefault=()=>new Date().toISOString().slice(0,7);
let goalMonth=goalMonthDefault();
function goalKey(){return 'testetg_crm_objectives_v1_'+String(tid()||'none');}
function goalsLoad(){
 try {const value=JSON.parse(localStorage.getItem(goalKey())||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
 catch {return {};}
}
function goalsSave(value){
 try {localStorage.setItem(goalKey(),JSON.stringify(value));return true;}
 catch {alert('Não foi possível guardar o objetivo neste navegador.');return false;}
}
function monthValue(p){const raw=p.dataModificacao||p.dataCriacao;if(!raw)return '';const d=new Date(raw);return Number.isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function renderTeam(d){
 const box=mount('secao-equipa-comercial','crmPlusTeam');if(!box)return;
 const sellers=manager()?(typeof _pessoasParaAtribuir==='function'?_pessoasParaAtribuir(tid()):[]):[{id:uid().id,nome:uid().nome||'Eu'}];
 const stored=goalsLoad();
 const proposals=d.proposals.filter(p=>monthValue(p)===goalMonth);
 const people=sellers.filter(p=>p.id).map(person=>{
  const items=proposals.filter(p=>p.responsavelComercial===person.id),won=items.filter(p=>p.estado==='aceite'),lost=items.filter(p=>p.estado==='recusada');
  const sales=won.reduce((sum,p)=>sum+Number(p.valor||0),0);
  const target=Number(stored[goalMonth+':'+person.id]||0);
  return {...person,count:items.length,accepted:won.length,sales,target,progress:target>0?Math.round(sales/target*100):null,
   conversion:won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):0,
   planned:won.filter(p=>!p.comissaoPaga).reduce((sum,p)=>sum+Number(p.valor||0)*Number(p.comissaoPercentagem||0)/100,0),
   paid:won.filter(p=>p.comissaoPaga).reduce((sum,p)=>sum+Number(p.valor||0)*Number(p.comissaoPercentagem||0)/100,0)};
 }).sort((a,b)=>b.sales-a.sales);
 const available=people.filter(p=>p.id===uid().id||manager());
 box.innerHTML='<h3><i class="fas fa-bullseye"></i> Objetivos e desempenho comercial</h3>'+
 '<p class="crm-plus-note">Objetivo mensal de vendas aceites, sem IVA. Comparação com propostas aceites no mês selecionado. Os cálculos de comissões existentes não são alterados.</p>'+
 '<div class="crm-plus-controls"><label for="crmPlusGoalMonth">Mês</label><input id="crmPlusGoalMonth" type="month" value="'+esc(goalMonth)+'"></div>'+
 (canSetGoal()?'<div class="crm-plus-controls"><label for="crmPlusGoalSeller">Comercial</label><select id="crmPlusGoalSeller">'+people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nome)+'</option>').join('')+'</select><label for="crmPlusGoalAmount">Objetivo (€)</label><input id="crmPlusGoalAmount" type="number" min="0" step="0.01" value="0" style="width:140px"><button type="button" class="btn btn-primary btn-sm" data-crmplus-goal-save>Guardar objetivo</button></div>':'')+
 '<div class="table-wrapper scroll" style="margin-top:16px"><table><thead><tr><th>Comercial</th><th>Objetivo</th><th>Vendas aceites</th><th>Concretização</th><th>Propostas</th><th>Conversão</th><th>Comissão prevista</th><th>Comissão paga</th></tr></thead><tbody>'+
 available.map(p=>'<tr><td>'+esc(p.nome)+'</td><td>'+ (p.target>0?euros(p.target):'Por definir')+'</td><td>'+euros(p.sales)+'</td><td>'+ (p.progress===null?'—':p.progress+'%')+
 (p.progress===null?'':'<div style="height:5px;width:100%;max-width:125px;border-radius:5px;background:var(--border);overflow:hidden"><div style="height:100%;width:'+Math.min(p.progress,100)+'%;background:'+(p.progress>=100?'#178a4c':'#2456d8')+'"></div></div>')+
 '</td><td>'+p.count+'</td><td>'+p.conversion+'%</td><td>'+euros(p.planned)+'</td><td>'+euros(p.paid)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="crm-plus-note"><strong>Modo de teste:</strong> os objetivos ficam guardados apenas neste navegador, separados por empresa e mês. Não são enviados à base de dados nem sincronizados entre dispositivos. Será necessária uma tabela de testes isolada antes de os disponibilizar à equipa em vários dispositivos.</p>';
 const sel=$('crmPlusGoalSeller');if(sel){sel.addEventListener('change',syncGoalInput);syncGoalInput();}
}
function syncGoalInput(){
 const sel=$('crmPlusGoalSeller'),amount=$('crmPlusGoalAmount');if(sel&&amount)amount.value=goalsLoad()[goalMonth+':'+sel.value]??0;
}
function saveGoal(){
 if(!canSetGoal())return;
 const person=$('crmPlusGoalSeller')?.value,raw=$('crmPlusGoalAmount')?.value;
 if(!person||raw===''||!Number.isFinite(Number(raw))||Number(raw)<0){alert('Seleciona um comercial e indica um objetivo válido.');return;}
 const available=(typeof _pessoasParaAtribuir==='function'?_pessoasParaAtribuir(tid()):[]);
 if(!available.some(p=>String(p.id)===String(person))){alert('Sem permissão para atribuir objetivo a esse comercial.');return;}
 const goals=goalsLoad();if(Number(raw)===0)delete goals[goalMonth+':'+person];else goals[goalMonth+':'+person]=Number(raw);
 if(goalsSave(goals))render();
}
function render(){const d=all();if(!d||!$('crmApp')||getComputedStyle($('crmApp')).display==='none')return;renderClient(d);renderFollowup(d);renderTemplates();renderForecast(d);renderTeam(d);}
document.addEventListener('change',e=>{if(e.target.id==='crmPlusClientSelect')render();if(e.target.id==='crmPlusGoalMonth'){goalMonth=e.target.value||goalMonthDefault();render();}});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-crmplus-goal-save]')){e.preventDefault();return saveGoal();}
 const follow=e.target.closest('[data-crmplus-follow]');if(follow){follow.preventDefault();return window.TGCRMPlus.follow(follow.dataset.crmplusFollow);}
 const button=e.target.closest('[data-crmplus-template]');if(button){button.preventDefault();return window.TGCRMPlus.template(Number(button.dataset.crmplusTemplate));}
});

const menus=[
 ['clientes-crm','Ficha do Cliente','fa-address-card','leads'],
 ['oportunidades','Oportunidades','fa-bullseye','clientes-crm'],
 ['acompanhamento','Seguimento','fa-phone-volume','propostas'],
 ['modelos','Modelos rápidos','fa-layer-group','propostas'],
 ['equipa-comercial','Equipa e objetivos','fa-bullseye','comissoes']
];
function installSections(){
 const menu=document.querySelector('.crm-nav'),body=document.querySelector('#crmApp .crm-body');
 if(!menu||!body)return;
 for(const [key,label,icon,after] of menus){
  if(!$('secao-'+key)){const panel=document.createElement('div');panel.className='secao-crm';panel.id='secao-'+key;body.appendChild(panel);}
  if(!menu.querySelector('[data-tab="'+key+'"]')){
   const node=document.createElement('div');node.className='crm-nav-item';node.dataset.tab=key;
   node.innerHTML='<i class="fas '+icon+'"></i><span>'+label+'</span>';
   node.addEventListener('click',()=>mudarTabCRM(key));
   const anchor=menu.querySelector('[data-tab="'+after+'"]');
   if(anchor)anchor.after(node);else menu.append(node);
  }
 }
}
function installRouter(){
 if(typeof mudarTabCRM!=='function')return;
 const original=mudarTabCRM;
 window.mudarTabCRM=function(name){
  if(name==='oportunidades'||!menus.some(item=>item[0]===name))return original(name);
  if(typeof _crmFecharMenu==='function')_crmFecharMenu();
  document.querySelectorAll('.secao-crm').forEach(el=>el.classList.remove('ativa'));
  document.querySelectorAll('.crm-nav-item').forEach(el=>el.classList.remove('ativo'));
  $('secao-'+name)?.classList.add('ativa');
  document.querySelector('.crm-nav-item[data-tab="'+name+'"]')?.classList.add('ativo');
  const def=menus.find(item=>item[0]===name);
  if($('crmTopTitulo'))$('crmTopTitulo').textContent=def[1];
  if($('crmTopIcon'))$('crmTopIcon').innerHTML='<i class="fas '+def[2]+'"></i>';
  if($('crmTopAcoes'))$('crmTopAcoes').innerHTML='<a href="index.html" class="btn btn-sm btn-voltar-tg"><i class="fas fa-arrow-left"></i> <span>Voltar ao Total Gest</span></a>';
  render();
 };
}
function boot(){document.head.append(style);installSections();installRouter();if(typeof renderizarTudo==='function'){const orig=renderizarTudo;renderizarTudo=function(...args){const result=orig.apply(this,args);render();return result;};}render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.TGCRMPlus={render,follow,template:startTemplate};
})();