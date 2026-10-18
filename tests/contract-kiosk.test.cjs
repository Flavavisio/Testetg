const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const fixture=fs.readFileSync('tests/contract-maintenance.test.cjs','utf8');
const setup=new Function('require',fixture.slice(0,fixture.indexOf("\ntest("))+';return setup;')(require);
function dialogSupport(w){
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.dados.clientes=[{id:'c',adminId:'a',nome:'Cliente inicial'},...Array.from({length:75},(_,i)=>({id:'c'+i,adminId:'a',numeroCliente:String(1000+i),nome:i===74?'Álvaro <img src=x>':'Cliente '+i})),{id:'alien',adminId:'z',nome:'SEGREDO'}];
 w._clienteLabel=c=>[c.numeroCliente,c.nome].filter(Boolean).join(' - ');
 w._licencaValidaTenant=()=>w.license!==false;
 w.abrirModalContrato('ct');
}
test('current hidden-ID contract picker shows every company customer and searches beyond the old 40-row limit',()=>{
 const w=setup();try{dialogSupport(w);w.document.getElementById('ct-client-open').click();const d=w.document.getElementById('ct-client-picker');assert(d.open);assert.equal(d.querySelectorAll('button').length,77);assert(!d.textContent.includes('SEGREDO'));assert.equal(d.querySelector('img'),null);
 const q=d.querySelector('input');q.value='alvaro';q.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('button').length,2);assert(d.textContent.includes('1074 - Álvaro <img src=x>'));
 q.value='1005';q.dispatchEvent(new w.Event('input'));assert(d.textContent.includes('1005 - Cliente 5'));assert(!d.textContent.includes('1074'));
 }finally{w.close();}
});
test('selection updates hidden ID, visible label and retained-label marker; clears the former installation and equipment',()=>{
 const w=setup();try{dialogSupport(w);let saved=false;w.guardarDados=()=>{saved=true;};w.document.getElementById('ct_local').dataset.cliente='c';w.document.getElementById('ct-client-open').click();const d=w.document.getElementById('ct-client-picker');[...d.querySelectorAll('button')].find(b=>b.textContent==='1074 - Álvaro <img src=x>').click();
 assert.equal(w.document.getElementById('ct_cliente').value,'c74');assert.equal(w.document.getElementById('ct_cliente_busca').value,'1074 - Álvaro <img src=x>');assert.equal(w.document.getElementById('ct_cliente_busca').dataset.selecionadoLabel,'1074 - Álvaro <img src=x>');assert.equal(w.document.getElementById('ct_local').value,'');assert.deepEqual(Array.from(w.eval('_ctEquipamentosAtuais')),[]);assert(!w.document.getElementById('ct-client-picker'));assert(!saved);
 }finally{w.close();}
});
test('search-empty state and close leave the contract unchanged',()=>{
 const w=setup();try{dialogSupport(w);w.document.getElementById('ct-client-open').click();const d=w.document.getElementById('ct-client-picker'),q=d.querySelector('input');q.value='impossivel';q.dispatchEvent(new w.Event('input'));assert(d.textContent.includes('Nenhum cliente encontrado'));[...d.querySelectorAll('button')].find(b=>b.textContent==='Fechar').click();assert.equal(w.document.getElementById('ct_cliente').value,'c');
 }finally{w.close();}
});
test('legacy select form still dispatches its existing change handler once',()=>{
 const w=setup();try{dialogSupport(w);const hidden=w.document.getElementById('ct_cliente');const select=w.document.createElement('select');select.id='ct_cliente';select.innerHTML='<option value="c">Cliente inicial</option><option value="c0">1000 - Cliente 0</option><option value="alien">SEGREDO</option>';hidden.replaceWith(select);let changed=0;select.addEventListener('change',()=>changed++);w.document.getElementById('ct-client-open').click();const d=w.document.getElementById('ct-client-picker');assert(!d.textContent.includes('SEGREDO'));[...d.querySelectorAll('button')].find(b=>b.textContent==='1000 - Cliente 0').click();assert.equal(select.value,'c0');assert.equal(changed,1);
 }finally{w.close();}
});
test('account switch, revoked license and removed customer cannot apply stale picker selections',()=>{
 for(const mode of ['account','license','removed']){const w=setup();try{dialogSupport(w);w.document.getElementById('ct-client-open').click();const d=w.document.getElementById('ct-client-picker'),target=[...d.querySelectorAll('button')].find(b=>b.textContent==='1000 - Cliente 0');if(mode==='account')w.usuarioLogado={id:'b',role:'admin'};if(mode==='license')w.license=false;if(mode==='removed')w.dados.clientes=w.dados.clientes.filter(c=>c.id!=='c0');target.click();assert.equal(w.document.getElementById('ct_cliente').value,'c');assert(!w.document.getElementById('ct-client-picker'));}finally{w.close();}}
});
const main=fs.readFileSync('app-principal.js','utf8');
const fn=name=>main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0];
function kiosk(){const w=new JSDOM('<select id="qs_obra"></select><div id="qs_geo_status"></div><input id="qs_password_saida"><div id="modalQuiosqueSetupOverlay"></div>',{runScripts:'outside-only'}).window;w.usuarioLogado={id:'u',adminId:'a',role:'admin'};w.admin={id:'a'};w.adminAtual=()=>w.admin;w.adminDoUtilizador=()=>w.admin;w._licencaValidaTenant=()=>w.licensed!==false;w.moduloArmazemAtivo=()=>w.module!==false;w._tenantQuiosque=()=> 'a';w._quiosqueRenderPessoasSetup=()=>{};w.dados={obras:[]};w.alert=()=>{};w.eval('let _quiosqueGeoTemp;'+['_podeAtivarQuiosque','ativarModoQuiosque'].map(fn).join('\n'));return w;}
test('kiosk setup rechecks manager roles, active license and warehouse entitlement without writing data',()=>{
 const w=kiosk();try{
 for(const role of ['admin','subadmin','encarregado']){w.usuarioLogado.role=role;assert.equal(w._podeAtivarQuiosque(),true);w.ativarModoQuiosque();assert(w.document.getElementById('modalQuiosqueSetupOverlay').classList.contains('open'));w.document.getElementById('modalQuiosqueSetupOverlay').classList.remove('open');}
 for(const role of ['funcionario','cliente','vendedor','vigilante','superadmin']){w.usuarioLogado.role=role;assert.equal(w._podeAtivarQuiosque(),false);w.ativarModoQuiosque();assert(!w.document.getElementById('modalQuiosqueSetupOverlay').classList.contains('open'));}
 w.usuarioLogado.role='admin';w.licensed=false;assert(!w._podeAtivarQuiosque());w.licensed=true;w.module=false;assert(!w._podeAtivarQuiosque());w.module=true;w.admin.ehDistribuidor=true;assert(!w._podeAtivarQuiosque());w.usuarioLogado=null;assert(!w._podeAtivarQuiosque());
 }finally{w.close();}
});
test('kiosk entry exists in both app shells and routes through the original activation gate',()=>{
 for(const f of ['index.html','login.html']){const d=new JSDOM(fs.readFileSync(f,'utf8')).window.document,card=d.querySelector('[data-grupo="equipa"] [data-card="quiosque"]');assert(card);assert(card.classList.contains('hidden-card'));assert.equal(card.getAttribute('onclick'),"abrirSecao('quiosque')");assert.equal(d.getElementById('btnQuiosque').getAttribute('onclick'),'ativarModoQuiosque()');}
 assert.match(fn('abrirSecao'),/nome === 'quiosque'.*ativarModoQuiosque\(\); return;/);assert.match(fn('ajustarVisibilidadeCards'),/cardName === 'quiosque'[\s\S]*?_podeAtivarQuiosque/);
});
test('long kiosk lists keep vertical overflow and nonshrinking content',()=>{
 const d=new JSDOM('<style>'+fs.readFileSync('styles.css','utf8')+'</style><div id="tgQuiosqueOverlay" class="aberto"><div id="tgqGrid">'+Array.from({length:80},()=>'<button>Pessoa</button>').join('')+'</div></div>').window;
 try{const overlay=d.getComputedStyle(d.document.getElementById('tgQuiosqueOverlay')),grid=d.getComputedStyle(d.document.getElementById('tgqGrid'));assert.equal(overlay.overflowY,'auto');assert.equal(grid.flexShrink,'0');assert.equal(grid.maxHeight,'none');}finally{d.close();}
});
test('the actual card visibility rules show kiosk only to entitled managers',()=>{
 const w=kiosk();try{
 const card=w.document.createElement('div');card.className='card-principal hidden-card';card.dataset.card='quiosque';w.document.body.appendChild(card);
 w.moduloFrotaAtivo=()=>false;w.moduloCrmAtivo=()=>false;w._utilizadorTemVeiculo=()=>false;w.moduloRondasAtivo=()=>false;w.expressAtivo=()=>false;
 w.eval(fn('ajustarVisibilidadeCards'));
 for(const role of ['admin','subadmin','encarregado','funcionario','cliente','vendedor','vigilante','supervisor_vigilantes','superadmin']){
  w.usuarioLogado.role=role;w.ajustarVisibilidadeCards();assert.equal(!card.classList.contains('hidden-card'),['admin','subadmin','encarregado'].includes(role),role);
 }
 w.usuarioLogado.role='admin';w.module=false;w.ajustarVisibilidadeCards();assert(card.classList.contains('hidden-card'));w.module=true;w.licensed=false;w.ajustarVisibilidadeCards();assert(card.classList.contains('hidden-card'));
 }finally{w.close();}
});
