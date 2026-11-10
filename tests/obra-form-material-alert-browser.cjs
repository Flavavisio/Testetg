const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const source = fs.readFileSync('app-principal.js', 'utf8');
const pick = (name) => {
    const start = source.indexOf('        function ' + name + '(');
    assert.notEqual(start, -1, name);
    const firstLine = source.slice(start, source.indexOf('\n', start));
    if (firstLine.endsWith(' }')) return firstLine;
    const end = source.indexOf('\n        }', start);
    return source.slice(start, end + '\n        }'.length);
};

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_BINARY,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
        const page = await browser.newPage({ viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
            <div id="modalOverlay" class="modal-overlay">
                <div class="modal"><h3 id="modalTitulo"></h3><div id="modalCampos"></div><button id="modalSubmitBtn"></button></div>
            </div>
            <div id="notifPessoalBanner"></div>`);
        for (const name of ['styles.css', 'responsive-device.css']) {
            await page.addStyleTag({ content: fs.readFileSync(name, 'utf8') });
        }
        const keyboardHandler = source.match(/        window\.visualViewport\?\.addEventListener\('resize', \(\) => \{[^]*?\n        \}\);/);
        const functions = [
            'abrirModal', '_clienteLabel', '_preencherDatalistClientes', 'clienteBuscaInput', 'clienteBuscaFoco', 'clienteBuscaEsconder',
            'onClienteObraChange', 'onLocalObraChange', 'escapeHtmlSimples', '_tenantId', 'omNovoItem',
            '_verOsAdicionarMaterial', '_avisarAdminArtigoNovo', '_notificarAdminESubadmin', '_notificarFuncionario',
            'renderizarNotifPessoalBanner', '_marcarNotifPessoalLida', '_esc', '_itensPendenciasAlerta', '_abrirRegistoPendenciaAlerta',
        ];
        await page.addScriptTag({ content: `
            var usuarioLogado = {id:'tenant', role:'admin', nome:'Ana'};
            var dados = {
                administradores: [{id:'tenant'}, {id:'other'}],
                funcionarios: [{id:'sub', adminId:'tenant', role:'subadmin'},
                    {id:'suspended', adminId:'tenant', role:'subadmin', suspenso:true},
                    {id:'foreign', adminId:'other', role:'subadmin'}],
                obras: [{id:'work', adminId:'tenant', nome:'Obra A', clienteId:'client', localId:'site'}],
                clientes: [{id:'client', adminId:'tenant', numeroCliente:'517', nome:'Luz & "Som"'}],
                locais: [{id:'site', adminId:'tenant', clienteId:'client', nome:'Loja'}],
                servicos: [{id:'os', adminId:'tenant', obraId:'work'}],
            };
            var _omItens = [{marca:'Marca', categoria:'Categoria'}], entidadeAtual, idEditando;
            var id = 0, saved = [], pushes = [], calls = [];
            var supa = {functions:{invoke: (_name, {body}) => {pushes.push(body); return Promise.resolve();}}};
            var adminAtual = () => dados.administradores[0], obrasAvancadoAtivo = () => false, moduloCrmAtivo = () => false;
            var _obraAtribuidosHtml = () => '', _obAtualizarResponsavelFolha = () => {};
            var gerarId = () => 'generated-' + ++id, guardarDados = () => saved.push(structuredClone(dados));
            var renderOmItens = () => {}, renderizarArtigos = () => {}, _verOsMostrar = () => {};
            var moduloNotificacoesAtivo = () => true, _tempoRelativo = () => 'agora';
            var getDataHoje = () => '2026-11-10', _armazemPrincipalId = () => 'warehouse';
            var mostrarErro = (message) => {throw Error(message)};
            ${functions.map(pick).join('\n')}
            ${keyboardHandler?.[0] || ''}
        ` });

        await page.evaluate(() => abrirModal('obra', 'work'));
        const input = page.locator('#ob_cliente_busca');
        await input.tap();
        assert.equal(await page.locator('#ob_cliente').inputValue(), 'client');
        assert.equal(await page.locator('#ob_local').inputValue(), 'site');

        await input.press('End');
        await page.keyboard.insertText('x');
        assert.equal(await input.inputValue(), '517 - Luz & "Som"x');
        const results = page.locator('#ob_cliente_busca_dd');
        assert.equal(await results.innerText(), 'Sem clientes encontrados');
        const [field, list] = await Promise.all([input.boundingBox(), results.boundingBox()]);
        assert(field.width >= 160, 'the focused input keeps room for typed text');
        assert(list.y >= field.y + field.height, 'the results stay below the input');

        await page.evaluate(() => {
            const height = document.activeElement.getBoundingClientRect().bottom - 35;
            Object.defineProperty(visualViewport, 'height', { configurable: true, value: height });
            visualViewport.dispatchEvent(new Event('resize'));
        });
        assert(await input.evaluate((field) => field.getBoundingClientRect().bottom <= visualViewport.height));
        await input.press('Backspace');
        await results.getByText('517 - Luz & "Som"', { exact: true }).tap();
        assert.equal(await page.locator('#ob_cliente').inputValue(), 'client');
        assert(await page.locator('#ob_local option[value="site"]').count());

        const alerts = await page.evaluate(() => {
            window.prompt = () => 'Cabo';
            omNovoItem(0);
            document.getElementById('modalOverlay').classList.remove('open');
            document.body.insertAdjacentHTML('beforeend', `
                <input id="veros_artigo_escolhido_id"><div id="veros_novo_artigo_campos" style="display:block"></div>
                <input id="veros_novo_artigo_nome" value="Ficha"><input id="veros_novo_qtd" value="1">`);
            _verOsAdicionarMaterial('os');
            _verOsAdicionarMaterial('os'); // Existing catalog item, so no new alert.
            const [plan, linked] = dados.artigos;
            _avisarAdminArtigoNovo(plan.id, plan.nome, 'tenant', 'no plano de materiais da obra');
            window.abrirModal = (tipo, id) => calls.push([tipo, id]);
            return {
                ids: [plan.id, linked.id],
                alerts: dados.notificacoes,
                recipients: pushes.map((push) => push.utilizador_id),
                planned: _omItens[0].artigoId,
                linked: dados.obraMateriais[0].artigoId,
                persisted: saved.at(-1).notificacoes.length,
            };
        });
        assert.deepEqual(alerts.recipients, ['tenant', 'sub', 'tenant', 'sub']);
        assert.equal(alerts.persisted, 4);
        assert.deepEqual([alerts.planned, alerts.linked], alerts.ids);
        assert.match(alerts.alerts[0].mensagem, /Cabo.*plano de materiais da obra/);
        assert.match(alerts.alerts[2].mensagem, /Ficha.*ordem de serviço/);
        await page.locator('#notifPessoalBanner').getByText(/"Cabo" foi criado/).click();
        assert.deepEqual(await page.evaluate(() => calls), [['artigo', alerts.ids[0]]]);
        assert.deepEqual(errors, []);
        console.log('PASS: mobile client editing and keyboard viewport, saved selection, scoped article notifications and direct opening');
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
