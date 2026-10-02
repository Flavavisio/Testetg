const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../app-principal.js'),'utf8');
const start=src.indexOf('        async function _salvarFormularioInterno(e) {');const end=src.indexOf('\n        // Os clientes entram no Portal',start);const fn=src.slice(start,end);
for(const edit of [true,false])test(`portal creation retains record id after modal closes (edit=${edit})`,async()=>{
 const tail=fn.slice(fn.indexOf('            registarAuditoria(isEdit'),fn.lastIndexOf('\n        }'));
 const calls=[];const ctx={idEditando:edit?'existing-client':null,ent:'cliente',isEdit:edit,obj:{id:'new-client',portalAtivo:true,nif:'123456789',senha:'test-only',adminId:'tenant',nome:'Test'},dados:{},_novaOSObraId:null,_funcAntesDeEditar:null,registarAuditoria(){},fecharModal(){ctx.idEditando=null;},renderizarTudo(){},guardarDados:async()=>{},_emailFantasmaCliente:()=> 'synthetic@clientes.totalgest.pt',criarUtilizadorAuth:async(...args)=>{calls.push(args);return {ok:true}},alert(){}};
 vm.createContext(ctx);await vm.runInContext('(async()=>{const idRegistoEmEdicao=idEditando;'+tail+'})()',ctx);assert.equal(ctx.idEditando,null);assert.equal(calls[0][4],edit?'existing-client':'new-client');assert.equal(calls[0][3],'tenant');
});
test('edit identity captured before async work and consistent login instructions',()=>{assert.match(fn,/const idRegistoEmEdicao = idEditando;/);assert.equal((fn.match(/\bidEditando\b/g)||[]).length,1);assert.ok(!src.includes('entra com o email acima'));});
