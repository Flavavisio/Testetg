const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb'),{JSDOM}=require('jsdom');
global.indexedDB=new IDBFactory();const api=require('../tg-report-autosave');
const scope={tenant:'t',user:'u',os:'os',type:'REX'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('AVAC autosave isolates each intervention while preserving legacy checkpoint keys',async()=>{
 const install={...scope,type:'RAVAC',model:'Instalação AVAC'},gas={...scope,type:'RAVAC',model:'Recarga de gás'};
 for(const s of [install,gas])await api.write(s,{scope:s,record:{work:s.model}});
 assert.equal((await api.read(install)).record.work,'Instalação AVAC');assert.equal((await api.read(gas)).record.work,'Recarga de gás');
 await api.remove(install);assert.equal(await api.read(install),undefined);assert.equal((await api.read(gas)).record.work,'Recarga de gás');await api.remove(gas);
});
test('checkpoints survive reopening, isolate company/user/equipment and are removed only explicitly',async()=>{
 const value={scope,record:{campos:{text:'Sem rede',signature:'data:image/png;base64,YQ=='}},savedAt:1};await api.write(scope,value);
 assert.deepEqual(await api.read(scope),value);assert.equal(await api.read({...scope,user:'other'}),undefined);assert.equal(await api.read({...scope,tenant:'other'}),undefined);assert.equal(await api.read({...scope,equipment:'other'}),undefined);
 assert.equal((await api.list('t','u')).length,1);await api.remove(scope);assert.equal(await api.read(scope),undefined);
});
test('native autosave debounces edits, preserves signatures and captures asynchronous photo additions',async()=>{
 const w=new JSDOM('<textarea id="work"></textarea><div id="native-photos"></div>',{runScripts:'outside-only'}).window;
 w.eval(fs.readFileSync('tg-report-autosave.js','utf8'));let writes=[],text='';w.TGNativeSheet={serialize:()=>({html:'draft',estadoNativo:{values:{sign_cliente_nome:'Cliente'},clientSignature:'signed',photos:[...w.document.querySelectorAll('img')].map(x=>x.src),text:w.document.getElementById('work').value}})};
 const binding=w.TGReportAutosave.attach({iframe:{contentWindow:w,contentDocument:w.document},isCurrent:()=>true,save:async msg=>{writes.push(msg);return false;},status:s=>text=s});
 try{await wait(50);assert.equal(writes.length,0);const el=w.document.getElementById('work');el.value='Trabalho feito';el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(800);assert.equal(writes.length,1);assert.equal(writes[0].assinaturaCliente,'signed');assert.equal(writes[0].estadoNativo.text,'Trabalho feito');assert.match(text,/dispositivo/);
 w.document.getElementById('native-photos').innerHTML='<img src="data:image/png;base64,YQ==">';await wait(800);assert.equal(writes.length,2);assert.equal(writes[1].estadoNativo.photos.length,1);
 }finally{binding.stop();w.close();}
});
test('legacy serializer is reused, close flush awaits commit, and preparing a saved draft is idempotent',async()=>{
 const w=new JSDOM('<input id="work"><button id="_relBtnRascunho">Guardar</button>',{runScripts:'outside-only'}).window;
 w.eval(fs.readFileSync('tg-report-autosave.js','utf8'));const api=w.TGReportAutosave;const js="window.parent.postMessage({type: 'relatorioEspecialidadeRascunho', html:document.getElementById('work').value}, '*');";
 assert.equal(api.prepare(api.prepare(js)),api.prepare(js));let binding,release,saved;
 Object.defineProperty(w,'parent',{value:{postMessage:m=>binding.accept(m)}});w.document.getElementById('_relBtnRascunho').onclick=()=>w.eval(api.prepare(js));
 binding=api.attach({iframe:{contentWindow:w,contentDocument:w.document},isCurrent:()=>true,status:()=>{},save:msg=>new Promise(r=>{saved=msg;release=()=>r(false);})});
 try{const el=w.document.getElementById('work');el.value='Rascunho';el.dispatchEvent(new w.Event('input',{bubbles:true}));let finished=false;const closing=binding.flush().then(()=>finished=true);await wait(10);assert(!finished);assert.equal(saved.html,'Rascunho');assert(saved._tgAutomatic);release();await closing;assert(finished);}finally{binding.stop();w.close();}
});
function syncFixture(){
 const main=fs.readFileSync('app-principal.js','utf8'),code=main.slice(main.indexOf('        // Checkpoints remain local'),main.indexOf('        let _relEspecOnMessageAtual'));
 const c={console,navigator:{onLine:true},usuarioLogado:{id:'u'},_tenantId:()=> 't',dados:{servicos:[{id:'os',adminId:'t'}],relatoriosEspecialidade:[]},_snap:{relatoriosEspecialidade:new Map()},_guardarCacheLocal:async()=>true,rows:[],writes:0,calls:0,window:{TGReportAutosave:api,addEventListener(){}},M:{relatoriosEspecialidade:{to:x=>x}}};
 c.supa={from:()=>{c.calls++;let row,mode,filters=[];const q={select:()=>q,eq:(k,v)=>(filters.push([k,v]),q),is:(k,v)=>(filters.push([k,v]),q),insert:v=>(row=v,mode='insert',q),update:v=>(row=v,mode='update',q),then:r=>Promise.resolve(r({data:c.rows})),single:async()=>{c.writes++;c.filters=filters;c.rows=[row];return {data:{id:row.id}};}};return q;}};
 vm.createContext(c);vm.runInContext(code,c);return c;
}
function checkpoint(base=null){return {scope,base,record:{id:'report',admin_id:'t',servico_id:'os',tipo:'REX',rascunho:true,campos:{text:'local'},assinatura_cliente:'signed'}};}
test('reconnect synchronizes once and retries a lost acknowledgement without inserting another report',async()=>{
 const c=syncFixture(),cp=checkpoint();await api.write(scope,cp);assert.equal(await c._tgSincronizarCheckpoint(cp),true);assert.equal(c.writes,1);assert.equal(await api.read(scope),undefined);
 await api.write(scope,cp);assert.equal(await c._tgSincronizarCheckpoint(cp),true);assert.equal(c.writes,1);assert.equal(c.dados.relatoriosEspecialidade.length,1);
});
test('conflicting edits and a completed server report never overwrite the remote data or delete the local copy',async()=>{
 for(const closed of [false,true]){const c=syncFixture(),cp=checkpoint({id:'report',rascunho:true,campos:{text:'before'}});c.rows=[{id:'report',rascunho:!closed,campos:{text:'changed by office'}}];await api.write(scope,cp);await assert.rejects(()=>c._tgSincronizarCheckpoint(cp),/noutro dispositivo/);assert.equal(c.writes,0);assert(await api.read(scope));}
 await api.remove(scope);
});
test('existing draft update uses a conditional write, and an account change cannot send another user’s checkpoint',async()=>{
 const c=syncFixture(),base={id:'report',rascunho:true,campos:{text:'before'}},cp=checkpoint(base);c.rows=[base];await c._tgSincronizarCheckpoint(cp);assert(c.filters.some(([k])=>k==='campos->>tgAutosaveVersion'));assert(c.filters.some(([k,v])=>k==='rascunho'&&v===true));
 c.usuarioLogado={id:'someone-else'};const calls=c.calls;assert.equal(await c._tgSincronizarCheckpoint(cp),false);assert.equal(c.calls,calls);
});
test('application cache captures data and confirmed snapshot atomically, serializes writes, and isolates account identities',async()=>{
 const main=fs.readFileSync('app-principal.js','utf8'),helpers=main.slice(main.indexOf('        async function _guardarCacheLocal()'),main.indexOf('        // -------- sincronização por diferenças'));
 const records=new Map(),c={console,structuredClone,Date,Map,Object,_cacheAuthId:'auth-a',_cacheWriteChain:Promise.resolve(),ORDEM:['items'],dados:{items:[{id:'1',text:'first'}]},_snap:{items:new Map([['1','confirmed-before-edit']])},_snapLic:new Map(),_snapJunc:new Map(),_kvCacheGet:async k=>records.get(k),_kvCacheSet:async(k,v)=>{await wait(5);records.set(k,v);}};
 vm.createContext(c);vm.runInContext(helpers,c);
 const first=c._guardarCacheLocal();c.dados.items[0].text='second';const second=c._guardarCacheLocal();await Promise.all([first,second]);
 assert.equal(records.get('tg_cache_v2:auth-a').dados.items[0].text,'second');assert.equal(records.get('tg_cache_v2:auth-a').snapshot.porColuna.items['1'],'confirmed-before-edit');
 c._cacheAuthId='auth-b';assert.equal(await c._carregarCacheLocal(),null);c._cacheAuthId='auth-a';assert.equal((await c._carregarCacheLocal()).items[0].text,'second');await c._restaurarSnapshotDaCache();assert.equal(c._snap.items.get('1'),'confirmed-before-edit');
});
test('both launch pages load same-origin offline dependencies and every local stylesheet/script has a service-worker cache entry',()=>{
 const sw=fs.readFileSync('sw.js','utf8'),assets=JSON.parse(sw.match(/const ASSETS = (\[.*?\]);/)[1]);
 for(const file of ['index.html','login.html']){
  const doc=new JSDOM(fs.readFileSync(file,'utf8')).window.document;
  for(const el of doc.querySelectorAll('script[src],link[rel=stylesheet][href]')){const path=el.getAttribute('src')||el.getAttribute('href');if(/^(https?:|data:|\/\/)/.test(path))continue;assert(assets.includes('./'+path),file+': '+path);}
  assert(doc.querySelector('script[src="vendor/supabase-2.118.0.js"]'));assert(doc.querySelector('script[src="tg-report-autosave.js?v=1.1.0-avac"]'));
 }
});

