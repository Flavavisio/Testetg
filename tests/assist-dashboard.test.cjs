const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=require('node:path').join(__dirname,'..');
for(const file of ['app-principal.js','TOTALGEST_ASSIST.html'])test(file+': customer, location, urgency, portal label and actionable alerts',()=>{
 const src=fs.readFileSync(root+'/'+file,'utf8'),a=src.indexOf('        function _assistResumoDados('),b=src.indexOf('\n        function ',src.indexOf('        function _assistPortalPorTratar(',a)+10);
 const ctx={dados:{clientes:[{id:'c',adminId:'a',nome:'Cliente <Teste>'}],locais:[{id:'l',adminId:'a',clienteId:'c',nome:'Loja Centro A'}],servicos:[{id:'os',adminId:'a',localId:'l'}],assistencias:[]},escapeHtmlSimples:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')};vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);
 const base={adminId:'a',clienteId:'c',assunto:'Alarme',prioridade:'alta',origem:'portal',estado:'aberta'};
 let h=ctx._assistResumoHtml({...base,osGeradaId:'os'});assert.match(h,/Cliente &lt;Teste&gt;/);assert.match(h,/Loja Centro A/);assert.match(h,/Alta/);assert.match(h,/Portal do Cliente/);assert.match(ctx._assistResumoHtml(base),/Sede/);
 ctx.dados.assistencias=[base,{...base,adminId:'b'},{...base,estado:'resolvida'},{...base,atribuidoId:'f'},{...base,osGeradaId:'os'}];assert.equal(ctx._assistPortalPorTratar('a').length,1);
});
