const fs=require('fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'))[0];
const context=vm.createContext({window:{innerWidth:390},usuarioLogado:{id:'a',role:'admin'},dados:{administradores:[{id:'a',layout:'aurora'}]},obterConfig:()=>({layout:'aurora'}),_dispositivoEhMobile:()=>true});
vm.runInContext(fn('obterLayout')+'\n'+fn('_ehPerfilMobile'),context);
assert.equal(vm.runInContext('obterLayout()',context),'aurora');assert.equal(vm.runInContext('_ehPerfilMobile()',context),false);
vm.runInContext("dados.administradores[0].layout='foco'",context);assert.equal(vm.runInContext('obterLayout()',context),'cards');assert.equal(vm.runInContext('_ehPerfilMobile()',context),true);
vm.runInContext("usuarioLogado={id:'s',role:'superadmin'}",context);assert.equal(vm.runInContext('obterLayout()',context),'aurora');
const dom=new JSDOM('<body class="com-sidebar"><aside id="tgSidebar"><div class="tg-side-brand"></div><nav id="tgSidebarNav"></nav></aside><div id="tgHome"><div class="tgm-panel tgm-panel--dia"><h2 class="tgm-title">O Meu Dia</h2><div>Hoje</div></div></div><div id="cardsGrid"></div></body>',{url:'https://totalgest.test/',runScripts:'outside-only'}),w=dom.window;
w.usuarioLogado={id:'a',role:'admin'};w.obterLayout=()=> 'aurora';let licensed=true;w._licencaValidaTenant=()=>licensed;w._fecharSidebarMobile=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
function add(id,title,cls='') {const card=w.document.createElement('div');card.className='card-principal '+cls;card.dataset.card=id;card.innerHTML='<div class="info"><h3></h3><p>4 pendentes</p></div>';card.querySelector('h3').textContent=title;card.onclick=()=>w.last=id;w.document.getElementById('cardsGrid').appendChild(card);return card;}
const services=add('servicos','Ordens de Serviço'),reports=add('relatorio-os','Relatórios'),hidden=add('artigos','Stock','hidden-card'),locked=add('crm','CRM','card-bloqueado');add('clientes','<img src=x onerror=bad>');
w.eval(fs.readFileSync('tg-nexus.js','utf8'));assert.equal(w.document.querySelectorAll('.nx-module').length,3);assert(!w.document.querySelector('#nexusWorkspace img'));
w.TGNexus.open();assert.equal(w.document.querySelectorAll('.nx-result').length,3);const query=w.document.getElementById('nexusQuery');query.value='relatorios';query.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('.nx-result').length,1);
reports.classList.add('hidden-card');w.document.querySelector('.nx-result').click();assert.equal(w.last,undefined);assert.equal(w.document.querySelectorAll('.nx-result').length,0);
w.TGNexus.close();w.document.querySelector('.nx-module[data-nx-open="servicos"]').click();assert.equal(w.last,'servicos');assert(w.localStorage.getItem('tg_nexus:["a","a"]'));
w.document.querySelector('[data-nx-density]').click();assert(w.document.body.classList.contains('nx-comfortable'));w.document.querySelector('[data-nx-fold]').click();assert(w.document.querySelector('.tgm-panel').classList.contains('nx-folded'));w.TGNexus.refresh();assert(w.document.querySelector('.tgm-panel').classList.contains('nx-folded'));
w.usuarioLogado={id:'b',adminId:'company-b',role:'funcionario'};w.TGNexus.refresh();assert(!w.document.body.classList.contains('nx-comfortable'));assert(!w.document.querySelector('.tgm-panel').classList.contains('nx-folded'));w.TGNexus.open();licensed=false;query.value='servico';query.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('.nx-result').length,0);
w.usuarioLogado=null;w.TGNexus.refresh();assert(!w.document.body.classList.contains('tg-nexus'));assert(!w.document.getElementById('nexusSearchDialog').open);

// Six chosen shortcuts stay fixed when modules are opened and refreshed.
licensed=true;w.usuarioLogado={id:'a',role:'admin'};reports.classList.remove('hidden-card');
add('assistencias','Assistências');add('agenda','Agenda');add('obras-longa','Obras');const fleet=add('frota','Frota');
const ids=()=>[...w.document.querySelectorAll('.nx-module')].map(e=>e.dataset.nxOpen);
const defaults=['clientes','servicos','assistencias','agenda','obras-longa','relatorio-os'];
w.TGNexus.refresh();assert.deepEqual(ids(),defaults);
w.document.querySelector('[data-nx-open="relatorio-os"]').click();w.TGNexus.refresh();assert.deepEqual(ids(),defaults);
const edit=()=>w.document.querySelector('[data-nx-shortcuts]').click();
const choose=(i,id)=>{const select=w.document.getElementById('nexusSlot'+i);select.value=id;select.dispatchEvent(new w.Event('change',{bubbles:true}));};
edit();assert.equal(w.document.querySelectorAll('[data-nx-slot]').length,6);
assert(!w.document.querySelector('#nexusShortcutRows img'));
assert(![...w.document.querySelectorAll('#nexusSlot0 option')].some(o=>o.value==='crm'||o.value==='artigos'));
choose(0,'frota');w.document.querySelector('[data-nx-shortcuts-close]').click();assert.deepEqual(ids(),defaults);
edit();choose(0,'frota');w.document.querySelector('[data-nx-move="0"][data-nx-direction="1"]').click();
w.document.querySelector('[data-nx-shortcuts-save]').click();
const custom=['servicos','frota','assistencias','agenda','obras-longa','relatorio-os'];assert.deepEqual(ids(),custom);
w.TGNexus.refresh();assert.deepEqual(ids(),custom);edit();assert.equal(w.document.getElementById('nexusSlot1').value,'frota');
// Revoked access is caught before saving, and inaccessible modules never open.
fleet.classList.add('hidden-card');w.document.querySelector('[data-nx-shortcuts-save]').click();
assert(w.document.getElementById('nexusShortcutsDialog').open);assert(w.document.getElementById('nexusShortcutsStatus').textContent.includes('mudaram'));
w.document.querySelector('[data-nx-shortcuts-close]').click();fleet.classList.remove('hidden-card');
// Restoring is staged; cancelling preserves the saved configuration.
edit();w.document.querySelector('[data-nx-shortcuts-reset]').click();w.document.querySelector('[data-nx-shortcuts-close]').click();w.TGNexus.refresh();assert.deepEqual(ids(),custom);
edit();w.document.querySelector('[data-nx-shortcuts-reset]').click();w.document.querySelector('[data-nx-shortcuts-save]').click();assert.deepEqual(ids(),defaults);
// Tenant/user switches close the editor and isolate saved choices.
edit();w.usuarioLogado={id:'b',adminId:'company-b',role:'funcionario'};w.TGNexus.refresh();assert(!w.document.getElementById('nexusShortcutsDialog').open);assert.deepEqual(ids(),defaults);
edit();choose(0,'frota');w.document.querySelector('[data-nx-shortcuts-save]').click();assert.equal(ids()[0],'frota');
w.usuarioLogado={id:'a',role:'admin'};w.TGNexus.refresh();assert.deepEqual(ids(),defaults);
// Storage failures keep the dialog open with an actionable message.
edit();const originalSet=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(){throw new Error('blocked');};
w.document.querySelector('[data-nx-shortcuts-save]').click();assert(w.document.getElementById('nexusShortcutsDialog').open);assert(w.document.getElementById('nexusShortcutsStatus').textContent.includes('Não foi possível guardar'));w.Storage.prototype.setItem=originalSet;
w.usuarioLogado=null;w.TGNexus.refresh();assert(!w.document.getElementById('nexusShortcutsDialog').open);
w.close();console.log('PASS Nexus: mobile layout, previous layouts, superadmin, restricted modules, safe titles, accent search, revoked access, original actions, account-scoped preferences, collapse, expired license, logout.');
