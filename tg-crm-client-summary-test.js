/* Customer summary for TesteTG CRM. Read-only, loaded only after customer selection. */
(function () {
'use strict';
if (window.TGCRMClientSummary) return;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT');
const user = () => typeof usuarioLogado === 'undefined' ? null : usuarioLogado;
const tenant = () => user()?.role === 'admin' ? user().id : user()?.adminId;
const manager = () => ['admin','subadmin'].includes(user()?.role);
const identity = () => JSON.stringify([tenant(), user()?.id, user()?.role]);
const stamp = value => { const n = new Date(value || 0).getTime(); return Number.isFinite(n) ? n : 0; };
const date = value => value && stamp(value) ? new Date(value).toLocaleDateString('pt-PT') : '—';
const money = value => value == null ? '—' : Number(value).toLocaleString('pt-PT', { style:'currency', currency:'EUR' });
const kinds = {
 propostas: { label:'Propostas', icon:'fa-file-invoice', table:'propostas', owner:'responsavel_comercial', fields:'id,admin_id,cliente_id,lead_id,oportunidade_id,numero,nome,descricao,estado,valor,data_criacao,data_modificacao,data_envio,responsavel_comercial' },
 visitas: { label:'Visitas', icon:'fa-calendar-check', table:'visitas', owner:'responsavel_id', fields:'id,admin_id,cliente_id,lead_id,nome,data,hora,estado,notas,responsavel_id,data_criacao' },
 instalacoes: { label:'Instalações', icon:'fa-location-dot', table:'locais', fields:'id,admin_id,cliente_id,nome,morada,numero_porta,codigo_postal,cidade,data_criacao' },
 contratos: { label:'Contratos', icon:'fa-file-contract', table:'contratos', fields:'id,admin_id,cliente_id,numero,tipo,periodicidade,data_inicio,data_criacao,valor' },
 os: { label:'Ordens de serviço', icon:'fa-wrench', table:'servicos', fields:'id,admin_id,cliente_id,numero_registo,descricao,status,data,hora' },
 assistencias: { label:'Assistências', icon:'fa-headset', table:'assistencias', fields:'id,admin_id,cliente_id,numero,assunto,descricao,estado,prioridade,data_criacao,apagado_superadmin' }
};
let state = { identity:'', selected:'', kind:'propostas', clientSearch:'', recordSearch:'', limit:50, request:0, loading:false, results:{}, relations:null };
let latest = null;
function permitted(data) {
 if (!user() || !tenant() || !['admin','subadmin','vendedor'].includes(user().role)) return [];
 const ids = new Set([...(data.leads || []).map(l => l.clienteConvertidoId || l.clienteId), ...(data.opps || []).map(o => o.clienteId), ...(data.proposals || []).map(p => p.clienteId)]);
 return (data.clients || []).filter(c => c.adminId === tenant() && !c.apagadoSuperAdmin && (manager() || ids.has(c.id))).sort((a,b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
}
function validRequest(request, account, clientId) {
 try { if (typeof _tgModuleAssertAccess === 'function') _tgModuleAssertAccess(); } catch (_) { return false; }
 return state.request === request && identity() === account && state.selected === clientId && permitted(latest || {}).some(c => String(c.id) === clientId);
}
function reset() {
 state = { identity:identity(), selected:'', kind:'propostas', clientSearch:'', recordSearch:'', limit:50, request:state.request + 1, loading:false, results:{}, relations:null };
}
async function readRows(table, fields, filters, owner, clientId, request, account) {
 const rows = [];
 for (let offset = 0; ; ) {
  if (!validRequest(request, account, clientId)) return null;
  const scoped = {admin_id:tenant(), ...filters, ...(!manager() && owner ? {[owner]:user().id} : {})};
  let query = supa.from(table).select(fields, {count:'exact'});
  Object.entries(scoped).forEach(([key,value]) => { query = Array.isArray(value) ? query.in(key,value) : query.eq(key,value); });
  const { data, error, count } = await query.order('id', {ascending:true}).range(offset, offset + 499);
  if (error) throw error;
  if (!validRequest(request, account, clientId)) return null;
  const page = data || [];
  rows.push(...page.filter(r => !r.apagado_superadmin && Object.entries(scoped).every(([key,value]) => Array.isArray(value) ? value.map(String).includes(String(r[key])) : String(r[key]) === String(value))));
  offset += page.length;
  if (!page.length || (count != null && offset >= count)) break;
 }
 return rows;
}
async function readRelations(clientId, request, account) {
 const [leads,opps] = await Promise.all([
  readRows('leads','id,admin_id,cliente_convertido_id,responsavel_comercial',{cliente_convertido_id:clientId},'responsavel_comercial',clientId,request,account),
  readRows('oportunidades','id,admin_id,cliente_id,lead_id,responsavel',{cliente_id:clientId},'responsavel',clientId,request,account)
 ]);
 if (!leads || !opps) return null;
 const viaOpportunities=[...new Set(opps.map(r=>r.lead_id).filter(Boolean))].filter(id=>!leads.some(l=>l.id===id));
 for (let index=0;index<viaOpportunities.length;index+=100) {
  const linked=await readRows('leads','id,admin_id,cliente_convertido_id,responsavel_comercial',{id:viaOpportunities.slice(index,index+100)},'responsavel_comercial',clientId,request,account);
  if (!linked) return null;
  leads.push(...linked.filter(r=>!r.cliente_convertido_id || String(r.cliente_convertido_id)===clientId));
 }
 return {leads,opps};
}
async function fetchCategory(kind, clientId, request, account, relationRequest) {
 if (!['propostas','visitas'].includes(kind) && !manager()) return { denied:true, rows:[] };
 const config = kinds[kind];
 const rows = await readRows(config.table,config.fields,{cliente_id:clientId},config.owner,clientId,request,account);
 if (!rows) return null;
 if (['propostas','visitas'].includes(kind)) {
  const relations = await relationRequest;
  if (!relations) return null;
  if (relations.error) throw new Error('Não foi possível consultar as associações comerciais.');
  const links = [['lead_id',relations.leads.map(r=>r.id)]];
  if (kind === 'propostas') links.push(['oportunidade_id',relations.opps.map(r=>r.id)]);
  for (const [field,ids] of links) {
   for (let index=0;index<ids.length;index+=100) {
    const linked = await readRows(config.table,config.fields,{[field]:ids.slice(index,index+100)},config.owner,clientId,request,account);
    if (!linked) return null;
    // A record explicitly linked to another customer must never be adopted via an old lead.
    rows.push(...linked.filter(r=>!r.cliente_id || String(r.cliente_id)===clientId));
   }
  }
 }
 return { rows:[...new Map(rows.map(r => [r.id,r])).values()].sort((a,b) => stamp(b.data || b.data_envio || b.data_criacao) - stamp(a.data || a.data_envio || a.data_criacao)) };
}
async function load() {
 if (!state.selected || !permitted(latest || {}).some(c => String(c.id) === state.selected)) return;
 const clientId = state.selected, request = ++state.request, account = identity();
 state.loading = true; state.results = {}; state.relations = null; render(latest);
 const relationRequest = readRelations(clientId,request,account).catch(()=>({error:true})).then(relations=>{
  if (relations && validRequest(request,account,clientId)) { state.relations=relations; render(latest); }
  return relations;
 });
 await Promise.all(Object.keys(kinds).map(async kind => {
  let result;
  try { result = await fetchCategory(kind, clientId, request, account, relationRequest); }
  catch (_) { result = { error:true, rows:[] }; }
  if (!result || !validRequest(request, account, clientId)) return;
  state.results[kind] = result; render(latest);
 }));
 if (validRequest(request, account, clientId)) { state.loading = false; render(latest); }
}
function sellerLabel() {
 const relations=state.relations;
 if (!relations) return 'Vendedor atribuído: a carregar…';
 if (relations.error) return 'Atribuição comercial indisponível';
 const assigned=[...new Set([...relations.leads.map(r=>r.responsavel_comercial),...relations.opps.map(r=>r.responsavel)].filter(Boolean))];
 const proposalSellers=[...new Set((state.results.propostas?.rows || []).map(r=>r.responsavel_comercial).filter(Boolean))];
 const ids=assigned.length?assigned:proposalSellers;
 if (!ids.length) return 'Sem vendedor atribuído';
 const people=(latest.people || []).filter(p=>p.adminId===tenant() || p.id===tenant());
 const names=ids.map(id=>people.find(p=>String(p.id)===String(id))?.nome || 'Vendedor não identificado').sort((a,b)=>a.localeCompare(b,'pt'));
 const label=assigned.length?(names.length===1?'Vendedor atribuído':'Vendedores atribuídos'):(names.length===1?'Vendedor da proposta':'Vendedores das propostas');
 return label+': '+names.join(' · ');
}
function customerOptions(clients) {
 const term = clean(state.clientSearch);
 return '<option value="">Selecionar cliente…</option>' + clients.filter(c => String(c.id) === state.selected || clean([c.nome,c.numeroCliente,c.nif].join(' ')).includes(term)).map(c => `<option value="${esc(c.id)}" ${String(c.id) === state.selected ? 'selected' : ''}>${esc([c.numeroCliente,c.nome].filter(Boolean).join(' · '))}</option>`).join('');
}
function recordValues(kind, r) {
 if (kind === 'propostas') return [r.numero || 'Sem número', r.nome || r.descricao || 'Proposta', r.estado || 'Rascunho', date(r.data_envio || r.data_criacao), money(r.valor)];
 if (kind === 'visitas') return [r.nome || 'Visita comercial', date(r.data), r.hora ? String(r.hora).slice(0,5) : '—', r.estado || 'Planeada', r.notas || '—'];
 if (kind === 'instalacoes') return [r.nome || 'Instalação', [r.morada,r.numero_porta].filter(Boolean).join(', ') || '—', [r.codigo_postal,r.cidade].filter(Boolean).join(' ') || '—'];
 if (kind === 'contratos') return [r.numero || 'Sem número', r.tipo || 'Contrato', r.periodicidade || '—', date(r.data_inicio), money(r.valor)];
 if (kind === 'os') return [r.numero_registo || 'Sem número', r.descricao || 'Ordem de serviço', r.status || 'Pendente', date(r.data), r.hora ? String(r.hora).slice(0,5) : '—'];
 return [r.numero || 'Sem número', r.assunto || r.descricao || 'Assistência', r.estado || 'Aberta', r.prioridade || 'Normal', date(r.data_criacao)];
}
function history() {
 const kind = state.kind, result = state.results[kind], name = kinds[kind].label;
 if (!result) return '<div class="crm-client-empty" role="status">A carregar ' + esc(name.toLowerCase()) + '…</div>';
 if (result.denied) return '<div class="crm-client-empty">O teu perfil não permite consultar estes registos.</div>';
 if (result.error) return '<div class="crm-client-empty" role="alert">Não foi possível carregar ' + esc(name.toLowerCase()) + '. <button type="button" class="btn btn-outline btn-sm" data-crmclient-refresh>Tentar novamente</button></div>';
 const headers = { propostas:['Número','Proposta','Estado','Data','Valor'], visitas:['Visita','Data','Hora','Estado','Notas'], instalacoes:['Instalação','Morada','Localidade'], contratos:['Número','Tipo','Periodicidade','Início','Valor'], os:['Número','Descrição','Estado','Data','Hora'], assistencias:['Número','Assunto','Estado','Prioridade','Data'] }[kind];
 const rows = result.rows.map(r => recordValues(kind,r)).filter(values => clean(values.join(' ')).includes(clean(state.recordSearch)));
 const list = rows.length ? `<div class="crm-client-table"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,state.limit).map(values => `<tr>${values.map((v,i) => `<td data-label="${esc(headers[i])}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="crm-client-empty">${state.recordSearch ? 'Sem resultados para esta pesquisa.' : 'Este cliente ainda não tem registos nesta categoria.'}</div>`;
 return `<div class="crm-client-history-head"><div><h3 id="crmClientHistoryTitle">${esc(name)}</h3><p>${rows.length} de ${result.rows.length} registos</p></div><label class="crm-client-history-search">Pesquisar nesta categoria<input type="search" id="crmClientRecordSearch" placeholder="Número, descrição ou estado…" value="${esc(state.recordSearch)}"></label></div>${list}${rows.length > state.limit ? '<button type="button" class="btn btn-outline crm-client-more" data-crmclient-more>Mostrar mais registos</button>' : ''}`;
}
function render(data) {
 latest = data;
 const parent = $('secao-clientes-crm'); if (!parent) return;
 let box = $('crmPlusClient');
 if (!box) { box = document.createElement('section'); box.id = 'crmPlusClient'; box.className = 'crm-plus crm-client-summary'; parent.prepend(box); }
 if (state.identity !== identity()) reset();
 try { if (typeof _tgModuleAssertAccess === 'function') _tgModuleAssertAccess(); }
 catch (_) { reset(); box.innerHTML = ''; return; }
 const clients = permitted(data);
 if (state.selected && !clients.some(c => String(c.id) === state.selected)) reset();
 const client = clients.find(c => String(c.id) === state.selected);
 const focused = box.contains(document.activeElement) ? document.activeElement : null;
 const focusId = focused?.id, cursor = focused?.selectionStart;
 box.innerHTML = `<div class="crm-client-heading"><div><span class="crm-client-eyebrow">CRM · CLIENTES</span><h2>Ficha do Cliente</h2><p>Escolhe um cliente para consultar o seu resumo e histórico.</p></div>${client ? '<button type="button" class="btn btn-outline btn-sm" data-crmclient-refresh ' + (state.loading ? 'disabled' : '') + '><i class="fas fa-rotate-right" aria-hidden="true"></i> Atualizar resumo</button>' : ''}</div>
 <div class="crm-client-picker"><label>Pesquisar cliente<input id="crmClientSearch" type="search" placeholder="Nome, número de cliente ou NIF…" value="${esc(state.clientSearch)}"></label><label for="crmPlusClientSelect">Selecionar cliente<select id="crmPlusClientSelect">${customerOptions(clients)}</select></label></div>
 ${client ? `<div class="crm-client-identity"><div class="crm-client-avatar" aria-hidden="true"><i class="fas fa-building"></i></div><div><h3>${esc(client.nome)}</h3><p>${esc([client.numeroCliente ? 'Cliente n.º ' + client.numeroCliente : '', client.nif ? 'NIF ' + client.nif : '', client.pessoaContacto].filter(Boolean).join(' · '))}</p><p>${esc([client.telefone,client.email].filter(Boolean).join(' · '))}</p><p>${esc([client.morada || client.endereco,client.codigoPostal,client.cidade].filter(Boolean).join(' · '))}</p><p class="crm-client-seller" data-crmclient-seller><i class="fas fa-user-tie" aria-hidden="true"></i> ${esc(sellerLabel())}</p></div></div>
 <div class="crm-client-counters" role="tablist" aria-label="Histórico por categoria">${Object.entries(kinds).map(([kind,config]) => {
  const r = state.results[kind], count = !r ? '…' : r.denied ? '—' : r.error ? '!' : r.rows.length;
  return `<button id="crmClientTab-${kind}" type="button" class="crm-client-counter" role="tab" aria-selected="${state.kind === kind}" aria-controls="crmClientHistory" data-crmclient-kind="${kind}"><i class="fas ${config.icon}" aria-hidden="true"></i><span>${esc(config.label)}</span><strong>${count}</strong><small>${!r ? 'A carregar' : r.denied ? 'Sem acesso' : r.error ? 'Indisponível' : 'Ver histórico'}</small></button>`;
 }).join('')}</div><section id="crmClientHistory" role="tabpanel" aria-labelledby="crmClientTab-${state.kind}" aria-busy="${!state.results[state.kind]}">${history()}</section>` : `<div class="crm-client-empty crm-client-welcome"><i class="fas fa-address-card" aria-hidden="true"></i><h3>${clients.length ? 'Começa por selecionar um cliente' : 'Sem clientes disponíveis'}</h3><p>Visitas, propostas, instalações, contratos, ordens de serviço e assistências, cada um no seu separador.</p></div>`}`;
 if (focusId) { const field = $(focusId); field?.focus(); if (cursor != null && field?.setSelectionRange) field.setSelectionRange(cursor,cursor); }
}
document.addEventListener('change', event => {
 if (event.target.id !== 'crmPlusClientSelect' || !latest) return;
 const value = event.target.value;
 state.selected = permitted(latest).some(c => String(c.id) === value) ? value : '';
 state.kind = 'propostas'; state.recordSearch = ''; state.limit = 50; state.request++; state.results = {}; state.relations = null; state.loading = false;
 render(latest); if (state.selected) void load();
});
document.addEventListener('input', event => {
 if (event.target.id === 'crmClientSearch') { state.clientSearch = event.target.value; const select = $('crmPlusClientSelect'); if (select) select.innerHTML = customerOptions(permitted(latest || {})); }
 if (event.target.id === 'crmClientRecordSearch') {
  state.recordSearch = event.target.value; state.limit = 50;
  const start = event.target.selectionStart; $('crmClientHistory').innerHTML = history();
  const field = $('crmClientRecordSearch'); field?.focus(); if (field && start != null) field.setSelectionRange(start,start);
 }
});
document.addEventListener('click', event => {
 if (!event.target.closest('#crmPlusClient') || !latest) return;
 const tab = event.target.closest('[data-crmclient-kind]');
 if (tab && kinds[tab.dataset.crmclientKind]) { state.kind = tab.dataset.crmclientKind; state.recordSearch = ''; state.limit = 50; render(latest); $('crmClientTab-' + state.kind)?.focus(); }
 if (event.target.closest('[data-crmclient-more]')) { state.limit += 50; $('crmClientHistory').innerHTML = history(); }
 if (event.target.closest('[data-crmclient-refresh]') && !state.loading) void load();
});
document.addEventListener('keydown', event => {
 const tab = event.target.closest('#crmPlusClient [role="tab"]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
 const keys = Object.keys(kinds), current = keys.indexOf(tab.dataset.crmclientKind);
 const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
 event.preventDefault(); $('crmClientTab-' + keys[next])?.click();
});
window.TGCRMClientSummary = { render };
})();
