const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'))[0];
function setup(role='admin'){
 const w=new JSDOM(fs.readFileSync('login.html','utf8'),{url:'https://example.test/',runScripts:'outside-only'}).window;
 w.usuarioLogado={id:'u',adminId:'a',role};w.dados={administradores:[],folhasObra:[],obras:[
 {id:'p',adminId:'a',nome:'Preparar',estado:'preparacao',dataCriacao:Date.UTC(2026,9,1,12)},
 {id:'a',adminId:'a',nome:'Ativa',estado:'ativa',dataCriacao:Date.UTC(2026,9,3,12)},
 {id:'l',adminId:'a',nome:'Almoço',estado:'pausa para almoço',dataCriacao:Date.UTC(2026,9,2,12)},
 {id:'s',adminId:'a',nome:'Suspensa',estado:'suspensa'},
 {id:'c',adminId:'a',nome:'Terminada',estado:'concluida',dataCriacao:'invalid'},
 {id:'old',adminId:'a',nome:'Antiga',estado:null},
 {id:'foreign',adminId:'other',nome:'Outra empresa',estado:'ativa'}]};w.state={};
 Object.assign(w,{_tenantArmazem:()=>w.usuarioLogado.adminId,_getTableState:()=>w.state,totalHorasObra:()=>0,obterNomeCliente:()=> 'Cliente',obterNomeFuncionario:()=> 'Técnico',_nomesAtribuidosObraColorido:()=> 'Técnico',_estadoSelectObra:o=>o.estado||'',obrasAvancadoAtivo:()=>false,_toolbarHtml:()=>''});
 w.eval("let _obrasLongaEstadoFiltro='todas',_obrasLongaConta='';"+['_aplicarFiltroOrdenacao','_obrasLongaGrupoEstado','_obrasLongaDataCriacao','obrasLongaFiltrarEstado','_obrasLongaContadores','renderizarObrasLongaDuracao'].map(fn).join('\n'));
 w.renderizarObrasLongaDuracao();return w;
}
const count=(w,state)=>Number(w.document.querySelector(`[data-obras-estado="${state}"] strong`).textContent);
const names=w=>[...w.document.querySelectorAll('#tabelaObrasLonga tr strong')].map(el=>el.textContent);
test('admin and subadmin see tenant-only counters and creation date in the first column',()=>{
 for(const role of ['admin','subadmin']){const w=setup(role);try{assert.equal(count(w,'todas'),6);assert.equal(count(w,'preparacao'),2);assert.equal(count(w,'ativa'),2);assert.equal(count(w,'suspensa'),1);assert.equal(count(w,'concluida'),1);assert(!names(w).includes('Outra empresa'));assert(!w.document.getElementById('obrasLongaDataCriacaoTh').hidden);assert.equal(w.document.querySelector('#tabelaObrasLonga tr td').textContent,'01/10/2026');assert.equal(w.document.querySelector('#tabelaObrasLonga tr').children.length,8);}finally{w.close();}}
});
test('state counters filter rows, combine with search, and keep totals for all company works',()=>{
 const w=setup();try{w.obrasLongaFiltrarEstado('ativa');assert.deepEqual(names(w),['Ativa','Almoço']);w.state.filtro='Almoço';w.renderizarObrasLongaDuracao();assert.deepEqual(names(w),['Almoço']);assert.equal(count(w,'todas'),6);assert.equal(count(w,'ativa'),2);w.state.filtro='missing';w.renderizarObrasLongaDuracao();assert.equal(w.document.querySelector('#tabelaObrasLonga td').colSpan,8);w.state.filtro='';w.obrasLongaFiltrarEstado('todas');assert.equal(names(w).length,6);}finally{w.close();}
});
test('missing or invalid dates stay unknown and date sorting is chronological',()=>{
 const w=setup();try{for(const name of ['Suspensa','Terminada','Antiga']){const row=[...w.document.querySelectorAll('#tabelaObrasLonga tr')].find(row=>row.querySelector('strong').textContent===name);assert.equal(row.firstElementChild.textContent,'—');}w.state.sortCol='dataCriacao';w.state.sortDir=-1;w.renderizarObrasLongaDuracao();assert.deepEqual(names(w).slice(0,3),['Ativa','Almoço','Preparar']);}finally{w.close();}
});
test('counts reflect status changes and the selected state cannot cross accounts',()=>{
 const w=setup();try{w.obrasLongaFiltrarEstado('ativa');w.dados.obras.find(o=>o.id==='a').estado='suspensa';w.renderizarObrasLongaDuracao();assert.equal(count(w,'ativa'),1);assert.equal(count(w,'suspensa'),2);assert.deepEqual(names(w),['Almoço']);w.usuarioLogado={id:'new',adminId:'other',role:'subadmin'};w.renderizarObrasLongaDuracao();assert.equal(count(w,'todas'),1);assert.deepEqual(names(w),['Outra empresa']);assert.equal(w.document.querySelector('[data-obras-estado=todas]').getAttribute('aria-pressed'),'true');}finally{w.close();}
});
test('employee and supervisor views retain seven columns and no management counters',()=>{
 const w=setup();try{for(const role of ['funcionario','encarregado']){w.usuarioLogado.role=role;w.renderizarObrasLongaDuracao();assert(w.document.getElementById('obrasLongaContadores').hidden);assert(w.document.getElementById('obrasLongaDataCriacaoTh').hidden);assert.equal(w.document.querySelector('#tabelaObrasLonga tr').children.length,7);const before=names(w);w.obrasLongaFiltrarEstado('concluida');assert.deepEqual(names(w),before);}}finally{w.close();}
});
test('both entry points include one overview container and creation-date header',()=>{
 for(const file of ['index.html','login.html']){const w=new JSDOM(fs.readFileSync(file,'utf8')).window;try{assert.equal(w.document.querySelectorAll('#obrasLongaContadores').length,1);const th=w.document.getElementById('obrasLongaDataCriacaoTh');assert.equal(th.parentElement.firstElementChild,th);assert.equal(th.dataset.tcol,'dataCriacao');}finally{w.close();}}
});
