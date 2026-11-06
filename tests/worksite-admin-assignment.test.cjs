const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('app-principal.js', 'utf8');
const fn = name => source.match(new RegExp('        function ' + name + '\\([^]*?\\n        \\}'))[0];
function setup(role = 'admin') {
    const w = new JSDOM('<div id="picker"></div><div id="ob_relatorio_responsavel_cont"><select id="ob_relatorio_responsavel"></select></div>', { runScripts: 'outside-only' }).window;
    w.usuarioLogado = role === 'admin' ? { id: 'a', role } : { id: 'sub', adminId: 'a', role };
    w.dados = {
        administradores: [{ id: 'a', nome: 'António <Admin>' }, { id: 'other', nome: 'Outra empresa' }],
        funcionarios: [{ id: 'f', adminId: 'a', nome: 'Pedro' }, { id: 'sub', adminId: 'a', nome: 'Subadmin', role: 'subadmin' }, { id: 's', adminId: 'a', nome: 'Suspenso', suspenso: true }, { id: 'x', adminId: 'other', nome: 'Pessoa externa' }],
        encarregados: [{ id: 'e', adminId: 'a', nome: 'Encarregado' }],
        servicos: [], folhasObra: [], obraPontoLonga: [], ponto: []
    };
    w.getDataHoje = () => '2026-11-06';
    w.escapeHtmlSimples = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    w.eval(['_tenantArmazem', 'obterNomeFuncionario', '_obraIdsAtribuidos', '_obraAtribuidosHtml', '_obraParticipantesIds', '_nomesAtribuidosObraColorido', '_obAtualizarResponsavelFolha'].map(fn).join('\n'));
    return w;
}
test('admin alone and with employees remains selectable when admin or subadmin edits', () => {
    for (const role of ['admin', 'subadmin']) {
        const w = setup(role);
        try {
            for (const ids of [['a'], ['a', 'f']]) {
                w.document.getElementById('picker').innerHTML = w._obraAtribuidosHtml({ responsaveisIds: ids });
                const checked = [...w.document.querySelectorAll('.ob-func-check:checked')].map(c => c.value);
                assert.deepEqual(checked, ids);
                assert(!w.document.querySelector('input[value="x"]'));
                assert(!w.document.querySelector('input[value="other"]'));
                assert(!w.document.querySelector('input[value="s"]'));
                assert.equal(w.document.querySelectorAll('#picker admin').length, 0);
                assert.match(w.document.getElementById('picker').textContent, /António <Admin> \(Admin\)/);
            }
        } finally { w.close(); }
    }
});
test('legacy primary admin, suspended and removed assignments survive editing without duplicates', () => {
    const w = setup();
    try {
        const obra = { responsavelId: 'a', responsaveisIds: ['f', 'f', 's', 'removed'] };
        w.document.getElementById('picker').innerHTML = w._obraAtribuidosHtml(obra);
        const checked = [...w.document.querySelectorAll('.ob-func-check:checked')].map(c => c.value);
        assert.deepEqual(checked.sort(), ['a', 'f', 'removed', 's']);
        w._obAtualizarResponsavelFolha();
        assert.equal(w.document.querySelectorAll('#ob_relatorio_responsavel option').length, 4);
        w.document.getElementById('ob_relatorio_responsavel').value = 'a';
        w.document.querySelectorAll('.ob-func-check').forEach(c => { c.checked = c.value === 'f'; });
        w._obAtualizarResponsavelFolha();
        assert.equal(w.document.getElementById('ob_relatorio_responsavel').value, 'f');
        w.document.querySelectorAll('.ob-func-check').forEach(c => { c.checked = false; });
        w._obAtualizarResponsavelFolha();
        assert.equal(w.document.getElementById('ob_relatorio_responsavel').value, '');
    } finally { w.close(); }
});
test('historic participants from linked OS, sheets and clock entries appear once, scoped to the company', () => {
    const w = setup();
    try {
        const obra = { id: 'bdll', adminId: 'a' };
        w.dados.servicos = [{ id: 'os', adminId: 'a', obraId: 'bdll', funcionarioId: 'a', funcionariosIds: ['f'] }, { id: 'foreign', adminId: 'other', obraId: 'bdll', funcionarioId: 'x' }];
        w.dados.folhasObra = [{ adminId: 'a', servicoId: 'os', funcionarioId: 'e' }, { adminId: 'other', obraId: 'bdll', funcionarioId: 'x' }];
        w.dados.ponto = [{ adminId: 'a', servicoId: 'os', funcionarioId: 'a', entrada: '09:00' }];
        w.dados.obraPontoLonga = [{ adminId: 'a', obraId: 'bdll', funcionarioId: 'sub', entrada: '10:00' }, { adminId: 'other', obraId: 'bdll', funcionarioId: 'x', entrada: '10:00' }];
        const before = JSON.stringify({ obra, dados: w.dados });
        assert.deepEqual(Array.from(w._obraParticipantesIds(obra)).sort(), ['a', 'e', 'f', 'sub']);
        const html = w._nomesAtribuidosObraColorido(obra);
        assert.match(html, /António &lt;Admin&gt; \(Admin\)/);
        assert.match(html, /Pedro/);
        assert(!html.includes('Sem responsável'));
        assert.equal(JSON.stringify({ obra, dados: w.dados }), before);
        assert.equal(w._nomesAtribuidosObraColorido({ id: 'empty', adminId: 'a' }), 'Sem responsável');
    } finally { w.close(); }
});
test('admin recorded only on a work sheet or a direct clock entry is shown; ownership alone is insufficient', () => {
    const w = setup();
    try {
        const obra = { id: 'wavecom', adminId: 'a', responsaveisIds: ['f'] };
        assert(!w._obraParticipantesIds(obra).includes('a'));
        w.dados.folhasObra.push({ adminId: 'a', obraId: 'wavecom', funcionarioId: 'a' });
        assert(w._obraParticipantesIds(obra).includes('a'));
        w.dados.folhasObra = [];
        w.dados.obraPontoLonga.push({ adminId: 'a', obraId: 'wavecom', funcionarioId: 'a', data: '2026-11-06', entrada: '09:00' });
        assert.match(w._nomesAtribuidosObraColorido(obra), /#0ea5e9/);
        assert.match(w._nomesAtribuidosObraColorido(obra), /\(Admin\)/);
    } finally { w.close(); }
});
