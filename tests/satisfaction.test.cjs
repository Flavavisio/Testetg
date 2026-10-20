const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app-principal.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(root, 'tg-satisfaction.js'), 'utf8');
function setup(extra = {}) {
    const dom = new JSDOM('<section class="section-container active"><div id="hdcSatisfacao"></div></section>', { runScripts: 'outside-only' });
    const w = dom.window;
    const ctx = { user: { id: 'a', role: 'admin' }, tenantId: 'a', clients: [{ id: 'c', adminId: 'a', nome: 'Cliente A' }], reports: [], readSnapshot: async () => null, ...extra };
    w._hdcContextoSatisfacao = () => ctx;
    w.eval(moduleSource);
    return { w, ctx, api: w.TGSatisfaction, target: w.document.getElementById('hdcSatisfacao'), close: () => w.close() };
}
const range = { ini: '2026-10-01', fim: '2026-10-31' };
const meta = (grau, temCampo = true) => ({ versao: 1, grau, temCampo });
const report = (id, grau, extra = {}) => ({ id, adminId: 'a', clienteId: 'c', data: '2026-10-20', numeroDocumento: id, tipo: 'REX', campos: { satisfacaoCliente: meta(grau) }, ...extra });
const satHTML = (index = 3) => '<html><body><label>Satisfação do Cliente</label><div>' + ['Mt. Insatisfeito', 'Insatisfeito', 'Satisfeito', 'Mt. Satisfeito'].map((text, i) => `<div class="sat-opt"><span>${text}</span><span class="sat-box">${i === index ? '✕' : ''}</span></div>`).join('') + '</div></body></html>';
for (const [i, key] of ['muito_insatisfeito', 'insatisfeito', 'satisfeito', 'muito_satisfeito'].entries()) test('extract degree ' + key + ' without partial-label collision', () => {
    const x = setup(); try { assert.equal(x.api.extract(satHTML(i)).grau, key); } finally { x.close(); }
});
test('unanswered, no field, malformed or contradictory marks are never satisfied by default', () => {
    const x = setup(); try {
        assert.equal(x.api.extract(satHTML(-1)).grau, null); assert.equal(x.api.extract(satHTML(-1)).temCampo, true);
        assert.equal(x.api.extract('<p>Mt. Satisfeito</p>').temCampo, false);
        assert.equal(x.api.extract(satHTML(3).replace('<span class="sat-box"></span>', '<span class="sat-box">X</span>')).grau, null);
    } finally { x.close(); }
});
test('extract actual embedded report templates, using the real click handler and saved HTML', () => {
    const x = setup(); try {
        const templates = [...app.matchAll(/(\w+):\s*"([A-Za-z0-9+/=]{10000,})"/g)]; let supported = 0;
        for (const [_, name, encoded] of templates) {
            const html = Buffer.from(encoded, 'base64').toString('utf8');
            const d = new JSDOM(html, { runScripts: 'outside-only' }); const w = d.window;
            if (name === 'REX') {
                w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_, k) => k === 'canvas' ? {} : () => {} });
                for (const script of w.document.querySelectorAll('script')) w.eval(script.textContent);
                if (typeof w.render === 'function') w.render();
            }
            const option = w.document.querySelector('.sat-opt');
            if (!option) { d.window.close(); continue; }
            supported++;
            const fn = html.match(/(?:window\._relSatisfacaoClick\s*=\s*function\(el\)|function _relSatisfacaoClick\(el\))\s*(\{[^}]*\}[^}]*\})/);
            assert(fn, name); w.eval('window.choose = function(el)' + fn[1]);
            w.choose(w.document.querySelectorAll('.sat-opt')[2]);
            const saved = d.serialize(); assert.equal(x.api.extract(saved).grau, 'satisfeito', name); w.close();
        }
        assert.equal(supported, 6);
    } finally { x.close(); }
});
test('custom report with satisfaction select is supported', () => {
    const x = setup(); try { assert.equal(x.api.extract('<div><label for="rating">Grau de satisfação do cliente</label><select id="rating"><option></option><option selected>Muito insatisfeito</option></select></div>').grau, 'muito_insatisfeito'); } finally { x.close(); }
});
test('scope, dates, duplicate report IDs, drafts and missing responses', () => {
    const x = setup(); try {
        x.ctx.reports = [report('first', 'satisfeito', { data: range.ini }), report('last', 'muito_satisfeito', { data: range.fim }), report('first', 'satisfeito', { data: range.ini }), report('otherTenant', 'insatisfeito', { adminId: 'b' }), report('draft', 'satisfeito', { rascunho: true }), report('old', 'satisfeito', { data: '2026-09-30' }), report('next', 'satisfeito', { data: '2026-11-01' }), report('empty', null), report('no-field', null, { campos: { satisfacaoCliente: meta(null, false) } }), report('invalid', 'satisfeito', { data: '2026-10-32' })];
        const s = x.api.summarize(x.ctx, range); assert.equal(s.total, 2); assert.equal(s.unanswered, 1); assert.equal(s.withoutField, 1); assert.equal(s.counts.satisfeito, 1); assert.equal(s.counts.muito_satisfeito, 1);
        assert.equal(x.api.eligible(x.ctx, { ini: range.fim, fim: range.ini }).length, 0);
    } finally { x.close(); }
});
test('only admin and subadmin of the actual company may read or export', async () => {
    const x = setup(); try {
        x.ctx.reports = [report('yes', 'satisfeito')];
        for (const role of ['funcionario', 'encarregado', 'cliente', 'superadmin']) {
            x.ctx.user = { id: 'a', role, adminId: 'a' }; assert.equal(x.api.summarize(x.ctx, range).total, 0); await x.api.mount(x.target, range); assert.equal(x.target.textContent, '');
        }
        x.ctx.user = { id: 's', role: 'subadmin', adminId: 'a' }; assert.equal(x.api.summarize(x.ctx, range).total, 1);
        x.ctx.user.adminId = 'b'; assert.equal(x.api.summarize(x.ctx, range).total, 0);
    } finally { x.close(); }
});
test('legacy snapshots are read with bounded concurrency, all results counted, cached, and never written', async () => {
    let active = 0, peak = 0, reads = 0;
    const x = setup({ readSnapshot: async () => { reads++; active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 1)); active--; return satHTML(3); } });
    try {
        x.ctx.reports = Array.from({ length: 11 }, (_, i) => report(String(i), null, { campos: { htmlSnapshotPath: 'a/' + i + '.html' } }));
        const original = JSON.stringify(x.ctx.reports); await x.api.mount(x.target, range);
        assert.equal(reads, 11); assert(peak <= 4); assert.equal(x.api.summarize(x.ctx, range).total, 11); assert.equal(JSON.stringify(x.ctx.reports), original); assert.equal(x.target.querySelector('button').disabled, false);
        await x.api.mount(x.target, range); assert.equal(reads, 11);
    } finally { x.close(); }
});
test('failed/foreign snapshots show incomplete data and prevent misleading exports, retry recovers', async () => {
    let ok = false, calls = [];
    const x = setup({ readSnapshot: async p => { calls.push(p); return ok ? satHTML(0) : null; } });
    try {
        x.ctx.reports = [report('old', null, { campos: { htmlSnapshotPath: 'a/old.html' } }), report('foreign', null, { campos: { htmlSnapshotPath: 'b/foreign.html' } }), report('new', 'satisfeito')];
        await x.api.mount(x.target, range); assert.equal(calls.length, 1); assert.equal(x.api.summarize(x.ctx, range).errors, 2); assert.match(x.target.textContent, /incompleto/); assert(x.target.querySelector('button').disabled);
        x.ctx.reports.splice(1, 1); ok = true; [...x.target.querySelectorAll('button')].find(b => b.textContent === 'Tentar novamente').click();
        await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(x.api.summarize(x.ctx, range).errors, 0); assert.equal(x.api.summarize(x.ctx, range).total, 2);
    } finally { x.close(); }
});
test('late legacy reads cannot overwrite a different period or account', async () => {
    let resolve;
    const x = setup({ readSnapshot: () => new Promise(r => { resolve = r; }) });
    try {
        x.ctx.reports = [report('old', null, { campos: { htmlSnapshotPath: 'a/old.html' } })]; const p = x.api.mount(x.target, range);
        await x.api.mount(x.target, { ini: '2026-11-01', fim: '2026-11-30' }); resolve(satHTML()); await p;
        assert.match(x.target.textContent, /01\/11\/2026/); assert.match(x.target.textContent, /Sem avaliações/);
        const p2 = x.api.mount(x.target, range); x.ctx.user = { id: 'b', role: 'admin' }; x.ctx.tenantId = 'b';
        await x.api.mount(x.target, range); resolve(satHTML()); await p2; assert.match(x.target.textContent, /Sem avaliações/);
    } finally { x.close(); }
});
test('CSV has BOM, period, exact totals, details and formula-safe escaped names', async () => {
    const x = setup(); try {
        x.ctx.clients[0].nome = '=SUM(1;2)"\nTeste'; x.ctx.reports = [report('R1', 'muito_satisfeito'), report('R2', 'satisfeito'), report('R3', null)];
        const s = x.api.summarize(x.ctx, range), csv = x.api.csv(x.ctx, range, s);
        assert(csv.startsWith('\uFEFF')); assert.match(csv, /2026-10-01/); assert.match(csv, /2026-10-31/); assert.match(csv, /"Total de avaliações";"2"/); assert.match(csv, /"50%"/); assert(csv.includes("'=SUM(1;2)")); assert(!csv.includes('R3'));
        await x.api.mount(x.target, range); assert.equal(x.target.querySelectorAll('table tr').length, 4); assert.match(x.target.textContent, /sem resposta/);
        const blobs = []; x.w.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:test'; }; x.w.URL.revokeObjectURL = () => {}; x.w.HTMLAnchorElement.prototype.click = function () { assert.equal(this.download, 'satisfacao-clientes_2026-10-01_2026-10-31.csv'); };
        x.api.download('csv'); assert.equal(blobs.length, 1);
        x.ctx.user.role = 'cliente'; x.api.download('csv'); assert.equal(blobs.length, 1);
    } finally { x.close(); }
});
test('PDF uses the displayed period and summary and a vector chart', async () => {
    const x = setup(); try {
        x.ctx.reports = [report('R', 'satisfeito')]; await x.api.mount(x.target, range);
        const text = [], files = []; let segments = 0;
        class PDF { setFontSize() {} setFillColor() {} lines(points) { segments += points.length; } circle() {} setTextColor() {} text(t) { text.push(t); } save(f) { files.push(f); } }
        x.w.jspdf = { jsPDF: PDF }; x.api.download('pdf'); assert(segments > 100); assert(text.some(t => t.includes('01/10/2026 a 31/10/2026'))); assert(text.includes('1 (100%)')); assert.deepEqual(files, ['satisfacao-clientes_2026-10-01_2026-10-31.pdf']);
    } finally { x.close(); }
});
test('report completion actually persists extracted satisfaction in existing JSON fields', async () => {
    const x = setup(); try {
        const start = app.indexOf('            async function onMessage(ev)', app.indexOf('async function _abrirModalRelatorioEspecialidade'));
        const end = app.indexOf("            window.addEventListener('message', onMessage);", start);
        const body = app.slice(start, end);
        const os = { id: 'os', adminId: 'a', clienteId: 'c' }, data = { relatoriosEspecialidade: [] };
        const frame = { contentWindow: {} };
        const env = { iframe: frame, equipamentoId: null, requisito: {}, osId: 'os', tipo: 'RBI', os, numDoc: 'RBI-1', localAtualRel: null, cliente: { id: 'c' }, numeroInicial: 1, hoje: '2026-10-20', initMsg: { local: 'Loja' }, usuarioLogado: { id: 't' }, dados: data,
            _tenantId: () => 'a', gerarId: () => 'r', _uploadTextoStorage: async () => true, _uploadImagemStorage: async () => false, proximoNumeroRelatorio: async () => 1, guardarDados: () => {}, overlay: { classList: { remove() {} } }, onGuardado: () => {}, mesmoEquipamento: () => true, window: x.w };
        const names = Object.keys(env);
        const onMessage = new Function(...names, body + '\nreturn onMessage;')(...names.map(n => env[n]));
        await onMessage({ source: frame.contentWindow, data: { type: 'relatorioEspecialidadeConcluido', html: satHTML(1) } });
        assert.equal(data.relatoriosEspecialidade.length, 1); assert.equal(data.relatoriosEspecialidade[0].campos.satisfacaoCliente.grau, 'insatisfeito'); assert.equal(data.relatoriosEspecialidade[0].campos.htmlSnapshotPath, 'a/r.html');
    } finally { x.close(); }
});
test('month and week boundaries use local dates in Portugal, not UTC conversion', () => {
    const a = app.indexOf('        function _hdcRangeDoTipo('), b = app.indexOf('        // Período imediatamente anterior', a);
    const code = app.slice(a, b), format = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const get = new Function('_hdcPeriodo', '_fmtDataAg', '_segundaDaSemana', code + ';return _hdcRangeDoTipo;')({}, format, d => { const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d; });
    assert.equal(get('mes', '2026-10-20').ini, '2026-10-01'); assert.equal(get('mes', '2026-10-20').fim, '2026-10-31'); assert.equal(get('semana', '2026-10-20').ini, '2026-10-19');
});
test('public shells and PWA cache reference the new module and app together', () => {
    for (const file of ['index.html', 'login.html', 'sw.js']) {
        const source = fs.readFileSync(path.join(root, file), 'utf8'); assert.match(source, /tg-satisfaction.js\?v=1.0.1/); assert.match(source, /tg-satisfaction.css\?v=1.0.3/); assert.match(source, /app-principal.js\?v=satisfaction-fields-height-20261020/);
    }
});

// Regressão: o quarto inferior é uma grelha regular de quatro cartões.
test('satisfaction dashboard layout keeps four desktop columns, aligned shortcuts and mobile stacking', () => {
    const css = fs.readFileSync(path.join(root, 'tg-satisfaction.css'), 'utf8');
    assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(css, /#secao-dashboard-central \.hdc-acoes\.hdc-acoes-rodape/);
    assert.match(css, /@media\(max-width:1250px\)/);
    assert.match(css, /@media\(max-width:660px\)/);
    assert.match(css, /#secao-dashboard-central #hdcSatisfacao \.tg-sat-body/);
});

// Satisfação em RCCTV / Intrusão e novo campo personalizável.
test('specialty report satisfaction field is included in RCCTV and Intrusão and configurable in custom reports', () => {
    const src = fs.readFileSync(path.join(root, 'app-principal.js'), 'utf8');
    assert.match(src, /\['RCCTV', 'RIN'\]\.forEach\(tipo/);
    assert.match(src, /Grau de satisfação do cliente/);
    assert.match(src, /\{ valor: 'satisfacao', label: 'Satisfação do cliente \(4 níveis\)'/);
    assert.match(src, /if \(c\.tipo === 'satisfacao'\) return/);
    assert.match(src, /el\.id === 'tg_satisfacao_cliente'/);
    const x = setup();
    try {
        const html = value => '<div><label for="tg_satisfacao_cliente">Grau de satisfação do cliente</label><select id="tg_satisfacao_cliente">' +
            '<option value="">— Sem resposta —</option>' +
            '<option value="satisfeito"' + (value === 'satisfeito' ? ' selected' : '') + '>Satisfeito</option>' +
            '<option value="muito_satisfeito"' + (value === 'muito_satisfeito' ? ' selected' : '') + '>Muito satisfeito</option></select></div>';
        assert.equal(x.api.extract(html('satisfeito')).grau, 'satisfeito');
        assert.equal(x.api.extract(html('muito_satisfeito')).grau, 'muito_satisfeito');
        assert.equal(x.api.extract(html('')).grau, null);
    } finally { x.close(); }
});
test('four compact charts are as tall as the primary charts on desktop, excluding shortcuts', () => {
    const css = fs.readFileSync(path.join(root, 'tg-satisfaction.css'), 'utf8');
    assert.match(css, /\.hdc-row4 > \.hdc-card/);
    assert.match(css, /\.hdc-row4b > \.hdc-card:not\(\.hdc-acoes\)/);
    assert.match(css, /height:270px/);
    assert.match(css, /@media \(max-width:660px\)/);
});
