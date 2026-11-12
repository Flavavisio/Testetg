/* TesteTG only — read-only dashboard/live-team indicators derived from clock records. */
(function () {
'use strict';
if (window.TGTestLiveStatus) return;
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const current = () => {
    const user = typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
    if (!user || !['admin', 'subadmin'].includes(user.role) || typeof dados === 'undefined') return null;
    const tenant = user.role === 'admin' ? user.id : user.adminId;
    if (!tenant) return null;
    const date = typeof getDataHoje === 'function' ? getDataHoje() : new Date().toLocaleDateString('sv-SE');
    return { tenant, date, data: dados };
};
const latest = records => records.sort((a,b) =>
    String(b.data||'').localeCompare(String(a.data||'')) ||
    String(b.entrada||'').localeCompare(String(a.entrada||'')) ||
    String(b.dataCriacao||b.id||'').localeCompare(String(a.dataCriacao||a.id||'')))[0] || null;
function osState(os, context) {
    const {data,date,tenant} = context;
    if (os.adminId !== tenant) return null;
    const status=norm(os.status);
    if (/concluid|terminad|fechad/.test(status)) return {label:'Concluída',color:'#16a34a'};
    if (/cancelad/.test(status)) return {label:'Cancelada',color:'#64748b'};
    const sessions=(data.ponto||[]).filter(p=>p.adminId===tenant&&p.servicoId===os.id&&p.data===date&&p.entrada);
    if (sessions.some(p=>!p.saida)) return {label:'Em curso',color:'#0ea5e9'};
    const last=latest(sessions);
    if (last && (last.motivoSaida==='pausa'||last.pausaAlmoco)) return {label:'Em pausa',color:'#f59e0b'};
    if (last?.saida) return {label:'Terminado por hoje',color:'#64748b'};
    if (/pausa|stand by|suspens/.test(status)) return {label:'Em pausa',color:'#f59e0b'};
    if (/andamento/.test(status)) return {label:'Em curso',color:'#0ea5e9'};
    return {label:'Pendente',color:'#94a3b8'};
}
function personState(personId,context){
    const {data,date,tenant}=context;
    const general=latest((data.ponto||[]).filter(p=>p.adminId===tenant&&p.funcionarioId===personId&&!p.servicoId&&!p.obraId&&p.data===date&&p.entrada));
    const openOs=latest((data.ponto||[]).filter(p=>p.adminId===tenant&&p.funcionarioId===personId&&p.servicoId&&p.data===date&&p.entrada&&!p.saida));
    if(openOs){
        const os=(data.servicos||[]).find(s=>s.adminId===tenant&&s.id===openOs.servicoId);
        const name=os?.numeroRegisto ? 'OS #'+os.numeroRegisto : os?.descricao ? 'OS '+os.descricao : 'OS';
        return {label:'Em serviço na '+name,color:'#16a34a'};
    }
    const openWork=latest((data.obraPontoLonga||[]).filter(p=>p.adminId===tenant&&p.funcionarioId===personId&&p.data===date&&p.entrada&&!p.saida));
    if(openWork){
        const work=(data.obras||[]).find(o=>o.adminId===tenant&&o.id===openWork.obraId);
        return {label:'Em serviço na obra '+(work?.nome||''),color:'#16a34a'};
    }
    if(general?.pausaAlmoco&&general.saida) return {label:'Em almoço',color:'#f59e0b'};
    const lastIntervention=latest([
        ...(data.ponto||[]).filter(p=>p.adminId===tenant&&p.funcionarioId===personId&&p.servicoId&&p.data===date&&p.entrada),
        ...(data.obraPontoLonga||[]).filter(p=>p.adminId===tenant&&p.funcionarioId===personId&&p.data===date&&p.entrada)
    ]);
    if(general&&!general.saida){
        if(lastIntervention?.motivoSaida==='pausa')return {label:'Intervenção em pausa',color:'#f59e0b'};
        return {label:'Em serviço (sem OS ativa)',color:'#16a34a'};
    }
    if(general?.saida || lastIntervention?.saida) return {label:'Saiu do serviço',color:'#64748b'};
    return null; // Keep native absence/holiday status when no clock exists.
}
function update(){
    const context=current(),root=document.getElementById('secao-dashboard-central');
    if(!context||!root||root.hidden)return;
    const feed=root.querySelector('.hdc-feed');
    if(feed){
        feed.querySelectorAll('.fi[onclick]').forEach(row=>{
            const match=(row.getAttribute('onclick')||'').match(/^abrirVerOS\('([^']+)'\)$/);
            if(!match)return;
            const os=(context.data.servicos||[]).find(s=>s.id===match[1]&&s.adminId===context.tenant);
            if(!os)return;
            const state=osState(os,context);
            const badge=row.querySelector('.ago'),dot=row.querySelector('.dot');
            if(badge){badge.textContent=state.label;badge.style.color=state.color;}
            if(dot)dot.style.background=state.color;
        });
    }
    root.querySelectorAll('.hdc-tec[onclick]').forEach(row=>{
        const match=(row.getAttribute('onclick')||'').match(/^_hdcClicarPessoaNoMapa\('([^']+)'\)$/);
        if(!match)return;
        const id=match[1];
        const person=[...(context.data.funcionarios||[]),...(context.data.encarregados||[])].find(p=>p.id===id&&p.adminId===context.tenant);
        if(!person)return;
        const state=personState(id,context);
        if(!state)return;
        const label=row.querySelector('.st'),dot=row.querySelector('.dot');
        if(label){label.textContent=state.label;label.style.color=state.color;}
        if(dot)dot.style.background=state.color;
    });
}
function safeUpdate(){try{update();}catch(err){console.warn('TesteTG: estados do dashboard',err);}}
document.addEventListener('tg:interface-updated',safeUpdate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)safeUpdate();});
window.addEventListener('focus',safeUpdate);
setInterval(safeUpdate,3000);
window.TGTestLiveStatus={osState,personState,update:safeUpdate};
safeUpdate();
}());