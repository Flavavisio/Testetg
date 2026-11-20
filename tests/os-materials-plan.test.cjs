const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app-principal.js', 'utf8');
const start = source.indexOf('        // ---- Plano de materiais das OS independentes');
const end = source.indexOf('        function _verOsMostrar(', start);
assert(start > 0 && end > start, 'OS plan implementation must exist');
function setup({role='admin', obraId=null, existing=[]}={}) {
    const fields = Object.fromEntries(['modalGenericoTitulo','modalGenericoCampos','modalGenericoForm','os_plano_lista','os_plano_erros']
        .map(k=>[k,{innerHTML:'',textContent:'',onsubmit:null}]));
    fields.modalGenericoOverlay={classList:{add:()=>{}}};
    const messages=[], saved=[];
    const ctx = {
        usuarioLogado:{role,id:'a',adminId:'a'},
        dados:{
            servicos:[{id:'os',adminId:'a',obraId,numeroRegisto:'OS-1',materiaisPlano:existing}],
            artigos:[{id:'c',adminId:'a',nome:'Cabo',referencia:'CAB',unidade:'m'},
                {id:'f',adminId:'b',nome:'Privado',referencia:'PR',unidade:'un'}]
        },
        _tenantId:()=> 'a',
        escapeHtmlSimples:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),
        document:{
            getElementById:k=> fields[k] || null,
            querySelector:()=>({style:{},textContent:''})
        },
        alert:m=>messages.push(m),
        guardarDados:async(...args)=>{saved.push(structuredClone(args[0].servicos[0]));},
        _fecharGenerico:()=>{}, _verOsMostrar:()=>{},
        _parseCsvLine:(line,sep)=>line.split(sep)
    };
    const body=source.slice(start,end);
    const api=new Function('ctx', 'with(ctx){'+body+'; return {abrirPlanoMateriaisOS,renderizarPlanoMateriaisOS,adicionarItemPlanoOS,alterarItemPlanoOS,removerItemPlanoOS,importarPlanoMateriaisOS,salvarPlanoMateriaisOS,getTemp:()=>_planoOSTemp};}')(ctx);
    return {ctx,api,fields,messages,saved};
}
test('OS without a work can edit and save its own material plan',async()=>{
    const x=setup();
    x.api.abrirPlanoMateriaisOS('os');
    x.api.adicionarItemPlanoOS();
    x.api.alterarItemPlanoOS(0,'qtdPrevista','2.5');
    assert.match(x.fields.os_plano_lista.innerHTML,/Por consumir: 2.5/);
    await x.api.salvarPlanoMateriaisOS();
    assert.deepEqual(x.ctx.dados.servicos[0].materiaisPlano,[{artigoId:'c',qtdPrevista:2.5,qtdConsumida:0}]);
    assert.equal(x.saved.length,1);
});
test('existing consumption is preserved when reducing a plan to zero',async()=>{
    const x=setup({existing:[{artigoId:'c',qtdPrevista:10,qtdConsumida:7}]});
    x.api.abrirPlanoMateriaisOS('os');
    x.api.removerItemPlanoOS(0);
    await x.api.salvarPlanoMateriaisOS();
    assert.deepEqual(x.ctx.dados.servicos[0].materiaisPlano,[{artigoId:'c',qtdPrevista:0,qtdConsumida:7}]);
});
test('OS linked to a work and unauthorized employees cannot edit independent plans',()=>{
    const linked=setup({obraId:'work'}); linked.api.abrirPlanoMateriaisOS('os');
    assert.equal(linked.messages.length,1);
    const tech=setup({role:'funcionario'}); tech.api.abrirPlanoMateriaisOS('os');
    assert.equal(tech.messages.length,1);
});
test('import handler stages valid CSV and rejects unknown tenant articles atomically',()=>{
    const x=setup();
    x.api.abrirPlanoMateriaisOS('os');
    // Simulate FileReader without accessing an external file.
    const old=global.FileReader;
    global.FileReader=class {
        readAsText(file) {this.result=file.csv;this.onload();}
    };
    try {
        const input={files:[{name:'materials.csv',csv:'Artigo;Quantidade\nCAB;2,5'}],value:'x'};
        x.api.importarPlanoMateriaisOS(input);
        assert.equal(input.value,'');
        assert.deepEqual(x.api.getTemp(),[{artigoId:'c',qtdPrevista:2.5,qtdConsumida:0}]);
        input.files=[{name:'materials.csv',csv:'Artigo;Quantidade\nCAB;1\nPR;1'}];
        x.api.importarPlanoMateriaisOS(input);
        assert.equal(x.api.getTemp()[0].qtdPrevista,2.5);
        assert.match(x.fields.os_plano_erros.textContent,/Importação não aplicada/);
    } finally {global.FileReader=old;}
});
test('schema mapping and kiosk support reference the new plan',()=>{
    assert.match(source,/materiaisPlano: Array\.isArray\(r\.materiais_previstos\)/);
    assert.match(source,/materiais_previstos: o\.materiaisPlano/);
    assert.match(source,/function _quiosqueAgendaPlanoMateriais\(ctx\)/);
    assert.match(source,/p\.qtdConsumida = \(Number\(p\.qtdConsumida\) \|\| 0\) \+ m\.quantidade/);
});
