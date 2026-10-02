/* Configuração preparatória por empresa. Não recolhe nem guarda segredos. */
(()=>{
'use strict';if(window.TGPHC)return;
const base=new URL('.',document.currentScript.src),css=document.createElement('link');css.rel='stylesheet';css.href=new URL('phc-integracao.css?v=1',base);document.head.append(css);
const box=document.createElement('dialog');box.id='tg-phc';box.setAttribute('aria-labelledby','phc-title');document.body.append(box);
let owner=null,edition='go',drafts={},dirty=false,simulator=null,simKey='',saving=false;
const $=s=>box.querySelector(s);
function context(){
 if(typeof usuarioLogado==='undefined'||!['admin','subadmin'].includes(usuarioLogado?.role)||typeof adminAtual!=='function')return null;
 const admin=adminAtual();if(!admin)return null;
 return {admin,key:[usuarioLogado.id,usuarioLogado.role,admin.id].join(':')};
}
function authorised(){const c=context();if(!c||!owner||c.key!==owner.key){box.close();owner=null;box.replaceChildren();return null;}return c;}
function state(message,error=false){const el=$('.phc-status');if(el){el.textContent=message;el.classList.toggle('error',error);}}
function collect(){return window.TGPHCCore.draft({edition,baseUrl:$('#phc-url').value,company:$('#phc-company').value,appId:$('#phc-app')?.value,version:$('#phc-version')?.value,scriptCode:$('#phc-script')?.value,invoiceSeries:$('#phc-series').value,stockPolicy:$('#phc-policy').value,warehouses:[...box.querySelectorAll('.phc-map-row')].map(r=>({localId:r.querySelector('[data-local]').value,externalId:r.querySelector('[data-external]').value}))});}
function warehouseRow(value={}){
 const row=document.createElement('div');row.className='phc-map-row';
 const local=document.createElement('select');local.dataset.local='';local.setAttribute('aria-label','Armazém Total Gest');
 const option=document.createElement('option');option.value='';option.textContent='Armazém Total Gest';local.append(option);
 const warehouses=(typeof dados!=='undefined'?dados.armazens||[]:[]).filter(a=>a.adminId===owner.admin.id);
 for(const a of warehouses){const o=document.createElement('option');o.value=a.id;o.textContent=a.nome||a.id;local.append(o);}
 if(value.localId&&!warehouses.some(a=>a.id===value.localId)){const o=document.createElement('option');o.value=value.localId;o.textContent='Armazém indisponível — '+value.localId;local.append(o);}
 local.value=value.localId||'';
 const external=document.createElement('input');external.dataset.external='';external.placeholder='Código no PHC';external.setAttribute('aria-label','Código do armazém PHC');external.maxLength=160;external.value=value.externalId||'';
 const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.addEventListener('click',()=>{row.remove();dirty=true;});row.append(local,external,remove);$('.phc-mappings').append(row);
}
function render(){
 const cfg=drafts[edition]||{};
 box.innerHTML=`<header><div><span class="phc-eyebrow">INTEGRAÇÕES · PREPARAÇÃO</span><h2 id="phc-title">PHC — faturação e stock</h2><p class="phc-company-name"></p></div><button type="button" data-close aria-label="Fechar">×</button></header>
 <nav aria-label="Versão do PHC"><button type="button" data-edition="go">PHC GO</button><button type="button" data-edition="cs">PHC CS</button></nav>
 <div class="phc-notice"><strong>Rascunho · ainda sem ligação ao PHC</strong><p>Prepara as opções da tua empresa. A simulação usa dados fictícios; não emite documentos nem altera stock real.</p></div>
 <form><div class="phc-fields"><label>URL da instalação / serviço<input id="phc-url" type="url" maxlength="500" placeholder="https://…"></label><label>Código da empresa no PHC<input id="phc-company" maxlength="160"></label>
 ${edition==='go'?'<label>App ID da integração<input id="phc-app" maxlength="160"></label>':'<label>Versão e gama PHC CS<input id="phc-version" maxlength="160" placeholder="Ex.: versão / Advanced ou Enterprise"></label><label>Código de script acordado com o parceiro<input id="phc-script" maxlength="160"></label>'}
 <label>Série pretendida para faturação<input id="phc-series" maxlength="160"></label><label>Quando movimentar stock?<select id="phc-policy"><option value="invoice">Na faturação — não repetir o consumo no PHC</option><option value="consumption">No consumo da OS — não repetir na fatura</option></select></label></div>
 <p class="phc-help">A série e o comportamento de stock terão de ser validados no PHC antes de ativar a ligação. As credenciais serão configuradas numa fase posterior.</p>
 <section><h3>Associação de armazéns</h3><p class="phc-help">Relaciona cada armazém desta empresa com o respetivo código no PHC.</p><div class="phc-mappings"></div><button type="button" data-add>+ Associar armazém</button></section>
 <div class="phc-status" role="status" aria-live="polite"></div><footer><button type="button" data-close>Fechar</button><button type="submit" class="phc-primary">Guardar rascunho</button></footer></form>
 <section class="phc-demo"><h3>Experimentar o fluxo</h3><p>Exemplo fictício: OS-DEMO-001 · 2 materiais × 35 € + 60 € de serviço. IVA de exemplo: 23%.</p><button type="button" data-demo>Simular faturação e stock</button><div class="phc-demo-result" role="status" aria-live="polite"></div></section>`;
 $('.phc-company-name').textContent=owner.admin.empresa||owner.admin.nome||'Empresa atual';
 for(const [id,key] of [['url','baseUrl'],['company','company'],['app','appId'],['version','version'],['script','scriptCode'],['series','invoiceSeries'],['policy','stockPolicy']])if($('#phc-'+id))$('#phc-'+id).value=cfg[key]||(id==='policy'?'invoice':'');
 for(const m of cfg.warehouses||[])warehouseRow(m);
 box.querySelectorAll('[data-edition]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.edition===edition));b.addEventListener('click',()=>{if(!authorised()||saving)return;try{drafts[edition]=collect();}catch(e){state(e.message,true);return;}edition=b.dataset.edition;render();});});
 box.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
 $('form').addEventListener('input',()=>{dirty=true;});$('form').addEventListener('change',()=>{dirty=true;});
 $('[data-add]').addEventListener('click',()=>{if(authorised()){warehouseRow();dirty=true;}});
 $('form').addEventListener('submit',save);
 $('[data-demo]').addEventListener('click',simulate);
}
function close(){if(saving)return;if(dirty&&!confirm('Fechar sem guardar as alterações do rascunho PHC?'))return;box.close();box.replaceChildren();owner=null;simulator=null;}
async function save(e){
 e.preventDefault();const c=authorised();if(!c||saving)return;
 try{
  drafts[edition]=collect();
  const clean={};for(const key of ['go','cs'])if(drafts[key])clean[key]=window.TGPHCCore.draft({...drafts[key],edition:key});
  const current=(typeof dados!=='undefined'?dados.armazens||[]:[]).filter(a=>a.adminId===c.admin.id);
  if(Object.values(clean).some(d=>d.warehouses.some(m=>!current.some(a=>a.id===m.localId))))throw Error('Uma associação contém um armazém que já não pertence a esta empresa. Corrige-a antes de guardar.');
  c.admin.integracaoFaturacao={...(c.admin.integracaoFaturacao||{}),phcDrafts:clean};
  saving=true;$('button[type="submit"]').disabled=true;state('A guardar o rascunho…');
  await guardarDados(dados);
  if(!authorised())return;
  dirty=false;state(navigator.onLine?'Rascunho guardado. A ligação ao PHC continua por validar.':'Rascunho guardado localmente. A sincronização fica pendente de ligação à internet.');
 }catch(err){if(owner&&context()?.key===owner.key)state('Não foi possível confirmar a gravação: '+err.message+' As alterações podem ficar pendentes de sincronização.',true);}
 finally{saving=false;if($('button[type="submit"]'))$('button[type="submit"]').disabled=false;}
}
function simulate(){
 if(!authorised())return;
 const policy=$('#phc-policy').value,key=JSON.stringify([owner.key,edition,policy]);
 if(key!==simKey||!simulator){simKey=key;simulator=window.TGPHCCore.demo(owner.admin.id,edition,policy);}
 const r=simulator.run(),money=c=>(c/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
 $('.phc-demo-result').textContent=`SIMULAÇÃO — ${r.documentId}\n${r.duplicate?'Pedido repetido: foi reutilizado o resultado da simulação, sem novo movimento.':'Foi simulado um documento, sem comunicação ao PHC.'}\nBase: ${money(r.netCents)} · IVA de exemplo: ${money(r.taxCents)} · Total: ${money(r.totalCents)}\nStock fictício inicial: 5 · Antes da fatura: ${r.quantityBeforeInvoice} · Final: ${r.quantityAfter}\nMovimento único ${policy==='invoice'?'na faturação':'no consumo da OS'}.`;
}
function open(){
 const c=context();if(!c){alert('A configuração PHC está disponível ao administrador da empresa.');return;}
 if(!window.TGPHCCore){alert('O módulo PHC ainda está a carregar. Tenta novamente.');return;}
 if(box.open)return;owner=c;edition='go';dirty=false;drafts=JSON.parse(JSON.stringify(c.admin.integracaoFaturacao?.phcDrafts||{}));simulator=null;simKey='';render();box.showModal();
}
box.addEventListener('cancel',e=>{e.preventDefault();close();});
document.addEventListener('tg:interface-updated',()=>{if(box.open)authorised();});
window.TGPHC=Object.freeze({open});
})();
