/* Portal do cliente: apresenta apenas os registos já filtrados pela aplicação. */
(()=>{
'use strict';if(window.TGPortal)return;
const base=new URL('.',document.currentScript.src),style=document.createElement('link');style.rel='stylesheet';style.href=new URL('portal-cliente-ui.css?v=1',base);document.head.append(style);
let identity='',selected='inicio',searches={},mounted=null;
const icons={inicio:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',servicos:'M8 3h8v4H8z M5 5H3v16h18V5h-2 M7 12h10 M7 16h7',locais:'M4 21V3h12v18 M16 10h4v11 M8 7h4 M8 11h4 M8 15h4',documentos:'M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6',contratos:'M5 3h14v18H5Z M8 7h8 M8 11h8 M8 16l2 2 5-5',pedidos:'M4 4h16v13H9l-5 4Z M8 8h8 M8 12h5'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function icon(id){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[id]||icons.inicio);svg.append(path);return svg;}
function allowed(key){return typeof usuarioLogado!=='undefined'&&usuarioLogado?.role==='cliente'&&[usuarioLogado.id,usuarioLogado.adminId,usuarioLogado.clienteId].join(':')===key;}
function mount(model){
 const cont=document.getElementById('portal-cliente');if(!cont||!allowed(model.key))return;
 const same=identity===model.key,scroll=window.scrollY;identity=model.key;
 if(!same){selected='inicio';searches={};}
 const records=new Map([...cont.querySelectorAll('[data-portal-section]')].map(n=>[n.dataset.portalSection,n]));
 cont.querySelector('[data-portal-hero]')?.remove();
 records.forEach(n=>n.remove());
 const overview=el('section','pc-overview');while(cont.firstChild)overview.append(cont.firstChild);
 const wrapper=el('div','pc-shell'),head=el('header','pc-header'),brand=el('div');
 brand.append(el('p','pc-eyebrow','ÁREA DE CLIENTE · '+model.empresa),el('h1','',`Olá, ${model.nome}`),el('p','pc-subtitle','Acompanhe os seus serviços, documentos e pedidos num só lugar.'));
 const request=el('button','pc-primary','Pedir assistência');request.type='button';request.prepend(icon('pedidos'));request.addEventListener('click',()=>{if(allowed(model.key))portalPedirAssistencia();});head.append(brand,request);wrapper.append(head);
 const stats=el('div','pc-stats');
 const statsData=[['Visitas nos próximos 10 dias',model.upcoming,'servicos'],['Serviços por concluir',model.openServices,'servicos'],['Folhas por assinar',model.signatures,'documentos'],['Pedidos por aprovar',model.pendingRequests,'pedidos']];
 statsData.forEach(([title,value,target])=>{const b=el('button','pc-stat');b.type='button';b.append(el('span','',title),el('strong','',String(value)));if(value&&target==='documentos')b.classList.add('pc-attention');b.addEventListener('click',()=>show(target));stats.append(b);});
 overview.prepend(stats);
 const next=el('div','pc-welcome');next.append(el('h2','',model.signatures?'Há documentos à sua espera':'Tudo organizado, sem complicações'),el('p','',model.signatures?`Tem ${model.signatures === 1 ? 'uma folha de obra por assinar' : model.signatures + ' folhas de obra por assinar'}. Consulte os documentos para continuar.`:'Escolha uma área para consultar o histórico ou envie um pedido de assistência.'));
 const goDocs=el('button','pc-secondary',model.signatures?'Consultar documentos':'Ver serviços');goDocs.type='button';goDocs.addEventListener('click',()=>show(model.signatures?'documentos':'servicos'));next.append(goDocs);overview.append(next);
 const layout=el('div','pc-layout'),nav=el('nav','pc-nav');nav.setAttribute('aria-label','Menu do cliente');const main=el('div','pc-main');
 const groups=[['inicio','Início',null],['servicos','Serviços',['os','obras']],['locais','Instalações',['locais']],['documentos','Documentos',['folhas','faturas']],['contratos','Contratos',['contratos']],['pedidos','Pedidos',null]];
 const panels=new Map(),buttons=new Map();
 for(const [id,label,sections] of groups){
  const button=el('button','pc-nav-button');button.type='button';button.append(icon(id),el('span','',label));button.addEventListener('click',()=>show(id));nav.append(button);buttons.set(id,button);
  const panel=el('section','pc-panel');panel.dataset.panel=id;panel.setAttribute('aria-label',label);panel.hidden=true;panels.set(id,panel);main.append(panel);
  if(id==='inicio'){panel.append(overview);continue;}
  const title=el('div','pc-panel-title');title.append(el('h2','',label));panel.append(title);
  if(sections){
    if(id==='servicos'||id==='documentos'||id==='contratos'){
      const labelEl=el('label','pc-search','Pesquisar nesta área');const input=el('input');input.type='search';input.placeholder=id==='documentos'?'Pesquisar documentos…':'Pesquisar por descrição, data ou estado…';input.value=searches[id]||'';labelEl.append(input);panel.append(labelEl);
      input.addEventListener('input',()=>{searches[id]=input.value;filter(panel,input.value);});
    }
    sections.forEach(section=>{const card=records.get(section);if(!card)return;card.classList.add('pc-content-card');const body=card.querySelector('#portal-acc-'+section);if(body)body.style.display='block';const trigger=card.querySelector('[aria-expanded]');if(trigger)trigger.setAttribute('aria-expanded','true');card.querySelector('[id^="portal-acc-icone-"]')?.style.setProperty('transform','rotate(180deg)');panel.append(card);});
    const empty=el('p','pc-search-empty','Não há resultados para esta pesquisa.');empty.hidden=true;panel.append(empty);
    filter(panel,searches[id]||'');
  }
  if(id==='pedidos'){
    panel.append(el('p','pc-muted','Consulte aqui o estado dos pedidos enviados à empresa.'));
    const newRequest=el('button','pc-primary','Novo pedido de assistência');newRequest.type='button';newRequest.addEventListener('click',()=>{if(allowed(model.key))portalPedirAssistencia();});panel.append(newRequest);
    if(!model.requests.length)panel.append(el('div','pc-empty','Ainda não enviou pedidos. Quando precisar de ajuda, use o botão acima.'));
    const cards=el('div','pc-requests');model.requests.forEach(p=>{const card=el('article','pc-request'),line=el('div','pc-request-line');line.append(el('time','',p.data?p.data.split('-').reverse().join('/'):'Sem data'),el('span','pc-status',p.status||'Por analisar'));card.append(line,el('p','',String(p.descricao||'Sem descrição').replace(/^\[Pedido do cliente\]\s*/,'')));cards.append(card);});panel.append(cards);
  }
 }
 const help=el('p','pc-nav-help','O seu contacto com a equipa, sempre à mão.');nav.append(help);layout.append(nav,main);wrapper.append(layout);
 wrapper.append(el('p','pc-footnote','Histórico recente. Para documentos mais antigos, contacte a empresa.'));
 cont.replaceChildren(wrapper);mounted={model,panels,buttons};
 function show(id){
  if(!allowed(model.key)||!panels.has(id))return;
  selected=id;panels.forEach((p,k)=>{p.hidden=k!==id;});buttons.forEach((b,k)=>{if(k===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 }
 show(selected);if(same&&window.scrollY!==scroll)requestAnimationFrame(()=>{if(allowed(model.key))window.scrollTo({top:scroll,behavior:'instant'});});
}
function filter(panel,value){
 const q=norm(value).trim(),rows=[...panel.querySelectorAll('tbody tr')];let count=0;
 rows.forEach(r=>{r.hidden=!!q&&!norm(r.textContent).includes(q);if(!r.hidden)count++;});
 const empty=panel.querySelector('.pc-search-empty');if(empty)empty.hidden=!q||count>0;
}
window.TGPortal=Object.freeze({mount});
document.addEventListener('tg:interface-updated',()=>{if(identity&&!allowed(identity)){identity='';selected='inicio';searches={};mounted=null;document.getElementById('portal-cliente')?.replaceChildren();}});
if(typeof usuarioLogado!=='undefined'&&usuarioLogado?.role==='cliente')renderizarPortalCliente();
})();
