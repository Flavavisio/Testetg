/* TesteTG CRM refresh: visual-only lead list and working proposal presets. */
(function(){
'use strict';
if(window.TGCRMOverhaul)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=value=>String(value??'').trim();
const manager=()=>typeof usuarioLogado!=='undefined'&&['admin','subadmin','superadmin'].includes(usuarioLogado?.role);
const tenant=()=>typeof usuarioLogado!=='undefined'&&(usuarioLogado?.adminId||usuarioLogado?.id);
let query='';
const types=[
 {key:'cctv',label:'Videovigilância',icon:'fa-video',title:'Instalação de sistema CCTV',body:'Fornecimento e instalação de sistema de videovigilância, configuração de gravação e acessos, testes e entrega ao cliente.'},
 {key:'intrusao',label:'Intrusão',icon:'fa-shield-halved',title:'Instalação de sistema de intrusão',body:'Fornecimento e instalação da central, detetores e acessórios, programação, testes e entrega ao cliente.'},
 {key:'avac',label:'AVAC',icon:'fa-wind',title:'Intervenção AVAC',body:'Levantamento de necessidades, fornecimento de equipamentos e materiais, instalação ou manutenção, ensaios e documentação.'},
 {key:'eletricidade',label:'Eletricidade',icon:'fa-bolt',title:'Instalação elétrica',body:'Execução de trabalhos de instalação elétrica, proteções, materiais, mão de obra, testes e entrega.'},
 {key:'manutencao',label:'Manutenção',icon:'fa-screwdriver-wrench',title:'Serviço de manutenção',body:'Manutenção preventiva e corretiva, verificações, periodicidade, peças e condições do serviço.'},
 {key:'livre',label:'Em branco',icon:'fa-file-circle-plus',title:'',body:''}
];
function data(){
 if(typeof dados==='undefined'||!dados||!tenant())return [];
 let rows=(dados.leads||[]).filter(l=>l.adminId===tenant());
 if(!manager())rows=rows.filter(l=>l.responsavelComercial===usuarioLogado.id);
 const id=$('leadsFiltroResponsavel')?.value;
 if(manager()&&id)rows=rows.filter(l=>l.responsavelComercial===id);
 const lost=$('leadsMostrarPerdidos')?.classList.contains('ativo');
 if(!lost)rows=rows.filter(l=>l.estado!=='perdido');
 if(query)rows=rows.filter(l=>[l.empresa,l.nomeContacto,l.email,l.telefone,l.telemovel,l.estado].some(v=>txt(v).toLocaleLowerCase('pt-PT').includes(query.toLocaleLowerCase('pt-PT'))));
 return rows.sort((a,b)=>(b.dataUltimoContacto||b.dataCriacao||0)-(a.dataUltimoContacto||a.dataCriacao||0));
}
function leads(){
 const area=$('secao-leads');if(!area||!$('crmApp')||getComputedStyle($('crmApp')).display==='none')return;
 let host=$('crmOverhaulLeads');
 if(!host){host=document.createElement('div');host.id='crmOverhaulLeads';area.insertBefore(host,area.querySelector('#leadsKanban'));}
 const rows=data();
 const input=host.querySelector('#crmOverhaulSearch');
 const focused=document.activeElement===input;
 const pos=focused?input.selectionStart:0;
 host.innerHTML='<div class="crm-overhaul-toolbar"><input id="crmOverhaulSearch" type="search" placeholder="Pesquisar empresas, contactos ou emails" aria-label="Pesquisar leads" value="'+esc(query)+'"><span class="crm-overhaul-label">'+rows.length+' leads</span></div>'+
 '<div class="crm-overhaul-lead-head"><span>Empresa e contacto</span><span>Responsável</span><span>Estado</span><span>Último contacto</span><span></span></div>'+
 '<div class="crm-overhaul-lead-list">'+(rows.length?rows.map(l=>{
 const resp=typeof obterNomeFuncionario==='function'?obterNomeFuncionario(l.responsavelComercial):'—';
 const when=l.dataUltimoContacto||l.dataCriacao;
 const whenText=when?new Date(when).toLocaleDateString('pt-PT'):'—';
 return '<button type="button" class="crm-overhaul-lead" data-crm-overhaul-lead="'+esc(l.id)+'"><span><strong>'+esc(l.empresa||l.nomeContacto||'Lead sem nome')+'</strong><small>'+esc([l.nomeContacto,l.telefone||l.telemovel].filter(Boolean).join(' · ')||l.email||'Sem contacto')+'</small></span><span><strong>'+esc(resp)+'</strong><small>'+esc(l.email||'')+'</small></span><span class="crm-overhaul-label">'+esc(l.estado||'Novo')+'</span><span><small>'+esc(whenText)+'</small></span><i class="fas fa-chevron-right" aria-hidden="true"></i></button>';
 }).join(''):'<div class="crm-overhaul-help">Sem leads para estes filtros. Podes criar uma nova lead no botão superior.</div>')+'</div>';
 const next=$('crmOverhaulSearch');
 if(focused){next.focus();try{next.setSelectionRange(pos,pos)}catch(_){}}
}
function models(){
 const area=$('secao-modelos');if(!area)return;
 const old=$('crmPlusTemplates');if(old)old.style.display='none';
 let host=$('crmOverhaulModels');if(!host){host=document.createElement('section');host.id='crmOverhaulModels';host.className='crm-plus';area.append(host);}
 host.innerHTML='<h3><i class="fas fa-layer-group"></i> Criar proposta rapidamente</h3><p class="crm-plus-note">Escolhe a especialidade. O editor original abre com uma descrição base, para acrescentares os artigos, preços e condições. Nada é guardado até clicares em Guardar.</p><div class="crm-overhaul-models">'+
 types.map(t=>'<button type="button" class="crm-overhaul-model" data-crm-overhaul-model="'+t.key+'"><i class="fas '+t.icon+'"></i><strong>'+esc(t.label)+'</strong><small>'+esc(t.body||'Criar uma proposta totalmente personalizada.')+'</small></button>').join('')+'</div>';
}
function openTemplate(key){
 const t=types.find(x=>x.key===key);if(!t)return false;
 if(typeof abrirEditorProposta!=='function'){alert('O editor de propostas ainda não está disponível.');return false;}
 // Reuse the real form, pricing, item editor, save workflow and generated document.
 try{
  abrirEditorProposta(null,null,null,'normal');
  if(typeof _orcAtual==='undefined'||!_orcAtual||!$('propostaEditor')||$('propostaEditor').style.display==='none')throw Error('O editor não abriu');
  _orcAtual.nome=t.title;
  _orcAtual.descricao=t.body;
  if($('orc_nome'))$('orc_nome').value=t.title;
  if($('orc_descricao'))$('orc_descricao').value=t.body;
  const legacy=$('crmPlusTemplates');if(legacy)legacy.style.display='none';
  $('propostaEditor').scrollIntoView?.({block:'start',behavior:'auto'});
  return true;
 }catch(error){console.error('Modelo rápido CRM',error);alert('Não foi possível abrir o modelo. Verifica a sessão e volta a tentar.');return false;}
}
function simplify(){
 const menu=document.querySelector('.crm-nav');
 menu?.querySelector('[data-tab="oportunidades"]')?.remove();
 // No data is deleted. The old opportunity stage model is not shown in navigation.
 const panel=$('secao-oportunidades');if(panel?.classList.contains('ativa')&&typeof mudarTabCRM==='function')mudarTabCRM('leads');
 const primary=$('secao-leads');
 if(primary){const heading=primary.querySelector('#crmOverhaulIntro');if(!heading){const h=document.createElement('div');h.id='crmOverhaulIntro';h.className='crm-overhaul-help';h.style.marginBottom='16px';h.textContent='Lista de contactos comerciais. Abre uma lead para consultar ou editar os respetivos detalhes.';primary.insertBefore(h,primary.firstChild);}}
}
function refresh(){simplify();leads();models();}
function boot(){
 simplify();
 if(typeof renderizarLeads==='function'){
  const original=renderizarLeads;
  renderizarLeads=function(...args){const res=original.apply(this,args);leads();return res;};
 }
 if(typeof mudarTabCRM==='function'){
  const original=mudarTabCRM;
  mudarTabCRM=function(name){const destination=name==='oportunidades'?'leads':name;const result=original(destination);refresh();return result;};
 }
 document.addEventListener('input',e=>{if(e.target?.id==='crmOverhaulSearch'){query=e.target.value;leads();}});
 document.addEventListener('click',e=>{
  const model=e.target.closest?.('[data-crm-overhaul-model]');
  if(model){e.preventDefault();openTemplate(model.dataset.crmOverhaulModel);return;}
  const lead=e.target.closest?.('[data-crm-overhaul-lead]');
  if(lead){e.preventDefault();if(typeof abrirModalLead==='function')abrirModalLead(lead.dataset.crmOverhaulLead);}
 });
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.TGCRMOverhaul={refresh,leads,models,openTemplate,types};
})();