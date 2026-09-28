// Navegação operacional e vistas do cliente. Reutiliza as ações, licenças e
// formulários da aplicação; não cria uma segunda camada de persistência.
const TG_AREAS = {
    servicos: { nome: 'Serviços', icone: 'fa-wrench', texto: 'Acompanhe o trabalho de todos os clientes.', secoes: ['servicos', 'assistencias', 'contratos', 'obras-longa', 'folhas', 'relatorio-os'] },
    agenda: { nome: 'Agenda', icone: 'fa-calendar-days', texto: 'Planeie serviços, obras e disponibilidade da equipa.', secoes: ['agenda', 'agenda-obras', 'calendario-equipa'] },
    equipa: { nome: 'Equipa', icone: 'fa-users', texto: 'Pessoas, presenças e organização do trabalho.', secoes: ['funcionarios', 'ponto', 'assiduidade', 'pedidos', 'mapa-equipa', 'alertas-geofence'] },
    mais: { nome: 'Mais', icone: 'fa-ellipsis', texto: 'Recursos da empresa, análises e configuração.', secoes: [] }
};
const TG_NOMES = { servicos: 'Todas as ordens de serviço', assistencias: 'Pedidos de assistência', contratos: 'Contratos e manutenções', 'obras-longa': 'Todas as obras', agenda: 'Agenda de serviços', 'agenda-obras': 'Planeamento de obras', 'calendario-equipa': 'Disponibilidade da equipa', 'relatorios-personalizados': 'Modelos de relatórios', reports: 'Indicadores de gestão', 'dashboard-analitico': 'Análise de produtividade', ferramentas: 'Ferramentas de trabalho (QR)' };
const _tgClientePosicoes = Object.create(null);
const _tgClienteDatasOS = Object.create(null);
function _tgCard(sec) { return document.querySelector('#cardsGrid .card-principal[data-card="' + sec + '"]'); }
function _tgCardPermitido(card) { return !!card && !card.classList.contains('hidden-card') && !card.classList.contains('card-bloqueado'); }
function _tgCardsArea(area) {
    const cards = [...document.querySelectorAll('#cardsGrid .card-principal')].filter(_tgCardPermitido);
    if (area !== 'mais') return (TG_AREAS[area]?.secoes || []).map(_tgCard).filter(_tgCardPermitido);
    const usados = new Set(['clientes', ...Object.values(TG_AREAS).flatMap(a => a.secoes)]);
    return cards.filter(c => !usados.has(c.dataset.card));
}
function _tgGrupoDaSecao(sec) {
    if (sec === '__inicio' || sec === 'clientes' || sec?.startsWith('area-')) return sec;
    if (sec === 'dashboard-central') return '__inicio';
    for (const [key, area] of Object.entries(TG_AREAS)) if (area.secoes.includes(sec)) return 'area-' + key;
    return 'area-mais';
}
function _tgMenuSimplesHTML(mobile) {
    const itens = [{ sec: '__inicio', nome: 'Hoje', icone: 'fa-sun', acao: "_tgHoje()" }];
    if (_tgCardPermitido(_tgCard('clientes'))) itens.push({sec:'clientes', nome:'Clientes', icone:'fa-address-book', acao:"_tgAbrirOriginal('clientes')"});
    for (const [key, area] of Object.entries(TG_AREAS)) {
        if (_tgCardsArea(key).length) itens.push({sec:'area-'+key, nome: area.nome, icone:area.icone, acao:`_tgAbrirArea('${key}')`});
    }
    return itens.map(i => `<button type="button" class="${mobile ? 'menu-inf-item' : 'tg-nav-item'}" data-secao="${i.sec}" onclick="${i.acao}" title="${i.nome}"><i class="fas ${i.icone}" aria-hidden="true"></i><span>${i.nome}</span></button>`).join('');
}
function _tgMarcarMenuSimples(sec) {
    const grupo = _tgGrupoDaSecao(sec);
    document.querySelectorAll('#tgSidebarNav [data-secao], #menuInferiorMobile [data-secao]').forEach(el => {
        const ativo = el.dataset.secao === grupo || el.dataset.secao === sec;
        el.classList.toggle('ativo', ativo);
        if (ativo) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
}
function _tgHoje() {
    _wsClienteFechar();
    if (_ehPerfilMobile()) { const dia = document.getElementById('omeudia'); const raiz = dia?.closest('#tgHome') || document.getElementById('cardsGrid'); if (raiz) raiz.style.display = 'block'; _voltarMeuDia(); _contextoAtual = '__inicio'; _tgMarcarMenuSimples('__inicio'); }
    else irParaInicio();
}
function _tgAbrirOriginal(sec) {
    const card = _tgCard(sec);
    if (!_tgCardPermitido(card)) return;
    _wsClienteFechar();
    // O clique original mantém os controlos de acesso, os add-ons e as integrações.
    card.click();
    _fecharSidebarMobile();
}
function _tgAbrirArea(area) {
    if (!usuarioLogado || usuarioLogado.role === 'cliente' || !TG_AREAS[area]) return;
    _wsClienteFechar();
    let painel = document.getElementById('secao-navegacao-simples');
    if (!painel) { painel = document.createElement('section'); painel.id = 'secao-navegacao-simples'; painel.className = 'section-container'; document.getElementById('cardsGrid').after(painel); }
    const info = TG_AREAS[area];
    const cards = _tgCardsArea(area);
    const esc = escapeHtmlSimples;
    painel.innerHTML = `<div class="tg-area-head"><div><p class="tg-area-eyebrow">TOTAL GEST</p><h2>${info.nome}</h2><p>${info.texto}</p></div><button class="btn btn-outline" onclick="_tgHoje()"><i class="fas fa-arrow-left"></i> Hoje</button></div><div class="tg-area-grid">${cards.map(c => {
        const sec = c.dataset.card;
        const nome = TG_NOMES[sec] || c.querySelector('h3')?.textContent || sec;
        const descricao = c.querySelector('.info p')?.textContent || 'Abrir';
        return `<button type="button" class="tg-area-card" onclick="_tgAbrirOriginal('${sec}')"><i class="${esc(c.querySelector('.icon i')?.className || 'fas fa-layer-group')}" aria-hidden="true"></i><span><strong>${esc(nome)}</strong><small>${esc(descricao)}</small></span><i class="fas fa-chevron-right" aria-hidden="true"></i></button>`;
    }).join('')}</div>`;
    if (area === 'equipa' && ['admin','subadmin','encarregado'].includes(usuarioLogado.role) && moduloArmazemAtivo(adminDoUtilizador())) {
        painel.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-outline tg-area-quiosque" onclick="ativarModoQuiosque()"><i class="fas fa-tablet-screen-button"></i> Abrir modo quiosque</button>');
    }
    document.querySelectorAll('.section-container.active').forEach(el => el.classList.remove('active'));
    ['tgHome','cardsGrid','painelGrupoMobile','omeudia'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    painel.classList.add('active');
    _contextoAtual = 'area-' + area;
    _marcarNavAtivo(_contextoAtual);
    _atualizarBreadcrumb(info.nome);
    _fecharSidebarMobile();
    window.scrollTo({top:0, behavior:'smooth'});
}
function _tgClienteGuardarPosicao() {
    const overlay = document.getElementById('wsClienteOverlay');
    const conteudo = document.getElementById('wsClienteConteudo');
    if (overlay?.dataset.clienteAtual && overlay.dataset.abaAtual && conteudo && overlay.classList.contains('open')) _tgClientePosicoes[overlay.dataset.clienteAtual + ':' + overlay.dataset.abaAtual] = conteudo.scrollTop;
}
function _tgClienteAbaPrincipal(aba) {
    if (['assistencias', 'manutencoes'].includes(aba)) return 'os';
    if (aba === 'equipamentos') return 'locais';
    if (['personalizados', 'anexos', 'registos'].includes(aba)) return 'documentos';
    return aba;
}
function _tgClienteSubabaPermitida(aba, admin) {
    if (aba === 'assistencias') return moduloAssistAtivo(admin);
    if (['manutencoes', 'equipamentos'].includes(aba)) return moduloContratosAtivo(admin);
    return true;
}
function _tgClienteSubnav(clienteId, aba) {
    const principal = _tgClienteAbaPrincipal(aba);
    const opcoes = principal === 'os' ? [['os','Ordens de serviço'],['assistencias','Assistências'],['manutencoes','Manutenções']]
        : principal === 'locais' ? [['locais','Locais'],['equipamentos','Equipamentos instalados']]
        : principal === 'documentos' ? [['documentos','Especialidade'],['personalizados','Personalizados'],['anexos','Documentação'],['registos','Registos da empresa']] : [];
    return opcoes.filter(([a]) => _tgClienteSubabaPermitida(a, adminAtual())).map(([a, titulo]) => `<button type="button" class="tg-cliente-subaba ${a === aba ? 'active' : ''}" aria-pressed="${a === aba}" onclick="_wsClienteAba('${clienteId}','${a}')">${titulo}</button>`).join('');
}
function _tgClienteManutencoes(clienteId) {
    const contratos = (dados.contratos || []).filter(c => c.clienteId === clienteId);
    const linhas = contratos.map(c => ({ c, proxima: calcularProximaManutencao(c), ultima: ultimoRegistoContrato(c.id) })).sort((a,b)=>(a.proxima || '9999').localeCompare(b.proxima || '9999'));
    const data = d => d ? escapeHtmlSimples(d.split('-').reverse().join('/')) : 'Não definida';
    return '<p class="help-text">Próximas intervenções calculadas a partir da periodicidade e do último registo de cada contrato.</p>' + (linhas.length ? linhas.map(({c,proxima,ultima}) => {
        const estado = estadoManutencao(proxima);
        const local = (dados.locais || []).find(l => l.id === c.localId && l.clienteId === clienteId);
        const historico = (dados.registosManutencao || []).filter(r => r.contratoId === c.id && r.dataRealizacao).sort((a,b) => b.dataRealizacao.localeCompare(a.dataRealizacao));
        return `<article class="tg-doc-row"><div><strong>Contrato ${escapeHtmlSimples(c.numero || '—')} · ${escapeHtmlSimples(local?.nome || 'Sede')}</strong><p>Próxima: ${data(proxima)} · ${escapeHtmlSimples(estado.label)}</p><small>Última realizada: ${data(ultima?.dataRealizacao)}</small>${historico.length ? `<details><summary>${historico.length} manutenção(ões) realizada(s)</summary>${historico.map(r => `<p>${data(r.dataRealizacao)} — ${escapeHtmlSimples(r.observacoes || 'Intervenção registada')}</p>`).join('')}</details>` : ''}</div><button class="btn btn-outline" onclick="_wsSairPara('${clienteId}');abrirModalContrato('${c.id}')">Ver contrato</button></article>`;
    }).join('') : '<p class="help-text">Sem contratos de manutenção associados.</p>');
}
async function _tgClienteDocumentos(clienteId, aba) {
    const esc = escapeHtmlSimples;
    if (aba === 'registos') {
        const admin = adminAtual() || {};
        return `<h3>Registos da empresa prestadora</h3><p class="help-text">Dados utilizados nos documentos deste cliente. A alteração é feita no perfil da empresa.</p><div class="tg-doc-row"><div><strong>Registo prévio</strong><p>${esc(admin.numeroRegistoPrevio || 'Não definido')}</p></div><div><strong>Registo ANEPC</strong><p>${esc(admin.numeroAnepc || 'Não definido')}</p></div></div>`;
    }
    if (aba === 'anexos') {
        const contratos = moduloContratosAtivo(adminAtual()) ? (dados.contratos || []).filter(c => c.clienteId === clienteId && c.documentoUrl) : [];
        const obras = moduloArmazemAtivo(adminAtual()) ? (dados.obras || []).filter(o => o.clienteId === clienteId) : [];
        const docs = (dados.obraDocumentos || []).filter(d => obras.some(o => o.id === d.obraId));
        return `<p class="help-text">Documentação dos contratos e obras deste cliente. Para adicionar ou organizar ficheiros, abra o contrato ou a obra correspondente.</p>${contratos.map(c => `<div class="tg-doc-row"><div><strong>${esc(c.documentoNome || 'Documento do contrato')}</strong><p>Contrato ${esc(c.numero || '—')}</p></div><button class="btn btn-outline" onclick="_wsSairPara('${clienteId}');abrirModalContrato('${c.id}')">Abrir contrato</button></div>`).join('')}${docs.map(d => `<div class="tg-doc-row"><div><strong>${esc(d.nome || 'Documento')}</strong><p>${esc(obras.find(o=>o.id===d.obraId)?.nome || 'Obra')}</p></div><button class="btn btn-outline" onclick="_verObraTransferirDocumento('${d.id}')">Transferir</button></div>`).join('')}${obras.map(o=>`<div class="tg-doc-row"><span>Documentos de ${esc(o.nome || 'Obra')}</span><button class="btn btn-outline" onclick="_wsSairPara('${clienteId}');abrirObraLongaDetalhe('${o.id}')">Abrir obra</button></div>`).join('')}${!contratos.length && !obras.length ? '<p class="help-text">Sem documentos associados a contratos ou obras.</p>' : ''}`;
    }
    const custom = aba === 'personalizados';
    const relatorios = (dados.relatoriosEspecialidade || []).filter(r => r.clienteId === clienteId && (String(r.tipo || '').startsWith('CUSTOM_') === custom)).sort((a,b)=>(b.data || '').localeCompare(a.data || ''));
    const base = {REX:'Extintores',RBI:'Bocas de incêndio',RSI:'Deteção de incêndio',RCM:'Monóxido de carbono',RIE:'Iluminação de emergência',RCP:'Portas corta-fogo',RCCTV:'Videovigilância',RIN:'Intrusão',RDI:'Declaração de instalação'};
    return `<div class="tg-doc-toolbar"><p class="help-text">${custom ? 'Relatórios personalizados' : 'Relatórios de especialidade'} deste cliente, incluindo rascunhos. Para preencher um relatório, abra a OS correspondente.</p><button class="btn btn-primary" onclick="_wsClienteAba('${clienteId}','os')">Abrir serviços</button></div>${relatorios.length ? relatorios.map(r => {
        const tipo = base[r.tipo] || (dados.tiposTrabalhoCustom || []).find(t => t.codigo === r.tipo)?.nome || r.tipo;
        const local = (dados.locais || []).find(l=>l.id===r.localId && l.clienteId===clienteId);
        const os = (dados.servicos || []).find(s=>s.id===r.servicoId && s.clienteId===clienteId);
        return `<article class="tg-doc-row"><div><strong>${esc(tipo || 'Relatório')}${r.numeroDocumento ? ' · ' + esc(r.numeroDocumento) : ''}</strong><p>${esc(r.data || 'Sem data')} · ${esc(local?.nome || 'Sede')}${r.rascunho ? ' · Rascunho' : ''}</p></div><div class="tg-doc-acoes">${!r.rascunho ? `<button class="btn btn-outline" onclick="_verRelatorioEspecialidadeSnapshot('${r.id}',false)">Ver relatório</button>` : ''}${os ? `<button class="btn btn-outline" onclick="_wsSairPara('${clienteId}');abrirVerOS('${os.id}')">${r.rascunho ? 'Continuar na OS' : 'Ver OS'}</button>` : ''}</div></article>`;
    }).join('') : '<p class="help-text">Ainda não existem relatórios nesta categoria.</p>'}`;
}
