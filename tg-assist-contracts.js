/* Teste TG: installation selection, contract opportunities and one visit per request. */
(function(){
'use strict';
const esc=v=>escapeHtmlSimples(String(v??''));
const own=(key,id)=>(dados[key]||[]).find(x=>x.id===id&&x.adminId===_tenantId()&&!x.apagadoSuperAdmin);
const licensed=()=>typeof moduloContratosAtivo==='function'&&moduloContratosAtivo(adminAtual());
const localKey=id=>id||'';
let potentialClient='';
function locations(clienteId){
 const c=own('clientes',clienteId);if(!c)return [];
 return [{id:'',nome:'Sede',cidade:c.cidade||'',morada:c.morada||c.endereco||''},...(dados.locais||[]).filter(l=>l.adminId===_tenantId()&&l.clienteId===c.id&&!l.apagadoSuperAdmin).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'))];
}
function contracts(clienteId,localId,today=getDataHoje()){
 return (dados.contratos||[]).filter(c=>c.adminId===_tenantId()&&c.clienteId===clienteId&&!c.apagadoSuperAdmin&&(!c.dataInicio||c.dataInicio<=today)&&(!c.validadeContrato||c.validadeContrato>=today)&&
  (Array.isArray(c.locaisIds)&&c.locaisIds.length?c.locaisIds:[c.localId||'']).includes(localKey(localId))).sort((a,b)=>(a.numero||a.id).localeCompare(b.numero||b.id,'pt',{numeric:true}));
}
function potential(){
 const ids=new Set((dados.assistencias||[]).filter(a=>a.adminId===_tenantId()&&!a.apagadoSuperAdmin&&own('clientes',a.clienteId)&&locations(a.clienteId).some(l=>localKey(l.id)===localKey(a.localId))&&!contracts(a.clienteId,a.localId).length).map(a=>a.clienteId));
 return [...ids].map(id=>({client:own('clientes',id),locations:locations(id)})).sort((a,b)=>(a.client.nome||'').localeCompare(b.client.nome||'','pt',{sensitivity:'base',numeric:true}));
}
function askForContract(clientId,localId,prefix,box){
 if(typeof tgConfirm!=='function')return;
 const tenant=_tenantId(),user=usuarioLogado?.id;
 Promise.resolve(tgConfirm('Esta instalação não tem contrato de manutenção ativo. Queres criar um contrato de manutenção agora?',{titulo:'Contrato de manutenção',icone:'fa-file-signature',textoOk:'Sim',textoCancelar:'Não'})).then(yes=>{
  if(!yes||typeof document==='undefined'||!box.isConnected)return;
  const current=selected(prefix);
  if(yes&&box.isConnected&&tenant===_tenantId()&&user===usuarioLogado?.id&&current.clientId===clientId&&localKey(current.localId)===localKey(localId))openContract(clientId,localId);
 });
}

function selected(prefix='assist'){
 const clientId=document.getElementById(prefix+'_cliente')?.value||'',select=document.getElementById(prefix+'_local');
 const value=select?.value;return {clientId,localId:value==='__sede__'?null:value||null,chosen:!!value};
}
function syncForm(prompt=false,prefix='assist'){
 const select=document.getElementById(prefix+'_local');if(!select)return;
 const clientId=document.getElementById(prefix+'_cliente')?.value||'',changed=select.dataset.client!==clientId;
 const before=changed?'':select.value;select.dataset.client=clientId;
 const opts=locations(clientId);select.replaceChildren(new Option('— Escolher instalação —',''));
 opts.forEach(l=>select.add(new Option(l.nome+(l.cidade?' — '+l.cidade:''),l.id||'__sede__')));
 select.value=opts.some(l=>(l.id||'__sede__')===before)?before:opts.length===1?'__sede__':'';
 if(select.dataset.initial!==undefined){const initial=select.dataset.initial;delete select.dataset.initial;if(opts.some(l=>(l.id||'__sede__')===initial))select.value=initial;}
 select.disabled=!clientId||select.dataset.locked==='1';
 syncContract(prompt,prefix);
}
function syncContract(prompt=false,prefix='assist'){
 const box=document.getElementById(prefix+'ContractSummary');if(!box)return;
 const {clientId,localId,chosen}=selected(prefix);if(!clientId||!chosen){box.textContent='Escolhe o cliente e a instalação para verificar o contrato.';return;}
 const matches=contracts(clientId,localId),previous=document.getElementById(prefix+'_contrato')?.value;
 const saved=box.dataset.contract;
 if(matches.length){
  box.innerHTML='<label for="'+prefix+'_contrato">Contrato de manutenção</label><select id="'+prefix+'_contrato">'+matches.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.numero||c.id)+'</option>').join('')+'</select><p class="help-text">A visita só é descontada quando a OS desta assistência for concluída. Criar ou guardar a assistência não desconta visitas.</p>';
  const select=document.getElementById(prefix+'_contrato');if(matches.some(c=>c.id===(previous||saved)))select.value=previous||saved;
 }else{
  box.innerHTML='<strong>Potencial para contrato</strong><p class="help-text">Esta instalação não tem contrato de manutenção ativo.</p><button type="button" class="btn btn-sm btn-outline" id="'+prefix+'CreateContract">Criar contrato de manutenção</button>';
  document.getElementById(prefix+'CreateContract').onclick=()=>openContract(clientId,localId);
  const key=JSON.stringify([clientId,localId]);
  if(prompt&&box.dataset.warned!==key){box.dataset.warned=key;askForContract(clientId,localId,prefix,box);}
 }
}
function form(item,prefix='assist'){
 const select=document.getElementById(prefix+'_local'),box=document.getElementById(prefix+'ContractSummary');if(!select)return;
 select.dataset.initial=item?(item.localId||'__sede__'):'';select.dataset.locked=item?.osGeradaId?'1':'0';if(box)box.dataset.contract=item?.testeContratoId||'';
 if(item?.osGeradaId){const search=document.getElementById(prefix+'_cliente_busca');if(search)search.disabled=true;}
 select.onchange=()=>syncContract(true,prefix);syncForm(false,prefix);
}
function booking(existing,clientId,localId,prefix='assist'){
 if(!own('clientes',clientId)||!locations(clientId).some(l=>localKey(l.id)===localKey(localId)))throw Error('Escolhe uma instalação válida deste cliente.');
 if(existing?.osGeradaId&&(existing.clienteId!==clientId||localKey(existing.localId)!==localKey(localId)))throw Error('O cliente e a instalação já estão associados à OS e não podem ser alterados.');
 const same=existing?.clienteId===clientId&&localKey(existing?.localId)===localKey(localId);
 if(same&&existing?.testeContratoId)return {testeContratoId:existing.testeContratoId,testeVisitaAno:existing.testeVisitaAno};
 const available=contracts(clientId,localId),id=document.getElementById(prefix+'_contrato')?.value;
 const c=available.find(c=>c.id===id)||(!id&&available.length===1?available[0]:null);
 if(available.length&&!c)throw Error('Escolhe o contrato de manutenção desta instalação.');
 return {testeContratoId:c?.id||null,testeVisitaAno:c?Number(getDataHoje().slice(0,4)):null};
}
function openContract(clientId,localId){
 if(!own('clientes',clientId)||!locations(clientId).some(l=>localKey(l.id)===localKey(localId)))return;
 if(!licensed()){alert('Ativa o módulo de Contratos de Manutenção para criar o contrato.');return;}
 abrirModalContrato(null);
 const hidden=document.getElementById('ct_cliente'),search=document.getElementById('ct_cliente_busca');if(!hidden)return;
 hidden.value=clientId;if(search){search.value=typeof _clienteLabel==='function'?_clienteLabel(own('clientes',clientId)):own('clientes',clientId).nome;search.dataset.selecionadoLabel=search.value;}
 onClienteContratoChange();document.getElementById('ct_local').value=localKey(localId);onLocalContratoChange();
}
function renderPotential(){
 const root=document.getElementById('secao-assistencias');if(!root)return;
 let panel=document.getElementById('tgAssistPotentialPane');if(!panel){panel=document.createElement('div');panel.id='tgAssistPotentialPane';root.appendChild(panel);
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-potential-action]');if(!b)return;
   if(b.dataset.potentialAction==='back'){potentialClient='';renderPotential();return;}
   const clientId=b.dataset.client,localId=b.dataset.local||'';if(!potential().some(row=>row.client.id===clientId))return;
   if(b.dataset.potentialAction==='sites'){potentialClient=clientId;renderPotential();}
   else if(b.dataset.potentialAction==='contract')openContract(clientId,localId);
   else if(b.dataset.potentialAction==='viewContract'){const c=contracts(clientId,localId)[0];if(c&&licensed())abrirModalContrato(c.id);}
   else if(b.dataset.potentialAction==='client')abrirWorkspaceCliente(clientId);
  });
 }
 const rows=potential(),current=rows.find(row=>row.client.id===potentialClient);
 if(!current)potentialClient='';
 if(current){
  const c=current.client;
  panel.innerHTML='<button type="button" class="btn btn-sm btn-outline" data-potential-action="back">Voltar aos clientes</button><h3 style="margin-top:14px">'+esc(c.nome)+'</h3><p class="help-text">Escolhe a instalação para criar ou consultar o contrato de manutenção.</p><div class="tg-assist-potential-grid">'+current.locations.map(l=>{
   const covered=contracts(c.id,l.id).length>0;
   return '<article class="tg-assist-card"><strong>'+esc(l.nome)+'</strong><p>'+esc([l.morada,l.cidade].filter(Boolean).join(' · '))+'</p><p class="help-text">'+(covered?'Com contrato ativo':'Sem contrato ativo')+'</p><button type="button" class="btn btn-sm btn-outline" data-potential-action="'+(covered?'viewContract':'contract')+'" data-client="'+esc(c.id)+'" data-local="'+esc(l.id)+'">'+(covered?'Abrir contrato':'Criar contrato de manutenção')+'</button></article>';
  }).join('')+'</div>';
 }else{
  panel.innerHTML='<h3>Potencial para contrato</h3><p class="help-text">'+rows.length+' clientes com assistências em instalações sem contrato ativo.</p><div class="tg-assist-potential-grid">'+rows.map(({client:c,locations:sites})=>'<button type="button" class="tg-assist-card tg-assist-potential-customer" data-potential-action="sites" data-client="'+esc(c.id)+'"><strong>'+esc(c.nome)+'</strong><span>'+sites.length+' instalações · Abrir instalações</span></button>').join('')+'</div>'+(rows.length?'':'<p class="help-text">Ainda não há assistências de clientes com potencial para contrato.</p>');
 }
}

document.addEventListener('tg:interface-updated',()=>{for(const prefix of ['assist','wsa'])if(document.getElementById(prefix+'_local'))syncContract(false,prefix);});
window.TGAssistContracts={locations,contracts,potential,form,syncForm,syncContract,selected,booking,openContract,renderPotential};
})();
