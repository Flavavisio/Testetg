/* Teste TG: installation selection, contract opportunities and one visit per request. */
(function(){
'use strict';
const esc=v=>escapeHtmlSimples(String(v??''));
const own=(key,id)=>(dados[key]||[]).find(x=>x.id===id&&x.adminId===_tenantId()&&!x.apagadoSuperAdmin);
const licensed=()=>typeof moduloContratosAtivo==='function'&&moduloContratosAtivo(adminAtual());
const localKey=id=>id||'';
function locations(clienteId){
 const c=own('clientes',clienteId);if(!c)return [];
 return [{id:'',nome:'Sede',cidade:c.cidade||'',morada:c.morada||c.endereco||''},...(dados.locais||[]).filter(l=>l.adminId===_tenantId()&&l.clienteId===c.id&&!l.apagadoSuperAdmin).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'))];
}
function contracts(clienteId,localId,today=getDataHoje()){
 return (dados.contratos||[]).filter(c=>c.adminId===_tenantId()&&c.clienteId===clienteId&&!c.apagadoSuperAdmin&&(!c.dataInicio||c.dataInicio<=today)&&(!c.validadeContrato||c.validadeContrato>=today)&&
  (Array.isArray(c.locaisIds)&&c.locaisIds.length?c.locaisIds:[c.localId||'']).includes(localKey(localId))).sort((a,b)=>(a.numero||a.id).localeCompare(b.numero||b.id,'pt',{numeric:true}));
}
function potential(){
 return (dados.clientes||[]).filter(c=>c.adminId===_tenantId()&&!c.apagadoSuperAdmin).flatMap(c=>locations(c.id).filter(l=>!contracts(c.id,l.id).length).map(l=>({client:c,local:l})))
 .sort((a,b)=>(a.client.nome||'').localeCompare(b.client.nome||'','pt',{sensitivity:'base',numeric:true})||(a.local.nome||'').localeCompare(b.local.nome||'','pt'));
}
function selected(){
 const clientId=document.getElementById('assist_cliente')?.value||'',select=document.getElementById('assist_local');
 const value=select?.value;return {clientId,localId:value==='__sede__'?null:value||null,chosen:!!value};
}
function syncForm(prompt=false){
 const select=document.getElementById('assist_local');if(!select)return;
 const clientId=document.getElementById('assist_cliente')?.value||'',changed=select.dataset.client!==clientId;
 const before=changed?'':select.value;select.dataset.client=clientId;
 const opts=locations(clientId);select.replaceChildren(new Option('— Escolher instalação —',''));
 opts.forEach(l=>select.add(new Option(l.nome+(l.cidade?' — '+l.cidade:''),l.id||'__sede__')));
 select.value=opts.some(l=>(l.id||'__sede__')===before)?before:opts.length===1?'__sede__':'';
 if(select.dataset.initial!==undefined){const initial=select.dataset.initial;delete select.dataset.initial;if(opts.some(l=>(l.id||'__sede__')===initial))select.value=initial;}
 select.disabled=!clientId||select.dataset.locked==='1';
 syncContract(prompt);
}
function syncContract(prompt=false){
 const box=document.getElementById('assistContractSummary');if(!box)return;
 const {clientId,localId,chosen}=selected();if(!clientId||!chosen){box.textContent='Escolhe o cliente e a instalação para verificar o contrato.';return;}
 const matches=contracts(clientId,localId),previous=document.getElementById('assist_contrato')?.value;
 const saved=box.dataset.contract;
 if(matches.length){
  box.innerHTML='<label for="assist_contrato">Contrato de manutenção</label><select id="assist_contrato">'+matches.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.numero||c.id)+'</option>').join('')+'</select><p class="help-text">Ao guardar a assistência, fica descontada uma visita do saldo anual. Criar a OS não desconta outra visita.</p>';
  const select=document.getElementById('assist_contrato');if(matches.some(c=>c.id===(previous||saved)))select.value=previous||saved;
 }else{
  box.innerHTML='<strong>Potencial para contrato</strong><p class="help-text">Esta instalação não tem contrato de manutenção ativo.</p><button type="button" class="btn btn-sm btn-outline" id="assistCreateContract">Criar contrato de manutenção</button>';
  document.getElementById('assistCreateContract').onclick=()=>openContract(clientId,localId);
  const key=JSON.stringify([clientId,localId]);
  if(prompt&&box.dataset.warned!==key){box.dataset.warned=key;if(confirm('Esta instalação não tem contrato de manutenção ativo. Queres criar um contrato de manutenção agora?'))openContract(clientId,localId);}
 }
}
function form(item){
 const select=document.getElementById('assist_local'),box=document.getElementById('assistContractSummary');if(!select)return;
 select.dataset.initial=item?(item.localId||'__sede__'):'';select.dataset.locked=item?.osGeradaId?'1':'0';if(box)box.dataset.contract=item?.testeContratoId||'';
 if(item?.osGeradaId){document.getElementById('assist_cliente_busca').disabled=true;}
 select.onchange=()=>syncContract(true);syncForm(false);
}
function booking(existing,clientId,localId){
 if(!own('clientes',clientId)||!locations(clientId).some(l=>localKey(l.id)===localKey(localId)))throw Error('Escolhe uma instalação válida deste cliente.');
 if(existing?.osGeradaId&&(existing.clienteId!==clientId||localKey(existing.localId)!==localKey(localId)))throw Error('O cliente e a instalação já estão associados à OS e não podem ser alterados.');
 const same=existing?.clienteId===clientId&&localKey(existing?.localId)===localKey(localId);
 if(same&&existing?.testeContratoId)return {testeContratoId:existing.testeContratoId,testeVisitaAno:existing.testeVisitaAno};
 const available=contracts(clientId,localId),id=document.getElementById('assist_contrato')?.value;
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
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-potential-action]');if(!b)return;const clientId=b.dataset.client,localId=b.dataset.local||'';if(!own('clientes',clientId))return;
   if(b.dataset.potentialAction==='contract')openContract(clientId,localId);
   else if(b.dataset.potentialAction==='client')abrirWorkspaceCliente(clientId);
   else if(locations(clientId).some(l=>l.id===localId)&&localId)abrirModalLocalCliente(clientId,localId);
  });
 }
 const rows=potential();panel.innerHTML='<h3>Potencial para contrato</h3><p class="help-text">'+rows.length+' instalações sem contrato ativo. Inclui sedes, instalações sem contrato e contratos expirados.</p><div class="tg-assist-potential-grid">'+rows.map(({client:c,local:l})=>'<article class="tg-assist-card"><strong>'+esc(c.nome)+'</strong><p>'+esc(l.nome)+(l.cidade?' · '+esc(l.cidade):'')+'</p><p class="help-text">'+esc(l.morada||'')+'</p><div class="tg-assist-card-actions">'+[['client','Abrir cliente'],...(l.id?[['local','Abrir instalação']]:[]),['contract','Criar contrato']].map(([action,label])=>'<button type="button" class="btn btn-sm btn-outline" data-potential-action="'+action+'" data-client="'+esc(c.id)+'" data-local="'+esc(l.id)+'">'+label+'</button>').join('')+'</div></article>').join('')+'</div>'+(rows.length?'':'<p class="help-text">Todos os clientes e instalações têm contrato ativo.</p>');
}
document.addEventListener('tg:interface-updated',()=>{if(document.getElementById('assist_local'))syncContract(false);});
window.TGAssistContracts={locations,contracts,potential,form,syncForm,syncContract,selected,booking,openContract,renderPotential};
})();
