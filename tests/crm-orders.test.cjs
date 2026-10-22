const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'app-principal.js'), 'utf8');
const slice = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
function pdf() {
    const calls = [];
    const doc = { calls, internal: {pageSize: {getWidth: () => 210}},
        getImageProperties: () => ({height: 10, width: 20, fileType: 'PNG'}),
        splitTextToSize: t => [t], getTextWidth: t => t.length,
        autoTable(options) { calls.push(['autoTable', options]); this.lastAutoTable = {finalY: 150}; }
    };
    for (const name of ['text','setFont','setFontSize','setTextColor','addImage','save']) doc[name] = (...args) => calls.push([name, ...args]);
    return doc;
}
(async () => {
for (const entry of ['TOTALGEST_CRM.html', 'TOTALGEST CRM.html']) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
    const saved = [], downloads = [], alerts = [];
    let n = 0, fail = true, release;
    const dados = {
        administradores: [{id:'tenant', empresa:'Marca', nomeFiscal:'Empresa Fiscal Lda', numeroAnepc:'123', numeroRegistoPrevio:'456', corCorporativa:'#123456'}],
        fornecedores: [{id:'f1', nome:'Ação', nif:'123', contacto:'Pessoa'}, {id:'f2',nome:'Outro'}],
        artigos: [{id:'a1', nome:'Artigo', unidade:'m'}, {id:'a2', nome:'Outro', unidade:'un'}],
        encomendas: [{id:'old', adminId:'tenant', numero:'ENC-ACAO-007'}, {adminId:'other',numero:'ENC-ACAO-099'}], encomendaItens: []
    };
    const context = vm.createContext({dados, console, window: {jspdf: {jsPDF: function(){return pdf();}}},
        _tenantId: () => 'tenant', gerarId: () => 'id'+(++n),
        _hexParaRgb: () => [18,52,86], nn: v => v || null, msToISO: v => v, isoToMs: v => v,
        alert: t => alerts.push(t), mostrarStatusCRM: () => {},
        document: {getElementById: () => ({value:'2026-10-22', classList:{remove(){}}}),
            querySelector: selector => selector.includes('chk') ? {checked:true} : {value:selector.includes('fornecedor') ? (selector.includes('"0"') ? 'f1' : 'f2') : '2.5'}},
        guardarDados: async (batch, cols) => {saved.push(JSON.parse(JSON.stringify({batch,cols}))); if(fail) throw Error('offline'); await new Promise(r => release = r);}
    });
    vm.runInContext('var mapping = {'+slice(html, '            encomendas: {', '            encomendaItens:')+'};', context);
    const original = {id:'x', numero:'ENC-ACAO-008', adminId:'tenant'};
    assert.equal(context.mapping.encomendas.from(context.mapping.encomendas.to(original)).numero, original.numero);
    vm.runInContext(slice(html, '        let _crmEncomendaAGuardar', '        function abrirCriarObraDeProposta'), context);
    context.downloads = downloads;
    vm.runInContext('_gerarPdfEncomendaCRM = e => downloads.push(e.numero)', context);
    const items = [{artigoId:'a1',precoCusto:10},{artigoId:'a2',precoCusto:null}];
    await context._confirmarFazerEncomendaDeProposta('p1',items);
    assert.equal(downloads.length,0, 'No PDF until persistence succeeds');
    assert.equal(dados.encomendas.length,4);
    assert.equal(dados.encomendas[2].numero,'ENC-ACAO-008');
    assert.equal(dados.encomendas[3].numero,'ENC-OUTRO-001');
    assert.equal(saved[0].batch.encomendaItens[0].quantidade,2.5);
    fail = false;
    const saving = context._confirmarFazerEncomendaDeProposta('p1',items);
    await context._confirmarFazerEncomendaDeProposta('p1',items);
    assert.equal(saved.length,2, 'Double clicks do not persist twice');
    release(); await saving;
    assert.deepEqual(saved[0],saved[1], 'Retries keep the same order numbers and item IDs');
    assert.deepEqual(downloads,['ENC-ACAO-008','ENC-OUTRO-001']);
    assert.deepEqual(saved[1].cols,['encomendas','encomendaItens']);
    // Compare every PDF drawing operation with the warehouse generator.
    vm.runInContext(slice(html,'        function _crmPdfEncomendaHeader','        function _gerarPdfEncomendaCRM'),context);
    const crm = context._crmMontarPdfNotaEncomenda(dados.encomendas[2].id);
    context._tenantArmazem = () => 'tenant'; context.obterConfig = () => ({}); context._novoPdf = pdf;
    vm.runInContext(slice(main,'        function _pdfArmHeader','        function _novoPdf'),context);
    vm.runInContext(slice(main,'        function _montarPdfNotaEncomenda','        function gerarNotaEncomenda'),context);
    const warehouse = context._montarPdfNotaEncomenda(dados.encomendas[2].id);
    assert.deepEqual(JSON.parse(JSON.stringify(crm.calls)),JSON.parse(JSON.stringify(warehouse.calls)));
    assert(crm.calls.some(c=>c[0]==='text' && String(c[1])==='Empresa Fiscal Lda'));
    console.log(entry+': numbering, mapping, persistence/retry, double click and warehouse PDF parity passed');
}
})().catch(e=>{console.error(e); process.exit(1);});
