const { test } = require('node:test');
const fs = require('node:fs');
const source = fs.readFileSync('app-principal.js', 'utf8');
function setup(extra = {}) {
    const own = x => ({ adminId: 'a', ...x });
    const ctx = {
        dados: { obras: [own({ id:'w', nome:'Obra' })], servicos:[own({ id:'os', obraId:'w' })],
            funcionarios:[own({ id:'r', nome:'Responsável' })], encarregados:[],
            artigos:[own({ id:'planned', nome:'Cabo', unidade:'m' }), own({ id:'extra', nome:'Conector', unidade:'un' }), {id:'foreign',adminId:'b',nome:'Segredo'}],
            obraMateriais:[own({id:'plan',obraId:'w',artigoId:'planned',qtdPrevista:10,qtdConsumida:2}),{id:'alien',adminId:'b',obraId:'w',artigoId:'foreign',qtdPrevista:99}],
            folhasObra:[], movimentosStock:[], notificacoes:[] },
        _quiosqueAgendaSessaoAtual:{tipo:'servico',id:'os',responsavelId:'r'}, _quiosqueAgendaPessoaSelecionada:{id:'r',nome:'Responsável'},
        _tenantQuiosque:()=>'a', _quiosqueAgendaMateriaisTemp:[], alerts:[], saves:0, exits:0,
        document:{getElementById:id=>id==='qsa_folha_desc'?ctx.field:null},
        getDataHoje:()=>'2026-11-16', _picagensParaFolha:()=>[], _somarIntervalosPicagem:()=>({horas:2}),
        obterNomeCliente:()=> 'Cliente', _armazemPrincipalId:()=> 'warehouse',
        _vincularPicagensFolha:f=>{f.picagensVinculadas=[];}, _quiosqueObterLocalizacaoAgora:async()=>null,
        ...extra
    };
    ctx.field={value:'Trabalho realizado'};
    let seq=0;
    ctx.gerarId=()=> 'new-'+(++seq);
    ctx.alert=message=>ctx.alerts.push(message);
    ctx.guardarDados=async()=>{ctx.saves++; if(ctx.fail)throw Error('offline');};
    ctx._quiosqueAgendaFecharSaida=()=>{ctx.exits++;};
    const names=['_quiosqueAgendaContextoMateriais','_quiosqueAgendaPlanoMateriais','_quiosqueAgendaValidarMateriais','_quiosqueAgendaConfirmarFolha'];
    const body=names.map(name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0]).join('\n');
    const api=new Function('ctx','with(ctx){'+body+';return {'+names.join(',')+'};}')(ctx);
    return {ctx,...api};
}
function ok(value, message='Assertion failed') { if(!value) throw Error(message); }
function equal(a,b) {ok(JSON.stringify(a)===JSON.stringify(b),JSON.stringify(a)+' != '+JSON.stringify(b));}
function throws(fn) {let caught=false;try{fn();}catch(e){caught=true;}ok(caught,'Expected validation error');}
test('agenda sheet resolves programmed materials through the OS work, with strict tenant isolation',()=>{
    const w=setup(),c=w._quiosqueAgendaContextoMateriais();
    equal(c.obraId,'w'); equal(w._quiosqueAgendaPlanoMateriais(c).map(x=>x.artigo.id),['planned']);
    w.ctx._quiosqueAgendaSessaoAtual={tipo:'obra',id:'w',responsavelId:'r'};
    equal(w._quiosqueAgendaContextoMateriais().obraId,'w');
    w.ctx.dados.obras[0].adminId='b';equal(w._quiosqueAgendaContextoMateriais(),null);
});
test('only the identified responsible person can submit; removed people and cross-tenant services are rejected',()=>{
    for(const kind of ['responsible','person','service']){
        const w=setup();
        if(kind==='responsible')w.ctx._quiosqueAgendaSessaoAtual.responsavelId='other';
        if(kind==='person')w.ctx.dados.funcionarios=[];
        if(kind==='service')w.ctx.dados.servicos[0].adminId='b';
        equal(w._quiosqueAgendaContextoMateriais(),null);
    }
});
test('positive fractional quantities, planned selection and manual/catalog extras are validated',()=>{
    const w=setup(),c=w._quiosqueAgendaContextoMateriais();
    const m=w._quiosqueAgendaValidarMateriais([{artigoId:'planned',quantidade:1.5},{artigoId:'extra',quantidade:2},{nome:'Material manual',quantidade:3,unidade:'kg'}],c);
    equal(m.map(x=>[x.nome,x.quantidade,x.extra]),[['Cabo',1.5,false],['Conector',2,true],['Material manual',3,true]]);
    for(const quantidade of [0,-1,NaN,Infinity])throws(()=>w._quiosqueAgendaValidarMateriais([{nome:'x',quantidade}],c));
    throws(()=>w._quiosqueAgendaValidarMateriais([{artigoId:'foreign',quantidade:1}],c));
    throws(()=>w._quiosqueAgendaValidarMateriais([{nome:' ',quantidade:1}],c));
});
test('saving uses only selected items, links stock to the sheet and updates planned consumption exactly once',async()=>{
    const w=setup();w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'planned',quantidade:1.5}];
    await w._quiosqueAgendaConfirmarFolha('terminar_hoje');
    equal(w.ctx.alerts,[]);equal(w.ctx.dados.folhasObra.length,1);equal(w.ctx.dados.movimentosStock.length,1);
    equal(w.ctx.dados.movimentosStock[0].origemTipo,'folha');equal(w.ctx.dados.movimentosStock[0].origemId,w.ctx.dados.folhasObra[0].id);
    equal(w.ctx.dados.folhasObra[0].obraId,'w');equal(w.ctx.dados.folhasObra[0].servicoId,'os');
    equal(w.ctx.dados.obraMateriais[0].qtdConsumida,3.5);equal(w.ctx.dados.obraMateriais[1].qtdPrevista,99);
    equal(w.ctx.dados.notificacoes.length,0);equal(w.ctx.exits,1);
});
test('extras create an admin record and preserve manual material with no invented prices',async()=>{
    const w=setup();w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'extra',quantidade:2},{nome:'Manual',quantidade:1,unidade:'kg'}];
    await w._quiosqueAgendaConfirmarFolha('terminar_servico');
    equal(w.ctx.alerts,[]);equal(w.ctx.dados.notificacoes.length,1);equal(w.ctx.dados.notificacoes[0].destinatarioId,'a');
    ok(w.ctx.dados.notificacoes[0].mensagem.includes('Manual'));ok(w.ctx.dados.folhasObra[0].materiais.includes('NÃO PLANEADO'));
    const article=w.ctx.dados.artigos.find(a=>a.nome==='Manual');equal(article.precoVenda,null);equal(article.precoCompra,null);
    equal(w.ctx.dados.movimentosStock.length,2);equal(w.ctx.dados.obraMateriais.find(m=>m.artigoId===article.id).qtdPrevista,0);
});
test('standalone OS accepts extra material without writing a work plan',async()=>{
    const w=setup();w.ctx.dados.servicos[0].obraId=null;w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'extra',quantidade:1}];
    await w._quiosqueAgendaConfirmarFolha('terminar_hoje');
    equal(w.ctx.alerts,[]);equal(w.ctx.dados.folhasObra[0].obraId,null);equal(w.ctx.dados.obraMateriais.length,2);equal(w.ctx.dados.notificacoes.length,1);
});
test('invalid material never creates a partial sheet or exits the job',async()=>{
    const w=setup();w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'foreign',quantidade:1}];
    await w._quiosqueAgendaConfirmarFolha('terminar_hoje');
    equal(w.ctx.dados.folhasObra.length,0);equal(w.ctx.dados.movimentosStock.length,0);equal(w.ctx.exits,0);equal(w.ctx.alerts.length,1);
});
test('failed sync and a double click reuse the same sheet, quantities and admin notice',async()=>{
    const w=setup();w.ctx.fail=true;w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'extra',quantidade:1}];
    await w._quiosqueAgendaConfirmarFolha('terminar_hoje');
    equal(w.ctx.exits,0);equal(w.ctx.dados.folhasObra.length,1);
    w.ctx.fail=false;
    await Promise.all([w._quiosqueAgendaConfirmarFolha('terminar_hoje'),w._quiosqueAgendaConfirmarFolha('terminar_hoje')]);
    equal(w.ctx.dados.folhasObra.length,1);equal(w.ctx.dados.movimentosStock.length,1);equal(w.ctx.dados.notificacoes.length,1);equal(w.ctx.exits,1);
});
