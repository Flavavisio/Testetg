const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=';
function setup(){
 const w=new JSDOM('<div id="tgReportMenu"><div class="tgr-menu"></div></div>',{runScripts:'outside-only',url:'https://totalgest.test/'}).window;
 w.usuarioLogado={id:'a',nome:'Técnico de teste',role:'admin'};w.licensed=true;
 w.dados={administradores:[{id:'a',ativo:true,areasNegocio:['avac'],empresa:'Empresa teste',nomeFiscal:'Nome Fiscal & Filhos',nif:'999999999'},{id:'foreign',areasNegocio:['avac']}],clientes:[{id:'c',adminId:'a',nome:'Cliente teste',morada:'Rua Teste',numeroCliente:'42'},{id:'secret',adminId:'foreign',nome:'OUTRA EMPRESA'}],locais:[],servicos:[{id:'os',adminId:'a',clienteId:'c',numeroRegisto:'OS-12',funcionariosIds:['f'],tiposTrabalho:['RAVAC']},{id:'alien',adminId:'foreign',clienteId:'secret'}],funcionarios:[{id:'f',adminId:'a',podeAssinarRelatorios:true},{id:'sa',adminId:'a',permissoesNegadas:[]}],encarregados:[{id:'enc',adminId:'a',funcionariosIds:['f']}],equipamentos:[{id:'eq',adminId:'a',clienteId:'c',marca:'Marca',numeroSerie:'123',tipo:'Bomba de calor',fichaTecnica:{modelo:'Modelo'}},{id:'secret-eq',adminId:'foreign',clienteId:'secret'}],relatoriosEspecialidade:[]};
 w._licencaValidaTenant=()=>w.licensed;w.adminDoUtilizador=()=>w.dados.administradores.find(a=>a.id===(w.usuarioLogado.role==='admin'?w.usuarioLogado.id:w.usuarioLogado.adminId));w.getDataHoje=()=> '2026-10-29';w.gerarId=()=> 'report-new';w.proximoNumeroRelatorio=async()=>1;w.renderizarTudo=()=>{};w.alert=()=>{};
 w.prepararRelatoriosGestao=()=>{};w.M={relatoriosEspecialidade:{to:v=>v}};w.writes=[];
 w.supa={from:table=>{const q={insert:v=>{q.value=v;q.mode='insert';return q;},update:v=>{q.value=v;q.mode='update';return q;},eq:()=>q,select:()=>q,single:async()=>{w.writes.push({table,value:q.value,mode:q.mode});return w.failSave?{error:{message:'Sem ligação'}}:{data:{id:q.value.id}};}};return q;}};
 w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},clearRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};w.HTMLCanvasElement.prototype.toDataURL=()=>png;
 w.eval(fs.readFileSync('tg-specialty-catalog.js','utf8'));w.eval(fs.readFileSync('tg-equipment-reports.js','utf8'));w.eval(fs.readFileSync('tg-specialty-reports.js','utf8'));return w;
}
const base=()=>({date:'2026-10-29',operation:'Manutenção preventiva',equipmentType:'Split',brand:'Marca',model:'Modelo',serial:'123',work:'Limpeza dos filtros',result:'Operacional',techName:'Técnico de teste',techSignature:png,clientStatus:'Cliente ausente',checks:['Conforme']});
const flush=()=>new Promise(r=>setImmediate(r));
function fill(w){for(const [key,value]of Object.entries(base())){const el=w.document.querySelector('[data-avac="'+key+'"]');if(el)el.value=value;}const c=w.document.querySelector('[data-avac-sign="tech"]');c.onpointerdown({preventDefault(){},pointerId:1,clientX:10,clientY:10});}
test('AVAC is opt-in and hidden for missing area, other tenants, portal, revoked license and unrelated staff',()=>{
 const w=setup();try{const A=w.TGAVAC,d=w.dados,u=w.usuarioLogado;assert(A.scope(d,u,'os'));assert(!A.scope(d,u,'alien'));for(const areas of [null,[],['seguranca']]){d.administradores[0].areasNegocio=areas;assert(!A.enabled(d.administradores[0]));assert(!A.scope(d,u,'os'));assert(!w.TGEquipmentReports.options('').includes('RAVAC'));}d.administradores[0].areasNegocio=['avac'];assert(!A.scope(d,{id:'f',adminId:'a',role:'cliente'},'os'));assert(!A.scope(d,u,'os',false));assert(!A.scope(d,{id:'x',adminId:'a',role:'funcionario'},'os'));assert(A.scope(d,{id:'f',adminId:'a',role:'funcionario'},'os'));assert(A.scope(d,{id:'enc',adminId:'a',role:'encarregado'},'os'));}finally{w.close();}
});
test('responsibility, signing permission and denied modules remain enforced',()=>{
 const w=setup();try{const A=w.TGAVAC,d=w.dados;d.servicos[0].relatorioResponsavelId='other';assert(!A.scope(d,{id:'f',adminId:'a',role:'funcionario'},'os'));d.servicos[0].relatorioResponsavelId='f';assert(A.scope(d,{id:'enc',adminId:'a',role:'encarregado'},'os'));d.funcionarios[0].podeAssinarRelatorios=false;assert(!A.scope(d,{id:'f',adminId:'a',role:'funcionario'},'os').canSign);d.funcionarios[1].permissoesNegadas=['relatorio-os'];assert(!A.scope(d,{id:'sa',adminId:'a',role:'subadmin'},'os'));}finally{w.close();}
});
test('adaptive sections do not invent refrigerants, values, legal deadlines or compliance',()=>{
 const w=setup();try{const A=w.TGAVAC,v=base();assert.deepEqual(Array.from(A.sections(v),s=>s.title),['Equipamento','Verificações','Medições','Intervenção e resultado']);assert.equal(A.co2(v),null);v.fgas=true;v.charge='3';v.gwp='675';assert.equal(A.co2(v),2.025);v.plan=true;v.operation='Instalação / colocação em serviço';assert(A.sections(v).some(s=>s.title==='Colocação em serviço'));assert(A.sections(v).some(s=>s.title==='Execução do plano de manutenção'));assert(A.sections(v).some(s=>s.title.includes('gases fluorados')));}finally{w.close();}
});
test('final validation requires signatures and a complete gas record; drafts remain possible',()=>{
 const w=setup();try{const A=w.TGAVAC;assert.equal(A.validate({},false).length,0);assert(A.validate({},true).length);const v=base();assert.equal(A.validate(v,true).length,0);v.fgas=true;assert(A.validate(v,true).some(x=>x.includes('certificados')));Object.assign(v,{refrigerant:'R32',charge:'3',gwp:'675',gwpSource:'Ficha de segurança do fabricante',added:'0',recovered:'0',companyCert:'EMP-TESTE',techCert:'TEC-TESTE',leakCheck:'Realizado',leakMethod:'Detetor eletrónico',leakResult:'Sem fuga detetada',periodicCheck:'Por confirmar'});assert.equal(A.validate(v,true).length,0);v.leakResult='Fuga detetada';assert(A.validate(v,true).some(x=>x.includes('medidas')));v.date='2026-02-30';assert(A.validate(v,true).some(x=>x.includes('data')));}finally{w.close();}
});
test('single printable document has fiscal name, conditional annexes, signatures and escaped text',()=>{
 const w=setup();try{const A=w.TGAVAC,v=base();v.work='<script>bad()</script>';const r={numeroDocumento:'RAVAC-42-001',rascunho:false,campos:{avac:v}};const html=A.html(r,w.dados.administradores[0]);assert.match(html,/Nome Fiscal &amp; Filhos/);assert.match(html,/&lt;script&gt;/);assert(!html.includes('<script>'));assert(!html.includes('Ficha de intervenção — gases fluorados'));assert(!html.includes('2024/573'));v.fgas=true;v.plan=true;const full=A.html(r,w.dados.administradores[0]);assert.match(full,/2024\/573/);assert.match(full,/6476-C\/2021/);assert.equal((full.match(/<!doctype html>/g)||[]).length,1);}finally{w.close();}
});
test('reports hub and equipment selector only offer AVAC for selected companies',()=>{
 const w=setup();try{w.prepararRelatoriosGestao();assert(w.document.querySelector('[data-specialty-launcher="RAVAC"]'));assert(w.TGEquipmentReports.options('').includes('RAVAC'));w.dados.administradores[0].areasNegocio=['seguranca'];w.TGAVAC.refresh();assert(!w.document.querySelector('[data-specialty-launcher="RAVAC"]'));assert(!w.TGEquipmentReports.options('').includes('RAVAC'));}finally{w.close();}
});
test('draft save is confirmed by the server and reopening restores the equipment and measurements',async()=>{
 const w=setup();try{await w.TGAVAC.open('os');const f=w.document.querySelector('.avac-form');f.querySelector('[data-avac="equipmentId"]').value='eq';f.querySelector('[data-avac="tSupply"]').value='12.3';f.querySelector('[data-avac-draft]').click();await flush();assert.equal(w.writes.length,1);assert(w.dados.relatoriosEspecialidade[0].rascunho);await w.TGAVAC.open('os');assert.equal(w.document.querySelector('[data-avac="equipmentId"]').value,'eq');assert.equal(w.document.querySelector('[data-avac="tSupply"]').value,'12.3');}finally{w.close();}
});
test('final report is persisted once, numbered, visible in history and satisfies an OS-level AVAC requirement',async()=>{
 const w=setup();try{let done=0;await w.TGAVAC.open('os',()=>done++);fill(w);w.document.querySelector('.avac-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(w.writes.length,1);const r=w.dados.relatoriosEspecialidade[0];assert(!r.rascunho);assert.equal(r.numeroDocumento,'RAVAC-42-001');assert.equal(r.adminId,'a');assert.equal(r.clienteId,'c');assert(r.campos.htmlSnapshot.includes('Nome Fiscal'));assert.equal(done,1);assert.equal(w.TGEquipmentReports.pending(w.dados.servicos[0]).length,0);}finally{w.close();}
});
test('failed writes keep the editor open and do not create a local success or complete the OS',async()=>{
 const w=setup();try{w.failSave=true;await w.TGAVAC.open('os');fill(w);w.document.querySelector('[data-avac-draft]').click();await flush();assert(w.document.querySelector('.avac-form'));assert.equal(w.dados.relatoriosEspecialidade.length,0);assert.match(w.document.querySelector('[data-avac-status]').textContent,/Sem ligação/);}finally{w.close();}
});
test('account or area changes close the editor and cannot save stale customer data',async()=>{
 const w=setup();try{await w.TGAVAC.open('os');w.dados.administradores[0].areasNegocio=[];w.TGAVAC.refresh();assert(!w.document.querySelector('.avac-form'));assert.equal(w.writes.length,0);}finally{w.close();}
});
for(const [type,area,code,fields] of [
 ['RLIM','limpeza','Limpeza regular',{zones:'Cozinha e sala',done:'Pavimento e pontos de contacto',method:'Lavagem e secagem',work:'Limpeza realizada',result:'Serviço realizado'}],
 ['RELE','eletricidade','Quadro elétrico',{installation:'Quadro Q1',qualification:'Técnico habilitado TESTE',tests:'Circuito C1 — ensaio funcional registado',voltage:'230.5',work:'Substituição de proteção',result:'Operacional com recomendações'}]
]){
 test(type+' is native only for its area and draft/final round-trip preserves values and photographs',async()=>{
  const w=setup();try{
   const module=w.TGSpecialtyReports.modules[type],os=w.dados.servicos[0];assert(!module.scope(w.dados,w.usuarioLogado,'os'));
   w.dados.administradores[0].areasNegocio=[area];os.tiposTrabalho=[code];assert.equal(w.TGEquipmentReports.pending(os)[0].tipo,type);assert(!w.TGEquipmentReports.options('').includes('RAVAC'));
   await module.open('os');for(const [key,value]of Object.entries(fields))w.document.querySelector('[data-avac="'+key+'"]').value=value;
   w.document.querySelector('[data-avac-draft]').click();await flush();const draft=w.dados.relatoriosEspecialidade[0];assert(draft.rascunho);draft.campos[area].photos=[{src:png,caption:'Antes e depois'}];
   // Simulate a reload from stored JSON instead of reusing form state.
   w.dados.relatoriosEspecialidade=JSON.parse(JSON.stringify(w.dados.relatoriosEspecialidade));await module.open('os');
   for(const [key,value]of Object.entries(fields))assert.equal(w.document.querySelector('[data-avac="'+key+'"]').value,value);
   assert(w.document.querySelector('[data-avac-photos] img'));assert(w.TGEquipmentReports.pending(os).length);
   w.document.querySelector('[data-avac="techName"]').value='Técnico QA';w.document.querySelector('[data-avac="clientStatus"]').value='Cliente ausente';w.document.querySelector('[data-avac-sign="tech"]').onpointerdown({preventDefault(){},pointerId:1,clientX:10,clientY:10});
   w.document.querySelector('.avac-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(w.writes.length,2);assert.equal(w.writes[1].mode,'update');assert.equal(w.dados.relatoriosEspecialidade.length,1);const final=w.dados.relatoriosEspecialidade[0];assert(!final.rascunho);assert.match(final.numeroDocumento,new RegExp('^'+type+'-42-001$'));assert(final.campos.htmlSnapshot.includes('Antes e depois'));assert(!final.campos.htmlSnapshot.includes('Ficha de intervenção — gases fluorados'));assert.equal(w.TGEquipmentReports.pending(os).length,0);
  }finally{w.close()}
 });
}
test('AVAC canonical work codes select all five matching forms; recarga requires its gas annex',async()=>{
 const w=setup();try{const c=w.TGSpecialtyCatalog.list[0];for(const [code,label]of c.work){const os={tiposTrabalho:[code]};assert(c.matches(os));assert(c.matches({tiposTrabalho:[label]}));assert.equal(c.operationFor(os),c.operations[c.work.findIndex(x=>x[0]===code)]);}
 w.dados.servicos[0].tiposTrabalho=['Recarga de gás'];await w.TGAVAC.open('os');assert.equal(w.document.querySelector('[data-avac="operation"]').value,'Recarga de gás refrigerante');assert(w.TGAVAC.validate({...base(),operation:'Recarga de gás refrigerante'},true).some(x=>x.includes('Ativa')));
 }finally{w.close()}
});
test('disinfection does not complete without product, dilution, contact time and authorization record',()=>{
 const w=setup();try{const m=w.TGSpecialtyReports.modules.RLIM,v={...base(),operation:'Desinfeção',result:'Serviço realizado',zones:'Sala',done:'Desinfeção',method:'Aplicação'};assert(m.validate(v,true).some(x=>x.includes('desinfeção')));Object.assign(v,{products:'Produto de teste',dilution:'Conforme rótulo',contact:'Conforme rótulo',biocide:'Registo de teste'});assert.equal(m.validate(v,true).length,0);}finally{w.close()}
});
test('installed and browser entrypoints load the same catalog/editor/cache versions',()=>{
 const files=['index.html','login.html'].map(f=>fs.readFileSync(f,'utf8')),sw=fs.readFileSync('sw.js','utf8');for(const path of ['tg-specialty-catalog.js?v=1.0.0','tg-specialty-reports.js?v=1.0.0','tg-specialty-reports.css?v=1.0.0']){for(const html of files)assert(html.includes(path));assert(sw.includes(path));}for(const html of files){assert(!html.includes('src="tg-avac-report.js'));assert(html.indexOf('tg-specialty-catalog.js')<html.indexOf('tg-equipment-reports.js'));}
});
test('client history includes the three native specialties without requiring the security add-on',()=>{
 const w=setup();try{w.eval(fs.readFileSync('tg-client-history.js','utf8'));w.dados.relatoriosEspecialidade=['RAVAC','RLIM','RELE'].map(tipo=>({id:tipo,adminId:'a',clienteId:'c',tipo,data:'2026-10-30',rascunho:false}));w.dados.relatoriosEspecialidade.push({id:'secret',adminId:'foreign',clienteId:'c',tipo:'RLIM'});const events=w.TGClientHistory.events({id:'c',tenant:'a',especialidade:false},w.dados,[]);assert.equal(events.length,3);assert(events.every(e=>e.action==='relatorio'));}finally{w.close()}
});
