const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
const source=fs.readFileSync('app-principal.js','utf8');
const helpers=source.slice(source.indexOf('        function _tgAssinaturasRascunhoRuntime'),source.indexOf('        // O nome fiscal faz parte do branding:'));
const prepare=new Function(helpers+';return _tgPrepararAssinaturasRascunho;')();
const custom=source.slice(source.indexOf('        function _gerarTemplateRelatorioCustom'),source.indexOf('        // ===== Relatórios de Especialidade (REX/'));
const makeCustom=new Function('escapeHtmlSimples',custom+';return _gerarTemplateRelatorioCustom({nome:"Custom",campos:[]});')(s=>String(s??''));
const models=Object.fromEntries([...source.matchAll(/(\w+):\s*"([A-Za-z0-9+/=]{10000,})"/g)].map(([,t,b])=>[t,Buffer.from(b,'base64').toString('utf8')]));
models.CUSTOM=makeCustom;
const png='data:image/png;base64,Y2xpZW50',tech='data:image/png;base64,dGVjaA==';
function open(html){
 const messages=[],errors=[],paint=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(prepare(html),{runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
  Object.defineProperty(w,'parent',{value:{postMessage:msg=>messages.push(msg)}});w.alert=()=>{};
  w.Image=class{set src(value){this.value=value;this.onload?.()} };
  w.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return new Proxy({canvas,drawImage(image){canvas._pixels=image.value;paint.push(canvas.id);},clearRect(){canvas._pixels='';}},{get:(o,k)=>o[k]||(()=>{})});};
  w.HTMLCanvasElement.prototype.toDataURL=function(){return this._pixels||'data:image/png;base64,Ymxhbms=';};
 }});return {w:dom.window,messages,errors,paint,close:()=>dom.window.close()};
}
const message=(s,data)=>s.w.dispatchEvent(new s.w.MessageEvent('message',{source:s.w.parent,data}));
const wait=()=>new Promise(r=>setTimeout(r,15));
function sign(s,id,value){const c=s.w.document.getElementById(id);assert(c,id);c._pixels=value;c._relDrawn=true;s.w.TGReportDraftSignatures.remember(c);}
for(const [type,html] of Object.entries(models))test(type+': signed draft reopens, saves again, finishes with same customer signature and can clear it',async()=>{
 let a=open(html),b;try{
  await wait();message(a,{type:'init',podeAssinar:true,tecnicoNome:'Técnico'});await wait();
  const client=a.w.document.getElementById('sign_cliente')?'sign_cliente':'_relCanvasCli';
  const technician=a.w.document.getElementById('sign_tecnico')?'sign_tecnico':'_relCanvasTec';
  const name=client==='sign_cliente'?'sign_cliente_nome':'_relNomeCli';
  sign(a,client,png);a.w.document.getElementById(name).value='Cliente QA';a.w.document.getElementById(name).dispatchEvent(new a.w.Event('input',{bubbles:true}));
  a.w.document.getElementById('_relBtnRascunho').click();const draft=a.messages.find(m=>m.type==='relatorioEspecialidadeRascunho');
  assert(draft,'draft sent without technician signature');assert.equal(draft.assinaturaCliente,png);assert.equal(draft.assinaturaClienteNome,'Cliente QA');
  b=open(draft.html||html);await wait();
  if(draft.estadoRex){message(b,{type:'init',podeAssinar:true});message(b,{type:'rascunhoRex',estado:draft.estadoRex});await wait();}
  assert.equal(b.w.document.getElementById(name).value,'Cliente QA');assert(b.paint.includes(client),'signature visibly repainted');
  assert.equal(b.w.TGReportDraftSignatures.save().assinaturaCliente,png);
  b.w.document.getElementById('_relBtnRascunho').click();assert.equal(b.messages.at(-1).assinaturaCliente,png);
  sign(b,technician,tech);message(b,{type:'permissao',podeAssinar:true});
  b.w.document.getElementById('_relBtnConcluir').click();const final=b.messages.find(m=>m.type==='relatorioEspecialidadeConcluido');
  assert(final,'completion after reopening');assert.equal(final.assinaturaCliente,png);assert(final.html.includes(png),'final printable document includes signature');
  b.w._relLimpar(client);b.w.document.getElementById('_relBtnRascunho').click();assert.equal(b.messages.at(-1).assinaturaCliente,'');
  assert.equal(a.errors.length,0,a.errors.map(x=>x.message).join('\n'));assert.equal(b.errors.length,0,b.errors.map(x=>x.message).join('\n'));
 }finally{a.close();b?.close();}
});
test('REX retains signature and name when the extintor table is rebuilt',async()=>{
 const s=open(models.REX);try{await wait();sign(s,'sign_cliente',png);const name=s.w.document.getElementById('sign_cliente_nome');name.value='Cliente QA';name.dispatchEvent(new s.w.Event('input',{bubbles:true}));s.w.render();await wait();assert.equal(s.w.document.getElementById('sign_cliente_nome').value,'Cliente QA');assert.equal(s.w.TGReportDraftSignatures.save().assinaturaCliente,png);}finally{s.close();}
});
