/* Native Assist workspace. Uses the TG session, shared data, forms and sync queue. */
(function(){
'use strict';
let identity='', modalIdentity='', tab='assistencias', assistBucket='';
const actor=()=>typeof usuarioLogado==='undefined'||!usuarioLogado?'':JSON.stringify([_tenantId(),usuarioLogado.id]);
const allowed=()=>!!window.TGModules?.allowed('assistencias');
function assertAccess(expected){if(!allowed()||(expected&&expected!==actor()))throw Error('A sessão ou o acesso às Assistências mudou. Volta a abrir o módulo.');}
function item(id){return (dados.assistencias||[]).find(a=>a.id===id&&a.adminId===_tenantId()&&!a.apagadoSuperAdmin);}
function persist(){assertAccess(modalIdentity);return guardarDados();}
function _crmNotificar(id,title,message){assertAccess(modalIdentity);_notificarFuncionario(id,title,message,_tenantId());return Promise.resolve();}
function mostrarStatusCRM(message){const e=document.getElementById('tgAssistStatus');if(e){e.textContent=message;e.hidden=false;}}
function refreshHost(){render();renderizarTudo();}
function closeForm(){assertAccess(modalIdentity);const o=document.getElementById('modalGenericoOverlay');o.classList.remove('open');delete o.dataset.tgAssistNative;}
function setupForm(){
 notesRequest++;
 assertAccess();modalIdentity=actor();
 const overlay=document.getElementById('modalGenericoOverlay');overlay.classList.remove('modal-veros');overlay.dataset.tgAssistNative='1';
 document.getElementById('rpPreviewFlutuante')?.classList.remove('open');
 overlay.querySelector('.modal').style.maxWidth='720px';
 document.getElementById('modalGenericoForm').style.cssText='';document.getElementById('modalGenericoCampos').style.cssText='';
 const actions=document.getElementById('modalGenericoAcoes');actions.style.display='flex';
 actions.innerHTML='<button type="button" class="btn btn-outline" onclick="_fecharModalGenerico()">Cancelar</button><button type="submit" class="btn btn-success"><i class="fas fa-save"></i> Guardar</button>';
}
function guard(fn,record=false,form=false){return function(...args){try{assertAccess(form?modalIdentity:undefined);if(record&&args[0]&&!item(args[0]))return;return fn(...args);}catch(e){alert(e.message);}}}
function _assistEstado(value) {
    return ['resolvida', 'fechada', 'concluida', 'concluido', 'terminada', 'terminado'].includes(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()) ? 'resolvida' : 'aberta';
}
        const ASSIST_PRIORIDADES = { baixa: { label: 'Baixa', cor: '#64748b' }, normal: { label: 'Normal', cor: '#2456d8' }, alta: { label: 'Alta', cor: '#b0650a' }, urgente: { label: 'Urgente', cor: '#d1342f' } };
        const ASSIST_ESTADOS = { aberta: { label: 'Aberta', cor: '#2456d8', bg: 'var(--blue-bg)' }, resolvida: { label: 'Resolvida', cor: '#178a4c', bg: 'var(--green-bg)' } };
const SHELL="<div class=\"section-header\"><h2><i class=\"fas fa-headset\"></i> Assistências</h2><button type=\"button\" class=\"btn btn-primary\" data-assist-action=\"new\"><i class=\"fas fa-plus\"></i> Nova assistência</button></div><div class=\"tg-assist-tabs\"><button type=\"button\" class=\"btn btn-outline\" data-assist-tab=\"assistencias\" aria-pressed=\"true\">Assistências</button><button type=\"button\" class=\"btn btn-outline\" data-assist-tab=\"dashboard\" aria-pressed=\"false\">Indicadores</button></div><p id=\"tgAssistStatus\" role=\"status\" hidden></p><div id=\"tgAssistListPane\"><div id=\"tgAssistMetrics\" class=\"tg-assist-metrics\" role=\"group\" aria-label=\"Filtrar assistências por estado\"></div><div class=\"tg-assist-filters\"><label>Pesquisar<input id=\"tgAssistSearch\" type=\"search\" placeholder=\"Cliente, instalação ou pedido\"></label><label>Localidade<select id=\"assistFiltroLocalidade\"><option value=\"\">Todas as localidades</option></select></label><label>Estado<select id=\"assistFiltroEstado\"><option value=\"\">Todos os estados</option><option value=\"aberta\">Aberta</option><option value=\"resolvida\">Resolvida</option></select></label><label>Prioridade<select id=\"assistFiltroPrioridade\"><option value=\"\">Todas as prioridades</option><option value=\"baixa\">Baixa</option><option value=\"normal\">Normal</option><option value=\"alta\">Alta</option><option value=\"urgente\">Urgente</option></select></label></div><p id=\"tgAssistCount\" class=\"help-text\"></p><div id=\"tgAssistResults\"></div></div><div id=\"tgAssistDashboardPane\" hidden>                    <div class=\"stat-row\">\n                        <div class=\"stat-card\"><div class=\"lbl\">Assistências abertas</div><div class=\"val\" id=\"assistDashAbertas\">0</div></div>\n                        <div class=\"stat-card warn\"><div class=\"lbl\">Abertas atribuídas</div><div class=\"val\" id=\"assistDashAndamento\">0</div></div>\n                        <div class=\"stat-card good\"><div class=\"lbl\">Resolvidas (30 dias)</div><div class=\"val\" id=\"assistDashResolvidas\">0</div></div>\n                        <div class=\"stat-card\"><div class=\"lbl\">OS geradas (30 dias)</div><div class=\"val\" id=\"assistDashOsGeradas\">0</div></div>\n                        <div class=\"stat-card\"><div class=\"lbl\">Tempo médio de resolução</div><div class=\"val\" id=\"assistDashTempoMedio\">—</div></div>\n                        <div class=\"stat-card\" id=\"assistDashForaSlaCard\" style=\"border-left:3px solid #d1342f;\"><div class=\"lbl\">Fora do SLA (+48h)</div><div class=\"val\" id=\"assistDashForaSla\">0</div></div>\n                    </div>\n                    <div id=\"assistDashAlertaSla\" style=\"display:none;margin-bottom:14px;padding:10px 14px;border-radius:8px;background:var(--red-bg);color:var(--red);font-weight:600;font-size:.85rem;cursor:pointer;\" onclick=\"TGAssistNative.mudarTabCRM('assistencias')\"></div>\n                    <div style=\"display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px;\">\n                        <div class=\"table-wrapper\" style=\"flex:1;min-width:260px;padding:16px 18px;\">\n                            <h4 style=\"margin-bottom:10px;color:var(--navy);\">Por prioridade (em aberto)</h4>\n                            <div id=\"assistDashPrioridades\"></div>\n                        </div>\n                    </div>\n                    <div class=\"orc-secao-titulo\" style=\"margin-top:6px;\">Assistências mais recentes</div>\n                    <div class=\"table-wrapper scroll\">\n                        <table>\n                            <thead><tr><th>Nº</th><th>Cliente</th><th>Assunto</th><th>Prioridade</th><th>Estado</th><th>Data</th></tr></thead>\n                            <tbody id=\"tabelaDashAssist\"></tbody>\n                        </table>\n                    </div>\n                    <p id=\"emptyDashAssist\" class=\"text-muted text-center mt-10\" style=\"display:none;\">Ainda não há assistências registadas.</p></div>";
        function gerarNumeroAssistencia() {
            const iniciais = _empresaIniciais((dados.administradores?.find(a => a.id === _tenantId())?.empresa) || (dados.administradores?.find(a => a.id === _tenantId())?.nome) || '');
            const agora = new Date();
            const mm = String(agora.getMonth() + 1).padStart(2, '0');
            const yy = String(agora.getFullYear()).slice(-2);
            const base = `AST-${iniciais}${mm}${yy}`;
            const existentes = (dados.assistencias || []).filter(a => a.numero && a.numero.startsWith(base));
            return base + '-' + (existentes.length + 1);
        }
        function renderizarDashboardAssist() {
            const tid = _tenantId();
            const lista = (dados.assistencias || []).filter(a => a.adminId === tid).sort((a, b) => (b.dataCriacao || 0) - (a.dataCriacao || 0));
            const trintaDias = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const emAberto = lista.filter(a => _assistEstado(a.estado) === 'aberta');
            document.getElementById('assistDashAbertas').textContent = lista.filter(a => _assistEstado(a.estado) === 'aberta').length;
            document.getElementById('assistDashAndamento').textContent = lista.filter(a => _assistEstado(a.estado) === 'aberta' && assistAssigned(a)).length;
            document.getElementById('assistDashResolvidas').textContent = lista.filter(a => (_assistEstado(a.estado) === 'resolvida') && (a.dataModificacao || a.dataCriacao || 0) >= trintaDias).length;
            document.getElementById('assistDashOsGeradas').textContent = lista.filter(a => a.osGeradaId && (a.dataCriacao || 0) >= trintaDias).length;

            // Tempo médio de resolução (últimos 30 dias)
            const resolvidasRecentes = lista.filter(a => (_assistEstado(a.estado) === 'resolvida') && a.dataModificacao && a.dataCriacao && a.dataModificacao >= trintaDias);
            const tempoMedioH = resolvidasRecentes.length ? resolvidasRecentes.reduce((s, a) => s + (a.dataModificacao - a.dataCriacao), 0) / resolvidasRecentes.length / 3600000 : null;
            document.getElementById('assistDashTempoMedio').textContent = tempoMedioH == null ? '—' : (tempoMedioH < 24 ? Math.round(tempoMedioH) + 'h' : Math.round(tempoMedioH / 24) + ' dias');

            // Fora do SLA de 48h (em aberto há mais de 48h e ainda não resolvida)
            const foraSla = emAberto.filter(a => (Date.now() - (a.dataCriacao || Date.now())) >= 48 * 3600000);
            document.getElementById('assistDashForaSla').textContent = foraSla.length;
            const alertaEl = document.getElementById('assistDashAlertaSla');
            if (foraSla.length) {
                alertaEl.style.display = 'block';
                alertaEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${foraSla.length} assistência${foraSla.length > 1 ? 's' : ''} aberta${foraSla.length > 1 ? 's' : ''} há mais de 48h sem resolução — clica para ver.`;
            } else { alertaEl.style.display = 'none'; }

            // Distribuição por prioridade (só das que estão em aberto)
            const porPrioridade = { urgente: 0, alta: 0, normal: 0, baixa: 0 };
            emAberto.forEach(a => { porPrioridade[a.prioridade || 'normal'] = (porPrioridade[a.prioridade || 'normal'] || 0) + 1; });
            const maxPrio = Math.max(1, ...Object.values(porPrioridade));
            document.getElementById('assistDashPrioridades').innerHTML = Object.entries(porPrioridade).map(([k, v]) => {
                const info = ASSIST_PRIORIDADES[k];
                return `<div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:2px;"><span>${info.label}</span><span>${v}</span></div>
                    <div style="background:var(--border-soft);border-radius:4px;height:8px;"><div style="background:${info.cor};height:8px;border-radius:4px;width:${(v / maxPrio * 100)}%;"></div></div>
                </div>`;
            }).join('');

            const recentes = lista.slice(0, 8);
            document.getElementById('emptyDashAssist').style.display = recentes.length ? 'none' : 'block';
            document.getElementById('tabelaDashAssist').innerHTML = recentes.map(a => {
                const est = ASSIST_ESTADOS[_assistEstado(a.estado)] || ASSIST_ESTADOS.aberta;
                const pri = ASSIST_PRIORIDADES[a.prioridade] || ASSIST_PRIORIDADES.normal;
                return `<tr style="cursor:pointer;" onclick="TGAssistNative.mudarTabCRM('assistencias');setTimeout(()=>TGAssistNative.abrirModalAssistencia('${a.id}'),60);">
                    <td>${escapeHtmlSimples(a.numero || '—')}</td>
                    <td>${escapeHtmlSimples(obterNomeCliente(a.clienteId))}</td>
                    <td>${_assistResumoHtml(a)}</td>
                    <td><span class="badge" style="background:${pri.cor}22;color:${pri.cor};">${pri.label}</span></td>
                    <td><span class="badge" style="background:${est.bg};color:${est.cor};">${est.label}</span></td>
                    <td>${a.dataCriacao ? new Date(a.dataCriacao).toLocaleDateString('pt-PT') : '—'}</td>
                </tr>`;
            }).join('');
        }
        function _assistResumoDados(a) {
            const cliente = (dados.clientes || []).find(c => c.id === a.clienteId && c.adminId === a.adminId);
            const os = (dados.servicos || []).find(s => s.id === a.osGeradaId && s.adminId === a.adminId);
            const localId = a.localId || os?.localId;
            const local = (dados.locais || []).find(l => l.id === localId && l.adminId === a.adminId && l.clienteId === a.clienteId);
            const localTexto = String(a.descricao || '').match(/^Local:\s*(.+)$/m)?.[1];
            return { cliente: cliente?.nome || a.nomeCliente || 'Sem cliente', local: local?.nome || localTexto || (localId ? (os?.morada || 'Instalação') : (a.clienteId ? 'Sede' : 'Local não indicado')), urgencia: ({baixa:'Baixa',normal:'Normal',alta:'Alta',urgente:'Urgente'})[a.prioridade] || 'Normal' };
        }
        function _assistResumoHtml(a) {
            const d = _assistResumoDados(a);
            return `<div style="white-space:normal;line-height:1.45;text-align:left;padding:4px 0;"><strong>${escapeHtmlSimples(a.assunto || a.numero || 'Assistência')}</strong><div style="font-size:.75rem;color:var(--hsub,#64748b);">${escapeHtmlSimples(d.cliente)}</div><div style="font-size:.72rem;">${escapeHtmlSimples(d.local)} · Urgência: <b>${escapeHtmlSimples(d.urgencia)}</b></div>${a.origem === 'portal' ? '<span style="display:inline-block;margin-top:4px;background:#e0f2fe;color:#075985;border-radius:6px;padding:2px 6px;font-size:.68rem;">Portal do Cliente</span>' : ''}</div>`;
        }
        function _assistPortalPorTratar(adminId) {
            return (dados.assistencias || []).filter(a => a.adminId === adminId && a.origem === 'portal' && !a.apagadoSuperAdmin && (a.estado || 'aberta') === 'aberta' && !a.osGeradaId && !a.atribuidoId);
        }
        function obterNomeCliente(id) {
            if (!id) return '—';
            const c = dados.clientes?.find(c => c.id === id);
            return c ? c.nome : '(removido)';
        }
        function _clienteLabel(c) { return c.numeroCliente ? `${c.numeroCliente} - ${c.nome}` : c.nome; }
        function _preencherDatalistClientes() {
            const tid = _tenantId();
            const lista = (dados.clientes || []).filter(c => c.adminId === tid);
            // Guarda label->id (o que aparece na lista) e, à parte, um texto de pesquisa mais
            // amplo por label (nome + número de cliente + NIF), para se conseguir encontrar um
            // cliente escrevendo o NIF, mesmo esse não aparecendo na etiqueta mostrada.
            window._clienteBuscaMapa = {};
            window._clienteBuscaTexto = {};
            lista.forEach(c => {
                const label = _clienteLabel(c);
                window._clienteBuscaMapa[label] = c.id;
                window._clienteBuscaTexto[label] = [label, c.nif].filter(Boolean).join(' ').toLowerCase();
            });
            if (!lista.length) console.warn('[Assist] Pesquisa de cliente: 0 clientes encontrados para adminId="' + tid + '" — confirma se dados.clientes já carregou e se o adminId dos clientes bate certo.');
        }
        function clienteBuscaInput(inputId, hiddenId, callback) {
            const input = document.getElementById(inputId);
            if (!input) return;
            // Só limpa a escolha anterior se o texto do campo mudou mesmo desde a última seleção
            // — sem isto, um simples focus/refocus no campo (sem editar nada) apagava o cliente
            // já escolhido, e a pessoa só descobria ao tentar gravar, mesmo continuando a ver o
            // nome certo, já selecionado, no campo.
            if (input.value !== input.dataset.selecionadoLabel) {
                document.getElementById(hiddenId).value = '';
                delete input.dataset.selecionadoLabel;
            }
            const q = input.value.trim().toLowerCase();
            const ddId = inputId + '_dd';
            let dd = document.getElementById(ddId);
            if (!dd) {
                dd = document.createElement('div');
                dd.id = ddId;
                // position:fixed, calculada a partir da posição real do campo no ecrã — em vez de
                // absolute dentro do formulário, que ficava cortada pelo scroll próprio do modal
                // (.modal tem overflow-y:auto) sempre que o campo não estivesse perto do topo.
                dd.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.14);max-height:min(55vh,420px);overflow-y:auto;';
                document.body.appendChild(dd);
            }
            const r = input.getBoundingClientRect();
            dd.style.left = r.left + 'px';
            dd.style.top = (r.bottom + 4) + 'px';
            dd.style.width = r.width + 'px';
            const mapa = window._clienteBuscaMapa || {};
            const textos = window._clienteBuscaTexto || {};
            const todasLabels = Object.keys(mapa);
            // Sem texto escrito ainda: mostra logo uma lista, em vez de esconder o dropdown à
            // espera da primeira letra — assim já se vêm opções antes mesmo de começar a escrever.
            const resultados = (q ? todasLabels.filter(label => (textos[label] || label.toLowerCase()).includes(q)) : todasLabels).slice(0, 40);
            if (!resultados.length) {
                dd.innerHTML = `<div style="padding:10px 12px;color:#94a3b8;font-size:.9rem;">${q ? 'Sem clientes encontrados' : 'Sem clientes registados ainda'}</div>`;
                dd.style.display = 'block';
                return;
            }
            dd.innerHTML = resultados.map(label => `<div class="cliente-busca-item" style="padding:8px 12px;cursor:pointer;font-size:.92rem;" data-label="${label.replace(/"/g, '&quot;')}">${label}</div>`).join('');
            dd.style.display = 'block';
            dd.querySelectorAll('.cliente-busca-item').forEach(el => {
                el.onmouseenter = () => el.style.background = '#f1f5f9';
                el.onmouseleave = () => el.style.background = '';
                el.onmousedown = (ev) => {
                    ev.preventDefault(); // evita perder o foco/blur antes do click registar
                    input.value = el.dataset.label;
                    input.dataset.selecionadoLabel = el.dataset.label;
                    document.getElementById(hiddenId).value = mapa[el.dataset.label] || '';
                    dd.style.display = 'none';
                    if (typeof callback === 'function') callback();
                };
            });
        }
        function clienteBuscaFoco(inputId) {
            clienteBuscaInput(inputId, inputId.replace('_busca', ''));
        }
        function clienteBuscaEsconder(inputId) {
            setTimeout(() => { const dd = document.getElementById(inputId + '_dd'); if (dd) dd.style.display = 'none'; }, 200);
        }
        function _tgAssistSugestao(tipo) {
            if (tipo !== 'os') return;
            if (!window.TGPlanner || !usuarioLogado) return alert('Motor de planeamento indisponível.');
            const tid = _tenantId();
            const isOS = tipo === 'os';
            const data = document.getElementById(isOS ? 'assistOsData' : 'assist_plan_data')?.value;
            const hora = document.getElementById(isOS ? 'assistOsHora' : 'assist_plan_hora')?.value;
            const duracao = Number(document.getElementById(isOS ? 'assistOsDuracao' : 'assist_plan_duracao')?.value);
            if (!data || !hora || !Number.isFinite(duracao) || duracao < 15 || duracao > 720) return alert('Indica a data, hora e duração prevista (15 a 720 minutos).');
            const inicio = new Date(data + 'T' + hora + ':00');
            if (!Number.isFinite(inicio.getTime())) return alert('Data ou hora inválida.');
            const fim = new Date(inicio.getTime() + duracao * 60000);
            const pessoa = _pessoasParaAtribuir(tid);
            const tecnicos = pessoa.filter(p => (dados.funcionarios || []).some(f => f.id === p.id && !f.suspenso && f.ativo !== false))
                .map(p => {
                    const f = dados.funcionarios.find(f => f.id === p.id);
                    return { id:p.id, name:p.nome, tenantId:tid, active:true,
                        skills:Array.isArray(f.competencias) ? f.competencias : [] };
                });
            const compromissos = (dados.servicos || []).filter(os => os.adminId === tid && os.data && os.hora)
                .flatMap(os => {
                    const d = new Date(os.data + 'T' + os.hora + ':00');
                    if (!Number.isFinite(d.getTime())) return [];
                    // Duração histórica desconhecida: intervalo conservador de 90 min, assinalado ao utilizador.
                    const minutos = Number(os.duracao || os.duracaoMinutos || os.duracaoPrevista || 90);
                    const ids = Array.isArray(os.funcionariosIds) && os.funcionariosIds.length ? os.funcionariosIds : [os.funcionarioId];
                    return ids.filter(Boolean).map(tecnicoId => ({
                        id:os.id,tenantId:tid,technicianId:tecnicoId,start:d.toISOString(),
                        end:new Date(d.getTime() + (minutos > 0 && minutos <= 1440 ? minutos : 90) * 60000).toISOString(),
                        status:os.status
                    }));
                });
            // Sem registos de férias validados, não afirmar disponibilidade definitiva.
            const lista = window.TGPlanner.recommend({tenantId:tid,technicians:tecnicos,appointments:compromissos,
                job:{start:inicio.toISOString(),end:fim.toISOString()},limit:50});
            const elegiveis = lista.filter(t=>t.eligible);
            if (!elegiveis.length) return alert('Não foram encontrados técnicos sem sobreposição detetada. Confirma férias e disponibilidade manualmente.');
            const resumo = elegiveis.slice(0,8).map((p,i)=>(i+1)+'. '+p.name).join('\n');
            const escolhido = elegiveis[0];
            if (!confirm('Sugestão: '+escolhido.name+'\n\nOutras opções sem conflito identificado:\n'+resumo+
                '\n\nAtenção: esta é uma sugestão preliminar. As férias e as deslocações não estão totalmente validadas; alguns serviços antigos não têm duração. Confirma com o técnico.\n\nSelecionar '+escolhido.name+'?')) return;
            if (isOS) {
                const check = [...document.querySelectorAll('.assist-os-func-chk')].find(el=>el.value===escolhido.id);
                if (!check) return alert('Técnico indisponível na lista deste serviço.');
                check.checked = true;
            } else {
                const select = document.getElementById('assist_atribuido');
                if (![...select.options].some(o=>o.value===escolhido.id)) return alert('Técnico indisponível na lista.');
                select.value = escolhido.id;
                select.dispatchEvent(new Event('change',{bubbles:true}));
            }
        }
        function abrirModalAssistencia(id) {
            setupForm();
            const tid = _tenantId();
            const item = id ? dados.assistencias?.find(a => a.id === id) : null;
            _preencherDatalistClientes();
            const cliente = item?.clienteId ? dados.clientes?.find(c => c.id === item.clienteId) : null;
            document.getElementById('modalGenericoTitulo').innerHTML = item ? `<i class="fas fa-headset"></i> ${escapeHtmlSimples(item.numero || 'Assistência')}` : '<i class="fas fa-headset"></i> Nova Assistência';
            document.getElementById('modalGenericoCampos').innerHTML = `
                ${item ? _assistBadgeSLA(item) : ''}
                <div class="form-group" style="position:relative;"><label>Cliente</label>
                    <input type="text" id="assist_cliente_busca" placeholder="Pesquisar por nome ou nº de cliente..." autocomplete="off"
                        value="${cliente ? escapeHtmlSimples(_clienteLabel(cliente)) : ''}"
                        oninput="TGAssistNative.clienteBuscaInput('assist_cliente_busca','assist_cliente', TGAssistNative._assistAtualizarContactosRapidos)"
                        onfocus="TGAssistNative.clienteBuscaInput('assist_cliente_busca','assist_cliente', TGAssistNative._assistAtualizarContactosRapidos)"
                        onblur="TGAssistNative.clienteBuscaEsconder('assist_cliente_busca')">
                    <input type="hidden" id="assist_cliente" value="${item?.clienteId || ''}">
                </div>
                <div class="form-group"><label for="assist_local">Instalação *</label><select id="assist_local" required></select></div>
                <div id="assistContractSummary" class="tg-assist-contract-summary"></div>
                <div id="assist_contactos_rapidos">${_assistContactosRapidosHTML(cliente)}</div>
                <div class="form-group"><label>Assunto *</label><input type="text" id="assist_assunto" value="${item ? escapeHtmlSimples(item.assunto || '') : ''}" placeholder="Ex: Alarme a disparar sem motivo" required></div>
                <div class="form-group"><label>Descrição do problema</label><textarea id="assist_descricao" rows="4" placeholder="Detalhes reportados pelo cliente...">${item ? escapeHtmlSimples(item.descricao || '') : ''}</textarea></div>
                <div style="display:flex;gap:14px;">
                    <div class="form-group" style="flex:1;"><label>Prioridade</label>
                        <select id="assist_prioridade">${Object.entries(ASSIST_PRIORIDADES).map(([k, v]) => `<option value="${k}" ${(item?.prioridade || 'normal') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
                    </div>
                    <div class="form-group" style="flex:1;"><label>Estado</label>
                        <select id="assist_estado">${Object.entries(ASSIST_ESTADOS).map(([k, v]) => `<option value="${k}" ${_assistEstado(item?.estado) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
                    </div>
                </div>
                <p class="help-text">O técnico é escolhido ao criar a ordem de serviço.</p>
                ${item?.osGeradaId ? `<div class="help-text" style="color:var(--green);"><i class="fas fa-check-circle"></i> Já tem uma OS criada a partir desta assistência.</div>` : ''}
                ${item ? _assistNotasHTML(item) : ''}
            `;
            window.TGAssistContracts?.form(item);
            document.getElementById('modalGenericoForm').onsubmit = _protegerSubmit(() => guardarAssistencia(id));
            document.getElementById('modalGenericoOverlay').classList.add('open');
        }
        function _assistBadgeSLA(item) {
            const portal = item.origem === 'portal' ? '<div style="padding:8px 12px;background:#e0f2fe;color:#075985;border-radius:8px;margin-bottom:8px;">Pedido recebido pelo Portal do Cliente</div>' : '';
            if ((_assistEstado(item.estado) === 'resolvida')) {
                const horas = item.dataModificacao ? Math.round((item.dataModificacao - item.dataCriacao) / 3600000) : null;
                return portal + (horas != null ? `<div class="help-text" style="margin-bottom:10px;"><i class="fas fa-check-circle" style="color:var(--green);"></i> Resolvida em ${horas < 24 ? horas + 'h' : Math.round(horas / 24) + ' dia(s)'}.</div>` : '');
            }
            const horasAberta = Math.round((Date.now() - (item.dataCriacao || Date.now())) / 3600000);
            const critico = horasAberta >= 48;
            return portal + `<div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;background:${critico ? 'var(--red-bg)' : 'var(--blue-bg)'};color:${critico ? 'var(--red)' : 'var(--blue)'};font-size:.82rem;font-weight:600;">
                <i class="fas ${critico ? 'fa-triangle-exclamation' : 'fa-clock'}"></i> Aberta há ${horasAberta < 24 ? horasAberta + ' hora(s)' : Math.round(horasAberta / 24) + ' dia(s)'}${critico ? ' — fora do SLA de 48h' : ''}
            </div>`;
        }
        function _assistContactosRapidosHTML(cliente) {
            if (!cliente || (!cliente.telefone && !cliente.telemovel)) return '';
            const tel = cliente.telefone || cliente.telemovel;
            const wpp = tel.replace(/[^0-9+]/g, '').replace(/^\+/, '');
            return `<div style="display:flex;gap:8px;margin:-4px 0 12px;">
                <a href="tel:${escapeHtmlSimples(tel)}" class="btn btn-sm btn-outline"><i class="fas fa-phone"></i> Ligar</a>
                <a href="https://wa.me/${wpp}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                ${cliente.email ? `<a href="mailto:${escapeHtmlSimples(cliente.email)}" class="btn btn-sm btn-outline"><i class="fas fa-envelope"></i> Email</a>` : ''}
            </div>`;
        }
        function _assistAtualizarContactosRapidos() {
            const cid = document.getElementById('assist_cliente').value;
            const cliente = cid ? dados.clientes?.find(c => c.id === cid) : null;
            document.getElementById('assist_contactos_rapidos').innerHTML = _assistContactosRapidosHTML(cliente);
            window.TGAssistContracts?.syncForm(true);
        }
        function _assistNotasHTML(item) {
            const notas = item.notas || [];
            return `<div class="form-group ff-span2" style="margin-top:6px;">
                <label>Histórico / notas internas</label>
                <div id="assist_notas_lista" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px;">
                    ${notas.length ? notas.slice().reverse().map(n => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border-soft);font-size:.82rem;">
                            <div>${escapeHtmlSimples(n.texto)}</div>
                            <div class="help-text">${escapeHtmlSimples(n.autor || '')} · ${n.data ? new Date(n.data).toLocaleString('pt-PT') : ''}</div>
                        </div>`).join('') : '<span class="help-text">Ainda sem notas.</span>'}
                </div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="assist_nova_nota" placeholder="Escrever uma nota rápida (ex: 'cliente confirmou visita amanhã')..." style="flex:1;" onkeydown="if(event.key==='Enter'){event.preventDefault();TGAssistNative.adicionarNotaAssistencia('${item.id}');}" />
                    <button type="button" class="btn btn-sm btn-outline" onclick="TGAssistNative.adicionarNotaAssistencia('${item.id}')"><i class="fas fa-plus"></i></button>
                </div>
            </div>`;
        }
        async function adicionarNotaAssistencia(id) {
            assertAccess(modalIdentity);
            const input = document.getElementById('assist_nova_nota');
            const texto = input.value.trim();
            if (!texto) return;
            const item = dados.assistencias?.find(a => a.id === id);
            if (!item) return;
            if (!item.notas) item.notas = [];
            item.notas.push({ texto, autor: usuarioLogado?.nome || 'Eu', data: Date.now() });
            input.value = '';
            document.getElementById('assist_notas_lista').innerHTML = item.notas.slice().reverse().map(n => `
                <div style="padding:6px 0;border-bottom:1px solid var(--border-soft);font-size:.82rem;">
                    <div>${escapeHtmlSimples(n.texto)}</div>
                    <div class="help-text">${escapeHtmlSimples(n.autor || '')} · ${new Date(n.data).toLocaleString('pt-PT')}</div>
                </div>`).join('');
            try { await persist(); } catch (e) { /* fica no ecrã, tenta sincronizar depois */ }
            // Avisa o cliente que abriu o pedido — só quando é a equipa a responder, não quando é
            // o próprio cliente a escrever (senão notificava-se a si próprio).
            if (item.clienteId && usuarioLogado?.role !== 'cliente') {
                _notificarFuncionario(item.clienteId, '💬 Resposta ao teu pedido de assistência', (item.assunto ? item.assunto + ' — ' : '') + texto, item.adminId);
            }
        }
        async function guardarAssistencia(id) {
            assertAccess(modalIdentity);
            const tid = _tenantId();
            const clientId=document.getElementById('assist_cliente').value;
            if(clientId && !(dados.clientes||[]).some(c=>c.id===clientId&&c.adminId===_tenantId()))return alert('Seleciona um cliente da empresa.');
            const assunto = document.getElementById('assist_assunto').value.trim();
            if (!assunto) { alert('Indica o assunto da assistência.'); return; }
            let item = id ? dados.assistencias?.find(a => a.id === id) : null;
            const novo = !item;
            let context=null,visit=null;
            if(window.TGAssistContracts){
                context=TGAssistContracts.selected();
                if(!context.chosen)return alert('Escolhe a instalação do cliente.');
                try{visit=TGAssistContracts.booking(item,clientId,context.localId);}catch(e){return alert(e.message);}
            }
            if (novo) {
                item = { id: gerarId(), adminId: tid, numero: gerarNumeroAssistencia(), criadoPor: usuarioLogado?.id || null, dataCriacao: Date.now(), notas: [] };
                if (!dados.assistencias) dados.assistencias = [];
                dados.assistencias.push(item);
            }
            item.clienteId = document.getElementById('assist_cliente').value || null;
            if(context){item.localId=context.localId;Object.assign(item,visit);}
            item.assunto = assunto;
            item.descricao = document.getElementById('assist_descricao').value.trim() || null;
            item.prioridade = document.getElementById('assist_prioridade').value;
            item.estado = _assistEstado(document.getElementById('assist_estado').value);
            if (novo) item.atribuidoId = null;
            item.dataModificacao = Date.now();

            closeForm();
            try { await persist(); mostrarStatusCRM('✅ Assistência guardada.'); }
            catch (e) { alert('⚠️ Ficou no ecrã, mas ainda não foi possível confirmar no servidor. Tenta novamente.'); }
            refreshHost();
        }
        function criarOSDeAssistencia(assistId) {
            setupForm();
            const a = dados.assistencias?.find(x => x.id === assistId);
            if (!a) return;
            if(a.osGeradaId || _assistEstado(a.estado)==='resolvida') return alert('Esta assistência já tem uma OS ou está resolvida.');
            const tid = _tenantId();
            const cliente = a.clienteId ? dados.clientes?.find(c => c.id === a.clienteId) : null;
            const clientesTenant = (dados.clientes || []).filter(c => c.adminId === tid);
            const funcionariosTenant = (dados.funcionarios || []).filter(f => f.adminId === tid && !f.suspenso);
            const contratosSite=window.TGAssistContracts?.contracts(a.clienteId,a.localId)||[];
            document.getElementById('modalGenericoTitulo').innerHTML = '<i class="fas fa-hard-hat"></i> Criar OS a partir da assistência';
            document.getElementById('modalGenericoCampos').innerHTML = `
                <div class="form-group"><label>Cliente</label>
                    <select id="assistOsCliente" disabled><option value="">— Sem cliente —</option>${clientesTenant.map(c => `<option value="${c.id}" ${a.clienteId === c.id ? 'selected' : ''}>${escapeHtmlSimples(c.nome)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Instalação</label><input type="text" id="assistOsLocalNome" value="${escapeHtmlSimples((dados.locais||[]).find(l=>l.id===a.localId&&l.adminId===tid&&l.clienteId===a.clienteId)?.nome || 'Sede')}" readonly><input type="hidden" id="assistOsLocal" value="${escapeHtmlSimples(a.localId||'')}"></div>
                <div class="form-group"><label>Morada</label><input type="text" id="assistOsMorada" value="${escapeHtmlSimples((dados.locais||[]).find(l=>l.id===a.localId&&l.adminId===tid&&l.clienteId===a.clienteId)?.morada || cliente?.morada || '')}" readonly></div>
                ${!a.testeContratoId && contratosSite.length ? `<div class="form-group"><label>Contrato de manutenção</label><select id="assistOsContrato">${contratosSite.map(c=>`<option value="${escapeHtmlSimples(c.id)}">${escapeHtmlSimples(c.numero||c.id)}</option>`).join('')}</select><small class="help-text">A visita só é descontada após a conclusão da OS.</small></div>` : ''}
                <div class="form-group"><label>Data</label><input type="date" id="assistOsData" value="${getDataHoje()}"></div>
                <div class="form-group"><label>Hora</label><input type="time" id="assistOsHora" value="09:00"></div>
                <div class="form-group"><label>Descrição</label><textarea id="assistOsDescricao" rows="3">${escapeHtmlSimples((a.assunto || '') + (a.descricao ? ' — ' + a.descricao : ''))}</textarea></div>
                <div class="form-group"><label>Duração prevista (minutos)</label><input type="number" id="assistOsDuracao" min="15" max="720" value="90"></div>
                <div class="form-group"><button type="button" class="btn btn-outline" onclick="TGAssistNative._tgAssistSugestao('os')">Sugerir técnico para esta OS</button><small class="help-text">Apenas preenche a seleção, sem guardar nem notificar.</small></div>
                <div class="form-group ff-span2"><label>Funcionários atribuídos</label>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
                        ${funcionariosTenant.map(f => `<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:20px;cursor:pointer;font-size:.85rem;">
                            <input type="checkbox" class="assist-os-func-chk" value="${f.id}" ${a.atribuidoId === f.id ? 'checked' : ''} style="width:auto;"> ${escapeHtmlSimples(f.nome)}
                        </label>`).join('') || '<span class="help-text">Sem funcionários disponíveis.</span>'}
                    </div>
                </div>
            `;
            document.getElementById('modalGenericoForm').onsubmit = _protegerSubmit(() => _confirmarCriarOSDeAssistencia(assistId));
            document.getElementById('modalGenericoOverlay').classList.add('open');
        }
        async function _confirmarCriarOSDeAssistencia(assistId) {
            assertAccess(modalIdentity);
            const a = dados.assistencias?.find(x => x.id === assistId);
            if (!a) return;
            const tid = _tenantId();
            const clienteIdEscolhido = a.clienteId || null;
            if((document.getElementById('assistOsCliente')?.value||null)!==clienteIdEscolhido)return alert('O cliente é o da assistência e não pode ser alterado aqui.');
            if((document.getElementById('assistOsLocal')?.value||null)!==(a.localId||null))return alert('A instalação é a da assistência e não pode ser alterada aqui.');
            if(a.localId&&!(dados.locais||[]).some(l=>l.id===a.localId&&l.clienteId===a.clienteId&&l.adminId===tid))return alert('A instalação da assistência já não está disponível.');
            const funcionariosIds = [...document.querySelectorAll('.assist-os-func-chk:checked')].map(el => el.value);
            const contractId=a.testeContratoId||document.getElementById('assistOsContrato')?.value||null;
            if(!a.testeContratoId&&contractId&&!window.TGAssistContracts?.contracts(a.clienteId,a.localId).some(c=>c.id===contractId))return alert('Escolhe um contrato ativo desta instalação.');
            const identityBeforeNumber = actor(),localBeforeNumber=a.localId||null;
            if(clienteIdEscolhido && !(dados.clientes||[]).some(c=>c.id===clienteIdEscolhido&&c.adminId===tid))return alert('Seleciona um cliente da empresa.');
            if(funcionariosIds.some(id=>!(dados.funcionarios||[]).some(f=>f.id===id&&f.adminId===tid&&!f.suspenso)))return alert('Seleciona técnicos da empresa.');
            if(_bloquearSeAusenteEmOS(funcionariosIds,document.getElementById('assistOsData').value))return;
            let numeroOS;
            try { numeroOS = await gerarNumeroRegistoServidor(); } catch (e) { numeroOS = gerarNumeroRegisto(); }
            assertAccess(identityBeforeNumber);
            const currentAssist = item(assistId);
            if(!currentAssist || currentAssist.osGeradaId || _assistEstado(currentAssist.estado)==='resolvida') return;
            if(currentAssist.clienteId!==clienteIdEscolhido||(currentAssist.localId||null)!==localBeforeNumber)throw Error('O cliente ou a instalação da assistência mudou. Volta a abrir a criação da OS.');
            if(!currentAssist.testeContratoId&&contractId){
                if(!window.TGAssistContracts?.contracts(currentAssist.clienteId,currentAssist.localId).some(c=>c.id===contractId))return alert('O contrato desta instalação mudou. Volta a criar a OS.');
                currentAssist.testeContratoId=contractId;currentAssist.testeVisitaAno=Number(getDataHoje().slice(0,4));
            }
            const novaOS = {
                id: gerarId(), adminId: tid, clienteId: clienteIdEscolhido,
                funcionarioId: funcionariosIds[0] || null, funcionariosIds,
                assistenciaId: a.id,
                localId: currentAssist.localId || null,
                contratoId: currentAssist.testeContratoId || null,
                morada: (dados.locais||[]).find(l=>l.id===currentAssist.localId&&l.adminId===tid&&l.clienteId===currentAssist.clienteId)?.morada || (dados.clientes||[]).find(c=>c.id===currentAssist.clienteId&&c.adminId===tid)?.morada || '',
                data: document.getElementById('assistOsData')?.value || getDataHoje(),
                hora: document.getElementById('assistOsHora')?.value || '09:00',
                duracao: Number(document.getElementById('assistOsDuracao')?.value)||90,
                status: 'pendente',
                descricao: '[Assistência] ' + (document.getElementById('assistOsDescricao')?.value || a.assunto),
                numeroRegisto: numeroOS, origem: 'assistencia', tiposTrabalho: [], dataCriacao: Date.now()
            };
            if (!dados.servicos) dados.servicos = [];
            dados.servicos.push(novaOS);
            currentAssist.osGeradaId = novaOS.id;
            currentAssist.atribuidoId = funcionariosIds[0] || null;
            currentAssist.dataModificacao = Date.now();

            const clienteNomeOS = clienteIdEscolhido ? (dados.clientes?.find(c => c.id === clienteIdEscolhido)?.nome || '') : '';
            for (const fid of funcionariosIds) {
                await _crmNotificar(fid, '🛠️ Nova Ordem de Serviço', `Foste atribuído à OS ${numeroOS}${clienteNomeOS ? ' — ' + clienteNomeOS : ''}, criada a partir da assistência ${a.numero}.`);
            }

            assertAccess(identityBeforeNumber);
            closeForm();
            try {
                await persist();
                alert('✅ Ordem de Serviço ' + numeroOS + ' criada — já podes agendá-la e ajustar detalhes na aplicação principal.');
            } catch (e) {
                alert('⚠️ Ficou no ecrã, mas ainda não foi possível confirmar no servidor. Tenta novamente.');
            }
            refreshHost();
        }
        function _protegerSubmit(fnAsync) {
            return async function (ev) {
                if (ev) ev.preventDefault();
                const btn = document.querySelector('#modalGenericoForm button[type="submit"]');
                if (btn && btn.disabled) return;
                const original = btn ? btn.innerHTML : null;
                if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A guardar…'; }
                try { await fnAsync(); } catch(error) { alert(error.message || 'Não foi possível concluir a ação.'); }
                finally { if (btn) { btn.disabled = false; btn.innerHTML = original; } }
            };
        }
function assistTechnicianIds(a){
 // The current OS is authoritative, including reassignment or removal of staff.
 // Older records may only retain the reverse assistanceId link.
 const services=(dados.servicos||[]).filter(s=>s.adminId===a.adminId&&s.clienteId===a.clienteId);
 const os=services.find(s=>s.id===a.osGeradaId)||services.find(s=>s.assistenciaId===a.id);
 const ids=os?(Array.isArray(os.funcionariosIds)&&os.funcionariosIds.length?os.funcionariosIds:[os.funcionarioId]):[a.atribuidoId];
 return [...new Set(ids.filter(Boolean))];
}
function assistTechnicians(a){
 const people=[...(dados.funcionarios||[]),...(dados.encarregados||[])];
 return assistTechnicianIds(a).map(id=>people.find(p=>p.id===id&&p.adminId===a.adminId)?.nome||'Técnico indisponível').join(', ')||'Por atribuir';
}
function assistAssigned(a){return assistTechnicianIds(a).length>0;}
function assistGroup(a){return _assistEstado(a.estado)==='resolvida'?'resolvida':assistAssigned(a)?'atribuidas':'sem_atribuicao';}
function assistLocality(a){
 const os=(dados.servicos||[]).find(s=>s.id===a.osGeradaId&&s.adminId===a.adminId);
 const clienteId=a.clienteId||os?.clienteId;
 const client=(dados.clientes||[]).find(c=>c.id===clienteId&&c.adminId===a.adminId);
 const localId=a.localId||(os&&os.clienteId===clienteId?os.localId:null);
 const local=(dados.locais||[]).find(l=>l.id===localId&&l.adminId===a.adminId&&l.clienteId===clienteId);
 const name=String(localId?(local?.cidade||local?.localidade||''):(client?.cidade||client?.localidade||'')).trim().replace(/\s+/g,' ');
 return {key:name?name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase():'__sem_localidade__',name:name||'Sem localidade indicada'};
}
function assistLocalityOptions(all){
 const select=document.getElementById('assistFiltroLocalidade'),previous=select.value;
 const options=new Map();all.forEach(a=>{const l=assistLocality(a);if(!options.has(l.key))options.set(l.key,l.name);});
 select.replaceChildren(new Option('Todas as localidades',''));
 [...options].sort((a,b)=>a[1].localeCompare(b[1],'pt',{sensitivity:'base',numeric:true})).forEach(([key,name])=>select.add(new Option(name,key)));
 select.value=options.has(previous)?previous:'';
 return select.value;
}
function renderizarAssistencias(){
 const root=document.getElementById('secao-assistencias');if(!root)return;
 const state=document.getElementById('assistFiltroEstado').value,priority=document.getElementById('assistFiltroPrioridade').value;
 const query=document.getElementById('tgAssistSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const all=(dados.assistencias||[]).filter(a=>a.adminId===_tenantId()&&!a.apagadoSuperAdmin);
 const locality=assistLocalityOptions(all);
 const list=all.filter(a=>{
  const d=_assistResumoDados(a);const text=[a.numero,a.assunto,d.cliente,d.local,assistLocality(a).name,assistTechnicians(a)].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return (!locality||assistLocality(a).key===locality)&&(!state||_assistEstado(a.estado)===state)&&(!assistBucket||assistGroup(a)===assistBucket)&&(!priority||(a.prioridade||'normal')===priority)&&(!query||text.includes(query));
 }).sort((a,b)=>(b.dataCriacao||0)-(a.dataCriacao||0));
 document.getElementById('tgAssistCount').textContent=`${list.length} de ${all.length} assistências`;
 document.getElementById('tgAssistMetrics').innerHTML=[['sem_atribuicao','Abertas sem atribuição'],['atribuidas','Abertas atribuídas a técnico'],['resolvida','Resolvidas'],['','Todas']].map(([value,label])=>{
  const n=value?all.filter(a=>assistGroup(a)===value).length:all.length;
  const active=tab!=='potential'&&(value?assistBucket===value:!assistBucket&&!state);
  return `<button type="button" class="obras-estado-contador tg-assist-metric" data-assist-action="filter" data-state="${value}" aria-pressed="${active}"><strong>${n}</strong><span>${label}</span></button>`;
 }).join('')+(window.TGAssistContracts?`<button type="button" class="obras-estado-contador tg-assist-metric" data-assist-action="potential" aria-pressed="${tab==='potential'}"><strong>${TGAssistContracts.potential().length}</strong><span>Potencial para contrato</span></button>`:'');
 document.getElementById('tgAssistResults').innerHTML=list.length?`<div class="table-wrapper tg-assist-table"><table><thead><tr><th>Pedido / Cliente / Instalação</th><th>Prioridade</th><th>Estado</th><th>Técnico</th><th>Localidade</th><th>Criada em</th><th>Ações</th></tr></thead><tbody>${list.map(a=>`<tr><td>${_assistResumoHtml(a)}</td><td>${priorityBadge(a)}</td><td>${stateBadge(a)}</td><td>${escapeHtmlSimples(assistTechnicians(a))}</td><td>${escapeHtmlSimples(assistLocality(a).name)}</td><td>${a.dataCriacao?new Date(a.dataCriacao).toLocaleDateString('pt-PT'):'—'}</td><td>${actions(a)}</td></tr>`).join('')}</tbody></table></div><div class="tg-assist-cards">${list.map(a=>`<article class="tg-assist-card"><div class="tg-assist-card-top"><span>${escapeHtmlSimples(a.numero||'Assistência')}</span>${priorityBadge(a)}</div>${_assistResumoHtml(a)}<div class="tg-assist-card-state">${stateBadge(a)}<span>${escapeHtmlSimples(assistTechnicians(a))}</span></div><p class="tg-assist-card-locality"><strong>Localidade:</strong> ${escapeHtmlSimples(assistLocality(a).name)}</p><div class="tg-assist-card-actions">${actions(a)}</div></article>`).join('')}</div>`:'<p class="help-text tg-assist-empty">Sem assistências para os filtros selecionados.</p>';
}
function stateBadge(a){const s=ASSIST_ESTADOS[_assistEstado(a.estado)]||ASSIST_ESTADOS.aberta;return `<span class="tg-assist-badge" style="--assist-color:${s.cor}">${s.label}</span>`;}
function priorityBadge(a){const p=ASSIST_PRIORIDADES[a.prioridade]||ASSIST_PRIORIDADES.normal;return `<span class="tg-assist-badge" style="--assist-color:${p.cor}">${p.label}</span>`;}
function actions(a){const id=escapeHtmlSimples(a.id);return `<button type="button" class="btn btn-sm btn-outline" data-assist-action="edit" data-id="${id}"><i class="fas fa-pen"></i> Ver / editar</button>${!a.osGeradaId&&_assistEstado(a.estado)!=='resolvida'?`<button type="button" class="btn btn-sm btn-primary" data-assist-action="os" data-id="${id}"><i class="fas fa-helmet-safety"></i> Criar OS</button>`:a.osGeradaId?`<button type="button" class="btn btn-sm btn-outline" data-assist-action="viewOS" data-id="${id}"><i class="fas fa-file-lines"></i> Ver OS</button>`:''}<button type="button" class="btn btn-sm btn-outline" data-assist-action="delete" data-id="${id}" aria-label="Eliminar assistência"><i class="fas fa-trash"></i></button>`;}
function mudarTabCRM(value){tab=['dashboard','potential'].includes(value)?value:'assistencias';document.querySelectorAll('#secao-assistencias [data-assist-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.assistTab===tab)));document.getElementById('tgAssistListPane').hidden=tab!=='assistencias';document.getElementById('tgAssistDashboardPane').hidden=tab!=='dashboard';render();}
function render(){if(!allowed())return;const section=document.getElementById('secao-assistencias');if(!section)return;renderizarAssistencias();if(tab==='dashboard')renderizarDashboardAssist();if(tab==='potential'){window.TGAssistContracts?.renderPotential();document.getElementById('tgAssistListPane').hidden=false;document.getElementById('tgAssistResults').hidden=true;document.querySelector('#secao-assistencias .tg-assist-filters').hidden=true;document.getElementById('tgAssistCount').hidden=true;}else{document.getElementById('tgAssistResults').hidden=false;document.querySelector('#secao-assistencias .tg-assist-filters').hidden=false;document.getElementById('tgAssistCount').hidden=false;}const potential=document.getElementById('tgAssistPotentialPane');if(potential)potential.hidden=tab!=='potential';}
function prepare(id){
 if(!allowed())return false;
 const identityNow=actor();let section=document.getElementById('secao-assistencias');
 if(identity!==identityNow){section?.remove();identity=identityNow;modalIdentity='';assistBucket='';}
 section=document.getElementById('secao-assistencias');
 if(!section){section=document.createElement('section');section.id='secao-assistencias';section.className='section-container tg-assist-native';section.setAttribute('aria-label','Assistências');section.innerHTML=SHELL;document.body.appendChild(section);
  section.addEventListener('click',event=>{
   const b=event.target.closest('[data-assist-action],[data-assist-tab]');if(!b)return;
   if(b.dataset.assistAction==='potential'){mudarTabCRM('potential');return;}
   if(b.dataset.assistTab){mudarTabCRM(b.dataset.assistTab);return;}
   if(b.dataset.assistAction==='filter'){assistBucket=b.dataset.state;document.getElementById('assistFiltroEstado').value=assistBucket==='resolvida'?'resolvida':assistBucket?'aberta':'';mudarTabCRM('assistencias');return;}
   const a=item(b.dataset.id);switch(b.dataset.assistAction){case 'new':window.TGAssistNative.abrirModalAssistencia(null);break;case 'edit':window.TGAssistNative.abrirModalAssistencia(a?.id);break;case 'os':if(a)window.TGAssistNative.criarOSDeAssistencia(a.id);break;case 'delete':if(a)window.TGAssistNative.excluirAssistencia(a.id);break;case 'viewOS':if(a?.osGeradaId&&(dados.servicos||[]).some(s=>s.id===a.osGeradaId&&s.adminId===_tenantId()))abrirVerOS(a.osGeradaId);break;}
  });
  section.querySelectorAll('select').forEach(e=>e.addEventListener('change',()=>{if(e.id==='assistFiltroEstado')assistBucket=e.value==='resolvida'?'resolvida':'';render();}));section.querySelector('#tgAssistSearch').addEventListener('input',render);
 }
 render();if(id&&item(id))setTimeout(()=>{if(allowed()&&actor()===identityNow)window.TGAssistNative.criarOSDeAssistencia(id)},0);
 return true;
}
function validate(){
 if(identity&&(!allowed()||identity!==actor())){
  const section=document.getElementById('secao-assistencias'),active=section?.classList.contains('active');section?.remove();identity='';
  const overlay=document.getElementById('modalGenericoOverlay');if(overlay?.dataset.tgAssistNative==='1'&&overlay.querySelector('#assist_assunto,#assistOsDescricao')){overlay.classList.remove('open');delete overlay.dataset.tgAssistNative;}
  if(active&&typeof usuarioLogado!=='undefined'&&usuarioLogado)irParaInicio();
 }
}
async function excluirAssistencia(id){
 const owner=actor();const a=item(id);if(!a||!confirm('Eliminar esta assistência? A ordem de serviço associada mantém-se.'))return;
 const os=(dados.servicos||[]).find(s=>s.id===a.osGeradaId&&s.adminId===a.adminId);
 dados.assistencias=dados.assistencias.filter(x=>x!==a);if(os)os.assistenciaId=null;
 try{await guardarDados();if(actor()===owner&&allowed()){(os?.funcionariosIds||[]).forEach(fid=>_notificarFuncionario(fid,'⚠️ Assistência cancelada',`A assistência ${a.numero||''} foi eliminada.`,a.adminId));mostrarStatusCRM('Assistência eliminada.');}}catch(e){alert('Não foi possível confirmar a gravação no servidor. A TG mantém as alterações pendentes.');}
 refreshHost();
}
document.addEventListener('tg:interface-updated',()=>{validate();if(document.getElementById('secao-assistencias')?.classList.contains('active'))render()});

// Old cached TG records did not include notes; load only that column before
// editing them so the migration cannot replace an existing history with [].
let notesRequest=0;
async function openAssist(id){
 const before=actor(),ticket=++notesRequest,a=id?item(id):null;
 if(a && a.notas===undefined){
  try{
   const {data,error}=await supa.from('assistencias').select('notas').eq('id',a.id).eq('admin_id',a.adminId).maybeSingle();
   assertAccess(before);
   if(ticket!==notesRequest || !document.getElementById('secao-assistencias')?.classList.contains('active'))return;
   if(error || !data || data.notas===undefined)throw Error('Não foi possível carregar o histórico deste pedido. Verifica a ligação e tenta novamente.');
   const now=item(id);if(!now)return;now.notas=_assistLerNotas(data.notas);
   if(document.getElementById('modalGenericoOverlay')?.classList.contains('open'))return;
  }catch(error){if(actor()===before&&allowed()&&ticket===notesRequest)alert(error.message);return;}
 }
 return abrirModalAssistencia(id);
}

window.TGAssistNative={prepare,render,validate,
 mudarTabCRM:guard(mudarTabCRM),
 abrirModalAssistencia:guard(openAssist,true),guardarAssistencia:guard(guardarAssistencia,true,true),
 adicionarNotaAssistencia:guard(adicionarNotaAssistencia,true,true),criarOSDeAssistencia:guard(criarOSDeAssistencia,true),
 _confirmarCriarOSDeAssistencia:guard(_confirmarCriarOSDeAssistencia,true,true),excluirAssistencia:guard(excluirAssistencia,true),
 clienteBuscaInput:guard(clienteBuscaInput,false,true),clienteBuscaFoco:guard(clienteBuscaFoco,false,true),clienteBuscaEsconder:guard(clienteBuscaEsconder,false,true),
 _assistAtualizarContactosRapidos:guard(_assistAtualizarContactosRapidos,false,true),_tgAssistSugestao:guard(_tgAssistSugestao,false,true)
};
})();
