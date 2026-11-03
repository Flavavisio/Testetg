/* Run with a locally installed Playwright Chromium; no live customer session. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom'),{chromium}=require('playwright');
(async()=>{
 const host=new JSDOM('<body></body>',{runScripts:'outside-only'}).window;host.REPORT_TEMPLATES={};
 for(const file of ['tg-specialty-catalog.js','tg-specialty-templates.js'])host.eval(fs.readFileSync(file,'utf8'));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--single-process']});
 try{
  const page=await browser.newPage(),results=[];
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});
   for(const [code,html]of Object.entries(host.TGNativeReportModels.models.RELE)){
    await page.setContent(html);await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{source:window.parent,data:{type:'init',cliente:'Cliente QA',empresaNome:'Empresa QA',empresaFiscal:'Nome fiscal QA',tecnicoNome:'Técnico QA',podeAssinar:true}})));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+'px '+code);
    if(code==='Relatório de exploração'){
     assert.equal(await page.locator('.seg').count(),23);await page.locator('#electric-pt_app').selectOption('Sim');assert(await page.locator('#electric-pt_unique').isVisible());await page.locator('#electric-pt_app').selectOption('Não');assert.equal(await page.locator('#electric-pt_unique').isVisible(),false);
     fs.mkdirSync('/tmp/electrical-qa',{recursive:true});await page.screenshot({path:'/tmp/electrical-qa/form-'+width+'.png'});
    }
    results.push({width,code,checks:await page.locator('.seg').count()});
   }
  }
  console.log(JSON.stringify(results));
 }finally{await browser.close();host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
