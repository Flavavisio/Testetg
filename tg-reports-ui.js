/* Reports hub: read-only views and local PDF/Excel downloads. */
(function(){
 'use strict';
 let selected=null;
 const E=window.TGReports, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id);
 function context(){
  const admin=typeof adminDoUtilizador==='function'?adminDoUtilizador():null;
  const sections=[...document.querySelectorAll('.card-principal[data-card]')].filter(c=>!c.classList.contains('hidden-card')&&!c.classList.contains('card-modulo-inativo')).map(c=>c.dataset.card);
  const gated={assistencias:'moduloAssistAtivo',contratos:'moduloContratosAtivo',artigos:'moduloArmazemAtivo','obras-longa':'moduloArmazemAtivo'};
  return E.scope(dados,usuarioLogado,{licensed:typeof _licencaValidaTenant==='function'&&_licencaValidaTenant(),sections:sections.filter(k=>!gated[k]||typeof window[gated[k]]==='function'&&window[gated[k]](admin))});
 }
 const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
 const select=(id,label,items)=>`<div class="form-group"><label for="${id}">${label}</label><select id="${id}">${option('__todos','Todos')}${items.map(x=>option(x[0],x[1])).join('')}</select></div>`;
 function mount(){
  const section=$('secao-relatorio-os');if(!section)return;
  if(!$('tgReportMenu')){
   section.querySelector('h2').innerHTML='<i class="fas fa-chart-bar"></i> Relatórios';
   const old=section.querySelector('.report-card');old.id='tgReportOS';old.hidden=true;
   const menu=document.createElement('div');menu.id='tgReportMenu';section.insertBefore(menu,old);
   const view=document.createElement('div');view.id='tgReportView';view.hidden=true;section.appendChild(view);
   const preview=document.createElement('div');preview.id='tgReportPreview';preview.setAttribute('aria-live','polite');section.appendChild(preview);
   const back=document.createElement('button');back.id='tgReportBack';back.className='btn btn-outline';back.hidden=true;back.textContent='← Tipos de relatório';back.onclick=window.prepararRelatoriosGestao;section.insertBefore(back,menu);
   old.insertAdjacentHTML('afterbegin','<h3>Ordens de serviço</h3>');
   old.insertAdjacentHTML('beforeend',select('ros_local','Local',[])+'<button type="button" class="btn btn-outline" onclick="tgPreverRelatorio()">Pré-visualizar</button>');
   const localField=$('ros_local').closest('.form-group');localField.style.cssText='flex:1;min-width:170px;';old.querySelector('div[style]').appendChild(localField);
   old.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{if(el.id==='ros_cliente')updateLocals('ros',context());window.tgPreverRelatorio();}));
  }
 }
 window.prepararRelatoriosGestao=function(){
  mount();if(!$('tgReportMenu'))return;selected=null;const s=context();
  $('tgReportMenu').hidden=false;$('tgReportView').hidden=true;$('tgReportOS').hidden=true;$('tgReportBack').hidden=true;$('tgReportPreview').innerHTML='';
  $('tgReportMenu').innerHTML='<p>Escolha o relatório que pretende consultar ou exportar.</p><div class="tgr-menu">'+s.allowed.map(k=>`<button type="button" class="tgr-option" data-report="${k}"><i class="fas ${E.definitions[k].icon}" aria-hidden="true"></i><span><strong>${E.definitions[k].title}</strong><small>Consultar · PDF / Excel</small></span><span aria-hidden="true">›</span></button>`).join('')+'</div>'+(s.allowed.length?'':'<p>Sem relatórios disponíveis para este acesso.</p>');
  $('tgReportMenu').querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>window.tgAbrirRelatorio(b.dataset.report));
 };
 function updateLocals(prefix,s){
  const cli=$(prefix+'_cliente').value;const field=$(prefix+'_local');const previous=field.value;
  field.innerHTML=option('__todos','Todos')+option('__sede','Sede')+s.locals.filter(l=>cli==='__todos'||l.clienteId===cli).map(l=>option(l.id,(cli==='__todos'?(s.clients.find(c=>c.id===l.clienteId)?.nome||'Cliente')+' · ':'')+(l.nome||'Instalação'))).join('');
  field.value=[...field.options].some(o=>o.value===previous)?previous:'__todos';
 }
 window.tgAbrirRelatorio=function(type){
  mount();const s=context();if(!s.allowed.includes(type)){alert('Sem acesso a este relatório.');return;}
  selected=type;$('tgReportMenu').hidden=true;$('tgReportBack').hidden=false;$('tgReportOS').hidden=type!=='os';$('tgReportView').hidden=type==='os';$('tgReportPreview').innerHTML='';
  if(type==='os'){
   prepararRelatorioOS();
   // Restrict filter labels too: foremen only see their permitted clients and team.
   $('ros_cliente').innerHTML=option('__todos','Todos')+s.clients.map(c=>option(c.id,c.nome)).join('');
   $('ros_func').innerHTML=option('__todos','Todos')+s.people.map(p=>option(p.id,p.nome)).join('');
   $('ros_local').value='__todos';updateLocals('ros',s);
  }else{
   const states={assistencias:[['aberta','Aberta'],['em tratamento','Em tratamento'],['concluida','Concluída'],['cancelada','Cancelada']],obras:[['preparacao','Preparação'],['ativa','Ativa'],['suspensa','Suspensa'],['concluida','Concluída']],manutencoes:[['prevista','Prevista'],['em atraso','Em atraso'],['sem agenda','Sem agenda'],['realizada','Realizada']],stock:[['baixo','Abaixo do mínimo'],['normal','Normal']]};
   if(type==='assistencias')states.assistencias=[...new Set(s.assistance.map(a=>a.estado||'aberta'))].sort().map(x=>[x,x]);
   let fields='';
   if(type!=='stock')fields+=select('tgr_cliente','Cliente',s.clients.map(c=>[c.id,c.nome]))+select('tgr_local','Local',[]);
   if(['assistencias','tecnicos','obras'].includes(type))fields+=select('tgr_func','Técnico / responsável',s.people.map(p=>[p.id,p.nome]));
   if(states[type])fields+=select('tgr_estado','Estado',states[type]);
   if(type==='assistencias')fields+=select('tgr_urgencia','Urgência',[['baixa','Baixa'],['normal','Normal'],['alta','Alta'],['urgente','Urgente']])+select('tgr_origem','Origem',[['portal','Portal do cliente'],['interna','Interna']]);
   if(type==='stock')fields+=select('tgr_artigo','Artigo',s.articles.map(a=>[a.id,a.nome]))+select('tgr_movimento','Movimento',[['entrada','Entrada'],['saida','Saída'],['devolucao','Devolução'],['ajuste','Ajuste']]);
   fields+='<div class="form-group"><label for="tgr_inicio">Data início</label><input type="date" id="tgr_inicio"></div><div class="form-group"><label for="tgr_fim">Data fim</label><input type="date" id="tgr_fim"></div>';
   $('tgReportView').innerHTML=`<div class="report-card"><h3>${E.definitions[type].title}</h3><div class="tgr-filters">${fields}</div><p class="tgr-note">${E.definitions[type].note} Deixe as datas em branco para incluir todas.</p><div class="tgr-actions"><button type="button" class="btn btn-outline" onclick="tgPreverRelatorio()">Pré-visualizar</button><button type="button" class="btn btn-danger" onclick="tgExportarRelatorio('pdf')"><i class="fas fa-file-pdf"></i> Gerar PDF</button><button type="button" class="btn btn-success" onclick="tgExportarRelatorio('excel')"><i class="fas fa-file-excel"></i> Gerar Excel</button></div></div>`;
   if(type!=='stock')updateLocals('tgr',s);
   $('tgReportView').querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{if(el.id==='tgr_cliente')updateLocals('tgr',context());window.tgPreverRelatorio();}));
  }
  window.tgPreverRelatorio();
 };
 function result(type=selected){
  if(!type)throw Error('Escolha um tipo de relatório.');const s=context(),p=type==='os'?'ros':'tgr';
  const val=k=>$(p+'_'+k)?.value||'';
  const f={client:val('cliente'),local:val('local'),person:val('func'),state:val('estado'),start:val('inicio'),end:val('fim'),urgency:val('urgencia'),origin:val('origem'),article:val('artigo'),movement:val('movimento')};
  const nextMaintenance={};s.contracts.forEach(c=>nextMaintenance[c.id]=calcularProximaManutencao(c));
  const r=E.build(s,type,f,{nextMaintenance,today:typeof getDataHoje==='function'?getDataHoje():E.date(new Date())});
  const labels={client:'Cliente',local:'Local',person:'Responsável',state:'Estado',urgency:'Urgência',origin:'Origem',article:'Artigo',movement:'Movimento'};
  r.selection=Object.keys(labels).filter(k=>f[k]&&f[k]!=='__todos').map(k=>{const ids={client:'cliente',local:'local',person:'func',state:'estado',urgency:'urgencia',origin:'origem',article:'artigo',movement:'movimento'};return labels[k]+': '+$(p+'_'+ids[k])?.selectedOptions[0]?.textContent;}).join(' · ');
  return {r,s};
 }
 window.tgPreverRelatorio=function(){
  try{const {r}=result();$('tgReportPreview').innerHTML=`<div class="tgr-summary">${r.summary.map(x=>`<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div><p class="tgr-note">${esc(r.note)}</p>`+r.tables.map(t=>`<div class="report-card"><h3>${esc(t.title)}</h3><p>${t.rows.length} registo(s)</p>${t.rows.length?`<div class="tgr-table"><table><thead><tr>${t.headers.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${t.rows.slice(0,100).map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>${t.rows.length>100?'<p>Pré-visualização dos primeiros 100 registos. A exportação inclui todos.</p>':''}`:'<p class="text-muted">Sem registos para os filtros escolhidos.</p>'}</div>`).join('');}
  catch(e){$('tgReportPreview').innerHTML='<p role="alert">'+esc(e.message)+'</p>';}
 };
 // Rebuild on every export, including after a permission/license change.
 window.tgExportarRelatorio=function(format,type=selected){
  try{
   const {r,s}=result(type);if(!r.tables.some(t=>t.rows.length)){alert('Sem registos para os filtros escolhidos.');return;}
   const filename='relatorio_'+type+'_'+E.date(new Date());
   const details='Período: '+r.period+(r.selection?' · '+r.selection:'');
   if(format==='excel'){
    if(!window.XLSX)throw Error('Biblioteca de Excel ainda não carregada. Tente novamente dentro de instantes.');
    const wb=XLSX.utils.book_new();
    r.tables.forEach((t,i)=>{const data=[[r.title],[details],[r.note],[],t.headers,...t.rows];const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=t.headers.map(()=>({wch:24}));XLSX.utils.book_append_sheet(wb,ws,('Dados '+(i+1)));});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Resumo'],...r.summary.map(x=>[x.label,x.value])]),'Resumo');XLSX.writeFile(wb,filename+'.xlsx');
   }else if(format==='pdf'){
    if(!window.jspdf?.jsPDF)throw Error('Biblioteca de PDF ainda não carregada. Tente novamente dentro de instantes.');
    const doc=new window.jspdf.jsPDF({orientation:'landscape'});if(typeof doc.autoTable!=='function')throw Error('Componente de tabelas do PDF ainda não carregado.');
    const {y,cor}=_pdfCabecalho(doc,'Relatório — '+r.title,details,s.tenant);
    let pos=_pdfCartoesResumo(doc,y,r.summary.map(x=>({valor:x.value,label:x.label})),cor);
    doc.setFontSize(8);const notes=doc.splitTextToSize(r.note,270);doc.text(notes,14,pos+5);pos+=notes.length*4+10;
    r.tables.forEach((t,i)=>{if(i){doc.addPage();pos=18;}doc.setFontSize(11);doc.text(t.title,14,pos);doc.autoTable({head:[t.headers],body:t.rows,startY:pos+5,styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:cor},margin:{bottom:18}});});
    _pdfRodape(doc,cor);_tgGuardarPdf(doc,filename+'.pdf');
   }
  }catch(e){alert(e.message);}
 };
})();
