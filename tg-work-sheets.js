/* Folhas de obra: contexto, filtros e validação administrativa persistente. */
(function () {
    'use strict';
    const pendentes = new Set();
    let contaFiltros = '';
    const filtros = ['cliente', 'instalacao', 'obra', 'tecnico', 'validacao'];
    const podeValidar = () => ['admin', 'subadmin'].includes(usuarioLogado?.role);
    const identidade = () => JSON.stringify([usuarioLogado?.adminId || usuarioLogado?.id, usuarioLogado?.id, usuarioLogado?.role]);
    const tenantItem = (lista, id, tenant) => (lista || []).find(x => x.id === id && x.adminId === tenant);
    // Teste TG only. Billing is stored separately; ordinary sheet synchronisation never writes it.
    let grupo = 'obras', faturacao = 'por_faturar', contaEstado = '', chaveEstado = '', carga = null;
    let estados = new Map(), osHistoricas = new Map(), obrasHistoricas = new Map();
    let faturacaoPronta = false, erroEstado = '', avisoLigacoes = '';
    const normalizarEstado = estado => String(estado || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const finalizado = estado => ['concluido', 'concluida', 'terminado', 'terminada'].includes(normalizarEstado(estado));
    const osDaFolha = f => tenantItem(dados.servicos, f.servicoId, f.adminId) || osHistoricas.get(f.servicoId);
    const obraDaFolha = f => tenantItem(dados.obras, f.obraId || osDaFolha(f)?.obraId, f.adminId) || obrasHistoricas.get(f.obraId || osDaFolha(f)?.obraId);
    function situacao(f) {
        const os = osDaFolha(f), obra = obraDaFolha(f);
        const temObra = !!(f.obraId || os?.obraId);
        const osTerminada = finalizado(os?.status), obraTerminada = finalizado(obra?.estado);
        const cancelada = /cancelad/.test(normalizarEstado(os?.status)) || /cancelad/.test(normalizarEstado(obra?.estado));
        const incerta = !!((f.servicoId && !os) || ((f.obraId || os?.obraId) && !obra));
        // Validation moves the sheet; completion only controls eligibility for billing.
        const terminada = !incerta && !cancelada && (temObra ? obraTerminada && (!f.servicoId || osTerminada) : osTerminada);
        const bloqueioValidacao = incerta ? 'Ligação à Obra/OS por confirmar.' :
            f.servicoId && !osTerminada && cancelada ? 'A OS está cancelada.' : '';
        const nota = f.servicoId && temObra && !incerta && !cancelada
            ? `${osTerminada ? 'OS terminada' : 'OS em curso'} · ${obraTerminada ? 'Obra concluída' : 'Obra em curso'}` : '';
        const bloqueioFaturacao = incerta ? 'Ligação à Obra/OS por confirmar.' : cancelada ? 'Obra/OS cancelada.' :
            temObra && !obraTerminada ? 'Faturação disponível após concluir a obra.' :
            f.servicoId && !osTerminada ? 'Faturação disponível após terminar a OS.' :
            !temObra && !f.servicoId ? 'Associa uma obra ou OS para disponibilizar a faturação.' : '';
        return { grupo: f.validada === true ? 'concluidas' : temObra ? 'obras' : f.servicoId ? 'os' : 'obras', os, obra,
            terminada, incerta, cancelada, bloqueioValidacao, bloqueioFaturacao, nota, semLigacao: !f.servicoId && !f.obraId };
    }
    const estadoFolha = f => estados.get(f.id) || { faturada: false, versao: 0 };
    const assinaturaEstado = folhas => JSON.stringify([identidade(), folhas.map(f => [f.id, f.servicoId, f.obraId])]);

    function prepararConta() {
        if (contaEstado === identidade()) return;
        contaEstado = identidade(); chaveEstado = ''; carga = null;
        estados = new Map(); osHistoricas = new Map(); obrasHistoricas = new Map();
        faturacaoPronta = false; erroEstado = ''; avisoLigacoes = '';
        grupo = 'obras'; faturacao = 'por_faturar';
        const feedback = document.getElementById('folhasFaturacaoFeedback'); if (feedback) feedback.textContent = '';
    }

    async function lerLotes(tabela, coluna, ids, campos, tenant) {
        const linhas = [];
        for (let i = 0; i < ids.length; i += 100) {
            const { data, error } = await supa.from(tabela).select(campos).eq('admin_id', tenant).in(coluna, ids.slice(i, i + 100));
            if (error) throw error;
            linhas.push(...(data || []));
        }
        return linhas;
    }

    async function carregarEstado(forcar = false) {
        prepararConta();
        const folhas = folhasVisiveis(), chave = assinaturaEstado(folhas), conta = identidade(), tenant = _tenantId();
        if (!usuarioLogado || ['cliente', 'superadmin'].includes(usuarioLogado.role)) return;
        if (carga) return carga;
        if (!forcar && chaveEstado === chave) return;
        chaveEstado = chave; faturacaoPronta = false; erroEstado = ''; avisoLigacoes = '';
        const trabalho = (async () => {
            try {
                const idsOS = [...new Set(folhas.map(f => f.servicoId).filter(id => id && !tenantItem(dados.servicos, id, tenant)))];
                const antigasOS = await lerLotes('servicos', 'id', idsOS, 'id,admin_id,obra_id,cliente_id,local_id,contrato_id,descricao,status,numero_registo', tenant);
                if (conta !== identidade()) return;
                osHistoricas = new Map(antigasOS.map(s => [s.id, { id:s.id, adminId:s.admin_id, obraId:s.obra_id, clienteId:s.cliente_id, localId:s.local_id, contratoId:s.contrato_id, descricao:s.descricao, status:s.status, numeroRegisto:s.numero_registo }]));
                const idsObras = [...new Set(folhas.map(f => f.obraId || osDaFolha(f)?.obraId).filter(id => id && !tenantItem(dados.obras, id, tenant)))];
                const antigasObras = await lerLotes('obras', 'id', idsObras, 'id,admin_id,nome,estado,cliente_id,local_id', tenant);
                if (conta !== identidade()) return;
                obrasHistoricas = new Map(antigasObras.map(o => [o.id, { id:o.id, adminId:o.admin_id, nome:o.nome, estado:o.estado, clienteId:o.cliente_id, localId:o.local_id }]));
                const nIncertas = folhas.filter(f => situacao(f).incerta).length;
                avisoLigacoes = nIncertas ? `${nIncertas} folha(s) com ligação à Obra/OS por confirmar; a faturação fica indisponível nessas folhas.` : '';
                const linhas = await lerLotes('tg_teste_folhas_faturacao_atual', 'folha_id', folhas.map(f => f.id), 'folha_id,faturada,versao,alterado_por,alterado_em,motivo', tenant);
                if (conta !== identidade()) return;
                estados = new Map(linhas.map(l => [l.folha_id, l])); faturacaoPronta = true;
            } catch (e) {
                if (conta === identidade()) erroEstado = 'Não foi possível confirmar os estados e a faturação. Verifica a ligação e clica em Atualizar.';
            } finally {
                if (conta === identidade()) { carga = null; render(); }
            }
        })();
        carga = trabalho;
        return trabalho;
    }

    function contexto(f) {
        const tenant = f.adminId;
        const os = osDaFolha(f);
        const contrato = tenantItem(dados.contratos, f.contratoId || os?.contratoId, tenant);
        const obra = obraDaFolha(f);
        const localId = f.localId || os?.localId || obra?.localId || contrato?.localId;
        const local = tenantItem(dados.locais, localId, tenant);
        const clienteId = f.clienteId || os?.clienteId || obra?.clienteId || contrato?.clienteId || local?.clienteId;
        let cliente = tenantItem(dados.clientes, clienteId, tenant);
        let instalacao = local;
        // Formato antigo das folhas criadas sem OS: "Cliente / Instalação".
        // Só recupera a ligação se houver uma correspondência única e exata neste tenant.
        if (!clienteId && !cliente && f.obraDescricao) {
            const candidatos = (dados.clientes || []).filter(c => c.adminId === tenant && (
                f.obraDescricao === c.nome + ' / Sede' ||
                (dados.locais || []).some(l => l.adminId === tenant && l.clienteId === c.id && f.obraDescricao === c.nome + ' / ' + l.nome)
            ));
            if (candidatos.length === 1) {
                cliente = candidatos[0];
                const locais = (dados.locais || []).filter(l => l.adminId === tenant && l.clienteId === cliente.id && f.obraDescricao === cliente.nome + ' / ' + l.nome);
                if (locais.length === 1) instalacao = locais[0];
            }
        }
        const pessoa = tenantItem(dados.funcionarios, f.funcionarioId, tenant) || tenantItem(dados.encarregados, f.funcionarioId, tenant)
            || (dados.administradores || []).find(a => a.id === f.funcionarioId && a.id === tenant);
        const nomeObra = obra?.nome || f.obraDescricao || os?.descricao || '—';
        const nomeInstalacao = instalacao?.nome || (cliente && !localId ? 'Sede' : '—');
        return {
            cliente: { chave: cliente?.id || 'sem', nome: cliente?.nome || '—' },
            instalacao: { chave: instalacao?.id || (cliente && !localId ? 'sede:' + cliente.id : 'sem'), nome: nomeInstalacao },
            obra: { chave: obra?.id || 'texto:' + nomeObra, nome: nomeObra },
            tecnico: { chave: pessoa?.id || f.funcionarioId || 'sem', nome: pessoa?.nome || (f.funcionarioId ? '(removido)' : '—') }
        };
    }

    function folhasVisiveis() {
        if (!usuarioLogado || ['superadmin', 'cliente'].includes(usuarioLogado.role)) return [];
        const tenant = _tenantId();
        const pessoas = new Set([usuarioLogado.id]);
        if (usuarioLogado.role === 'encarregado') {
            const encarregado = tenantItem(dados.encarregados, usuarioLogado.id, tenant);
            const atribuidos = new Set(encarregado?.funcionariosIds || []);
            (dados.funcionarios || []).filter(f => f.adminId === tenant && atribuidos.has(f.id))
                .forEach(f => pessoas.add(f.id));
        }
        return (dados.folhasObra || []).filter(f => f.adminId === tenant &&
            (podeValidar() || pessoas.has(f.funcionarioId)) &&
            (usuarioLogado.role !== 'funcionario' || f.validada !== true));
    }

    function atualizarFiltros(linhas) {
        if (contaFiltros !== identidade()) {
            filtros.forEach(k => { const el = document.getElementById('folhasFiltro_' + k); if (el) el.value = ''; });
            contaFiltros = identidade();
        }
        // Cada filtro usa apenas as folhas que passaram pelos anteriores.
        // Uma escolha incompatível é limpa antes de construir o filtro seguinte.
        let disponiveis = linhas;
        for (const campo of filtros) {
            const select = document.getElementById('folhasFiltro_' + campo);
            if (!select) continue;
            const anterior = select.value;
            const chave = l => campo === 'validacao' ? (l.f.validada === true ? 'validada' : 'nao_validada') : l.ctx[campo].chave;
            const nome = l => campo === 'validacao' ? (l.f.validada === true ? 'Validadas' : 'Não validadas') : l.ctx[campo].nome;
            const opcoes = new Map(disponiveis.map(l => [chave(l), nome(l)]));
            select.replaceChildren(new Option(campo === 'validacao' ? 'Todas' : 'Todos', ''));
            [...opcoes].sort((a, b) => a[1].localeCompare(b[1], 'pt', { sensitivity: 'base', numeric: true }))
                .forEach(([id, nome]) => select.add(new Option(nome, id)));
            select.value = opcoes.has(anterior) ? anterior : '';
            if (select.value) disponiveis = disponiveis.filter(l => chave(l) === select.value);
        }
    }

    function render() {
        const tbody = document.getElementById('tabelaFolhas');
        const empty = document.getElementById('emptyFolhas');
        if (!tbody || !empty) return;
        prepararConta();
        const funcionario = usuarioLogado?.role === 'funcionario';
        document.getElementById('secao-folhas')?.classList?.toggle('folhas-funcionario', funcionario);
        for (const id of ['folhasGrupos', 'folhasFiltros', 'folhasFiltroContagem', 'folhasAvisoCarregamento']) {
            const el = document.getElementById(id); if (el) el.hidden = funcionario;
        }
        if (funcionario) {
            for (const id of ['folhasFaturacaoTabs', 'folhasEstadoAviso', 'folhasFaturacaoFeedback']) {
                const el = document.getElementById(id); if (el) el.hidden = true;
            }
            const titulo = document.getElementById('folhasListaTitulo'); if (titulo) titulo.textContent = 'Por verificar pela empresa';
            filtros.forEach(k => { const el = document.getElementById('folhasFiltro_' + k); if (el) { el.value = ''; el.replaceChildren(new Option('Todos', '')); } });
        } else {
            const feedback = document.getElementById('folhasFaturacaoFeedback'); if (feedback) feedback.hidden = false;
        }
        const comGrupos = !funcionario && !!document.getElementById('folhasGrupos');
        const todas = folhasVisiveis();
        const linhas = todas.map(f => ({ f, ctx: contexto(f), sit: situacao(f) }));
        if (comGrupos) {
            void carregarEstado();
            renderizarGrupos(linhas);
        }
        const doGrupo = comGrupos ? linhas.filter(({ f, sit }) => sit.grupo === grupo && (grupo !== 'concluidas' ||
            (faturacaoPronta && estadoFolha(f).faturada === (faturacao === 'faturadas')))) : linhas;
        // Não limpar escolhas enquanto o estado de faturação ainda está a carregar.
        if (!funcionario && (!comGrupos || grupo !== 'concluidas' || faturacaoPronta)) atualizarFiltros(doGrupo);
        const valores = Object.fromEntries(filtros.map(k => [k, document.getElementById('folhasFiltro_' + k)?.value || '']));
        const filtradas = doGrupo.filter(({ f, ctx }) => filtros.every(k => !valores[k] ||
            (k === 'validacao' ? (f.validada === true ? 'validada' : 'nao_validada') === valores[k] : ctx[k].chave === valores[k])));
        filtradas.sort((a, b) => _folhasOrdem === 'desc' ? (b.f.data || '').localeCompare(a.f.data || '') : (a.f.data || '').localeCompare(b.f.data || ''));
        const ordem = document.getElementById('folhasOrdemIcone');
        if (ordem) ordem.className = 'fas ' + (_folhasOrdem === 'desc' ? 'fa-sort-down' : 'fa-sort-up');
        const aviso = document.getElementById('folhasAvisoCarregamento');
        if (aviso) aviso.innerHTML = `<div style="margin-bottom:10px;"><button type="button" class="btn btn-sm btn-outline" onclick="carregarFolhasMaisAntigas()"><i class="fas fa-clock-rotate-left"></i> Carregar folhas mais antigas (+3 meses)</button> <span style="font-size:.8rem;">Assinadas desde ${_folhasCarregadoDesde ? new Date(_folhasCarregadoDesde + 'T00:00:00').toLocaleDateString('pt-PT') : '—'}. Por assinar aparecem sempre.</span></div>`;
        const contador = document.getElementById('folhasFiltroContagem');
        if (contador) contador.textContent = `${filtradas.length} de ${doGrupo.length} folhas neste separador · ${linhas.length} carregadas no total`;
        empty.style.display = filtradas.length ? 'none' : 'block';
        empty.textContent = funcionario ? 'Não tens folhas de obra por verificar.' : grupo === 'concluidas' && !faturacaoPronta ? (erroEstado || 'A confirmar os estados de faturação…') : doGrupo.length ? 'Nenhuma folha corresponde aos filtros.' : 'Nenhuma folha de obra neste separador.';
        tbody.innerHTML = filtradas.map(({ f, ctx, sit }) => {
            const idAttr = escapeHtmlSimples(f.id);
            const validada = f.validada === true;
            const acao = nome => escapeHtmlSimples(`${nome}(${JSON.stringify(f.id)})`);
            if (funcionario) {
                const data = /^\d{4}-\d{2}-\d{2}$/.test(f.data || '') ? f.data.split('-').reverse().join('/') : f.data || '—';
                const campo = (nome, valor, classe = '') => `<td data-label="${nome}" class="${classe}">${escapeHtmlSimples(valor)}</td>`;
                return `<tr data-folha-id="${idAttr}">
                    ${campo('Cliente', ctx.cliente.nome, 'folha-cliente')}
                    ${campo('Data', data)}
                    ${campo('Obra / OS', ctx.obra.nome, 'folha-larga')}
                    ${ctx.instalacao.chave !== 'sem' ? campo('Instalação', ctx.instalacao.nome, 'folha-larga') : ''}
                    ${campo('Trabalho realizado', f.descricao || '—', 'folha-larga')}
                    ${f.materiais ? campo('Materiais', f.materiais, 'folha-larga') : ''}
                    ${campo('Horas de trabalho', (Number(f.horasTrabalhadas) || 0).toLocaleString('pt-PT') + ' h')}
                    <td class="folha-acoes"><button type="button" class="btn btn-primary" onclick="${acao('abrirFolhaDetalhe')}"><i class="fas fa-eye" aria-hidden="true"></i> Abrir folha</button><span class="badge">Por verificar</span></td>
                </tr>`;
            }
            const estado = validada ? 'Validada' : 'Não validada';
            const bloqueio = !validada && sit.bloqueioValidacao;
            const tituloValidacao = bloqueio || (validada ? 'Marcar como não validada' : 'Validar esta folha');
            const fat = estadoFolha(f);
            const botaoFaturacao = grupo === 'concluidas' && faturacaoPronta && !sit.incerta && !sit.cancelada && podeValidar() && (fat.faturada || sit.terminada)
                ? (fat.faturada && usuarioLogado.role !== 'admin' ? '<span class="folhas-so-admin">Só o administrador pode voltar a Por faturar</span>' : `<button type="button" class="btn btn-sm btn-outline" data-folha-faturacao="${idAttr}" ${pendentes.has(f.id) ? 'disabled' : ''} onclick="${acao('tgFolhasFaturar')}"><i class="fas ${fat.faturada ? 'fa-rotate-left' : 'fa-file-invoice'}"></i> ${pendentes.has(f.id) ? 'A guardar…' : fat.faturada ? 'Voltar a por faturar' : 'Marcar como faturada'}</button>`)
                : grupo === 'concluidas' && !fat.faturada && sit.bloqueioFaturacao ? `<small class="folhas-ligacao">${escapeHtmlSimples(sit.bloqueioFaturacao)}</small>` : '';
            const nota = sit.cancelada ? 'Obra/OS cancelada' : sit.incerta ? 'Ligação por confirmar' : sit.semLigacao ? 'Sem Obra/OS associada' : sit.nota;
            const origem = sit.os ? `OS ${sit.os.numeroRegisto || sit.os.id}` : sit.obra ? 'Obra' : '';
            return `<tr data-folha-id="${idAttr}">
                ${['cliente', 'instalacao', 'obra', 'tecnico'].map(k => `<td>${escapeHtmlSimples(ctx[k].nome)}${k === 'obra' ? `<small class="folhas-ligacao">${escapeHtmlSimples(nota || origem)}</small>` : ''}</td>`).join('')}
                <td>${escapeHtmlSimples(f.descricao || '—')}</td><td>${escapeHtmlSimples(f.materiais || '—')}</td>
                <td>${Number(f.horasTrabalhadas) || 0}</td><td>${escapeHtmlSimples(f.data || '—')}</td>
                <td><div class="acoes" style="flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm" style="background:#0ea5e9;color:#fff;" onclick="${acao('abrirFolhaDetalhe')}" title="Abrir e gerar PDF" aria-label="Abrir folha"><i class="fas fa-eye"></i></button>
                    ${podeValidar() ? `<span class="folhas-validacao"><button type="button" class="btn btn-sm ${validada ? 'btn-success' : 'btn-outline'}" data-folha-validacao="${idAttr}" aria-pressed="${validada}" ${pendentes.has(f.id) || bloqueio ? 'disabled' : ''} onclick="${acao('tgFolhasValidar')}" title="${escapeHtmlSimples(tituloValidacao)}"><i class="fas ${validada ? 'fa-circle-check' : 'fa-circle'}"></i> ${pendentes.has(f.id) ? 'A guardar…' : estado}</button>${bloqueio ? `<small class="folhas-ligacao">${escapeHtmlSimples(bloqueio)}</small>` : ''}</span>` : `<span class="badge">${estado}</span>`}
                    ${botaoFaturacao}
                    ${usuarioLogado?.role !== 'funcionario' ? `<button type="button" class="btn btn-sm btn-danger" onclick="${escapeHtmlSimples(`excluirEntidade('folha',${JSON.stringify(f.id)})`)}" title="Eliminar folha"><i class="fas fa-trash"></i></button>` : ''}
                </div></td></tr>`;
        }).join('');
    }

    function renderizarGrupos(linhas) {
        const titulo = { obras: 'Obras em curso', os: 'OS em curso', concluidas: 'Concluídas / terminadas' };
        for (const nome of Object.keys(titulo)) {
            const lista = linhas.filter(l => l.sit.grupo === nome);
            const numero = document.getElementById('folhasGrupoNumero_' + nome);
            if (numero) numero.textContent = lista.length;
            const info = document.getElementById('folhasGrupoInfo_' + nome);
            if (info) {
                const nFat = lista.filter(l => estadoFolha(l.f).faturada).length;
                const h = lista.reduce((s,l) => s + (Number(l.f.horasTrabalhadas) || 0), 0).toLocaleString('pt-PT', { maximumFractionDigits: 2 });
                const n = new Set(lista.map(l => nome === 'os' ? l.f.servicoId : l.sit.obra?.id).filter(Boolean)).size;
                info.textContent = nome === 'concluidas' ? (faturacaoPronta ? `${lista.length - nFat} por faturar · ${nFat} faturadas` : 'Faturação por confirmar') : `${n} ${nome === 'os' ? 'OS' : 'obras'} · ${h} h registadas`;
            }
            const b = document.getElementById('folhasGrupo_' + nome);
            if (b) b.setAttribute('aria-pressed', String(nome === grupo));
        }
        const t = document.getElementById('folhasListaTitulo'); if (t) t.textContent = titulo[grupo];
        const tabs = document.getElementById('folhasFaturacaoTabs'); if (tabs) tabs.hidden = grupo !== 'concluidas';
        const painel = document.getElementById('folhasListaPainel');
        if (painel) {
            if (grupo === 'concluidas') { painel.setAttribute('role', 'tabpanel'); painel.setAttribute('aria-labelledby', 'folhasTab_' + faturacao); }
            else { painel.removeAttribute('role'); painel.removeAttribute('aria-labelledby'); }
        }
        const concluidas = linhas.filter(l => l.sit.grupo === 'concluidas');
        for (const estado of ['por_faturar', 'faturadas']) {
            const b = document.getElementById('folhasTab_' + estado);
            if (b) { b.setAttribute('aria-selected', String(estado === faturacao)); b.classList.toggle('active', estado === faturacao); }
            const n = document.getElementById('folhasFaturacaoNumero_' + estado);
            if (n) n.textContent = faturacaoPronta ? concluidas.filter(l => estadoFolha(l.f).faturada === (estado === 'faturadas')).length : '—';
        }
        const aviso = document.getElementById('folhasEstadoAviso');
        if (aviso) { aviso.textContent = erroEstado || avisoLigacoes; aviso.hidden = !aviso.textContent; }
        const atualizar = document.getElementById('folhasAtualizar'); if (atualizar) atualizar.disabled = !!carga;
    }

    async function faturar(id) {
        prepararConta();
        const f = folhasVisiveis().find(f => f.id === id), conta = identidade();
        if (!f || !podeValidar() || !faturacaoPronta || pendentes.has(id)) return;
        const sit = situacao(f), antes = estadoFolha(f);
        if (sit.grupo !== 'concluidas' || sit.incerta || sit.cancelada || (antes.faturada && usuarioLogado.role !== 'admin')) return;
        if (!antes.faturada && !sit.terminada) { mostrarErro(sit.bloqueioFaturacao); return; }
        if (!navigator.onLine) { mostrarErro('É necessária ligação à Internet para alterar a faturação.'); return; }
        let motivo = '';
        if (antes.faturada) {
            motivo = await tgPrompt('Indica o motivo para voltar a colocar esta folha em Por faturar. A alteração fica registada com autor, data e hora.', { titulo: 'Voltar a por faturar', icone: 'fa-file-invoice' });
            if (motivo == null) return;
            motivo = String(motivo).trim();
            if (!motivo || motivo.length > 1000) { mostrarErro('Indica um motivo entre 1 e 1000 caracteres.'); return; }
        } else if (!await tgConfirm('Marcar esta folha como faturada? Esta marcação não emite uma fatura.', { titulo: 'Faturação da folha', textoOk: 'Marcar como faturada' })) return;
        if (conta !== identidade() || pendentes.has(id) || !podeValidar() || (antes.faturada && usuarioLogado.role !== 'admin')) return;
        pendentes.add(id); render();
        try {
            const { data, error } = await supa.from('tg_teste_folhas_faturacao').insert({
                admin_id: _tenantId(), folha_id: id, versao: Number(antes.versao) + 1,
                faturada: !antes.faturada, motivo: motivo || null
            }).select('folha_id,faturada,versao,alterado_por,alterado_em,motivo').single();
            if (conta !== identidade()) return;
            if (error || !data || data.faturada !== !antes.faturada) throw error || new Error('Estado não confirmado.');
            estados.set(id, data);
            const feedback = document.getElementById('folhasFaturacaoFeedback');
            if (feedback) feedback.textContent = `${data.faturada ? 'Folha marcada como faturada' : 'Folha reposta em Por faturar'}. Alteração registada em ${new Date(data.alterado_em).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}${motivo ? ' · Motivo: ' + motivo : ''}.`;
        } catch (e) {
            if (conta === identidade()) {
                mostrarErro('Não foi possível confirmar a alteração. Atualiza a lista antes de tentar novamente.');
                await carregarEstado(true);
            }
        } finally {
            pendentes.delete(id); if (conta === identidade()) render();
        }
    }

    async function validar(id) {
        const f = folhasVisiveis().find(x => x.id === id);
        if (!podeValidar() || !f || pendentes.has(id)) return;
        const conta = identidade(), tenant = _tenantId(), antes = f.validada === true;
        const bloqueio = !antes && situacao(f).bloqueioValidacao;
        if (bloqueio) { mostrarErro(bloqueio); return; }
        if (!navigator.onLine) { mostrarErro('É necessária ligação à Internet para confirmar a validação.'); return; }
        pendentes.add(id); render();
        try {
            // Test-only endpoint checks the current OS state under lock. Production keeps its existing flow.
            const { data, error } = await supa.rpc('tg_teste_validar_folha', {
                p_folha_id: id, p_validada: !antes, p_antes: antes
            }).single();
            if (conta !== identidade()) return;
            if (error || !data || data.validada !== !antes) throw error || new Error('Validação não confirmada.');
            const atual = (dados.folhasObra || []).find(x => x.id === id && x.adminId === tenant);
            if (atual) Object.assign(atual, { validada: data.validada, validadaPor: data.validada_por, validadaEm: data.validada_em });
            _guardarCacheLocal();
            const feedback = document.getElementById('folhasFaturacaoFeedback');
            if (feedback) feedback.textContent = data.validada ? 'Folha validada e movida para Concluídas / terminadas.' : 'Folha reposta no separador de origem como Não validada.';
        } catch (e) {
            if (conta === identidade()) mostrarErro('Não foi possível confirmar a validação. Atualiza a lista e volta a tentar.');
        } finally {
            pendentes.delete(id);
            if (conta === identidade()) render();
        }
    }

    // Also guard actions reached from another screen or a stale row after team changes.
    const podeAbrir = id => usuarioLogado?.role === 'cliente' || folhasVisiveis().some(f => f.id === id);
    for (const nome of ['abrirFolhaDetalhe', 'gerarPDFFolha']) {
        const original = window[nome];
        if (typeof original !== 'function') continue;
        window[nome] = function (id, ...args) {
            if (!podeAbrir(id)) { mostrarErro('Não tens acesso a esta folha de obra.'); return; }
            return original.call(this, id, ...args);
        };
    }
    const excluirOriginal = window.excluirEntidade;
    if (typeof excluirOriginal === 'function') window.excluirEntidade = function (tipo, id, ...args) {
        if (tipo === 'folha' && !podeAbrir(id)) { mostrarErro('Não tens acesso a esta folha de obra.'); return; }
        return excluirOriginal.call(this, tipo, id, ...args);
    };

    window.tgFolhasFiltrar = render;
    window.tgFolhasLimpar = () => { filtros.forEach(k => { const el = document.getElementById('folhasFiltro_' + k); if (el) el.value = ''; }); render(); };
    window.tgFolhasValidar = validar;
    window.tgFolhasGrupo = nome => {
        if (!['obras', 'os', 'concluidas'].includes(nome)) return;
        grupo = nome; faturacao = 'por_faturar'; render();
    };
    window.tgFolhasFaturacao = estado => { if (['por_faturar', 'faturadas'].includes(estado)) { faturacao = estado; render(); } };
    window.tgFolhasAtualizar = async () => {
        if (usuarioLogado?.role === 'funcionario') {
            const conta = identidade();
            try { await carregarTabelaEspecifica('folhasObra'); if (conta === identidade()) render(); }
            catch (e) { if (conta === identidade()) mostrarErro('Não foi possível atualizar as folhas de obra.'); }
            return;
        }
        const promessa = carregarEstado(true); render(); return promessa;
    };
    window.tgFolhasFaturar = faturar;
    renderizarFolhas = render;
}());
