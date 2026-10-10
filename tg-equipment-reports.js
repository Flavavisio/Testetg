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
 function equipmentField(e){return `<label style="font-size:.8rem">Relatório de especialidade<select data-equipment-report="${esc(e.id)}" aria-label="Relatório de ${esc(e.fichaTecnica?.nome || e.marca || e.id)}">${options(e.fichaTecnica?.relatorioEspecialidade)}</select></label>`;}
 document.addEventListener('change',e=>{const el=e.target.closest('[data-equipment-report]');if(!el)return;const eq=(dados.equipamentos||[]).find(x=>x.id===el.dataset.equipmentReport&&x.adminId===(usuarioLogado?.adminId||usuarioLogado?.id));if(!eq||!['admin','subadmin'].includes(usuarioLogado?.role))return;try{eq.fichaTecnica={...eq.fichaTecnica,relatorioEspecialidade:validate(el.value)};}catch(err){alert(err.message);}});
 window.TGEquipmentReports={types,options,validate,snapshot,requirements,matches,pending,resolve,equipmentField};
})();
