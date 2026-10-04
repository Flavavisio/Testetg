const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const main=fs.readFileSync('app-principal.js','utf8');
const fn=name=>main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
const host=fs.readFileSync('tg-integrated-modules.js','utf8'),embed=fs.readFileSync('tg-module-embed.js','utf8');
function setup(){
 const dom=new JSDOM('<body><header>Empresa</header><div id="tgHome"></div><div id="cardsGrid" class="cards-grid"><a class="card-principal" data-card="crm"></a><a class="card-principal" data-card="assistencias"></a></div><div id="wsClienteOverlay"></div></body>',{url:'https://totalgest.test/login.html',runScripts:'outside-only'}),w=dom.window;
 w.usuarioLogado={id:'a',role:'admin'};w.admin={id:'a',crmPlano:'mensal',crmExpiracao:Date.now()+86400000,assistPlano:'mensal',assistExpiracao:Date.now()+86400000};
 w.licensed=true;w._licencaValidaTenant=()=>w.licensed;w.adminDoUtilizador=()=>w.admin;w.alert=message=>w.lastAlert=message;
 w.eval(fn('moduloCrmAtivo')+'\n'+fn('moduloAssistAtivo'));
 for(const name of ['_registarUsoSecao','_marcarNavAtivo','_atualizarBreadcrumb','_fecharSidebarMobile','_injetarBotaoVoltarSecaoMobile']) w[name]=()=>{};
 w._tituloSecao=name=>name;w._layoutUsaSidebarShell=()=>true;w._ehPerfilMobile=()=>false;w._contextoAtual='__inicio';
 w.irParaInicio=()=>{w._contextoAtual='__inicio';w.document.querySelectorAll('.section-container').forEach(e=>e.classList.remove('active'));};
 w._wsClienteFechar=()=>w.document.getElementById('wsClienteOverlay').classList.remove('open');
 w.open=()=>{throw Error('Must not open another tab');};
 w._contarAlteracoesPendentes=()=>0;w.carregarTabelaEspecifica=async col=>{w.loaded.push(col);};w.loaded=[];w.renderizarTudo=()=>w.rendered=true;
 w.eval(host);w.eval(fn('abrirSecao')+'\n'+fn('_abrirCRM')+'\n'+fn('_abrirAssist')+'\n'+fn('_abrirAssistGeral'));
 return {dom,w,close:()=>w.close()};
}
test('pack grants, downgrade and expiry keep CRM and Assist independent',()=>{
 const ctx=vm.createContext({Date,admin:{}}),defs=main.slice(main.indexOf('        const PACKS ='),main.indexOf('        // Preços base por escalão'));
 vm.runInContext(defs+'\n'+['packDiferencaAoMudar','aplicarPackAoAdmin','moduloCrmAtivo','moduloAssistAtivo'].map(fn).join('\n'),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run("aplicarPackAoAdmin(admin,'pro',Date.now()+86400000)");assert.equal(run('!!moduloAssistAtivo(admin)'),true);assert.equal(run('!!moduloCrmAtivo(admin)'),false);
 run("aplicarPackAoAdmin(admin,'supreme',Date.now()+86400000)");assert.equal(run('!!moduloCrmAtivo(admin)'),true);assert.equal(run('!!moduloAssistAtivo(admin)'),true);
 run("aplicarPackAoAdmin(admin,'pro',Date.now()+86400000)");assert.equal(run('!!moduloCrmAtivo(admin)'),false);assert.equal(run('!!moduloAssistAtivo(admin)'),true);
 run("admin={crmPlano:'mensal',crmExpiracao:Date.now()+86400000}");assert.equal(run('!!moduloAssistAtivo(admin)'),false);
 run("admin.assistPlano='mensal';admin.assistExpiracao=Date.now()-1");assert.equal(run('!!moduloAssistAtivo(admin)'),false);
});
test('original routes open the central section, preserve the shell and deep-link to create OS',()=>{
 const {w,close}=setup();try{
 let prevented=false;assert.equal(w._abrirCRM({preventDefault(){prevented=true;}}),false);assert(prevented);
 const crm=w.document.querySelector('#secao-crm iframe');assert(crm);assert.equal(w._contextoAtual,'crm');assert(w.document.getElementById('secao-crm').classList.contains('active'));assert(w.document.querySelector('header'));
 w.document.getElementById('wsClienteOverlay').classList.add('open');w._abrirAssist(null,'request&test');
 const assist=w.document.querySelector('#secao-assistencias iframe');assert.equal(new URL(assist.src).searchParams.get('criarOS'),'request&test');assert.equal(new URL(assist.src).searchParams.get('embedded'),'1');
 assert(!w.document.getElementById('secao-crm').classList.contains('active'));assert(!w.document.getElementById('wsClienteOverlay').classList.contains('open'));
 w.document.querySelector('#secao-assistencias .tg-module-heading button').click();assert.equal(w._contextoAtual,'__inicio');
 }finally{close();}
});
test('unbought, expired, hidden, wrong role and base-expired modules cannot load',()=>{
 const {w,close}=setup();try{
 w.admin.assistPlano=null;w._abrirAssistGeral();assert(!w.document.querySelector('iframe'));assert(w.lastAlert);
 w.admin.crmExpiracao=Date.now()-1;w.abrirSecao('crm');assert(!w.document.querySelector('iframe'));
 w.admin.crmExpiracao=Date.now()+86400000;w.document.querySelector('[data-card="crm"]').classList.add('hidden-card');w._abrirCRM();assert(!w.document.querySelector('iframe'));
 w.document.querySelector('[data-card="crm"]').classList.remove('hidden-card');w.usuarioLogado.role='funcionario';w._abrirCRM();assert(!w.document.querySelector('iframe'));
 w.usuarioLogado.role='vendedor';w._abrirCRM();assert(w.document.querySelector('#secao-crm iframe'));
 w.usuarioLogado.role='admin';w.licensed=false;w.TGModules.validate();assert(!w.document.querySelector('iframe'));
 }finally{close();}
});
test('revocation, logout and tenant switch remove existing frames',()=>{
 const {w,close}=setup();try{
 w._abrirCRM();w.usuarioLogado={id:'b',adminId:'tenant-b',role:'admin'};w.TGModules.validate();assert(!w.document.querySelector('iframe'));
 w._abrirCRM();w.admin.crmPlano=null;w.document.dispatchEvent(new w.Event('tg:interface-updated'));assert(!w.document.querySelector('iframe'));
 w.admin.crmPlano='mensal';w._abrirCRM();w.usuarioLogado=null;w.TGModules.validate();assert(!w.document.querySelector('iframe'));
 }finally{close();}
});
test('embedded checks bind the child to its host account and revoked access blocks saving',()=>{
 const {w,close}=setup();try{
 w._abrirCRM();const child=w.document.querySelector('#secao-crm iframe').contentWindow;
 child.document.write('<html data-tg-module="crm"><body></body></html>');child.eval(embed);child.usuarioLogado={id:'a',role:'admin'};
 child._tgModuleAssertAccess();assert(child.document.documentElement.classList.contains('tg-module-embedded'));
 child.usuarioLogado={id:'other',role:'admin'};assert.throws(()=>child._tgModuleAssertAccess(),/conta/);
 child.usuarioLogado={id:'a',role:'admin'};w.admin.crmPlano=null;assert.throws(()=>child._tgModuleAssertAccess(),/disponível/);
 }finally{close();}
});
test('saved records refresh only permitted tables from the active account frame',async()=>{
 const {w,close}=setup();try{
 w._abrirCRM();const child=w.document.querySelector('#secao-crm iframe').contentWindow;
 const send=(source,origin)=>w.dispatchEvent(new w.MessageEvent('message',{source,origin,data:{type:'tg-module-saved',name:'crm',columns:['clientes','servicos','perfis','clientes']}}));
 send(w,'https://totalgest.test');send(child,'https://evil.test');await new Promise(r=>setTimeout(r,0));assert.deepEqual(w.loaded,[]);
 send(child,'https://totalgest.test');await new Promise(r=>setTimeout(r,0));assert.deepEqual(w.loaded,['clientes','servicos']);assert(w.rendered);
 w.loaded=[];w._contarAlteracoesPendentes=()=>1;send(child,'https://totalgest.test');await new Promise(r=>setTimeout(r,0));assert.deepEqual(w.loaded,[]);
 }finally{close();}
});
test('real CRM and Assist pages initialize in the host and retain their existing forms',async()=>{
 for(const [name,file] of [['crm','TOTALGEST_CRM.html'],['assistencias','TOTALGEST_ASSIST.html']]){
  const {w,close}=setup();try{
   w.TGModules.open(name,name==='assistencias'?'request-1':undefined);
   const child=w.document.querySelector('#secao-'+name+' iframe').contentWindow;
   child.document.write(fs.readFileSync(file,'utf8'));
   const admin={id:'a',nome:'Admin',empresa:'Demo',ativo:true,crm_plano:'mensal',crm_expiracao:new Date(Date.now()+86400000).toISOString(),assist_plano:'mensal',assist_expiracao:new Date(Date.now()+86400000).toISOString()};
   const tables={administradores:[admin],perfis:[{papel:'admin',registo_id:'a'}],clientes:[{id:'c',admin_id:'a',nome:'Cliente Demo'}],assistencias:[{id:'request-1',admin_id:'a',cliente_id:'c',assunto:'Alarme',estado:'aberta',prioridade:'alta',data_criacao:new Date().toISOString()}]};
   child.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'auth-a'}}}})},from:table=>{
    const result={data:tables[table]||[],error:null};const query={select(){return this;},eq(){return this;},single:async()=>({data:result.data[0],error:null}),then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};return query;
   },functions:{invoke:async()=>({error:null})}})};
   child.eval(embed);
   for(const script of child.document.querySelectorAll('script:not([src])')) if(script.textContent.trim()) child.eval(script.textContent);
   child.document.dispatchEvent(new child.Event('DOMContentLoaded'));
   await new Promise(r=>setTimeout(r,260));
   assert.equal(child.document.getElementById('crmApp').style.display,'block',name+' app initializes');
   assert(child.document.documentElement.classList.contains('tg-module-embedded'));
   if(name==='crm'){
    child.abrirModalLead(null);assert(child.document.getElementById('modalGenericoOverlay').classList.contains('open'));assert(child.document.getElementById('modalGenericoCampos').innerHTML.includes('lead_'));
   }else{
    assert(child.document.getElementById('modalGenericoOverlay').classList.contains('open'));assert.match(child.document.getElementById('assistOsDescricao').value,/Alarme/);
   }
  }finally{close();}
 }
});
test('a table refresh from a former account does not overwrite the new account data',async()=>{
 const ctx=vm.createContext({usuarioLogado:{id:'a'},_tenantIdAtual:()=> 'a',M:{clientes:{tabela:'clientes',from:x=>x,to:x=>x}},dados:{clientes:[]},_snap:{},_guardarCacheLocal:()=>{},_buscarPaginadoGenerico:()=>new Promise(r=>ctx.resolve=r),supa:{from:()=>({select(){return this;},eq(){return this;}})},console});
 vm.runInContext(fn('carregarTabelaEspecifica'),ctx);const pending=ctx.carregarTabelaEspecifica('clientes');
 ctx.usuarioLogado={id:'b'};ctx.dados.clientes=[{id:'new-company'}];ctx.resolve({data:[{id:'old-company'}],error:null});await pending;
 assert.deepEqual(ctx.dados.clientes,[{id:'new-company'}]);
});
