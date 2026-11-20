/* Shared, side-effect-free material planning helpers for Obras and OS.
 * Expects already-parsed spreadsheet rows; importing XLSX uses the existing UI parser.
 * No stock movements or persistence occur in this module.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TGMaterialPlanning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const own = (item, tenantId) => !!item && !!tenantId && String(item.adminId) === String(tenantId);
    const amount = value => {
        if (typeof value === 'string') {
            const raw = value.trim().replace(/\s/g, '');
            if (!raw || !/^-?\d+(?:[.,]\d+)?$/.test(raw)) return NaN;
            value = Number(raw.replace(',', '.'));
        }
        return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
    };
    const round = value => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
    function resolvePlanOwner(os, works, tenantId) {
        if (!own(os, tenantId)) return null;
        if (!os.obraId) return { type: 'os', id: os.id };
        const work = (works || []).find(w => String(w.id) === String(os.obraId) && own(w, tenantId));
        return work ? { type: 'obra', id: work.id } : null;
    }
    function summarizePlan(plan, articles, tenantId) {
        return (plan || []).filter(item => own(item, tenantId)).map(item => {
            const article = (articles || []).find(a => String(a.id) === String(item.artigoId) && own(a, tenantId));
            if (!article) return null;
            const planned = amount(item.qtdPrevista), consumed = amount(item.qtdConsumida == null ? 0 : item.qtdConsumida);
            if (!(planned >= 0) || !(consumed >= 0)) return null;
            return {
                id: item.id, artigoId: article.id, nome: article.nome, unidade: article.unidade || 'un',
                previsto: round(planned), consumido: round(consumed), falta: round(Math.max(0, planned - consumed)),
                excedente: round(Math.max(0, consumed - planned))
            };
        }).filter(Boolean);
    }
    function validateImportRows(rows, articles, tenantId) {
        const accepted = [], errors = [];
        const catalog = (articles || []).filter(a => own(a, tenantId));
        (rows || []).forEach((row, index) => {
            const line = index + 2; // line 1 contains the header
            const ref = String(row.referencia ?? row.ref ?? row.codigo ?? '').trim();
            const name = String(row.nome ?? row.descricao ?? '').trim();
            const qty = amount(row.quantidade ?? row.qtd ?? row.qtdPrevista);
            const unit = String(row.unidade || '').trim();
            const matches = catalog.filter(a => (ref && String(a.referencia || a.codigo || '').trim() === ref) ||
                (!ref && name && String(a.nome || '').trim().toLocaleLowerCase('pt-PT') === name.toLocaleLowerCase('pt-PT')));
            if (matches.length !== 1) { errors.push({linha:line,erro:matches.length ? 'Artigo ambíguo' : 'Artigo não encontrado'}); return; }
            if (!(qty > 0)) { errors.push({linha:line,erro:'Quantidade inválida'}); return; }
            if (unit && String(matches[0].unidade || 'un').trim().toLowerCase() !== unit.toLowerCase()) {
                errors.push({linha:line,erro:'Unidade diferente da ficha do artigo'}); return;
            }
            accepted.push({artigoId:matches[0].id,qtdPrevista:round(qty),linha:line});
        });
        return { accepted, errors, canConfirm: errors.length === 0 && accepted.length > 0 };
    }
    return {resolvePlanOwner,summarizePlan,validateImportRows};
});
