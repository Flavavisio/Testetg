const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=n=>source.match(new RegExp('        function '+n+'\\([^]*?\\n        \\}'))[0];
test('all five report groups toggle independently and retain selected reports',()=>{
 const w=new JSDOM('<section><div id="s_tipos_trabalho_cont"></div></section>',{runScripts:'outside-only'}).window;
 try {
 w._tenantId=()=> 'a';w.dados={tiposTrabalhoCustom:[]};
 w._sTiposDisponiveis=()=>['REX','RCCTV'].map(c=>({codigo:c,nome:c})).concat(['AVAC','Limpezas','Eletricidade'].flatMap((g,i)=>[0,1].map(n=>({codigo:g+n,nome:g+n,especialidade:g}))));
 w.eval("const TIPOS_TRABALHO_GRUPO_INCENDIO=['REX'],TIPOS_TRABALHO_GRUPO_SEGURANCA=['RCCTV'],TIPOS_TRABALHO_BASE=[{codigo:'REX'},{codigo:'RCCTV'}];"+fn('_tiposTrabalhoGrupoHtml')+fn('_osWizTornarAcordeaoTiposTrabalho'));
 const cont=w.document.getElementById('s_tipos_trabalho_cont');cont.innerHTML=w._tiposTrabalhoGrupoHtml('s-tipo-trabalho-chk',['AVAC0'],'');
 w._osWizTornarAcordeaoTiposTrabalho(w.document.querySelector('section'));
 assert.equal(cont.querySelectorAll('button').length,5);
 assert.equal(cont.querySelectorAll('input').length,8);
 for(const b of cont.querySelectorAll('button')){
  const body=b.parentElement.nextElementSibling;assert.equal(body.hidden,true);b.click();assert.equal(body.hidden,false);assert.equal(b.getAttribute('aria-expanded'),'true');b.click();assert.equal(body.hidden,true);
 }
 assert.equal(cont.querySelector('[value="AVAC0"]').checked,true);
 w._osWizTornarAcordeaoTiposTrabalho(w.document.querySelector('section'));assert.equal(cont.querySelectorAll('button').length,5);
 }finally{w.close();}
});
