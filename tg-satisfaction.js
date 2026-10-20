/* Customer satisfaction: one response per completed report, scoped to the current company.
 * Historical HTML is parsed inertly, never inserted or executed. No database migration. */
(function (global) {
    'use strict';
    const levels = [
        { key: 'muito_insatisfeito', label: 'Muito insatisfeito', color: '#ef4444' },
        { key: 'insatisfeito', label: 'Insatisfeito', color: '#f59e0b' },
        { key: 'satisfeito', label: 'Satisfeito', color: '#3b82f6' },
        { key: 'muito_satisfeito', label: 'Muito satisfeito', color: '#22c55e' }
    ];
    const cache = new Map();
    let actor = '', generation = 0, current = null;
    const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
    function grade(value) {
        const n = norm(value);
        return levels.find(l => n === norm(l.key) || n === norm(l.label) || n === norm(l.label.replace('Muito ', 'Mt. ')))?.key || null;
    }
    function extract(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const opts = [...doc.querySelectorAll('.sat-opt')];
        let hasField = opts.length > 0;
        let values = opts.filter(el => /^[x✕×✓✔]$/i.test((el.querySelector('.sat-box')?.textContent || '').trim()))
            .map(el => grade(el.querySelector('span:not(.sat-box)')?.textContent)).filter(Boolean);
        // Custom reports can use a named select/radio group with the same four degrees.
        if (!hasField) for (const label of doc.querySelectorAll('label')) {
            if (!norm(label.textContent).includes('satisfacao')) continue;
            const field = (label.htmlFor && doc.getElementById(label.htmlFor)) || label.parentElement?.querySelector('select');
            if (field?.tagName === 'SELECT' && [...field.options].some(o => grade(o.textContent))) {
                hasField = true;
                const selected = field.querySelector('option[selected]');
                const key = selected && (grade(selected.textContent) || grade(selected.value));
                if (key) values.push(key);
            }
        }
        // Conflicting marks must not manufacture a response.
        values = [...new Set(values)];
        return { versao: 1, temCampo: hasField, grau: values.length === 1 ? values[0] : null };
    }
    const validDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
    const authorized = ctx => ctx?.tenantId && ctx.user?.id && ['admin', 'subadmin'].includes(ctx.user.role) && (ctx.user.role === 'admin' ? ctx.user.id : ctx.user.adminId) === ctx.tenantId;
    const getContext = () => typeof _hdcContextoSatisfacao === 'function' ? _hdcContextoSatisfacao() : null;
    function eligible(ctx, range) {
        if (!authorized(ctx) || !validDay(range?.ini) || !validDay(range?.fim) || range.ini > range.fim) return [];
        const unique = new Map();
        for (const r of ctx.reports || []) {
            if (!r.id || r.adminId !== ctx.tenantId || r.rascunho || !validDay(r.data) || r.data < range.ini || r.data > range.fim) continue;
            unique.set(r.id, r);
        }
        return [...unique.values()];
    }
    function cacheKey(ctx, r) { return JSON.stringify([ctx.tenantId, r.id, r.campos?.htmlSnapshotPath, r.criadoEm]); }
    function known(ctx, r) {
        const meta = r.campos?.satisfacaoCliente;
        if (meta?.versao === 1 && typeof meta.temCampo === 'boolean' && (meta.grau === null || levels.some(l => l.key === meta.grau))) return meta;
        if (r.campos?.htmlSnapshot) return extract(r.campos.htmlSnapshot);
        if (!r.campos?.htmlSnapshotPath) return { versao: 1, temCampo: false, grau: null };
        return cache.get(cacheKey(ctx, r));
    }
    function summarize(ctx, range) {
        const rows = [], counts = Object.fromEntries(levels.map(l => [l.key, 0]));
        let unanswered = 0, pending = 0, errors = 0, withoutField = 0;
        for (const r of eligible(ctx, range)) {
            const value = known(ctx, r);
            if (!value) { pending++; continue; }
            if (value.error) { errors++; continue; }
            if (!value.temCampo) { withoutField++; continue; }
            if (!value.grau) { unanswered++; continue; }
            counts[value.grau]++;
            const customer = (ctx.clients || []).find(c => c.id === r.clienteId && c.adminId === ctx.tenantId);
            rows.push({ id: r.id, date: r.data, number: r.numeroDocumento || r.id, type: r.tipo || '', customer: customer?.nome || 'Cliente indisponível', key: value.grau });
        }
        rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number), 'pt'));
        return { counts, rows, total: rows.length, unanswered, pending, errors, withoutField };
    }
    const ptDay = s => s.split('-').reverse().join('/');
    const period = range => ptDay(range.ini) + ' a ' + ptDay(range.fim);
    const percent = (n, total) => total ? (100 * n / total).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) : '0';
    function chart(s) {
        let from = 0;
        const stops = levels.map(l => {
            const start = from; from += s.total ? s.counts[l.key] * 100 / s.total : 0;
            return `${l.color} ${start}% ${from}%`;
        });
        return `<div class="tg-sat-donut" style="background:${s.total ? 'conic-gradient(' + stops.join(',') + ')' : '#e2e8f0'}" aria-hidden="true"><div><b>${s.total}</b><small>Avaliações</small></div></div>`;
    }
    function draw(target, ctx, range, s) {
        target.replaceChildren();
        const head = document.createElement('div'); head.className = 'tg-sat-heading';
        const title = document.createElement('h4'); title.textContent = 'Satisfação dos clientes'; head.append(title);
        const actions = document.createElement('div'); actions.className = 'tg-sat-actions';
        for (const [format, label] of [['pdf', 'PDF'], ['csv', 'CSV']]) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', 'Descarregar ' + label); button.title = 'Descarregar ' + label;
            button.disabled = !s.total || !!s.pending || !!s.errors;
            button.addEventListener('click', () => download(format)); actions.append(button);
        }
        head.append(actions); target.append(head);
        const dates = document.createElement('p'); dates.className = 'tg-sat-period'; dates.textContent = period(range) + ' · Data do relatório'; target.append(dates);
        const body = document.createElement('div'); body.className = 'tg-sat-body';
        const donut = document.createElement('div'); donut.innerHTML = chart(s); body.append(donut);
        const table = document.createElement('table'); table.className = 'tg-sat-table';
        const caption = document.createElement('caption'); caption.textContent = 'Distribuição das avaliações no período'; table.append(caption);
        const tbody = document.createElement('tbody');
        for (const l of levels) {
            const tr = document.createElement('tr'), name = document.createElement('th'), value = document.createElement('td');
            name.scope = 'row'; const dot = document.createElement('i'); dot.style.background = l.color; dot.setAttribute('aria-hidden', 'true');
            name.append(dot, l.label); value.textContent = `${s.counts[l.key]} (${percent(s.counts[l.key], s.total)}%)`; tr.append(name, value); tbody.append(tr);
        }
        table.append(tbody); body.append(table); target.append(body);
        const status = document.createElement('p'); status.className = 'tg-sat-status'; status.setAttribute('role', 'status');
        status.textContent = s.pending ? `A carregar ${s.pending} relatório(s) antigo(s)…` : s.errors ? `Não foi possível ler ${s.errors} relatório(s). O gráfico está incompleto; os downloads estarão disponíveis após a leitura completa.` : !s.total ? 'Sem avaliações de satisfação no período selecionado.' : `${s.total} avaliação(ões) · Uma resposta por relatório concluído.`;
        if (!s.pending && s.unanswered) status.textContent += ` ${s.unanswered} relatório(s) com campo de satisfação sem resposta (excluídos das percentagens).`;
        if (s.withoutField) status.textContent += ` ${s.withoutField} relatório(s) sem campo de satisfação.`;
        target.append(status);
        if (s.errors && !s.pending) {
            const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Tentar novamente';
            retry.addEventListener('click', () => { for (const [key, value] of cache) if (value.error) cache.delete(key); mount(target, range); }); target.append(retry);
        }
    }
    function sameActor(ctx) { return authorized(ctx) && `${ctx.tenantId}:${ctx.user.id}` === actor; }
    async function mount(target, range) {
        const ctx = getContext();
        if (!target || !authorized(ctx)) { current = null; if (target) target.replaceChildren(); return; }
        const nextActor = `${ctx.tenantId}:${ctx.user.id}`;
        if (nextActor !== actor) { cache.clear(); actor = nextActor; }
        const ticket = ++generation;
        range = { ini: range.ini, fim: range.fim };
        current = { target, range, ticket };
        if (!validDay(range.ini) || !validDay(range.fim) || range.ini > range.fim) { target.textContent = 'Selecione um período válido.'; return; }
        const fresh = () => ticket === generation && target.isConnected && sameActor(getContext());
        const render = () => { if (fresh()) draw(target, getContext(), range, summarize(getContext(), range)); };
        render();
        const queue = eligible(ctx, range).filter(r => !known(ctx, r));
        // Limit concurrent reads; never request another tenant's storage path.
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
            while (queue.length && fresh()) {
                const r = queue.shift(), path = r.campos.htmlSnapshotPath;
                let value;
                try {
                    if (!path.startsWith(ctx.tenantId + '/') || path.includes('..')) throw new Error('Invalid report path');
                    const html = await ctx.readSnapshot(path);
                    if (typeof html !== 'string' || !/<(?:!doctype|html|body|div|table)\b/i.test(html)) throw new Error('Report unavailable');
                    value = extract(html);
                } catch (_) { value = { error: true }; }
                if (!fresh()) return;
                cache.set(cacheKey(ctx, r), value); render();
            }
        }));
    }
    function csv(ctx, range, s) {
        const cell = v => '"' + String(v == null ? '' : v).replace(/^[\s]*[=+@-]/, "'$&").replace(/"/g, '""') + '"';
        const lines = [ ['Satisfação dos clientes'], ['Início', range.ini, 'Fim', range.fim], ['Base', 'Data do relatório; uma resposta por relatório concluído'],
            ['Grau de satisfação', 'Avaliações', 'Percentagem'] ];
        for (const l of levels) lines.push([l.label, s.counts[l.key], percent(s.counts[l.key], s.total) + '%']);
        lines.push(['Total de avaliações', s.total], ['Com campo sem resposta', s.unanswered], ['Sem campo de satisfação', s.withoutField], [], ['Data', 'Relatório', 'Tipo', 'Cliente', 'Satisfação']);
        for (const r of s.rows) lines.push([r.date, r.number, r.type, r.customer, levels.find(l => l.key === r.key).label]);
        return '\uFEFF' + lines.map(line => line.map(cell).join(';')).join('\r\n');
    }
    function download(format) {
        const ctx = getContext(), view = current;
        if (!view || !view.target.isConnected || !sameActor(ctx) || view.ticket !== generation) return;
        const s = summarize(ctx, view.range);
        if (!s.total || s.pending || s.errors) return;
        const filename = `satisfacao-clientes_${view.range.ini}_${view.range.fim}`;
        if (format === 'csv') {
            const url = URL.createObjectURL(new Blob([csv(ctx, view.range, s)], { type: 'text/csv;charset=utf-8;' }));
            const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000); return;
        }
        if (!global.jspdf?.jsPDF) { alert('O componente de PDF ainda não está disponível. Tente novamente ou descarregue o CSV.'); return; }
        const pdf = new global.jspdf.jsPDF();
        pdf.setFontSize(18); pdf.text('Satisfação dos clientes', 18, 22);
        pdf.setFontSize(11); pdf.text(period(view.range) + ' | Data do relatório', 18, 32);
        // Vector donut: no external image, canvas or network dependency.
        const cx = 105, cy = 75, radius = 28, hole = 18;
        let angle = -Math.PI / 2;
        for (const l of levels) {
            const end = angle + s.counts[l.key] / s.total * Math.PI * 2;
            pdf.setFillColor(l.color);
            if (end > angle) {
                const segments = [];
                let x = 0, y = 0;
                const steps = Math.max(2, Math.ceil((end - angle) / 0.025));
                for (let i = 0; i <= steps; i++) {
                    const a = angle + (end - angle) * i / steps;
                    const nx = Math.cos(a) * radius, ny = Math.sin(a) * radius;
                    segments.push([nx - x, ny - y]); x = nx; y = ny;
                }
                segments.push([-x, -y]);
                pdf.lines(segments, cx, cy, [1, 1], 'F', true);
            }
            angle = end;
        }
        pdf.setFillColor('#ffffff'); pdf.circle(cx, cy, hole, 'F'); pdf.setTextColor('#152a52');
        pdf.setFontSize(18); pdf.text(String(s.total), cx, cy, { align: 'center' }); pdf.setFontSize(9); pdf.text('Avaliações', cx, cy + 6, { align: 'center' });
        let y = 120;
        for (const l of levels) {
            pdf.setFillColor(l.color); pdf.circle(21, y - 1, 1.5, 'F'); pdf.setFontSize(11); pdf.text(l.label, 27, y);
            pdf.text(`${s.counts[l.key]} (${percent(s.counts[l.key], s.total)}%)`, 190, y, { align: 'right' }); y += 12;
        }
        pdf.setFontSize(10); pdf.text('Uma resposta por relatório concluído.', 18, y + 8);
        pdf.text(`Com campo sem resposta: ${s.unanswered}. Sem campo: ${s.withoutField}.`, 18, y + 16);
        pdf.save(filename + '.pdf');
    }
    // Existing data refresh/save/realtime pathway already emits this event.
    document.addEventListener('tg:interface-updated', () => {
        if (!current) return;
        if (!sameActor(getContext())) {
            generation++; cache.clear(); current.target.replaceChildren(); current = null; return;
        }
        if (!current.target.isConnected || !current.target.closest('.section-container.active')) return;
        mount(current.target, current.range);
    });
    global.TGSatisfaction = { extract, mount, eligible, summarize, csv, download };
})(window);
