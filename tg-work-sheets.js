/* Folhas de obra: contexto, filtros e validação administrativa persistente. */
(function () {
    'use strict';
    const pendentes = new Set();
    let contaFiltros = '';
    const filtros = ['cliente', 'instalacao', 'obra', 'tecnico', 'validacao'];
    const podeValidar = () => ['admin', 'subadmin'].includes(usuarioLogado?.role);
    const identidade = () => JSON.stringify([usuarioLogado?.adminId || usuarioLogado?.id, usuarioLogado?.id]);
    const tenantItem = (lista, id, tenant) => (lista || []).find(x => x.id === id && x.adminId === tenant);

    function contexto(f) {
        const tenant = f.adminId;
        const os = tenantItem(dados.servicos, f.servicoId, tenant);
        const contrato = tenantItem(dados.contratos, f.contratoId || os?.contratoId, tenant);
        const obra = tenantItem(dados.obras, f.obraId || os?.obraId, tenant);
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
            (podeValidar() || pessoas.has(f.funcionarioId)));
    }

    function atualizarFiltros(linhas) {
        if (contaFiltros !== identidade()) {
            filtros.forEach(k => { const el = document.getElementById('folhasFiltro_' + k); if (el) el.value = ''; });
            contaFiltros = identidade();
        }
        for (const campo of filtros.filter(k => k !== 'validacao')) {
            const select = document.getElementById('folhasFiltro_' + campo);
            if (!select) continue;
            const anterior = select.value;
            const opcoes = new Map(linhas.map(l => [l.ctx[campo].chave, l.ctx[campo].nome]));
            select.replaceChildren(new Option('Todos', ''));
            [...opcoes].sort((a, b) => a[1].localeCompare(b[1], 'pt', { sensitivity: 'base', numeric: true }))
                .forEach(([id, nome]) => select.add(new Option(nome, id)));
            select.value = opcoes.has(anterior) ? anterior : '';
        }
    }

    function render() {
        const tbody = document.getElementById('tabelaFolhas');
        const empty = document.getElementById('emptyFolhas');
        if (!tbody || !empty) return;
        const linhas = folhasVisiveis().map(f => ({ f, ctx: contexto(f) }));
        atualizarFiltros(linhas);
        const valores = Object.fromEntries(filtros.map(k => [k, document.getElementById('folhasFiltro_' + k)?.value || '']));
        const filtradas = linhas.filter(({ f, ctx }) => filtros.every(k => !valores[k] ||
            (k === 'validacao' ? (f.validada === true ? 'validada' : 'nao_validada') === valores[k] : ctx[k].chave === valores[k])));
        filtradas.sort((a, b) => _folhasOrdem === 'desc' ? (b.f.data || '').localeCompare(a.f.data || '') : (a.f.data || '').localeCompare(b.f.data || ''));
        const ordem = document.getElementById('folhasOrdemIcone');
        if (ordem) ordem.className = 'fas ' + (_folhasOrdem === 'desc' ? 'fa-sort-down' : 'fa-sort-up');
        const aviso = document.getElementById('folhasAvisoCarregamento');
        if (aviso) aviso.innerHTML = `<div style="margin-bottom:10px;"><button type="button" class="btn btn-sm btn-outline" onclick="carregarFolhasMaisAntigas()"><i class="fas fa-clock-rotate-left"></i> Carregar folhas mais antigas (+3 meses)</button> <span style="font-size:.8rem;">Assinadas desde ${_folhasCarregadoDesde ? new Date(_folhasCarregadoDesde + 'T00:00:00').toLocaleDateString('pt-PT') : '—'}. Por assinar aparecem sempre.</span></div>`;
        const contador = document.getElementById('folhasFiltroContagem');
        if (contador) contador.textContent = `${filtradas.length} de ${linhas.length} folhas carregadas`;
        empty.style.display = filtradas.length ? 'none' : 'block';
        empty.textContent = linhas.length ? 'Nenhuma folha corresponde aos filtros.' : 'Nenhuma folha de obra.';
        tbody.innerHTML = filtradas.map(({ f, ctx }) => {
            const idAttr = escapeHtmlSimples(f.id);
            const validada = f.validada === true;
            const acao = nome => escapeHtmlSimples(`${nome}(${JSON.stringify(f.id)})`);
            const estado = validada ? 'Validada' : 'Não validada';
            return `<tr data-folha-id="${idAttr}">
                ${['cliente', 'instalacao', 'obra', 'tecnico'].map(k => `<td>${escapeHtmlSimples(ctx[k].nome)}</td>`).join('')}
                <td>${escapeHtmlSimples(f.descricao || '—')}</td><td>${escapeHtmlSimples(f.materiais || '—')}</td>
                <td>${Number(f.horasTrabalhadas) || 0}</td><td>${escapeHtmlSimples(f.data || '—')}</td>
                <td><div class="acoes" style="flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm" style="background:#0ea5e9;color:#fff;" onclick="${acao('abrirFolhaDetalhe')}" title="Abrir e gerar PDF" aria-label="Abrir folha"><i class="fas fa-eye"></i></button>
                    ${podeValidar() ? `<button type="button" class="btn btn-sm ${validada ? 'btn-success' : 'btn-outline'}" data-folha-validacao="${idAttr}" aria-pressed="${validada}" ${pendentes.has(f.id) ? 'disabled' : ''} onclick="${acao('tgFolhasValidar')}" title="${validada ? 'Marcar como não validada' : 'Validar esta folha'}"><i class="fas ${validada ? 'fa-circle-check' : 'fa-circle'}"></i> ${pendentes.has(f.id) ? 'A guardar…' : estado}</button>` : `<span class="badge">${estado}</span>`}
                    ${usuarioLogado?.role !== 'funcionario' ? `<button type="button" class="btn btn-sm btn-danger" onclick="${escapeHtmlSimples(`excluirEntidade('folha',${JSON.stringify(f.id)})`)}" title="Eliminar folha"><i class="fas fa-trash"></i></button>` : ''}
                </div></td></tr>`;
        }).join('');
    }

    async function validar(id) {
        const f = folhasVisiveis().find(x => x.id === id);
        if (!podeValidar() || !f || pendentes.has(id)) return;
        const conta = identidade(), tenant = _tenantId(), antes = f.validada === true;
        if (!navigator.onLine) { mostrarErro('É necessária ligação à Internet para confirmar a validação.'); return; }
        pendentes.add(id); render();
        try {
            // Atualiza só a validação. O servidor verifica o papel/empresa e carimba o autor/data.
            const { data, error } = await supa.from('folhas_obra').update({ validada: !antes })
                .eq('id', id).eq('admin_id', tenant).eq('validada', antes)
                .select('id,validada,validada_por,validada_em').single();
            if (conta !== identidade()) return;
            if (error || !data || data.validada !== !antes) throw error || new Error('Validação não confirmada.');
            const atual = (dados.folhasObra || []).find(x => x.id === id && x.adminId === tenant);
            if (atual) Object.assign(atual, { validada: data.validada, validadaPor: data.validada_por, validadaEm: data.validada_em });
            _guardarCacheLocal();
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
    renderizarFolhas = render;
}());
