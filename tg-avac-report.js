/* AVAC adaptive service report – TesteTG only. No regulatory inspection or Legionella form. */
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const fields=(items)=>items.map(([id,label,type='text'])=>'<label style="display:block;margin:10px 0">'+esc(label)+(type==='textarea'?'<textarea id="avac_'+id+'" rows="3" style="width:100%;box-sizing:border-box"></textarea>':'<input id="avac_'+id+'" type="'+type+'" style="width:100%;box-sizing:border-box">')+'</label>').join('');
const general=[['cliente','Cliente'],['instalacao','Instalação / morada'],['tecnico','Técnico responsável'],['data','Data da intervenção','date'],['marca','Marca'],['modelo','Modelo'],['serie','N.º de série'],['observacoes','Observações','textarea']];
const checks=[['filtros','Estado e limpeza dos filtros'],['bateria','Baterias e permutadores'],['drenagem','Condensados e drenagem'],['ventiladores','Ventiladores e ruídos'],['ligacoes','Ligações elétricas e segurança']];
const measurements=[['temp_entrada','Temperatura de entrada (°C)','number'],['temp_saida','Temperatura de saída (°C)','number'],['corrente','Corrente elétrica (A)','number'],['pressao','Pressão (bar)','number']];
const refrigerant=[['tipo_gas','Refrigerante / designação'],['gwp','GWP (valor declarado)','number'],['carga','Carga total do equipamento (kg)','number'],['adicionado','Quantidade adicionada (kg)','number'],['recuperado','Quantidade recuperada (kg)','number'],['fugas','Verificação de fugas, método e resultado','textarea'],['certificacao','Identificação da certificação do técnico/empresa'],['destino','Destino do refrigerante recuperado','textarea']];
const plan=[['plano_ref','Referência e versão do plano'],['tarefas_previstas','Tarefas previstas','textarea'],['tarefas_realizadas','Tarefas realizadas','textarea'],['desvios','Desvios ou tarefas pendentes','textarea']];
function admin(){try{return typeof adminDoUtilizador==='function'?adminDoUtilizador():null}catch(e){return null}}
function isAVAC(){const a=admin();if(!a)return false;const names=['areasAtividade','areaAtividade','atividades','atividade','setor','setorAtividade','ramoAtividade','especialidades'];return names.some(k=>{const v=a[k];return (Array.isArray(v)?v.join(' '):typeof v==='string'?v:'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('avac')})}

/* Drafts are scoped to this browser, tenant and login. Never claim cloud persistence. */
const tenant=()=>String(typeof usuarioLogado!=='undefined'?(usuarioLogado?.adminId||usuarioLogado?.id||''):'');
const login=()=>String(typeof usuarioLogado!=='undefined'?(usuarioLogado?.id||''):'');
const draftKey=()=>['tg-avac-drafts-v1',tenant(),login()].join(':');
const allFields=[...general,...checks,...measurements,...refrigerant,...plan,['resultado'],['recomendacoes']];
const readForm=()=>({id:$('avac_draft_id')?.value||'',osId:$('avac_os')?.value||'',equipamento:$('avac_equip')?.value||'',mode:$('avac_mode')?.value||'normal',values:Object.fromEntries(allFields.map(([id])=>[id,$('avac_'+id)?.value||''])),updatedAt:new Date().toISOString()});
function listDrafts(){try{const d=JSON.parse(localStorage.getItem(draftKey())||'[]');return Array.isArray(d)?d.slice(0,50):[]}catch(_){return []}}
function saveDraft(){
 const d=readForm();d.id ||= (globalThis.crypto?.randomUUID?.()||String(Date.now()));
 const rows=listDrafts().filter(x=>x.id!==d.id);rows.unshift(d);
 try{localStorage.setItem(draftKey(),JSON.stringify(rows));$('avac_draft_id').value=d.id;renderDrafts();$('avac_status').textContent='Rascunho guardado neste navegador. Não está sincronizado com o servidor.'}
 catch(e){$('avac_status').textContent='Não foi possível guardar o rascunho neste dispositivo.'}
}
function renderDrafts(){
 const picker=$('avac_saved');if(!picker)return;
 picker.innerHTML='<option value="">Escolher rascunho guardado neste dispositivo</option>'+listDrafts().map(d=>'<option value="'+esc(d.id)+'">'+esc((d.values?.cliente||'Sem cliente')+' · '+(d.updatedAt||''))+'</option>').join('');
}
function loadDraft(){
 const d=listDrafts().find(x=>x.id===$('avac_saved')?.value);if(!d)return;
 $('avac_draft_id').value=d.id;$('avac_equip').value=d.equipamento;$('avac_mode').value=d.mode;
 if(d.osId)$('avac_os').value=d.osId;
 allFields.forEach(([id])=>{const e=$('avac_'+id);if(e)e.value=d.values?.[id]||''});toggle();$('avac_status').textContent='Rascunho carregado.';
}
function listOS(){
 if(typeof dados==='undefined'||!Array.isArray(dados.servicos))return [];
 return dados.servicos.filter(s=>String(s.adminId)===tenant());
}
function populateOS(){
 const el=$('avac_os');if(!el)return;
 el.innerHTML='<option value="">Intervenção sem OS associada</option>'+listOS().slice(-250).reverse().map(s=>'<option value="'+esc(s.id)+'">'+esc([s.numero||s.numeroOS||s.id,s.descricao||s.titulo||''].filter(Boolean).join(' · '))+'</option>').join('');
}
function selectOS(){
 const s=listOS().find(s=>String(s.id)===$('avac_os').value);if(!s)return;
 const customer=(typeof dados!=='undefined'?(dados.clientes||[]):[]).find(x=>x.id===(s.clienteId||s.idCliente));
 const local=(typeof dados!=='undefined'?(dados.locais||[]):[]).find(x=>x.id===(s.localId||s.instalacaoId));
 const set=(id,v)=>{if(v!=null&&$('avac_'+id))$('avac_'+id).value=String(v)};
 set('cliente',customer?.nome||customer?.nomeFiscal||s.clienteNome);
 set('instalacao',local?.nome||local?.morada||s.localNome);
 set('data',String(s.dataAgendada||s.data||'').slice(0,10));
 set('tecnico',s.tecnicoNome||'');
 $('avac_status').textContent='Dados disponíveis da OS preenchidos; confirma-os antes de guardar.';
}


/* Saved specialty report records use the application's existing tenant-scoped sync pipeline. */
const cloudReports=()=>typeof dados!=='undefined'&&Array.isArray(dados.relatoriosEspecialidade)?dados.relatoriosEspecialidade.filter(r=>r.adminId===tenant()&&r.tipo==='AVAC'):[];
function renderCloud(){
 const e=$('avac_cloud');if(!e)return;
 e.innerHTML='<option value="">Escolher relatório AVAC guardado</option>'+cloudReports().slice().reverse().map(r=>'<option value="'+esc(r.id)+'">'+esc((r.numeroDocumento||r.id)+' · '+(r.campos?.cliente||'Cliente'))+'</option>').join('');
}
function openCloud(){
 const r=cloudReports().find(x=>String(x.id)===$('avac_cloud')?.value);if(!r)return;
 $('avac_draft_id').value='';$('avac_record_id').value=r.id;$('avac_equip').value=r.campos?.equipamento||'Ar condicionado';
 $('avac_mode').value=r.campos?.mode||'normal';populateOS();$('avac_os').value=r.servicoId||'';
 allFields.forEach(([id])=>{const e=$('avac_'+id);if(e)e.value=r.campos?.[id]||''});toggle();$('avac_status').textContent='Relatório guardado carregado.';
}
async function saveCloud(){
 const status=$('avac_status'),button=$('avac_save_cloud');if(button.disabled)return;
 if(typeof usuarioLogado==='undefined'||!usuarioLogado||typeof dados==='undefined'||typeof guardarDados!=='function')throw Error('Sessão ou sincronização indisponível.');
 if(!isAVAC())throw Error('Atividade AVAC não identificada na configuração da empresa. Não é possível guardar.');
 const os=listOS().find(s=>String(s.id)===$('avac_os').value);
 if(!os?.clienteId)throw Error('Seleciona uma OS associada a um cliente para guardar no servidor.');
 const client=(dados.clientes||[]).find(x=>x.id===os.clienteId&&x.adminId===tenant());
 if(!client)throw Error('O cliente não pertence à empresa atual.');
 const form=readForm();if(!form.values.data||!form.values.resultado)throw Error('Preenche a data e o resultado da intervenção.');
 const existing=cloudReports().find(x=>x.id===$('avac_record_id').value);
 const current={id:existing?.id||crypto.randomUUID(),adminId:tenant(),servicoId:os.id,clienteId:os.clienteId,localId:os.localId||os.instalacaoId||null,tipo:'AVAC',numeroDocumento:existing?.numeroDocumento||'AVAC-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),data:form.values.data,local:form.values.instalacao||'',campos:{...form.values,equipamento:form.equipamento,mode:form.mode},tecnicoId:usuarioLogado.id,rascunho:true,criadoEm:existing?.criadoEm||new Date().toISOString()};
 button.disabled=true;status.textContent='A guardar no servidor…';
 const snapshot=[...(dados.relatoriosEspecialidade||[])];
 try{
 dados.relatoriosEspecialidade=existing?snapshot.map(r=>r.id===existing.id?{...r,...current}:r):[...snapshot,current];
 await guardarDados();
 $('avac_record_id').value=current.id;renderCloud();status.textContent='Gravação solicitada. Verifica o registo sincronizado no histórico.';
 }catch(e){dados.relatoriosEspecialidade=snapshot;status.textContent='Falha ao guardar no servidor: '+(e.message||e)}finally{button.disabled=false}
}

function section(id,title,body){return '<section id="avac_sec_'+id+'" style="padding:12px;border:1px solid #d9e0e9;border-radius:10px;margin:12px 0"><h3 style="margin-top:0">'+title+'</h3>'+body+'</section>'}
function insert(){if(!isAVAC())return;const menu=$('tgReportMenu');if(!menu||$('tgAvacLaunch'))return;const b=document.createElement('button');b.id='tgAvacLaunch';b.type='button';b.className='btn btn-outline';b.style.margin='8px';b.textContent='AVAC · Relatório técnico adaptativo';b.onclick=open;menu.appendChild(b);}
function open(){
if(!$('tgAvacDialog')){
const dialog=document.createElement('dialog');dialog.id='tgAvacDialog';dialog.style.cssText='border:0;border-radius:14px;padding:0;max-width:750px;width:94vw;max-height:90vh;overflow:auto;box-shadow:0 16px 70px #0005';
dialog.innerHTML='<div style="padding:18px"><div style="display:flex;justify-content:space-between;gap:10px"><h2 style="margin:0">Relatório técnico AVAC</h2><button type="button" id="avac_close" class="btn btn-outline">Fechar</button></div><p>Um relatório por intervenção. Inspeção regulamentar e Legionella requerem documentos separados.</p>'+
section('identity','Identificação', '<input id="avac_draft_id" type="hidden"><input id="avac_record_id" type="hidden"><label>Relatórios AVAC guardados<select id="avac_cloud" style="display:block;width:100%"></select></label><label>Associar Ordem de Serviço<select id="avac_os" style="display:block;width:100%"></select></label><label>Rascunhos locais<select id="avac_saved" style="display:block;width:100%"></select></label><label>Tipo de equipamento<select id="avac_equip" style="display:block;width:100%"><option>Ar condicionado</option><option>Bomba de calor</option><option>UTA</option><option>Ventilação</option><option>Chiller</option><option>Outro</option></select></label>'+fields(general))+
section('mode','Intervenção','<label>Tipo de intervenção<select id="avac_mode" style="display:block;width:100%"><option value="normal">Manutenção normal</option><option value="refrigerante">Intervenção com refrigerante</option><option value="plano">Execução do plano de manutenção</option><option value="refrigerante_plano">Refrigerante + plano de manutenção</option></select></label>')+
section('maintenance','Verificações e limpeza',fields(checks.map(([id,label])=>[id,label+' — estado / trabalho realizado']))+fields(measurements))+
section('refrigerant','Ficha de gases fluorados (quando aplicável)','<p>Preencher apenas quando o circuito e o fluido estejam sujeitos às obrigações aplicáveis. Este formulário não substitui comunicações ou registos legalmente exigidos.</p>'+fields(refrigerant))+
section('plan','Execução do plano de manutenção',fields(plan))+
section('finish','Conclusão',fields([['resultado','Resultado: conforme / não conforme / condicionado'],['recomendacoes','Recomendações','textarea']])+'<label>Fotografias / anexos de imagem<input type="file" id="avac_photos" accept="image/*" multiple style="display:block;width:100%"></label>')+
'<div style="display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap"><button type="button" id="avac_save_cloud" class="btn btn-primary">Guardar no sistema</button><button type="button" id="avac_save" class="btn btn-outline">Guardar rascunho local</button><button type="button" id="avac_pdf" class="btn btn-primary">Gerar PDF</button></div><p id="avac_status" role="status"></p></div>';
document.body.appendChild(dialog);
$('avac_close').onclick=()=>dialog.close();
$('avac_mode').onchange=toggle;
$('avac_pdf').onclick=exportPDF;
$('avac_save').onclick=saveDraft;
$('avac_save_cloud').onclick=()=>saveCloud().catch(e=>{$('avac_status').textContent=e.message});
$('avac_cloud').onchange=openCloud;
$('avac_saved').onchange=loadDraft;
$('avac_os').onchange=selectOS;
populateOS();renderDrafts();renderCloud();
}toggle();$('tgAvacDialog').showModal();
}
function toggle(){const mode=$('avac_mode')?.value||'normal';if($('avac_sec_refrigerant'))$('avac_sec_refrigerant').hidden=!mode.includes('refrigerante');if($('avac_sec_plan'))$('avac_sec_plan').hidden=!mode.includes('plano')}
async function exportPDF(){
const status=$('avac_status');status.textContent='A preparar PDF…';
try{
if(typeof window.ensurePDFLib==='function')await window.ensurePDFLib();
const jsPDF=window.jspdf?.jsPDF||window.jsPDF;if(!jsPDF)throw Error('Biblioteca de PDF indisponível.');
const doc=new jsPDF({unit:'mm',format:'a4'}), W=210, margin=15;let y=18;
const newPage=(needed=8)=>{if(y+needed>275){doc.addPage();y=18}};
const heading=t=>{newPage(14);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(t,margin,y);y+=8};
const line=(label,value)=>{if(!String(value||'').trim())return;doc.setFont('helvetica','normal');doc.setFontSize(10);const text=doc.splitTextToSize(label+': '+value,180);newPage(text.length*5+3);doc.text(text,margin,y);y+=text.length*5+2};
doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('Relatório técnico AVAC',margin,y);y+=10;
const company=admin();doc.setFont('helvetica','normal');doc.setFontSize(10);
line('Empresa',company?.nomeEmpresa||company?.nome||'');line('Nome fiscal',company?.nomeFiscal||company?.razaoSocial||'');line('Data de emissão',new Date().toLocaleDateString('pt-PT'));
y+=4;
line('Ordem de serviço',$('avac_os').selectedOptions[0]?.textContent||'');line('Equipamento',$('avac_equip').value);line('Intervenção',$('avac_mode').selectedOptions[0].textContent);
const read=id=>$ ('avac_'+id)?.value||'';
const group=(title,entries)=>{heading(title);entries.forEach(([id,label])=>line(label,read(id)))};
group('Identificação',general);group('Verificações e limpeza',checks);group('Medições',measurements);
if($('avac_mode').value.includes('refrigerante'))group('Anexo — refrigerante / gases fluorados',refrigerant);
if($('avac_mode').value.includes('plano'))group('Anexo — plano de manutenção',plan);
group('Resultado e recomendações',[['resultado','Resultado'],['recomendacoes','Recomendações']]);
const files=[...($('avac_photos').files||[])].slice(0,15);
if(files.length){heading('Anexo fotográfico');for(const f of files){if(!f.type.startsWith('image/'))continue;const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f)});const fmt=f.type==='image/png'?'PNG':'JPEG';if(!['image/png','image/jpeg'].includes(f.type)){line('Ficheiro não incorporado',f.name);continue}newPage(70);doc.addImage(url,fmt,margin,y,95,64,undefined,'FAST');y+=70;}}
const pages=doc.internal.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Relatório técnico de intervenção — não substitui inspeção regulamentar, registo oficial de gases fluorados ou Legionella.',15,286,{maxWidth:170});doc.text(p+' / '+pages,194,290,{align:'right'});}
const date=new Date().toISOString().slice(0,10);doc.save('relatorio_avac_'+date+'.pdf');status.textContent='PDF gerado.';
}catch(e){status.textContent='Erro ao gerar PDF: '+e.message;}
}
window.TGAVACReport={open,saveDraft,listDrafts,isAVAC,saveCloud,renderCloud};
const observer=new MutationObserver(insert);function init(){insert();observer.observe(document.body,{subtree:true,childList:true});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
