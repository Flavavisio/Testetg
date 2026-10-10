// Real browser, fictitious fixtures and no connection to production.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()]}));
(async()=>{
 const opts=process.env.CHROMIUM_BINARY?{executablePath:process.env.CHROMIUM_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}:{headless:true};
 const browser=await chromium.launch(opts),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 const main=fs.readFileSync('app-principal.js','utf8'),testSource=fs.readFileSync('tests/contract-maintenance.test.cjs','utf8');
 const fixture=testSource.slice(testSource.indexOf(' w.usuarioLogado='),testSource.indexOf(" w.eval('var")).replaceAll('w.','window.');
 const names=[...testSource.match(/w\.eval\('var[^]*?\+\[([^]*?)\]\.map\(fn\)/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const functions=names.map(name=>main.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0]).join('\n');
 await page.setContent('<html lang="pt"><head><meta charset="utf-8"></head><body><div id="modalContratoOverlay" class="modal-overlay open"><div class="modal" style="max-width:900px"><div class="modal-header"><h2 id="modalContratoTitulo"></h2></div><div class="modal-body" id="modalContratoCampos"></div></div></div><div id="modalGerarOSCampos"></div><div id="modalGerarOSOverlay"></div></body></html>');
 await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
 await page.addScriptTag({content:fixture+'\nlet contratoEditandoId=null,_ctEquipamentosAtuais=[],gerarOSContratoId=null,registoContratoId=null;\n'+functions});
 await page.addScriptTag({content:fs.readFileSync('tg-contract-maintenance.js','utf8')});await page.evaluate(()=>abrirModalContrato('ct'));
 assert.equal(await page.locator('[data-ct-tab]').count(),4);await page.locator('[data-ct-tab="plano"]').click();assert(await page.locator('#ct_plano_extra').isVisible());assert(!await page.locator('#ct_comercial_extra').isVisible());assert.equal(await page.locator('[data-ct-system]').count(),2);
 await page.screenshot({path:'/tmp/tg-contract-plan-desktop.png',fullPage:true});
 await page.locator('[data-ct-tab="cobertura"]').click();await page.locator('button',{hasText:'Adicionar todos das instalações'}).click();assert.equal(await page.locator('#ct_equip_lista > span').count(),3);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/tg-contract-coverage-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('[data-ct-tab="resumo"]').click();await page.locator('#ct_labor').selectOption('limitada');await page.locator('#ct_horas').fill('12');await page.evaluate(()=>salvarContrato());assert.equal(await page.evaluate(()=>c.gestaoManutencao.servicos.horasAno),12);assert.equal(await page.evaluate(()=>c.gestaoManutencao.plano[0].periodicidade),'trimestral');
 assert.deepEqual(errors,[]);process.stdout.write('Desktop/mobile contract tabs, coverage, plans and saving passed.\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
