const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = process.cwd();
const fixture = '<div class="form-group orc-linha-produto"><input id="text" style="font-size:12px" value="Rascunho"><textarea id="notes" style="font-size:13px">Notas</textarea><select id="choice" style="font-size:14px"><option>Opção</option></select><div id="editable" contenteditable="true" style="font-size:12px">Texto editável</div><button id="button" style="font-size:12px">Guardar</button></div>';
const pages = ['index.html', 'login.html', 'TOTALGEST_CRM.html', 'TOTALGEST_ASSIST.html', 'TOTALGEST_RONDAS.html', 'TOTALGEST CRM.html', 'equip.html', 'redefinir-password.html'];
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_BINARY, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try {
  for (const mobile of [false,true]) {
   const context = await browser.newContext({viewport:{width:mobile?390:1440,height:900},hasTouch:mobile,isMobile:mobile});
   await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin !== 'https://tg.test') return route.fulfill({status:404,body:''});
    const name = decodeURIComponent(u.pathname.slice(1));
    if (pages.includes(name)) {
     const source = fs.readFileSync(name,'utf8');
     let head = source.slice(source.indexOf('<head>')+6,source.indexOf('</head>'));
     head = head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, tag=>tag.includes('src="tg-form-focus.js?')?tag:'');
     return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head>'+head+'</head><body>'+fixture+'</body></html>'});
    }
    const local = path.join(root,name);
    if (!fs.existsSync(local)||!fs.statSync(local).isFile()) return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(local),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/octet-stream'});
   });
   const page = await context.newPage();
   for (const name of pages) {
    await page.goto('https://tg.test/'+encodeURIComponent(name));
    for (const [id,original] of [['text',12],['notes',13],['choice',14],['editable',12]]) {
     assert.equal(await page.locator('#'+id).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),mobile?16:original,name+' '+id);
    }
    await page.locator('#text').focus();
    assert.equal(await page.locator('#text').inputValue(),'Rascunho');
    assert.equal(await page.evaluate(()=>visualViewport.scale),1);
    assert.equal(await page.locator('#button').evaluate(el=>getComputedStyle(el).fontSize),'12px');
    assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(await page.locator('meta[name="viewport"]').getAttribute('content')));
   }
   await page.goto('https://tg.test/login.html');
   if (mobile) {
    // Wide touch screens use the same sizing even beyond the phone breakpoint.
    await page.setViewportSize({width:1024,height:900});
    assert.equal(await page.locator('#text').evaluate(el=>getComputedStyle(el).fontSize),'16px');
   } else {
    await page.evaluate(()=>document.documentElement.style.zoom='80%');
    await page.locator('#text').focus();assert.equal(await page.evaluate(()=>document.documentElement.style.zoom),'80%');
   }
   const report='<html><head><style>input{font-size:11px} @media print{input{font-size:8px}}</style></head><body><input id="report" value="Relatório em curso"></body></html>';
   await page.evaluate(html=>{const f=document.createElement('iframe');f.id='report-frame';f.style.width='100%';f.srcdoc=html;document.body.append(f)},report);
   const frame = page.frameLocator('#report-frame');
   await page.waitForFunction(()=>document.querySelector('#report-frame').contentDocument.querySelector('#tg-form-focus-style')?.sheet);
   assert.equal(await frame.locator('#report').evaluate(el=>getComputedStyle(el).fontSize),mobile?'16px':'11px');
   assert.equal(await frame.locator('#report').inputValue(),'Relatório em curso');
   await page.evaluate(html=>document.querySelector('#report-frame').srcdoc=html,report);
   await page.waitForFunction(()=>document.querySelector('#report-frame').contentDocument.querySelector('#tg-form-focus-style')?.sheet);
   assert.equal(await frame.locator('#tg-form-focus-style').count(),1);
   await frame.locator('body').evaluate(body=>{const f=body.ownerDocument.createElement('iframe');f.id='nested';f.style.width='100%';f.srcdoc='<input id="nested-input" style="font-size:10px" value="Preservado">';body.append(f)});
   await page.waitForFunction(()=>document.querySelector('#report-frame').contentDocument.querySelector('#nested').contentDocument.querySelector('#tg-form-focus-style')?.sheet);
   assert.equal(await frame.frameLocator('#nested').locator('#nested-input').evaluate(el=>getComputedStyle(el).fontSize),mobile?'16px':'10px');
   if (mobile) {
    // iPad landscape reports a portrait screen width on some Safari versions.
    // Keyboard/split view resize must not inflate fields or retain inflation.
    await page.setViewportSize({width:1366,height:768});
    await page.evaluate(()=>Object.defineProperty(screen,'width',{configurable:true,value:768}));
    for (const height of [400,768,400,768]) {
     await page.setViewportSize({width:1366,height});
     for (const target of [page.locator('#text'),frame.locator('#report'),frame.frameLocator('#nested').locator('#nested-input')]) {
      await target.dispatchEvent('pointerdown');
      assert.equal(await target.evaluate(el=>getComputedStyle(el).fontSize),'16px','Landscape/keyboard must not enlarge fields');
     }
    }
   }
   await page.emulateMedia({media:'print'});
   assert.equal(await frame.locator('#report').evaluate(el=>getComputedStyle(el).fontSize),'8px');
   assert.equal(await frame.locator('#report').inputValue(),'Relatório em curso');
   await context.close();
  }
  console.log('PASS: eight app/module pages on mobile and desktop, wide touch screens, dynamic and nested report frames, preserved drafts/zoom/print typography.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
