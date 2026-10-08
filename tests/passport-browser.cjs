// Real browser with fictitious data. Does not log in or write to production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()]}));
(async()=>{
 const binary=process.env.CHROMIUM_BINARY;
 const opts=binary?{executablePath:binary,args:process.env.TG_CHROMIUM_ARGS?JSON.parse(process.env.TG_CHROMIUM_ARGS):['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu'],headless:true}:{headless:true};
 const browser=await chromium.launch(opts),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',route=>{if(route.request().url().includes('photo'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#d9e7ee"/><rect x="100" y="170" width="600" height="260" fill="#748da1"/><rect x="400" y="240" width="180" height="190" fill="#bdd0dd"/><path d="M50 170L400 50L750 170" fill="#3b5872"/><text x="400" y="380" text-anchor="middle" fill="#fff" font-size="40">ARMAZÉM</text></svg>'});return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><head><meta charset="utf-8"></head><body><div id="wsClienteOverlay" class="modal-overlay open" data-cliente-atual="c"><div class="modal" style="max-width:1400px;width:98vw;height:95vh;display:flex;flex-direction:column"><div id="wsClienteAbas"></div><div id="wsClienteConteudo" style="overflow:auto;flex:1;padding:20px"></div></div></div><div id="modalGenericoOverlay"><div id="modalGenericoCampos"></div></div></body></html>'});});
 await page.goto('https://tg.test/login.html');await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});await page.addStyleTag({content:fs.readFileSync('tg-passport.css','utf8')});
 const main=fs.readFileSync('app-principal.js','utf8');
 const mapping=['clientes','locais','equipamentos','servicos'].map(key=>{const a=main.indexOf('            '+key+': {',main.indexOf('const M ='));return main.slice(a,main.indexOf('\n            },',a)+15)}).join('\n');
 await page.addScriptTag({content:`
 var usuarioLogado={id:'a',role:'admin',nome:'Miguel Santos'};
 var dados={clientes:[{id:'c',adminId:'a',nome:'Cliente Demonstração',morada:'Rua da Receção'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Armazém — Cascais',morada:'Rua do Armazém',cidade:'Cascais',passaporteTecnico:{foto:'https://tg.test/photo-local.jpg',armario:'Piso 0 · junto à receção',acesso:'Acesso pela porta lateral. Contactar a receção.',contacto:'Responsável de manutenção',pendencias:'Câmara 03 com falhas intermitentes de imagem.',notas:'Fonte de alimentação substituída na última visita.',documentos:[{nome:'Esquema da rede CCTV',url:'https://tg.test/esquema.pdf'}]}}],equipamentos:[{id:'e',adminId:'a',clienteId:'c',localId:'l',tipo:'cctv',marca:'Uniview',numeroSerie:'DEMO-003',fichaTecnica:{nome:'Câmara 03 — Entrada',modelo:'Dome 8 MP',posicao:'Entrada / piso 0',ip:'192.168.1.103',porta:'Switch PoE · porta 3',estado:'avaria',foto:'https://tg.test/photo-camera.jpg'}},{id:'switch',adminId:'a',clienteId:'c',localId:'l',tipo:'rede',marca:'Switch PoE',fichaTecnica:{nome:'Switch PoE 01',modelo:'8 portas',posicao:'Armário técnico',ip:'192.168.1.2',estado:'operacional'}}],servicos:[{id:'os',adminId:'a',clienteId:'c',localId:'l',numeroRegisto:'INT-000124',descricao:'Verificar falhas de imagem na Câmara 03.',data:'2026-10-08',status:'pendente',funcionarioId:'f',funcionariosIds:['f'],checklist:{Rede:true},fotos:[{url:'https://tg.test/photo-intervencao.jpg'}]}],contratos:[],funcionarios:[]};
 var _snap={servicos:new Map()},_wsAbaAtual='passaporte',saved=0,alertMessages=[];
 var msToISO=ms=>ms==null?null:new Date(Number(ms)).toISOString(),isoToMs=iso=>iso==null?null:Date.parse(iso),nn=v=>(v===''||v===undefined)?null:v,hhmm=t=>t?String(t).slice(0,5):null;var M={${mapping}};
 function _licencaValidaTenant(){return true}function adminAtual(){return {}}function adminDoUtilizador(){return {}}function moduloContratosAtivo(){return true}function moduloAssistAtivo(){return true}function moduloArmazemAtivo(){return true}
 function escapeHtmlSimples(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 var supa={from:()=>({select(){return this},eq(){return this},order(){return this}})};
 async function _buscarPaginadoGenerico(){return {data:[{id:'old',admin_id:'a',cliente_id:'c',local_id:'l',numero_registo:'ANT-001',data:'2020-01-01',descricao:'Manutenção anterior',status:'concluído'}]}}
 async function guardarDados(){saved++}var counter=0;function gerarId(){return 'new-'+(++counter)}window.alert=v=>alertMessages.push(v);
 function _wsSairPara(){}function abrirVerOS(id){window.openedOS=id}function _osPedirFoto(id){window.photoOS=id}function _wsMarcarOS(id){window.newOS=id}
 function _wsResumoHtml(){return Promise.resolve('Resumo')}function _wsLocaisHtml(){return 'Locais'}function _wsOsHtml(){return Promise.resolve('OS')}function _wsObrasHtml(){return ''}function _wsContratosHtml(){return ''}function _wsRelatoriosHtml(){return ''}function _wsAssistenciasHtml(){return ''}function _wsEquipamentosHtml(){return ''}function _wsFinanceiroHtml(){return Promise.resolve('')}
 var TGClientHistory={show:async()=>{document.getElementById('wsClienteConteudo').innerHTML='<div>HISTÓRICO ORIGINAL</div>'}};
 ${main.match(/        const WS_CLIENTE_ABAS =[^\n]+/)[0]}
 ${main.match(/        const WS_CLIENTE_ABAS_LABEL =[^\n]+/)[0]}
 ${main.match(/        async function _wsClienteAba\([^]*?\n        \}/)[0]}
 `});
 await page.addScriptTag({content:fs.readFileSync('tg-passport.js','utf8')});
 await page.evaluate(()=>_wsClienteAba('c','passaporte'));await page.locator('[data-pp-site="l"]').click();await page.locator('h2',{hasText:'Armazém'}).waitFor();
 assert(await page.getByText('ANT-001',{exact:false}).count());assert.equal(await page.locator('.tg-pp-equipment-card').count(),2);
 await page.screenshot({path:'/tmp/tg-passport-desktop.png',fullPage:true});
 await page.locator('[data-pp-search]').fill('192.168.1.103');assert.equal(await page.locator('.tg-pp-equipment-card').count(),1);await page.locator('[data-pp-search]').fill('');
 await page.locator('[data-pp-action="intervention"][data-pp-id="os"]').click();await page.locator('[name="trabalho"]').fill('Substituição do conector RJ45.');await page.locator('[name="proximoTecnico"]').fill('Verificar o cabo junto à câmara se a falha regressar.');await page.locator('[data-pp-editor] button[type="submit"]').click();await page.getByText('Verificar o cabo junto à câmara se a falha regressar.',{exact:false}).first().waitFor();
 assert.equal(await page.evaluate(()=>dados.servicos[0].status),'pendente');assert.deepEqual(await page.evaluate(()=>dados.servicos[0].checklist),{Rede:true});
 await page.locator('[data-pp-action="history"]').click();assert(await page.getByText('HISTÓRICO ORIGINAL').count());
 await page.evaluate(()=>TGPassport.open('c','l'));await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/tg-passport-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const sectionOverflow=await page.locator('.tg-passport').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(sectionOverflow,false,'passport has horizontal overflow');
 await page.evaluate(()=>{usuarioLogado={id:'f',adminId:'a',role:'funcionario'};document.getElementById('wsClienteOverlay').classList.remove('open')});await page.evaluate(()=>TGPassport.open('c','l'));await page.locator('#tgPassportOverlay.open').waitFor();assert.equal(await page.locator('#tgPassportOverlay [data-pp-action="edit-equipment"]').count(),0);assert(await page.locator('#tgPassportOverlay [data-pp-action="intervention"]').count());
 await page.locator('[data-pp-close]').click();assert.equal(await page.locator('#tgPassportOverlay.open').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS desktop/mobile, original workspace tab, inventory filtering, intervention save, unchanged OS/checklist, preserved history, employee permissions, no horizontal overflow or browser errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
