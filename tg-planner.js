/* Total Gest — recommendations only. Never assigns a technician without confirmation.
   Pure, dependency-free module; safe to use with Supabase records after tenant scoping. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TGPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ms=60000;
const date=v=>{const n=new Date(v);return Number.isFinite(n.getTime())?n:null;};
const id=v=>String(v??'');
const overlap=(a,b,c,d)=>a<d&&c<b;
function recommend({technicians=[],appointments=[],absences=[],job={},tenantId,now=new Date(),limit=8}={}){
 if(!tenantId)throw Error('tenantId obrigatório');
 const begin=date(job.start),end=date(job.end),current=date(now);
 if(!begin||!end||begin>=end||!current)throw Error('Intervalo inválido');
 const scoped=x=>id(x.tenantId??x.adminId??x.admin_id)===id(tenantId);
 const required=(job.skills||[]).map(x=>String(x).toLowerCase().trim()).filter(Boolean);
 return technicians.filter(t=>scoped(t)&&t.active!==false&&t.ativo!==false).map(t=>{
  const tid=id(t.id);
  const skills=(t.skills||t.competencias||[]).map(x=>String(x).toLowerCase().trim());
  const missing=required.filter(x=>!skills.includes(x));
  const conflicts=appointments.filter(a=>scoped(a)&&id(a.technicianId??a.tecnicoId??a.tecnico_id)===tid&&(!job.id||id(a.id)!==id(job.id))&&!['cancelado','cancelled'].includes(String(a.status||'').toLowerCase())&&date(a.start)&&date(a.end)&&overlap(begin,end,date(a.start),date(a.end)));
  const away=absences.filter(a=>scoped(a)&&id(a.technicianId??a.employeeId??a.colaboradorId)===tid&&date(a.start)&&date(a.end)&&overlap(begin,end,date(a.start),date(a.end)));
  const reasons=[...(missing.length?['Competências em falta: '+missing.join(', ')]:[]),...(conflicts.length?['Serviços sobrepostos: '+conflicts.length]:[]),...(away.length?['Ausência/férias no período']:[])];
  const free=reasons.length===0;
  const workload=appointments.filter(a=>scoped(a)&&id(a.technicianId??a.tecnicoId??a.tecnico_id)===tid&&date(a.start)&&date(a.end)&&overlap(begin,end,date(a.start),date(a.end))).length;
  return {id:tid,name:String(t.name??t.nome??tid),eligible:free,reasons,score:free?100-workload*5:0};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score||a.name.localeCompare(b.name,'pt')).slice(0,Math.max(0,Math.min(50,limit)));
}
return Object.freeze({recommend});
});
