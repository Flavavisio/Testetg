const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync('tg-crm-client-summary-test.js', 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup({role = 'admin', request} = {}) {
 const w = new JSDOM('<div id="secao-clientes-crm"></div>', {url:'https://example.test/',runScripts:'outside-only'}).window;
 w.usuarioLogado = role === 'admin' ? {id:'tenant',role} : {id:'seller',adminId:'tenant',role};
 const clients = [{id:'a',adminId:'tenant',nome:'Águia & Filhos',numeroCliente:'100',nif:'123456789'},{id:'b',adminId:'tenant',nome:'Beta',numeroCliente:'200'},{id:'x',adminId:'other',nome:'Outro tenant'}];
 const d = {clients,leads:[],opps:[],proposals:[]};
 const fixtures = {
  propostas:[{id:'p',admin_id:'tenant',cliente_id:'a',numero:'PROP-1',nome:'CCTV <teste>',estado:'aceite',valor:150,data_criacao:'2026-11-01'}],
  locais:[{id:'l',admin_id:'tenant',cliente_id:'a',nome:'Loja',morada:'Rua A'}],
  contratos:[{id:'c',admin_id:'tenant',cliente_id:'a',numero:'CT-1',tipo:'Manutenção',periodicidade:'anual'}],
  servicos:[{id:'s',admin_id:'tenant',cliente_id:'a',numero_registo:'OS-1',descricao:'Manutenção',status:'concluido',data:'2026-11-02'}],
  assistencias:[{id:'as',admin_id:'tenant',cliente_id:'a',numero:'AS-1',assunto:'Alarme',estado:'aberta'},{id:'deleted',admin_id:'tenant',cliente_id:'a',assunto:'Apagada',apagado_superadmin:true}]
 };
 const calls = [];
 w.supa = {from(table) {
  const call = {table,filters:{},range:[]}; calls.push(call);
  const query = {select(fields){call.fields=fields;return query;},eq(k,v){call.filters[k]=v;return query;},order(){return query;},range(from,to){call.range=[from,to];return query;},then(resolve,reject){return Promise.resolve().then(()=>request ? request(call,fixtures) : {data:(fixtures[table]||[]).filter(r=>Object.entries(call.filters).every(([key,value])=>r[key]===value)).slice(call.range[0],call.range[1]+1),error:null}).then(resolve,reject);}};
  return query;
 }};
 w._tgModuleAssertAccess = () => {};
 w.eval(script);
 w.TGCRMClientSummary.render(d);
 const select = async (id,wait=true) => {const field=w.document.getElementById('crmPlusClientSelect');field.value=id;field.dispatchEvent(new w.Event('change',{bubbles:true}));if(wait){await tick();await tick();}};
 return {w,d,fixtures,calls,select};
}
function count(w,kind) {return w.document.querySelector('[data-crmclient-kind="'+kind+'"] strong')?.textContent;}
test('requires explicit selection, with no default customer, counters or read requests',()=>{
 const {w,calls}=setup();try{assert.equal(w.document.getElementById('crmPlusClientSelect').value,'');assert.equal(w.document.querySelectorAll('[data-crmclient-kind]').length,0);assert.match(w.document.body.textContent,/Começa por selecionar/);assert.equal(calls.length,0);assert(!w.document.body.textContent.includes('Outro tenant'));}finally{w.close();}
});
test('selection loads five exact separate counts, changes history by category and clears cleanly',async()=>{
 const {w,d,calls,select}=setup();try{
 const before=JSON.stringify(d);await select('a');
 for(const kind of ['propostas','instalacoes','contratos','os','assistencias']) assert.equal(count(w,kind),'1');
 assert.equal(w.document.querySelectorAll('[role=tab]').length,5);
 assert.match(w.document.getElementById('crmClientHistory').textContent,/PROP-1/);
 assert(!w.document.getElementById('crmClientHistory').textContent.includes('OS-1'));
 assert(!w.document.querySelector('#crmClientHistory teste'));
 w.document.querySelector('[data-crmclient-kind=os]').click();
 assert.match(w.document.getElementById('crmClientHistory').textContent,/OS-1/);
 assert(!w.document.getElementById('crmClientHistory').textContent.includes('PROP-1'));
 assert(calls.every(c=>c.filters.admin_id==='tenant'&&c.filters.cliente_id==='a'));
 assert.equal(JSON.stringify(d),before);
 await select('b');for(const kind of ['propostas','instalacoes','contratos','os','assistencias'])assert.equal(count(w,kind),'0');
 await select('');assert.equal(w.document.querySelectorAll('[role=tab]').length,0);
 }finally{w.close();}
});
test('query pagination handles over 1000 records even when server uses smaller page limits; UI offers more',async()=>{
 const {w,calls,select}=setup({request:call=>({data:call.table==='servicos'?Array.from({length:1203},(_,i)=>({id:'s'+i,admin_id:'tenant',cliente_id:'a',numero_registo:'OS-'+i})).slice(call.range[0],call.range[0]+200):[],error:null})});
 try{await select('a');for(let i=0;i<12&&count(w,'os')==='…';i++)await tick();assert.equal(count(w,'os'),'1203');w.document.querySelector('[data-crmclient-kind=os]').click();assert.equal(w.document.querySelectorAll('#crmClientHistory tbody tr').length,50);w.document.querySelector('[data-crmclient-more]').click();assert.equal(w.document.querySelectorAll('#crmClientHistory tbody tr').length,100);assert(calls.filter(c=>c.table==='servicos').some(c=>c.range[0]===1203));}finally{w.close();}
});
test('failed requests show unavailable rather than zero, and retry recovers',async()=>{
 let fail=true;
 const {w,select}=setup({request:(call,fixtures)=>({data:fail&&call.table==='contratos'?null:fixtures[call.table].slice(call.range[0],call.range[1]+1),error:fail&&call.table==='contratos'?{message:'offline'}:null})});
 try{await select('a');assert.equal(count(w,'contratos'),'!');w.document.querySelector('[data-crmclient-kind=contratos]').click();assert.match(w.document.getElementById('crmClientHistory').textContent,/Não foi possível/);fail=false;w.document.querySelector('[data-crmclient-refresh]').click();await tick();await tick();assert.equal(count(w,'contratos'),'1');}finally{w.close();}
});
test('late responses cannot mix clients or survive an account change',async()=>{
 const pending=[];
 const {w,d,select}=setup({request:call=>new Promise(resolve=>pending.push({call,resolve}))});
 try{
 await select('a',false);await tick();await select('b',false);await tick();
 pending.filter(p=>p.call.filters.cliente_id==='a').forEach(p=>p.resolve({data:[{id:'late',admin_id:'tenant',cliente_id:'a',numero:'PRIVATE-A'}],error:null}));await tick();
 assert(!w.document.body.textContent.includes('PRIVATE-A'));assert.equal(w.document.getElementById('crmPlusClientSelect').value,'b');
 w.usuarioLogado={id:'other',role:'admin'};w.TGCRMClientSummary.render(d);
 pending.filter(p=>p.call.filters.cliente_id==='b').forEach(p=>p.resolve({data:[{id:'late-b',admin_id:'tenant',cliente_id:'b',numero:'PRIVATE-B'}],error:null}));await tick();
 assert.equal(w.document.getElementById('crmPlusClientSelect').value,'');assert.equal(w.document.querySelectorAll('[role=tab]').length,0);assert(!w.document.body.textContent.includes('PRIVATE-B'));
 }finally{w.close();}
});
test('seller sees associated clients and own proposals only, without reading operational tables',async()=>{
 const {w,d,calls,fixtures,select}=setup({role:'vendedor'});
 try{d.leads=[{clienteConvertidoId:'a',responsavelComercial:'seller'}];w.TGCRMClientSummary.render(d);assert.equal(w.document.querySelectorAll('#crmPlusClientSelect option').length,2);fixtures.propostas[0].responsavel_comercial='seller';await select('a');assert.equal(count(w,'propostas'),'1');assert.equal(count(w,'os'),'—');assert(calls.every(c=>c.table==='propostas'&&c.filters.responsavel_comercial==='seller'));w.document.querySelector('[data-crmclient-kind=os]').click();assert.match(w.document.getElementById('crmClientHistory').textContent,/não permite/);}finally{w.close();}
});
test('search finds clients by number and accent-free name, filters records, and keyboard switches category',async()=>{
 const {w,select}=setup();try{
 const search=w.document.getElementById('crmClientSearch');search.value='aguia';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.document.querySelectorAll('#crmPlusClientSelect option').length,2);await select('a');
 const filter=w.document.getElementById('crmClientRecordSearch');filter.value='nothing';filter.dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(w.document.getElementById('crmClientHistory').textContent,/Sem resultados/);assert.equal(count(w,'propostas'),'1');
 w.document.getElementById('crmClientTab-propostas').dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight'}));assert.equal(w.document.querySelector('[role=tab][aria-selected=true]').dataset.crmclientKind,'instalacoes');assert.match(w.document.getElementById('crmClientHistory').textContent,/Loja/);
 }finally{w.close();}
});
test('entry pages load the same summary before CRM Plus and cache all versioned assets',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 for(const file of ['TOTALGEST_CRM.html','TOTALGEST CRM.html']){
 const html=fs.readFileSync(file,'utf8');assert(html.indexOf('tg-crm-client-summary-test.js')<html.indexOf('tg-crm-plus-test.js'));
 for(const asset of ['tg-crm-client-summary-test.js?v=1.0.0','tg-crm-client-summary-test.css?v=1.0.0','tg-crm-plus-test.js?v=3.1.0-client-summary']){assert(html.includes(asset));assert(sw.includes(asset));}
 }
});
test('both real CRM pages mount the customer screen through the existing menu without a preselected customer',()=>{
 for(const file of ['TOTALGEST_CRM.html','TOTALGEST CRM.html']) {
  const html=fs.readFileSync(file,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const w=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'}).window;
  try {
   w.document.getElementById('crmApp').style.display='block';
   w.usuarioLogado={id:'tenant',role:'admin'};
   w.dados={clientes:[{id:'c',adminId:'tenant',nome:'Cliente de teste'}],administradores:[],funcionarios:[],encarregados:[],leads:[],oportunidades:[],propostas:[],atividadesComerciais:[]};
   w.mudarTabCRM=()=>{};w.renderizarTudo=()=>{};w._tgModuleAssertAccess=()=>{};
   w.eval(script);w.eval(fs.readFileSync('tg-crm-plus-test.js','utf8'));
   w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
   w.document.querySelector('[data-tab="clientes-crm"]').click();
   assert(w.document.getElementById('secao-clientes-crm').classList.contains('ativa'));
   assert.equal(w.document.getElementById('crmPlusClientSelect').value,'');
   assert.equal(w.document.querySelectorAll('#crmPlusClient').length,1);
   assert.match(w.document.getElementById('crmPlusClient').textContent,/Começa por selecionar/);
   assert.equal(w.document.getElementById('crmTopTitulo').textContent,'Ficha do Cliente');
  } finally {w.close();}
 }
});
