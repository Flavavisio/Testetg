const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const html=fs.readFileSync('TOTALGEST_ASSIST.html','utf8');
const functions=['_assistResumoDados','_assistContactosRapidosHTML','adicionarNotaAssistencia'].map(name=>{
 const start=html.search(new RegExp('        (?:async )?function '+name+'\\('));const end=html.indexOf('\n        }',start);return html.slice(start,end+10);
}).join('\n');
const constants=['ASSIST_ESTADOS','ASSIST_PRIORIDADES'].map(name=>html.match(new RegExp('        const '+name+' = [^\\n]+'))[0]).join('\n');
const boot=`
 var usuarioLogado={id:'admin',nome:'Responsável',role:'admin'},tenant='a',calls=[],saves=0;
 let dados={clientes:[{id:'c1',adminId:'a',nome:'Farmácia Avenida',telefone:'210000000'},{id:'c2',adminId:'a',nome:'Condomínio Jardim'},{id:'foreign-c',adminId:'b',nome:'Cliente de outra empresa'}],locais:[{id:'l1',adminId:'a',clienteId:'c1',nome:'Loja Lisboa'}],servicos:[{id:'os1',adminId:'a',numeroRegisto:'OS-008',localId:'l1',data:'2026-10-28',hora:'09:00',dataCriacao:Date.now()-100000}],assistencias:[
 {id:'urgent',adminId:'a',numero:'AS-0248',clienteId:'c1',localId:'l1',assunto:'Alarme sem comunicação',descricao:'A central deixou de comunicar.\\nVerificar a ligação.',prioridade:'urgente',estado:'aberta',origem:'portal',dataCriacao:Date.now()-100000,notas:[{texto:'Cliente confirmou disponibilidade.',autor:'Ana',data:Date.now()-50000}]},
 {id:'progress',adminId:'a',numero:'AS-0247',clienteId:'c2',assunto:'Portão não abre',prioridade:'alta',estado:'andamento',atribuidoId:'f1',osGeradaId:'os1',dataCriacao:Date.now()-200000,notas:[]},
 {id:'resolved',adminId:'a',numero:'AS-0246',clienteId:'c1',assunto:'Câmara sem imagem',prioridade:'normal',estado:'resolvida',dataCriacao:Date.now()-300000,notas:[]},
 {id:'closed',adminId:'a',numero:'AS-0245',clienteId:'c2',assunto:'Pedido terminado',prioridade:'normal',estado:'fechada',dataCriacao:Date.now()-400000,notas:[]},
 {id:'foreign',adminId:'b',clienteId:'foreign-c',assunto:'DADOS DE OUTRA EMPRESA',estado:'aberta',notas:[]}]};
 function _tenantId(){return tenant}
 function escapeHtmlSimples(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function obterNomeFuncionario(id){return id==='f1'?'João Silva':id||'—'}
 function abrirModalAssistencia(id){calls.push(['edit',id])}
 function criarOSDeAssistencia(id){calls.push(['os',id])}
 function excluirAssistencia(id){calls.push(['delete',id])}
 function guardarDados(){saves++;return Promise.resolve()}
 function _notificarFuncionario(){calls.push(['notify'])}
 function _tgModuleAssertAccess(){calls.push(['access'])}
 function renderizarAssistencias(){TGAssistCentral.render()}
 ${constants}\n${functions}
 document.getElementById('crmApp').style.display='block';document.querySelectorAll('.secao-crm').forEach(e=>e.classList.remove('ativa'));document.getElementById('secao-assistencias').classList.add('ativa');
 renderizarAssistencias();
`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:1050},isMobile:width===390,hasTouch:width===390});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await context.route('**/*',route=>{
    const u=new URL(route.request().url()),name=decodeURIComponent(u.pathname.slice(1));
    if(u.origin!=='https://tg.test'||!fs.existsSync(name))return route.fulfill({status:404,body:''});
    let body=fs.readFileSync(name);
    if(name==='TOTALGEST_ASSIST.html')body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,tag=>/src="(?:tg-form-focus|tg-assist-central)\.js\?/.test(tag)?tag:'');
    return route.fulfill({contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript',body});
   });
   await page.goto('https://tg.test/TOTALGEST_ASSIST.html');
   await page.addScriptTag({content:boot});
   assert.equal(await page.locator('.ac-request').count(),4);
   assert.equal(await page.locator('#acList').getByText('DADOS DE OUTRA EMPRESA').count(),0);
   assert.equal(await page.locator('#acMetrics strong').allTextContents().then(v=>v.join(',')),'1,1,1,1');
   assert.equal(await page.locator('#acDetail').isVisible(),width>760);
   // Search is accent-insensitive and combines with filters; counters stay tenant-wide.
   await page.locator('#assistPesquisa').fill('farmacia');assert.equal(await page.locator('.ac-request').count(),2);
   await page.locator('#assistFiltroEstado').selectOption('aberta');assert.equal(await page.locator('.ac-request').count(),1);
   await page.locator('#assistPesquisa').fill('nenhum resultado');assert.equal(await page.locator('.ac-request').count(),0);
   await page.getByText('Sem resultados',{exact:true}).waitFor();
   await page.locator('#assistPesquisa').fill('');await page.locator('#assistFiltroEstado').selectOption('');
   await page.locator('[data-id=urgent]').click();
   assert.match(await page.locator('#acDetail').innerText(),/Loja Lisboa/);
   assert.equal(await page.locator('#acDetail [data-ac-action=os]').count(),1);
   // Desktop/mobile layout stays within viewport; mobile detail closes from deep scroll.
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(width===390){
    await page.locator('#acDetail').evaluate(e=>e.scrollTop=1000);
    const r=await page.locator('.ac-close').boundingBox();assert(r.y>=0&&r.y+r.height<=844);
    assert(await page.locator('body').evaluate(e=>e.classList.contains('ac-mobile-detail')));
   }
   await page.locator('.ac-close').click();assert.equal(await page.locator('#acDetail').isVisible(),false);
   assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('ac-mobile-detail')),false);
   await page.locator('[data-id=urgent]').click();
   await page.locator('#acNote').fill('Rascunho preservado');
   assert.equal(await page.evaluate(()=>TGAssistCentral.hasDraft()),true);
   await page.locator('[data-ac-action=history]').click();assert.equal(await page.locator('#acNote').inputValue(),'Rascunho preservado');
   assert.match(await page.locator('#acTabPanel').innerText(),/Cliente confirmou disponibilidade/);
   await page.locator('[data-ac-action=note]').click();
   await page.waitForFunction(()=>saves===1);
   assert.equal(await page.locator('#acNote').inputValue(),'');
   assert.equal(await page.evaluate(()=>TGAssistCentral.hasDraft()),false);
   assert.equal(await page.evaluate(()=>dados.assistencias.find(a=>a.id==='urgent').notas.length),2);
   await page.locator('[data-ac-action=os]').click();await page.locator('[data-ac-action=assign]').click();await page.locator('[data-ac-action=delete]').click();
   assert.deepEqual(await page.evaluate(()=>calls.filter(c=>['os','edit','delete'].includes(c[0]))),[['os','urgent'],['edit','urgent'],['delete','urgent']]);
   await page.locator('.ac-close').click();await page.locator('[data-id=progress]').click();
   assert.equal(await page.locator('#acDetail [data-ac-action=os]').count(),0);assert.match(await page.locator('.ac-linked').innerText(),/OS-008/);
   await page.locator('.ac-close').click();await page.locator('[data-id=closed]').click();assert.equal(await page.locator('#acDetail [data-ac-action=os]').count(),0);
   // User-controlled strings never create executable markup.
   await page.evaluate(()=>{dados.assistencias[0].assunto='<img src=x onerror="window.injected=1">';renderizarAssistencias()});
   assert.equal(await page.locator('.ac img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
   await page.evaluate(()=>{dados.assistencias[0].assunto='Alarme sem comunicação';renderizarAssistencias()});
   // Capture real UI in light/dark for visual inspection, then verify account isolation.
   await page.locator('.ac-close').click();await page.locator('[data-id=urgent]').click();
   fs.mkdirSync('../qa/assist-central',{recursive:true});
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:`../qa/assist-central/${width}-light.png`,fullPage:width>760});
   await page.locator('body').evaluate(e=>e.classList.add('dark-mode'));
   await page.screenshot({path:`../qa/assist-central/${width}-dark.png`,fullPage:width>760});
   await page.evaluate(()=>{tenant='b';renderizarAssistencias()});
   assert.equal(await page.locator('.ac-request').count(),1);assert.match(await page.locator('#acList').innerText(),/DADOS DE OUTRA EMPRESA/);
   assert(!String(await page.locator('#acDetail').innerText()).includes('Farmácia'));
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS Assist central: desktop/mobile, search and combined filters, counters, tenant switch, escaped data, notes/draft, existing edit/create/delete actions, linked/closed OS, close control, light/dark screenshots.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
