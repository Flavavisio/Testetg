/* Equipment-specific specialty reports. Historic OS keep their original requirements. */
(function(){
 'use strict';
 const types={REX:'Extintores',RBI:'Bocas de incêndio',RSI:'Sistemas de incêndio',RCM:'Central de incêndio',RIE:'Iluminação de emergência',RCP:'Portas corta-fogo',RCCTV:'CCTV',RIN:'Intrusão',RDI:'Declaração de instalação'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const options=value=>`<option value="__choose__" ${value==null?'selected':''} disabled>Escolher relatório ou Sem relatório</option><option value="" ${value===''?'selected':''}>Sem relatório</option>`+Object.entries(types).map(([id,label])=>`<option value="${id}" ${value===id?'selected':''}>${id} — ${esc(label)}</option>`).join('');
 function validate(value){if(value!==''&&!Object.hasOwn(types,value))throw Error('Indica o relatório de especialidade do equipamento ou escolhe Sem relatório.');return value;}
 function snapshot(os,equipments){
  for(const e of equipments){try{validate(e.fichaTecnica?.relatorioEspecialidade);}catch(_){throw Error('Define o relatório do equipamento '+(e.fichaTecnica?.nome || e.marca || e.id)+' ou escolhe Sem relatório.');}}
  const relatoriosEquipamentos=equipments.flatMap(e=>{const tipo=e.fichaTecnica?.relatorioEspecialidade;if(!Object.hasOwn(types,tipo))return [];return [{tipo,equipamentoId:e.id,equipamentoNome:e.fichaTecnica?.nome || [e.marca,e.numeroSerie].filter(Boolean).join(' · ') || e.tipo}];});
  os.planoManutencao={...os.planoManutencao,relatoriosEquipamentos};
  os.tiposTrabalho=[...new Set([...(os.tiposTrabalho||[]).filter(t=>!Object.hasOwn(types,t)),...relatoriosEquipamentos.map(r=>r.tipo)])];
 }
 function requirements(os){
  if(Array.isArray(os?.planoManutencao?.relatoriosEquipamentos))return os.planoManutencao.relatoriosEquipamentos.filter(r=>r&&Object.hasOwn(types,r.tipo)&&r.equipamentoId);
  return (os?.tiposTrabalho||[]).filter(t=>Object.hasOwn(types,t)).map(tipo=>({tipo,equipamentoId:null,equipamentoNome:''}));
 }
 function matches(r,os,req){return r.adminId===os.adminId&&r.servicoId===os.id&&r.tipo===req.tipo&&(r.campos?.equipamentoId||null)===(req.equipamentoId||null);}
 function pending(os){return requirements(os).filter(req=>!(dados.relatoriosEspecialidade||[]).some(r=>matches(r,os,req)&&!r.rascunho));}
 function resolve(os,tipo,id){return id?requirements(os).find(r=>r.tipo===tipo&&r.equipamentoId===id):pending(os).find(r=>r.tipo===tipo)||requirements(os).find(r=>r.tipo===tipo);}
 const periods={semanal:'Semanal',quinzenal:'Quinzenal',mensal:'Mensal',trimestral:'Trimestral',semestral:'Semestral',anual:'Anual'};
 function maintenanceValidate(periodicidade,proximaData){
  if(!Object.hasOwn(periods,periodicidade))throw Error('Indica a periodicidade de manutenção do equipamento.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(proximaData || '') || !Number.isFinite(Date.parse(proximaData+'T12:00:00Z')) || new Date(proximaData+'T12:00:00Z').toISOString().slice(0,10)!==proximaData)throw Error('Indica uma data de próxima manutenção válida para o equipamento.');
  return {periodicidade,proximaData};
 }
 function maintenanceValue(e){
  const value={...e?.fichaTecnica?.manutencao};
  if(e && window.TGContractMaintenance){const rows=(dados.contratos || []).filter(c=>c.adminId===e.adminId && c.clienteId===e.clienteId).flatMap(c=>window.TGContractMaintenance.schedule(c)).filter(r=>r.plan.equipamentoId===e.id || (!r.plan.equipamentoId && r.plan.tipo===e.tipo && r.localId===(e.localId || ''))).sort((a,b)=>String(a.data).localeCompare(String(b.data)));if(rows.length){value.periodicidade ||= rows[0].plan.periodicidade;value.proximaData=rows[0].data || value.proximaData;}}
  return value;
 }
 function maintenanceFields(e,prefix=''){
  const value=maintenanceValue(e),periodName=prefix?prefix+'_periodicidade':'manutencaoPeriodicidade',dateName=prefix?prefix+'_proxima':'manutencaoProxima';
  return `<label>Periodicidade de manutenção *<select name="${periodName}" id="${periodName}"><option value="" ${!value.periodicidade?'selected':''} disabled>Escolher periodicidade</option>${Object.entries(periods).map(([id,label])=>`<option value="${id}" ${value.periodicidade===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Próxima manutenção *<input type="date" name="${dateName}" id="${dateName}" value="${esc(value.proximaData || '')}"></label>`;
 }
 function equipmentField(e){return `<label style="font-size:.8rem">Relatório de especialidade<select data-equipment-report="${esc(e.id)}" aria-label="Relatório de ${esc(e.fichaTecnica?.nome || e.marca || e.id)}">${options(e.fichaTecnica?.relatorioEspecialidade)}</select></label>`;}
 document.addEventListener('change',e=>{const el=e.target.closest('[data-equipment-report]');if(!el)return;const eq=(dados.equipamentos||[]).find(x=>x.id===el.dataset.equipmentReport&&x.adminId===(usuarioLogado?.adminId||usuarioLogado?.id));if(!eq||!['admin','subadmin'].includes(usuarioLogado?.role))return;try{eq.fichaTecnica={...eq.fichaTecnica,relatorioEspecialidade:validate(el.value)};}catch(err){alert(err.message);}});
 window.TGEquipmentReports={types,options,validate,periods,maintenanceValidate,maintenanceValue,maintenanceFields,snapshot,requirements,matches,pending,resolve,equipmentField};
})();
