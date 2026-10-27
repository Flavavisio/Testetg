const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync('app-principal.js', 'utf8');
const functions = ['criarFolhaDaObra', 'criarFolhaDaOS', '_horasBloqueadasHTML', '_foEscolherMateriais']
  .map(name => source.match(new RegExp('        function ' + name + '\\([^]*?\\n        \\}'))[0]).join('\n');
const shell = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="responsive-device.css">
<link id="tg-form-focus-style" rel="stylesheet" href="tg-form-focus.css?v=1.2.0">
<script src="tg-form-focus.js?v=1.2.0"></script></head><body>
<div class="modal-overlay" id="modalOverlay"><div class="modal"><h3 id="modalTitulo"></h3>
<form><div id="modalCampos"></div><button id="modalSubmitBtn">Criar Folha</button></form></div></div></body></html>`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_BINARY, args: ['--no-sandbox'] });
  try {
    for (const mobile of [true, false]) {
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
      await context.route('**/*', route => {
        const name = new URL(route.request().url()).pathname.slice(1);
        if (!name) return route.fulfill({ contentType: 'text/html', body: shell });
        return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(name) });
      });
      const page = await context.newPage();
      await page.goto('https://tg.test/');
      await page.addScriptTag({ content: `
        var dados = {obras:[{id:'obra',nome:'Obra teste'}],servicos:[{id:'os',descricao:'OS teste',obraId:'obra'}]};
        var usuarioLogado={id:'tecnico',role:'funcionario'},_folhaOSPendente={terminou:false};
        var _folhaObraPendente,_foHorasCorrigidasManualmente,entidadeAtual,_foMatExtra,idEditando;
        var escapeHtmlSimples = s=>s, getDataHoje=()=> '2026-10-24', expressAtivo=()=>false, adminDoUtilizador=()=>({});
        var _quemEsteveNaObraHTML=()=>'',_quemEsteveNaOSHTML=()=>'',_especialidadesEfetuadasTexto=()=>'';
        var _horasPicadasObra=()=>2,_horasPicadasOS=()=>2,_horasFmt=()=> '2h',_gerarOpcoesHoras=()=>'<option value="2">2h</option>';
        var renderPlanoConsumoFolha=()=>document.getElementById('fo_plano_materiais').innerHTML='<input id="material_nome" placeholder="Material"><input type="number" id="material_qtd" value="2">';
        ${functions}` });
      for (const kind of ['obra', 'os']) {
        for (const zoom of [1, .9, .8]) {
          await page.evaluate(({kind,zoom}) => {
            document.querySelector('.modal').style.zoom = zoom;
            if (kind === 'obra') criarFolhaDaObra('obra',false); else criarFolhaDaOS('os');
            _foEscolherMateriais(true);
          }, {kind,zoom});
          for (const id of ['fo_obra_desc','fo_descricao','fo_materiais','fo_data','material_nome','material_qtd']) {
            const field = page.locator('#'+id);
            const event = await field.evaluate(el => {
              const event = new PointerEvent('pointerdown', {bubbles:true,cancelable:true});
              el.dispatchEvent(event);
              return {prevented:event.defaultPrevented,size:parseFloat(getComputedStyle(el).fontSize),min:el.style.getPropertyValue("--tg-form-focus-min"),zoom:getComputedStyle(el.closest(".modal")).zoom};
            });
            assert.equal(event.prevented,false);
            if (mobile) assert(event.size*zoom>=16,kind+' '+id+' at '+zoom+' must be readable before focus; '+JSON.stringify(event));
          }
          await page.locator('#fo_descricao').fill('Trabalho registado, manter rascunho');
          await page.locator('#fo_materiais').fill('2 sensores');
          assert.equal(await page.locator('#fo_descricao').inputValue(),'Trabalho registado, manter rascunho');
          assert.equal(await page.locator('#material_qtd').inputValue(),'2');
          assert.equal(await page.locator('.modal').evaluate(el=>parseFloat(el.style.zoom)),zoom);
          assert.equal(await page.evaluate(()=>visualViewport.scale),1);
        }
      }
      if (mobile) {
        // Model a browser page reduced to 80%, separately from CSS container zoom.
        await page.evaluate(()=>{
          document.querySelector('.modal').style.zoom=1;
          Object.defineProperty(screen,'width',{configurable:true,value:visualViewport.width*.8});
        });
        await page.locator('#fo_descricao').dispatchEvent('pointerdown');
        assert.equal(await page.locator('#fo_descricao').evaluate(el=>getComputedStyle(el).fontSize),'20px');
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('#fo_descricao').evaluate(el=>getComputedStyle(el).fontSize),'16px');
      }
      assert(!/maximum-scale|user-scalable/.test(await page.locator('meta[name=viewport]').getAttribute('content')));
      await context.close();
    }
    console.log('PASS: actual Obra/OS sheet renderers, dynamic materials, 100/90/80% sizing before focus, simulated page reduction, preserved zoom/drafts/quantities/printing.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
