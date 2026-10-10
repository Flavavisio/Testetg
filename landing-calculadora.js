function atualizarLanding(){var l=document.getElementById('tg-landing');if(l)l.style.display=(typeof usuarioLogado!=='undefined'&&usuarioLogado)?'none':'block';}
async function loginLanding(e){e.preventDefault();var em=document.getElementById('landEmail').value;var pw=document.getElementById('landSenha').value;document.getElementById('loginEmail').value=em;document.getElementById('loginSenha').value=pw;return login(e);}

// Poupa espaço no ficheiro: o logo só está gravado uma vez (no cabeçalho);
// aqui é copiado para os outros sítios onde aparece (rodapé, sidebar, formulário de signup).
(function () {
    const master = document.getElementById('tg-logo-master');
    if (!master) return;
    function clonarLogo() {
        const src = master.src;
        document.querySelectorAll('.tg-logo-clone').forEach(img => { img.src = src; });
    }
    if (master.complete) clonarLogo(); else master.addEventListener('load', clonarLogo, { once: true });
})();

function abrirDetalheAddon(el) {
    const nome = el.querySelector('h3')?.childNodes[0]?.textContent?.trim() || el.querySelector('h3')?.textContent?.trim() || '';
    const desc = el.querySelector('p')?.textContent?.trim() || '';
    const icHtml = el.querySelector('.ic svg')?.outerHTML || '';
    const elPreco = el.querySelector('.pa .m');
    const precoM = elPreco?.getAttribute('data-m') || elPreco?.textContent?.trim() || '';
    const precoA = elPreco?.getAttribute('data-a') || '';
    document.getElementById('tg-addon-ic').innerHTML = icHtml;
    document.getElementById('tg-addon-nome').textContent = nome;
    document.getElementById('tg-addon-desc').textContent = desc;
    document.getElementById('tg-addon-precos').innerHTML = `
        <div><div class="lbl">Mensal</div><div class="val">${precoM}</div></div>
        <div><div class="lbl">Anual (-10%)</div><div class="val">${precoA}</div></div>
    `;
    document.getElementById('tg-addon-overlay').classList.add('open');
}
function fecharDetalheAddon() {
    document.getElementById('tg-addon-overlay').classList.remove('open');
}
// Public plan finder: the same pack price source as the pricing cards and signup.
const TCW_NEEDS = {instalacoes: 1, equipa: 1, portal: 1, contratos: 1, frota: 1, armazem: 2, assist: 2, crm: 3};
const TCW_PACK_ORDER = ['express', 'expert', 'pro', 'supreme'];
const TCW_TITULOS = ['Quantas pessoas tem a equipa?', 'Que áreas precisa de gerir?', 'O pack para a sua equipa'];
let _tcwPasso = 1;
let _tcwRecomendacao = null;
let _tgBilling = 'mensal';
function tgPropostaUrl(pack, capacity, monthly, annual = false) {
    const periodo = annual ? 'anual' : 'mensal';
    const valor = annual ? Math.round(monthly * 12 * 0.9 * 100) / 100 : monthly;
    const mensagem = 'Olá, pretendo uma proposta Total Gest' + (pack ? ' para o pack ' + PACK_NOMES[pack] : '') +
        ', para ' + capacity + ' funcionários' + (monthly != null ? ', pagamento ' + periodo +
        ' (' + _packFmtEuro(valor) + (annual ? '/ano' : '/mês') + ', IVA incluído)' : '') + '.';
    return 'https://wa.me/351939373322?text=' + encodeURIComponent(mensagem);
}
function tgEscolherPack(event, pack) {
    if (_tgBilling === 'anual') return true; // the anchor opens a prefilled proposal, never sends it
    event.preventDefault();
    _tgRegistarEvento('clique_cta', 'pack_' + pack);
    abrirModalSignup(pack);
    return false;
}
function tgCalcularPack(func, necessidades) {
    if (!Number.isInteger(func) || func < 1 || func > 10000) return null;
    const nivel = Math.max(0, ...necessidades.map(n => TCW_NEEDS[n] || 0));
    const pack = TCW_PACK_ORDER[nivel];
    if (func > SU_MAX_FUNCIONARIOS) return {pack, funcionarios: func, proposta: true};
    const opcoes = SU_ESCALOES.map(e => {
        const blocos = Math.max(0, Math.ceil((func - Number(e.key)) / 5));
        return {pack, escalao: e.key, blocos, capacidade: Number(e.key) + blocos * 5,
            mensal: PACK_PRECOS_SITE[pack][e.key] + blocos * SU_PRECO_BLOCO_5};
    }).filter(o => o.capacidade <= SU_MAX_FUNCIONARIOS);
    opcoes.sort((a,b) => a.mensal - b.mensal || a.capacidade - b.capacidade || a.blocos - b.blocos);
    return {...opcoes[0], funcionarios: func, proposta: false};
}
function abrirWizardCalc() {
    _tgRegistarEvento('wizard_calc_abrir', null);
    _tcwPasso = 1;
    document.getElementById('tcw-error').hidden = true;
    _tcwRenderCabecalho();
    document.getElementById('tg-calc-wizard-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('tcw_func').focus();
}
function fecharWizardCalc() {
    document.getElementById('tg-calc-wizard-overlay').classList.remove('open');
    document.body.style.overflow = '';
}
function _tcwSyncFuncInput() {
    const value = document.getElementById('tcw_func').value;
    document.querySelectorAll('#tcw-func-chips button').forEach(b => {
        b.classList.toggle('on', b.dataset.v === value);
        b.setAttribute('aria-pressed', String(b.dataset.v === value));
    });
    document.getElementById('tcw-error').hidden = true;
}
document.addEventListener('click', e => {
    const chip = e.target.closest('#tcw-func-chips button');
    if (!chip) return;
    document.getElementById('tcw_func').value = chip.dataset.v;
    _tcwSyncFuncInput();
});
function _tcwRenderCabecalho() {
    document.getElementById('tcw-titulo-passo').textContent = TCW_TITULOS[_tcwPasso - 1];
    document.getElementById('tcw-step-label').textContent = _tcwPasso + ' de 3';
    document.getElementById('tcw-progress-fill').style.width = (_tcwPasso / 3 * 100) + '%';
    document.getElementById('tcw-btn-voltar').style.visibility = _tcwPasso === 1 ? 'hidden' : 'visible';
    document.getElementById('tcw-btn-seguinte').style.display = _tcwPasso === 3 ? 'none' : 'inline-flex';
    document.getElementById('tcw-btn-seguinte').textContent = _tcwPasso === 2 ? 'Ver recomendação →' : 'Seguinte →';
    document.querySelectorAll('.tcw-passo').forEach((el, i) => el.style.display = i === _tcwPasso - 1 ? '' : 'none');
}
function _tcwSeguinte() {
    if (_tcwPasso >= 3) return;
    if (_tcwPasso === 1) {
        const v = Number(document.getElementById('tcw_func').value);
        if (!Number.isInteger(v) || v < 1 || v > 10000) {
            const error = document.getElementById('tcw-error');
            error.textContent = 'Indique um número inteiro entre 1 e 10 000 funcionários.';
            error.hidden = false; document.getElementById('tcw_func').focus(); return;
        }
    }
    _tcwPasso++;
    if (_tcwPasso === 3) _tcwCalcularResultado();
    _tcwRenderCabecalho();
    document.getElementById('tg-calc-wizard-card').scrollTop = 0;
    document.getElementById('tcw-titulo-passo').setAttribute('tabindex', '-1');
    document.getElementById('tcw-titulo-passo').focus();
}
function _tcwVoltar() {
    if (_tcwPasso <= 1) return;
    _tcwPasso--; _tcwRenderCabecalho();
    document.getElementById('tcw-titulo-passo').focus();
}
function _tcwCalcularResultado() {
    const necessidades = Array.from(document.querySelectorAll('.tcw-addon input:checked')).map(c => c.value);
    const r = tgCalcularPack(Number(document.getElementById('tcw_func').value), necessidades);
    _tcwRecomendacao = r;
    if (!r) return;
    const alvo = document.getElementById('tcw-resultado-conteudo');
    if (r.proposta) {
        alvo.innerHTML = '<h3>Uma proposta para ' + r.funcionarios + ' funcionários</h3><p>O pack ' + PACK_NOMES[r.pack] +
            ' corresponde às áreas selecionadas. Para mais de 100 funcionários, confirmamos consigo a capacidade e o preço.</p>' +
            '<a class="btn btn-orange" target="_blank" rel="noopener" href="' + tgPropostaUrl(r.pack,r.funcionarios,null) + '">Pedir proposta no WhatsApp</a>';
        return;
    }
    const anual = _tgBilling === 'anual';
    const total = anual ? Math.round(r.mensal * 12 * 0.9 * 100) / 100 : r.mensal;
    alvo.innerHTML = '<span class="eyebrow">Sugestão para as áreas escolhidas</span><h3>Pack ' + PACK_NOMES[r.pack] + '</h3>' +
        '<p>Até ' + r.capacidade + ' funcionários · ' + (r.blocos ? 'escalão ' + r.escalao + ' + ' + r.blocos + ' bloco(s) de +5' : 'escalão ' + r.escalao) + '</p>' +
        '<div class="tg-recommended-price">' + _packFmtEuro(total) + '<small>/' + (anual ? 'ano' : 'mês') + ' · IVA incluído</small></div>' +
        '<p>' + PACK_LIMITES_TXT[r.pack] + '. Pode consultar a comparação completa antes de decidir.</p>' +
        (anual ? '<a class="btn btn-orange" href="' + tgPropostaUrl(r.pack,r.capacidade,r.mensal,true) + '" target="_blank" rel="noopener">Pedir proposta anual</a>' : '<button type="button" class="btn btn-orange" onclick="_tcwIniciarTeste()">Experimentar este pack</button>') +
        '<button type="button" class="btn btn-ghost" onclick="_tcwComparar()">Comparar funcionalidades</button>' +
        '<p class="tcw-sub">' + (anual ? 'O pagamento anual tem 10% de desconto. A equipa confirma consigo a proposta.' : '14 dias grátis. O preço indicado aplica-se após o teste.') + '</p>';
    _tgRegistarEvento('wizard_calc_resultado', r.pack);
}
function _tcwIniciarTeste() {
    const r = _tcwRecomendacao;
    if (!r || r.proposta) return;
    fecharWizardCalc(); _packMudarEscalao(r.escalao); abrirModalSignup(r.pack);
    _suBlocosExtra = r.blocos; _suRenderEscaloes(); _suAtualizarTotal();
}
function _tcwComparar() {
    const r = _tcwRecomendacao;
    if (!r) return;
    fecharWizardCalc();
    const target = document.getElementById('packDetalhesInline');
    target.dataset.packAberto = ''; _packVerDetalhes(r.pack);
    target.scrollIntoView({behavior:'smooth',block:'start'});
}
// Packs e escalões mostrados no checkout — os preços têm de bater sempre certo com os cartões
// da página (PACK_PRECOS_SITE), que reutiliza os preços da aplicação quando disponíveis.
const SU_PACKS = {
    express: { nome: 'Express' },
    expert:  { nome: 'Expert' },
    pro:     { nome: 'Pro' },
    supreme: { nome: 'Supreme' },
};
// Escalões-base de funcionários (o preço vem de PACK_PRECOS_SITE, por pack). A partir daqui,
// em qualquer um destes, dá para juntar blocos de +5 funcionários a 5€/mês cada — não é preciso
// escolher "mais de 50" à parte, os blocos somam-se ao escalão escolhido, até um total de 100.
const SU_ESCALOES = [
    { key: '5', label: 'Até 5 funcionários' },
    { key: '10', label: 'Até 10 funcionários' },
    { key: '25', label: 'Até 25 funcionários' },
    { key: '50', label: 'Até 50 funcionários' },
];
const SU_PRECO_BLOCO_5 = typeof PACK_PRECO_BLOCO_5 !== 'undefined' ? PACK_PRECO_BLOCO_5 : 5;
const SU_MAX_FUNCIONARIOS = 100;
function _suFormatarEuro(v) { return v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
let _suPackSelecionado = null;
let _suEscalaoSelecionado = '5';
let _suBlocosExtra = 0;
let _tgSignupFormHtml = '';
function abrirModalSignup(packChave) {
    const body = document.getElementById('tg-signup-body');
    document.getElementById('tg-signup-card').removeAttribute('aria-label');
    if (!_tgSignupFormHtml) _tgSignupFormHtml = body.innerHTML;
    if (!document.getElementById('su_empresa')) body.innerHTML = _tgSignupFormHtml;
    _suPackSelecionado = packChave && SU_PACKS[packChave] ? packChave : null;
    _suEscalaoSelecionado = (typeof _packEscalaoAtual !== 'undefined' && _packEscalaoAtual && _packEscalaoAtual !== '50+') ? _packEscalaoAtual : '5';
    _suBlocosExtra = 0;
    const resumo = document.getElementById('su_plano_resumo');
    const wrapColab = document.getElementById('su_colaboradores_wrap');
    const inputColab = document.getElementById('su_colaboradores');
    const blocoPack = document.getElementById('su_pack_bloco');
    const titulo = document.getElementById('su_titulo');
    const subtitulo = document.getElementById('su_subtitulo');
    if (_suPackSelecionado) {
        // Escolheu um pack de propósito, a partir da tabela de preços — isto já não é uma pessoa
        // curiosa a "só experimentar", é alguém a decidir-se por um plano. O texto deixa de falar
        // em "teste" para não parecer que está só a pedir uma demo.
        if (titulo) titulo.textContent = 'Ativar o Pack ' + SU_PACKS[_suPackSelecionado].nome;
        if (subtitulo) subtitulo.textContent = 'Preencha os dados abaixo para ativarmos a sua conta. Fica com 14 dias grátis já com este plano, antes de qualquer pagamento.';
        document.getElementById('su_plano_nome').textContent = 'Pack ' + SU_PACKS[_suPackSelecionado].nome;
        resumo.style.display = 'flex';
        wrapColab.style.display = 'none';
        inputColab.required = false;
        if (blocoPack) blocoPack.style.display = '';
        _suRenderEscaloes();
    } else {
        // Veio do CTA genérico "14 dias grátis" — sem pack ainda, pede só o nº de colaboradores.
        if (titulo) titulo.textContent = 'Comece agora o seu teste gratuito';
        if (subtitulo) subtitulo.textContent = 'Preencha os dados abaixo — a conta fica pronta assim que confirmar o email.';
        resumo.style.display = 'none';
        wrapColab.style.display = '';
        inputColab.required = true;
        inputColab.value = '';
        if (blocoPack) blocoPack.style.display = 'none';
    }
    _suAtualizarTotal();
    document.getElementById('tg-signup-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function _suRenderEscaloes() {
    const cont = document.getElementById('su_escalao_botoes');
    if (!cont) return;
    cont.innerHTML = SU_ESCALOES.map(e => `
        <button type="button" class="su-escalao-btn ${e.key === _suEscalaoSelecionado ? 'active' : ''}" onclick="_suMudarEscalao('${e.key}')">${e.label}</button>
    `).join('');
    // Os blocos de +5 aparecem sempre, seja qual for o escalão-base escolhido — servem para
    // qualquer pack e qualquer escalão, até ao máximo de 100 funcionários no total.
    const wrapBlocos = document.getElementById('su_blocos_wrap');
    if (wrapBlocos) wrapBlocos.style.display = '';
    document.getElementById('su_blocos_num').textContent = _suBlocosExtra;
    document.getElementById('su_blocos_pessoas').textContent = Number(_suEscalaoSelecionado) + _suBlocosExtra * 5;
    const inputColab = document.getElementById('su_colaboradores');
    if (inputColab) inputColab.value = SU_ESCALOES.find(e => e.key === _suEscalaoSelecionado)?.label || '';
}
function _suMudarEscalao(escalao) {
    _suEscalaoSelecionado = escalao;
    // Ao mudar de escalão-base, os blocos que já tinha ficam — só se ajustam para baixo se, com
    // o novo escalão, ultrapassarem os 100 no total.
    const maxBlocos = Math.floor((SU_MAX_FUNCIONARIOS - Number(escalao)) / 5);
    if (_suBlocosExtra > maxBlocos) _suBlocosExtra = maxBlocos;
    _suRenderEscaloes();
    _suAtualizarTotal();
}
function _suMudarBlocos(delta) {
    const maxBlocos = Math.floor((SU_MAX_FUNCIONARIOS - Number(_suEscalaoSelecionado)) / 5);
    _suBlocosExtra = Math.max(0, Math.min(maxBlocos, _suBlocosExtra + delta));
    document.getElementById('su_blocos_num').textContent = _suBlocosExtra;
    document.getElementById('su_blocos_pessoas').textContent = Number(_suEscalaoSelecionado) + _suBlocosExtra * 5;
    _suAtualizarTotal();
}
// Recalcula e mostra o preço total (pack do escalão-base + blocos de +5). Só quando há um pack
// escolhido — no CTA genérico do trial não há total a mostrar, está tudo grátis no teste.
function _suPrecoAtual() {
    if (!_suPackSelecionado) return null;
    const precos = PACK_PRECOS_SITE[_suPackSelecionado];
    return (precos[_suEscalaoSelecionado] || precos[5]) + _suBlocosExtra * SU_PRECO_BLOCO_5;
}
function _suAtualizarTotal() {
    const preco = document.getElementById('su_plano_preco');
    const detalhe = document.getElementById('su_plano_detalhe');
    if (!preco) return;
    if (!_suPackSelecionado) { preco.textContent = ''; if (detalhe) detalhe.textContent = ''; return; }
    const total = _suPrecoAtual();
    preco.textContent = _suFormatarEuro(total) + '/mês';
    if (detalhe) {
        const totalFunc = Number(_suEscalaoSelecionado) + _suBlocosExtra * 5;
        detalhe.textContent = _suBlocosExtra
            ? `${totalFunc} funcionários (${SU_ESCALOES.find(e => e.key === _suEscalaoSelecionado)?.label} + ${_suBlocosExtra} bloco${_suBlocosExtra === 1 ? '' : 's'} de +5)`
            : SU_ESCALOES.find(e => e.key === _suEscalaoSelecionado)?.label || '';
    }
}
// "mudar" no resumo — deixa escolher outro pack sem fechar o modal.
function _suMudarPlano() {
    fecharModalSignup();
    document.getElementById('tg-precos')?.scrollIntoView({ behavior: 'smooth' });
}
function fecharModalSignup() {
    document.getElementById('tg-signup-overlay').classList.remove('open');
    document.body.style.overflow = '';
}
function _suAlternarOlho(idCampo, btn) {
    const campo = document.getElementById(idCampo);
    const icone = btn.querySelector('i');
    btn.setAttribute('aria-label', campo.type === 'password' ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
    btn.setAttribute('aria-pressed', String(campo.type === 'password'));
    if (campo.type === 'password') { campo.type = 'text'; icone.className = 'fas fa-eye-slash'; }
    else { campo.type = 'password'; icone.className = 'fas fa-eye'; }
}
function _suSenhaValida(senha) {
    return senha.length >= 9 && /[A-Z]/.test(senha) && /[^A-Za-z0-9]/.test(senha);
}
function _suValidarSenha() {
    const s1 = document.getElementById('su_senha').value;
    const s2 = document.getElementById('su_senha2').value;
    const msg = document.getElementById('su_senha_msg');
    if (!s1) { msg.textContent = ''; return; }
    if (!_suSenhaValida(s1)) {
        msg.textContent = 'Precisa de pelo menos 9 caracteres, 1 maiúscula e 1 símbolo (ex: ! @ # $ %).';
        msg.style.color = '#dc2626';
        return;
    }
    if (s2 && s1 !== s2) {
        msg.textContent = 'As palavras-passe não coincidem.';
        msg.style.color = '#dc2626';
        return;
    }
    msg.textContent = s2 ? '✓ Palavra-passe válida.' : 'Palavra-passe válida — confirme-a abaixo.';
    msg.style.color = '#16a34a';
}

async function submeterSignup(e) {
    e.preventDefault();
    const btn = document.getElementById('su_btn');
    const dadosPedido = {
        empresa: document.getElementById('su_empresa').value.trim(),
        nome: document.getElementById('su_nome').value.trim(),
        email: document.getElementById('su_email').value.trim().toLowerCase(),
        telefone: document.getElementById('su_telefone').value.trim(),
        colaboradores: document.getElementById('su_colaboradores').value.trim() || null,
        nif: document.getElementById('su_nif').value.trim() || null,
        senha: document.getElementById('su_senha').value,
        // Modelo de packs: manda o pack escolhido, o escalão e (se for 50+) os blocos de +5.
        // "plano" fica com o nome do pack, para a Edge Function/super admin saberem o que ativar.
        plano: _suPackSelecionado || null,
        escalao: _suPackSelecionado ? _suEscalaoSelecionado : null,
        blocosExtra: _suPackSelecionado ? _suBlocosExtra : 0,
        addons: [],
    };
    const senha2 = document.getElementById('su_senha2').value;
    if (!dadosPedido.empresa || !dadosPedido.nome || !dadosPedido.email || !dadosPedido.telefone || !dadosPedido.colaboradores || !dadosPedido.nif) {
        alert('Por favor preencha todos os campos — são todos obrigatórios.');
        return false;
    }
    if (!_suSenhaValida(dadosPedido.senha)) {
        alert('A palavra-passe precisa de pelo menos 9 caracteres, 1 maiúscula e 1 símbolo (ex: ! @ # $ %).');
        return false;
    }
    if (dadosPedido.senha !== senha2) {
        alert('As palavras-passe não coincidem.');
        return false;
    }
    btn.disabled = true;
    btn.textContent = 'A processar…';
    try {
        const { data, error } = await supa.functions.invoke('criar_pedido_trial', { body: dadosPedido });
        if (error) {
            // o supabase-js só dá uma mensagem genérica no "error.message";
            // a mensagem real que a função devolveu vem no corpo da resposta (error.context)
            let mensagemReal = '';
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const corpo = await error.context.json();
                    mensagemReal = corpo?.erro || '';
                }
            } catch (e2) { /* ignora, usa mensagem genérica abaixo */ }
            throw new Error(mensagemReal || 'Não foi possível enviar o pedido. Tente novamente ou contacte-nos por WhatsApp.');
        }
        if (!data || data.erro) throw new Error(data?.erro || 'Falha ao criar o pedido.');
        const token = data.token;
        _tgRegistarEvento('signup', dadosPedido.empresa);
        _tgIdentificarVisitante(dadosPedido.nome, dadosPedido.email);
        document.getElementById('tg-signup-body').innerHTML = `
            <div class="signup-msg">
                <i class="fas fa-envelope-circle-check"></i>
                <h2>Confirme o seu email</h2>
                <p class="signup-sub">Enviámos um link de confirmação para <b id="tg-confirm-email"></b>.<br>A sua conta de teste (14 dias) fica ativa assim que confirmar.</p>
            </div>`;
        document.getElementById('tg-confirm-email').textContent = dadosPedido.email;
        document.getElementById('tg-signup-card').setAttribute('aria-label','Confirme o seu email');
    } catch (err) {
        console.error('signup trial:', err);
        alert(err && err.message ? err.message : 'Não foi possível enviar o pedido. Tente novamente ou contacte-nos por WhatsApp.');
        btn.disabled = false;
        btn.textContent = 'Criar conta de teste';
    }
    return false;
}
// ===================== Analytics da página pública (visitas + conversões) =====================
// Só corre uma vez por sessão do browser (sessionStorage) — não regista cliques dentro da app já
// autenticada, só a página de marketing pública, antes do login. Falha em silêncio se a Edge
// Function não estiver disponível — nunca deve travar a página por causa disto.
let _tgVisitaId = null;
function _tgSessaoId() {
    let s = sessionStorage.getItem('tg_sessao_analytics');
    if (!s) { s = gerarId() + gerarId(); sessionStorage.setItem('tg_sessao_analytics', s); }
    return s;
}
// Ao contrário do sessao_id (reinicia a cada aba/sessão nova), este fica gravado no telemóvel/PC
// entre visitas diferentes — é o que permite saber se alguém é "novo" ou "já cá esteve".
function _tgVisitanteId() {
    let v = localStorage.getItem('tg_visitante_analytics');
    if (!v) { v = gerarId() + gerarId(); localStorage.setItem('tg_visitante_analytics', v); }
    return v;
}
// Lê utm_source/utm_medium/utm_campaign da própria URL, se vierem lá (ex: de um anúncio ou
// campanha de email) — funciona mesmo que o link não tenha esses parâmetros, fica tudo a null.
function _tgLerUTM() {
    const params = new URLSearchParams(location.search);
    return {
        utmSource: params.get('utm_source') || null,
        utmMedium: params.get('utm_medium') || null,
        utmCampaign: params.get('utm_campaign') || null,
    };
}
async function _tgRegistarVisita() {
    try {
        const utm = _tgLerUTM();
        const { data } = await supa.functions.invoke('registar-visita', {
            body: {
                acao: 'visita',
                sessaoId: _tgSessaoId(),
                visitanteId: _tgVisitanteId(),
                paginaAtual: location.pathname + location.search,
                referrer: document.referrer || null,
                dispositivo: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                resolucaoEcra: window.screen ? `${window.screen.width}x${window.screen.height}` : null,
                utmSource: utm.utmSource,
                utmMedium: utm.utmMedium,
                utmCampaign: utm.utmCampaign
            }
        });
        if (data?.visitaId) _tgVisitaId = data.visitaId;
    } catch (e) { /* silencioso — analytics nunca deve travar a página pública */ }
}
function _tgRegistarEvento(tipo, detalhe) {
    try {
        supa.functions.invoke('registar-visita', { body: { acao: 'evento', tipo, detalhe: detalhe || null, sessaoId: _tgSessaoId(), visitaId: _tgVisitaId } }).catch(() => {});
    } catch (e) { /* silencioso */ }
}
// Só é chamada quando a própria pessoa se identifica (ex: preenche o formulário de signup) —
// nunca tenta adivinhar quem é a partir do dispositivo.
function _tgIdentificarVisitante(nome, email) {
    try {
        supa.functions.invoke('registar-visita', { body: { acao: 'identificar', sessaoId: _tgSessaoId(), visitaId: _tgVisitaId, nome: nome || null, email: email || null } }).catch(() => {});
    } catch (e) { /* silencioso */ }
}
// Duração da visita e profundidade de scroll — o que interessa aqui não é a cada X segundos, é
// o valor MÁXIMO ao longo de toda a visita (scroll pode subir e descer; duração só cresce).
// Manda pelo sendBeacon ao sair, porque nessa altura a página pode fechar a qualquer instante —
// um fetch normal arriscava-se a nunca chegar a partir.
let _tgInicioVisita = Date.now();
let _tgScrollMaximo = 0;
function _tgAtualizarScrollMaximo() {
    const landing = document.getElementById('tg-landing');
    if (typeof usuarioLogado !== 'undefined' && usuarioLogado) return;
    const doc = landing || document.documentElement;
    const alturaTotal = doc.scrollHeight - doc.clientHeight;
    if (alturaTotal <= 0) { _tgScrollMaximo = 100; return; }
    const pct = Math.round(Math.min(100, ((landing ? landing.scrollTop : window.scrollY) / alturaTotal) * 100));
    if (pct > _tgScrollMaximo) _tgScrollMaximo = pct;
}
function _tgEnviarDuracaoFinal() {
    try {
        if (!_tgVisitaId) return; // visita nem chegou a ficar registada, nada a atualizar
        const duracaoSegundos = Math.round((Date.now() - _tgInicioVisita) / 1000);
        const payload = JSON.stringify({ acao: 'duracao', sessaoId: _tgSessaoId(), visitaId: _tgVisitaId, duracaoSegundos, scrollMaximoPct: _tgScrollMaximo });
        const url = `${SUPABASE_URL}/functions/v1/registar-visita`;
        // Nota: usa fetch(keepalive) em vez de sendBeacon — o sendBeacon não deixa mandar
        // cabeçalhos, e esta função (como todas as outras chamadas à Supabase) precisa da apikey
        // para aceitar o pedido. O keepalive garante o mesmo comportamento essencial do beacon:
        // o pedido continua a ser enviado mesmo que a página feche logo a seguir.
        fetch(url, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
            body: payload,
        }).catch(() => {});
    } catch (e) { /* silencioso */ }
}
window.addEventListener('scroll', _tgAtualizarScrollMaximo, { passive: true });
document.getElementById('tg-landing')?.addEventListener('scroll', _tgAtualizarScrollMaximo, {passive:true});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _tgEnviarDuracaoFinal(); });
window.addEventListener('pagehide', _tgEnviarDuracaoFinal);

// ===================== PACKS (Fase 2 — site) =====================
// Preços por escalão de funcionários (c/ IVA). Acima de 50, blocos de +5 a 5€/mês.
const PACK_PRECOS_SITE = typeof PACK_PRECOS !== 'undefined' ? PACK_PRECOS : {
    express: { 5: 42.49, 10: 47.49, 25: 62.49, 50: 102.49 },
    expert:  { 5: 52.49, 10: 57.49, 25: 72.49, 50: 112.49 },
    pro:     { 5: 72.49, 10: 77.49, 25: 92.49, 50: 132.49 },
    supreme: { 5: 102.49, 10: 107.49, 25: 122.49, 50: 162.49 },
};
// Detalhe de cada pack — o que ganhas ao subir de nível fica agrupado, para o cliente perceber
// logo "o que é que este pack me traz a mais". Cumulativo: cada um inclui tudo o do anterior.
// Mapa completo de funcionalidades por pack (igual ao Excel). Agrupado por área para se ler bem.
// ✓ = incluído nesse pack. A ordem segue a lógica cumulativa Express → Expert → Pro → Supreme.
const PACK_FUNCS = [
    { grupo: 'Base', linhas: [
        ['Clientes', 1,1,1,1],
        ['Instalações do cliente', 1,1,1,1],
        ['Passaporte de Instalação', 0,1,1,1],
        ['Ordens de Serviço', 1,1,1,1],
        ['Folha de Obra / Intervenção', 1,1,1,1],
        ['PDF Folha de Obra — Cliente', 1,1,1,1],
        ['Manutenções', 1,1,1,1],
        ['Agenda de Obras (calendário de OS)', 1,1,1,1],
        ['Funcionários', 1,1,1,1],
        ['Calendário da equipa', 1,1,1,1],
        ['Relatórios personalizados', '5 modelos','15 modelos','40 modelos','Ilimitados'],
    ]},
    { grupo: 'Equipa no terreno', linhas: [
        ['Ponto / Assiduidade', 0,1,1,1],
        ['GPS nas picagens', 0,1,1,1],
        ['Férias e faltas', 0,1,1,1],
        ['Portal do Cliente', 0,1,1,1],
        ['Contratos de manutenção', 0,1,1,1],
        ['Frota', 0,1,1,1],
        ['Relatórios de especialidade', 0,'REX, RBI, RSI, RCM, RIE, RCP, CCTV, Intrusão','REX, RBI, RSI, RCM, RIE, RCP, CCTV, Intrusão','REX, RBI, RSI, RCM, RIE, RCP, CCTV, Intrusão'],
        ['Mapa da Equipa', 0,1,1,1],
        ['Painel TV', 0,1,1,1],
    ]},
    { grupo: 'Operação (obras, stock, assistências)', linhas: [
        ['Folha de Obra — Custos Internos', 0,0,1,1],
        ['Custos de mão de obra', 0,0,1,1],
        ['Custos dos materiais', 0,0,1,1],
        ['Obras', 0,0,1,1],
        ['Picagem entrada/saída em obra', 0,0,1,1],
        ['Stock / Artigos', 0,0,1,1],
        ['Armazéns', 0,0,1,1],
        ['Requisições', 0,0,1,1],
        ['Encomendas', 0,0,1,1],
        ['Fornecedores', 0,0,1,1],
        ['Ferramentas / QR', 0,0,1,1],
        ['Assistências', 0,0,1,1],
        ['Financeiro / Despesas', 0,0,1,1],
    ]},
    { grupo: 'Topo de gama', linhas: [
        ['CRM Comercial', 0,0,0,1],
        ['Dashboard Analítico', 0,0,0,1],
        ['Geofence / histórico GPS', 0,0,0,1],
        ['Opções de integração ERP (sujeitas a compatibilidade)', 0,0,0,1],
        ['Rondas / Vigilância', 0,0,0,1],
        ['Auditoria avançada', 0,0,0,1],
    ]},
];
const PACK_LIMITES_TXT = { express: 'Até 5 modelos de relatório personalizado', expert: 'Até 15 modelos', pro: 'Até 40 modelos', supreme: 'Modelos ilimitados' };
const PACK_NOMES = { express: 'Express', expert: 'Expert', pro: 'Pro', supreme: 'Supreme' };
const PACK_IDX = { express: 1, expert: 2, pro: 3, supreme: 4 };
let _packEscalaoAtual = '5';
function _packFmtEuro(v) { return v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function _packMudarEscalao(escalao) {
    if (!SU_ESCALOES.some(e => e.key === escalao)) return;
    _packEscalaoAtual = escalao;
    document.querySelectorAll('.pack-escalao-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.escalao === escalao);
        b.setAttribute('aria-pressed', String(b.dataset.escalao === escalao));
    });
    tgAtualizarPrecos();
}
function tgAtualizarPrecos() {
    const anual = _tgBilling === 'anual';
    document.querySelectorAll('#tg-billing button').forEach(b => {
        b.classList.toggle('on', b.dataset.mode === _tgBilling);
        b.setAttribute('aria-pressed', String(b.dataset.mode === _tgBilling));
    });
    document.querySelectorAll('#packGrid .plan').forEach(card => {
        const mensal = PACK_PRECOS_SITE[card.dataset.pack][_packEscalaoAtual];
        const totalAnual = Math.round(mensal * 12 * 0.9 * 100) / 100;
        card.querySelector('.amt').textContent = _packFmtEuro(anual ? totalAnual : mensal);
        card.querySelector('.per').textContent = anual ? 'por ano · IVA incluído · equivalente a ' + _packFmtEuro(totalAnual / 12) + '/mês' : 'por mês · IVA incluído';
    });
    document.querySelectorAll('[data-pack-start]').forEach(a => {
        const pack = a.dataset.packStart;
        a.textContent = anual ? 'Pedir proposta anual' : 'Experimentar grátis';
        a.href = anual ? tgPropostaUrl(pack,_packEscalaoAtual,PACK_PRECOS_SITE[pack][_packEscalaoAtual],true) : '#tg-precos';
        if (anual) { a.target = '_blank'; a.rel = 'noopener'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    });
    const note = document.getElementById('tg-billing-note');
    if (note) note.textContent = anual ? 'Pagamento anual com 10% de desconto. Peça a proposta do pack escolhido no WhatsApp; a equipa confirma os detalhes consigo.' : 'Experimente durante 14 dias. O valor mensal indicado aplica-se após o teste.';
}
document.getElementById('tg-billing')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    _tgBilling = b.dataset.mode; tgAtualizarPrecos();
});
// Detalhe do pack: tabela comparativa completa (como no Excel), com a coluna do pack escolhido
// realçada. Assim vê-se não só o que este pack tem, mas como se compara com os outros.
function _packVerDetalhes(pack) {
    const alvo = document.getElementById('packDetalhesInline');
    if (!alvo || !PACK_NOMES[pack]) return;
    if (alvo.dataset.packAberto === pack) { alvo.innerHTML = ''; alvo.dataset.packAberto = ''; document.querySelectorAll('[data-pack-details]').forEach(b => b.setAttribute('aria-expanded','false')); document.querySelector('[data-pack-details="' + pack + '"]')?.focus(); return; }
    alvo.dataset.packAberto = pack;
    document.querySelectorAll('[data-pack-details]').forEach(b => b.setAttribute('aria-expanded',String(b.dataset.packDetails === pack)));
    const escolhido = PACK_IDX[pack];
    const cabecalho = ['express','expert','pro','supreme'].map(p =>
        `<th scope="col" class="${p === pack ? 'pack-col-destaque' : ''}">${PACK_NOMES[p]}</th>`).join('');
    const corpo = PACK_FUNCS.map(g => `
        <tr class="pack-grupo-linha"><td colspan="5">${g.grupo}</td></tr>
        ${g.linhas.map(l => `
            <tr>
                <td class="pack-func-nome">${l[0]}</td>
                ${[1,2,3,4].map(i => {
                    const v = l[i];
                    // Valor pode ser 1 (✓), 0 (—) ou texto (ex.: limite de relatórios por pack).
                    const conteudo = (typeof v === 'string')
                        ? `<span class="pack-valor-txt">${v}</span>`
                        : (v ? '<span class="pack-sim">✓</span>' : '<span class="pack-nao">—</span>');
                    return `<td class="pack-cel ${i === escolhido ? 'pack-col-destaque' : ''}">${conteudo}</td>`;
                }).join('')}
            </tr>
        `).join('')}
    `).join('');
    alvo.innerHTML = `
        <div class="pack-detalhe-caixa">
            <button class="pack-detalhe-fechar" onclick="_packVerDetalhes('${pack}')" aria-label="Fechar">&times;</button>
            <h3>Todas as funcionalidades — em destaque: Pack ${PACK_NOMES[pack]}</h3>
            <p class="pack-detalhe-resumo">${PACK_LIMITES_TXT[pack]}. Cada pack inclui tudo o do nível anterior.</p>
            <div class="pack-tabela-scroll">
                <table class="pack-tabela-funcs"><caption class="tg-visually-hidden">Comparação de funcionalidades dos packs Total Gest</caption>
                    <thead><tr><th scope="col">Funcionalidade</th>${cabecalho}</tr></thead>
                    <tbody>${corpo}</tbody>
                </table>
            </div>
            <a class="btn btn-orange" href="#tg-precos" data-pack-start="${pack}" onclick="return tgEscolherPack(event,'${pack}')" style="margin-top:14px;display:inline-block;">Experimentar grátis</a>
        </div>
    `;
    tgAtualizarPrecos();
    alvo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
if (document.getElementById('tg-landing') && !document.querySelector('.tg-login-page')) {
    // O elemento "tg-landing" existe sempre no HTML (só fica escondido por CSS depois do login),
    // por isso não chega para saber se é mesmo um visitante novo — confirma com a sessão real do
    // Supabase antes de contar a visita, para não contar utilizadores já autenticados a recarregar a página.
    supa.auth.getSession().then(({ data }) => { if (!data.session) _tgRegistarVisita(); }).catch(() => {});
}
(function(){var ano=document.getElementById('tg-ano');if(ano)ano.textContent=new Date().getFullYear();if(typeof _packMudarEscalao==='function'&&document.getElementById('packGrid')){_packMudarEscalao('5');}atualizarLanding();})();
