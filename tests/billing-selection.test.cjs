const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app-principal.js'),'utf8');
test('one billing provider per company, PHC pending and drafts preserved',()=>{
 const dom=new JSDOM('<div id="modalGenericoOverlay"><div id="modalGenericoCampos"></div><div id="modalGenericoAcoes"></div></div>',{runScripts:'outside-only'});
 const w=dom.window;
 w.eval(`var usuarioLogado={role:'admin'};var dados={};var companies=[{integracaoFaturacao:{provider:'moloni',phcDrafts:{go:{company:'A'}}}},{integracaoFaturacao:{provider:'toconline'}}];var active=0;function adminAtual(){return companies[active]}function guardarDados(){}function alert(){};`);
 for(const n of ['_fatMostrarWizardEscolha','_fatEscolherProvider','_fatRenderCamposProvider','salvarConfigFaturacao','_fatMostrarResumo'])w.eval(src.match(new RegExp('        function '+n+'\\([^]*?\\n        \\}'))[0]);
 w._fatMostrarWizardEscolha();assert.equal(w.document.querySelectorAll('[name=fat_provider]').length,4);
 for(const p of ['phc_go','phc_cs','moloni','toconline','phc_cs']){
 w._fatEscolherProvider(p);assert.equal(w.document.querySelectorAll('[name=fat_provider]:checked').length,1);assert.equal(w.document.querySelector('[name=fat_provider]:checked').value,p);
 }
 w.salvarConfigFaturacao();assert.equal(w.eval('companies[0].integracaoFaturacao.provider'),'phc_cs');assert.equal(w.eval('companies[1].integracaoFaturacao.provider'),'toconline');assert.equal(w.eval('companies[0].integracaoFaturacao.phcDrafts.go.company'),'A');assert.match(w.document.body.textContent,/Ligação PHC por validar/);
 w._fatMostrarWizardEscolha();assert.equal(w.document.querySelector('[name=fat_provider]:checked').value,'phc_cs');
 w._fatEscolherProvider('phc_go');w.salvarConfigFaturacao();assert.equal(w.eval('companies[0].integracaoFaturacao.provider'),'phc_go');
 dom.window.close();
});
