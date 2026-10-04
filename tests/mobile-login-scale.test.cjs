const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const source=fs.readFileSync('app-principal.js','utf8');
const fn=name=>source.match(new RegExp('        function '+name+'\\([^]*?\\n        \\}'))[0];
test('mobile login releases keyboard and ignores saved desktop zoom; desktop retains its preference',()=>{
 const dom=new JSDOM('<div id="tg-entrar"><input id="landSenha"></div><input id="editCustomer"><span id="labelZoom"></span>',{url:'https://totalgest.test/login.html',runScripts:'outside-only'}),w=dom.window;
 try{
 let mobile=true;w.matchMedia=()=>({matches:mobile});w.localStorage.setItem('tg_zoom','80');
 w.eval('const _NIVEIS_ZOOM=[100,90,80];\n'+['_zoomAutomaticoMobile','_aplicarZoom','_aplicarZoomGuardado','_prepararVistaAposLogin'].map(fn).join('\n'));
 const input=w.document.getElementById('landSenha');input.focus();assert.equal(w.document.activeElement,input);w._prepararVistaAposLogin();assert.notEqual(w.document.activeElement,input);assert.equal(w.document.documentElement.style.zoom,'100%');assert.equal(w.document.getElementById('labelZoom').textContent,'100%');assert.equal(w.document.documentElement.style.getPropertyValue('--tg-zoom-compensa'),'100%');
 const editor=w.document.getElementById('editCustomer');editor.focus();w._prepararVistaAposLogin();assert.equal(w.document.activeElement,editor);
 mobile=false;w._prepararVistaAposLogin();assert.equal(w.document.documentElement.style.zoom,'80%');assert.equal(w.localStorage.getItem('tg_zoom'),'80');
 }finally{w.close();}
});
