const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('app-principal.js','utf8');
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
    const names=['_quiosqueAgendaResumoMateriais','_quiosqueAgendaToggleMateriais','_quiosqueAgendaContextoMateriais','_quiosqueAgendaPlanoMateriais','_quiosqueAgendaValidarMateriais','_quiosqueAgendaConfirmarFolha'];
    const body=names.map(name=>source.match(new RegExp('        (?:async )?function '+name+'\\([^]*?\\n        \\}'))[0]).join('\n');
    const api=new Function('ctx','with(ctx){'+body+';return {'+names.join(',')+'};}')(ctx);
    return {ctx,...api};
}

function screen(){
    const dom=new JSDOM('<button id="qsa_mat_sim">Sim</button><button id="qsa_mat_nao">Não</button><div id="qsa_mat_area"></div>');
    dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
    return {dom,...setup({document:dom.window.document})};
}
test('modal shows only this work planned items, enables quantities by checkbox and confirms selected consumption',()=>{
    const w=screen();try{
        w._quiosqueAgendaToggleMateriais(true);
        const doc=w.dom.window.document,dialog=doc.getElementById('qsa_materiais_modal');
        assert(dialog.open);assert(dialog.textContent.includes('Cabo'));assert(!dialog.textContent.includes('Segredo'));
        const check=dialog.querySelector('input[type=checkbox]'),q=dialog.querySelector('#qsa_planeados input[type=number]');
        assert(q.disabled);check.checked=true;check.dispatchEvent(new w.dom.window.Event('change'));assert(!q.disabled);
        q.value='1.5';q.dispatchEvent(new w.dom.window.Event('input'));
        doc.getElementById('qsa_mat_confirmar').click();
        assert(!doc.getElementById('qsa_materiais_modal'));assert.equal(w.ctx._quiosqueAgendaMateriaisTemp[0].quantidade,1.5);
        assert(doc.getElementById('qsa_resumo_materiais').textContent.includes('Cabo × 1.5'));
    }finally{w.dom.window.close();}
});
test('manual material can be added and removed without catalog writes; cancel retains confirmed selection',()=>{
    const w=screen();try{
        w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'planned',nome:'Cabo',quantidade:2,unidade:'m'}];
        w._quiosqueAgendaToggleMateriais(true);
        const doc=w.dom.window.document;
        doc.getElementById('qsa_extra_nome').value='<img src=x onerror=alert(1)>';
        doc.getElementById('qsa_extra_qtd').value='2';doc.getElementById('qsa_extra_adicionar').click();
        assert(!doc.getElementById('qsa_extras').querySelector('img'));
        assert.equal(w.ctx.dados.artigos.length,3);assert.equal(w.ctx.dados.movimentosStock.length,0);
        doc.getElementById('qsa_mat_cancelar').click();assert.equal(w.ctx._quiosqueAgendaMateriaisTemp.length,1);
        assert.equal(w.ctx._quiosqueAgendaMateriaisTemp[0].quantidade,2);
    }finally{w.dom.window.close();}
});
test('confirm rejects empty quantities and stale sessions while preserving draft and description',()=>{
    const w=screen();try{
        w._quiosqueAgendaToggleMateriais(true);
        const doc=w.dom.window.document,check=doc.querySelector('input[type=checkbox]');
        check.checked=true;check.dispatchEvent(new w.dom.window.Event('change'));
        doc.getElementById('qsa_mat_confirmar').click();assert(doc.getElementById('qsa_mat_erro').textContent.includes('quantidade'));
        w.ctx._quiosqueAgendaSessaoAtual.responsavelId='other';
        doc.getElementById('qsa_mat_confirmar').click();assert(doc.getElementById('qsa_mat_erro').textContent.includes('sessão'));
        assert.equal(w.ctx._quiosqueAgendaMateriaisTemp.length,0);
    }finally{w.dom.window.close();}
});

test('material balance stays below the name, uses saved consumption and refreshes after saving',async()=>{
    const w=screen();try{
        const doc=w.dom.window.document;
        w.ctx._quiosqueAgendaMateriaisTemp=[{artigoId:'planned',nome:'Cabo',quantidade:1.5,unidade:'m'}];
        const read=()=>{
            const info=doc.querySelector('#qsa_planeados .qsa_material_info');
            assert.equal(info.querySelector('.qsa_material_nome').textContent,'Cabo');
            assert.equal(info.querySelector('.qsa_material_nome').style.display,'block');
            return [...info.querySelectorAll('.qsa_material_saldo')].map(el=>{
                assert.equal(el.style.display,'block'); return el.textContent;
            });
        };
        w._quiosqueAgendaToggleMateriais(true);
        assert.deepEqual(read(),['Previsto: 10 m','Consumido: 2 m','Falta consumir: 8 m']);
        const q=doc.querySelector('#qsa_planeados input[type=number]');
        q.value='2.5';q.dispatchEvent(new w.dom.window.Event('input'));
        assert.deepEqual(read(),['Previsto: 10 m','Consumido: 2 m','Falta consumir: 8 m']);
        doc.getElementById('qsa_mat_confirmar').click();
        const field=doc.createElement('input');field.id='qsa_folha_desc';field.value='Trabalho realizado';doc.body.appendChild(field);
        await w._quiosqueAgendaConfirmarFolha('terminar_hoje');
        assert.deepEqual(w.ctx.alerts,[]);
        w._quiosqueAgendaToggleMateriais(true);
        assert.deepEqual(read(),['Previsto: 10 m','Consumido: 4,5 m','Falta consumir: 5,5 m']);
    }finally{w.dom.window.close();}
});
test('balances handle zero, complete and excess consumption without negative remaining quantities',()=>{
    for(const [consumido,expected] of [[0,'10'],[10,'0'],[12,'0'],[2.25,'7,75']]){
        const w=screen();try{
            w.ctx.dados.obraMateriais[0].qtdConsumida=consumido;
            w._quiosqueAgendaToggleMateriais(true);
            const rows=[...w.dom.window.document.querySelectorAll('.qsa_material_saldo')].map(el=>el.textContent);
            assert.deepEqual(rows,['Previsto: 10 m','Consumido: '+String(consumido).replace('.',',')+' m','Falta consumir: '+expected+' m']);
        }finally{w.dom.window.close();}
    }
});
