/* Total Gest — painel não invasivo para planeamento no menu de Ordens de Serviço.
 * Não altera serviços nem submete dados. Recomendação exige confirmação no formulário original.
 */
(function(){
'use strict';
function enc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function current(){try{return typeof usuarioLogado!=='undefined'?usuarioLogado:null;}catch(_){return null;}}
function state(){try{return typeof dados!=='undefined'?dados:null;}catch(_){return null;}}
function tenant(u){return u?.role==='admin'?u.id:u?.adminId;}
function open(){
 const u=current(),d=state(),tid=tenant(u);
 if(!u||!tid||!d||!window.TGPlanner){alert('É necessário iniciar sessão e carregar os dados antes de planear.');return;}
 document.getElementById('tg-os-planner-dialog')?.remove();
 const el=document.createElement('dialog');el.id='tg-os-planner-dialog';
 el.style.cssText='border:1px solid #dde4ed;border-radius:16px;padding:22px;max-width:490px;width:calc(100% - 30px);color:#172642;box-shadow:0 20px 70px #0004;';
 el.innerHTML='<form method="dialog"><button style="float:right;border:0;background:transparent;cursor:pointer;font-size:23px" aria-label="Fechar">×</button><h3 style="margin:0 0 10px">Planeamento de técnicos — OS</h3>'+
 '<p style="font-size:13px;color:#64748b">Consulta indicativa. Não altera nem cria a OS. Seleciona o técnico no formulário depois de confirmar a sua disponibilidade.</p>'+
 '<label>Data <input id="tg-op-date" type="date" required style="display:block;width:100%;margin:5px 0 12px"></label>'+
 '<label>Hora <input id="tg-op-time" type="time" value="09:00" required style="display:block;width:100%;margin:5px 0 12px"></label>'+
 '<label>Duração prevista (minutos) <input id="tg-op-duration" type="number" min="15" max="720" value="90" required style="display:block;width:100%;margin:5px 0 12px"></label>'+
 '<button id="tg-op-eval" type="button" style="background:#183b70;color:white;border:0;border-radius:9px;padding:11px 15px;cursor:pointer">Ver recomendações</button>'+
 '<div id="tg-op-results" aria-live="polite" style="margin-top:15px"></div></form>';
 document.body.appendChild(el);
 el.querySelector('#tg-op-date').value=new Date().toLocaleDateString('en-CA');
 el.querySelector('#tg-op-eval').onclick=()=>{
  const date=el.querySelector('#tg-op-date').value,time=el.querySelector('#tg-op-time').value,mins=Number(el.querySelector('#tg-op-duration').value);
  if(!date||!time||mins<15||mins>720||!Number.isFinite(mins)){el.querySelector('#tg-op-results').textContent='Indica data, hora e duração válidas.';return;}
  const start=new Date(date+'T'+time+':00');
  if(!Number.isFinite(start.getTime()))return;
  const end=new Date(start.getTime()+mins*60000);
  const technicians=(d.funcionarios||[]).filter(f=>String(f.adminId)===String(tid)&&!f.suspenso&&f.ativo!==false).map(f=>({id:f.id,name:f.nome,tenantId:tid,skills:Array.isArray(f.competencias)?f.competencias:[]}));
  const appointments=(d.servicos||[]).filter(s=>String(s.adminId)===String(tid)&&s.data&&s.hora).flatMap(s=>{
    const begin=new Date(s.data+'T'+s.hora+':00');if(!Number.isFinite(begin.getTime()))return [];
    const duration=Number(s.duracaoMinutos||s.duracaoPrevista||90);const length=duration>0&&duration<=1440?duration:90;
    const ids=(Array.isArray(s.funcionariosIds)&&s.funcionariosIds.length?s.funcionariosIds:[s.funcionarioId]).filter(Boolean);
    return ids.map(technicianId=>({id:s.id,tenantId:tid,technicianId,start:begin.toISOString(),end:new Date(begin.getTime()+length*60000).toISOString(),status:s.status}));
  });
  const ranked=window.TGPlanner.recommend({tenantId:tid,technicians,appointments,job:{start:start.toISOString(),end:end.toISOString()},limit:50});
  const out=el.querySelector('#tg-op-results');
  out.replaceChildren();
  const note=document.createElement('p');note.style.cssText='font-size:12px;color:#92400e';note.textContent='Atenção: férias, faltas, deslocações e serviços sem hora registada não estão integralmente validados. É obrigatória a confirmação manual.';out.appendChild(note);
  if(!ranked.length){out.append('Sem técnicos elegíveis registados.');return;}
  for(const x of ranked){
    const p=document.createElement('p');p.style.cssText='padding:9px;border:1px solid #e2e8f0;border-radius:9px;font-size:14px;margin:6px 0';
    p.textContent=(x.eligible?'✓ ':'⚠ ')+x.name+(x.reasons.length?' — '+x.reasons.join('; '):' — sem sobreposição conhecida');out.appendChild(p);
  }
 };
 el.showModal();
}
window.TGOSPlannerUI=Object.freeze({open});
})();