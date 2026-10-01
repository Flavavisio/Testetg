/* TG Smart — navegação local. Não envia conversas para serviços de IA. */
(() => {
  'use strict';
  if (window.TGAssistente) return;
  const base = new URL('.', document.currentScript.src);
  const asset = name => new URL('assets/' + name, base).href;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('tg-assistente.css', base).href;
  document.head.append(css);
  const root = document.createElement('aside');
  root.id = 'tg-assistente'; root.hidden = true;
  root.innerHTML = `
    <section class="tg-chat" hidden role="dialog" aria-labelledby="tg-chat-title">
      <header><div><strong id="tg-chat-title">TG · O teu assistente</strong><small>Vamos encontrar o que precisas.</small></div><button type="button" class="tg-close" aria-label="Fechar assistente">×</button></header>
      <div class="tg-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa com o TG"></div>
      <div class="tg-shortcuts" aria-label="Atalhos disponíveis"></div>
      <form class="tg-form"><label class="tg-sr" for="tg-question">O que precisas de encontrar?</label><input id="tg-question" maxlength="300" autocomplete="off" placeholder="Ex.: abrir ordens de serviço"><button type="submit" aria-label="Enviar pedido">➜</button></form>
      <footer>Ajudo-te a navegar na Total Gest.</footer>
    </section>
    <div class="tg-launcher"><button type="button" class="tg-minimize" aria-label="Minimizar mascote" title="Minimizar mascote">−</button><button type="button" class="tg-open" aria-label="Abrir assistente TG" aria-expanded="false"><img alt="" width="104" height="123"><span>Precisas de ajuda?</span></button></div>`;
  document.body.append(root);
  const panel = root.querySelector('.tg-chat'), log = root.querySelector('.tg-messages');
  const input = root.querySelector('input'), toggle = root.querySelector('.tg-open');
  const picture = toggle.querySelector('img'), shortcuts = root.querySelector('.tg-shortcuts');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let identity = '', opened = false, minimized = false, imageTimer;
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const synonyms = {
    servicos: ['os', 'ordens de servico', 'ordem de servico', 'servicos', 'intervencoes'],
    clientes: ['cliente', 'clientes', 'locais'], contratos: ['contrato', 'contratos', 'manutencao', 'manutencoes'],
    funcionarios: ['funcionario', 'funcionarios', 'tecnicos', 'colaboradores'],
    ponto: ['ponto', 'picar', 'picagem', 'picagens'], assiduidade: ['assiduidade', 'presencas'],
    pedidos: ['ferias', 'faltas'], 'calendario-equipa': ['calendario', 'disponibilidade', 'disponivel', 'disponiveis'],
    artigos: ['stock', 'stocks', 'artigos', 'material', 'armazem'], folhas: ['folha de obra', 'folhas de obra'],
    'obras-longa': ['obras', 'obra'], 'agenda-obras': ['agenda', 'agendamento'],
    crm: ['crm', 'leads', 'comercial', 'propostas'], frota: ['frota', 'viaturas'],
    assistencias: ['assistencias', 'assistencia'], guia: ['guia', 'manual', 'tutorial'],
    'minha-licenca': ['licenca', 'plano', 'pack'], 'relatorios-personalizados': ['relatorios personalizados'],
    'relatorio-os': ['relatorio de os', 'relatorios de os']
  };
  function user() { return typeof usuarioLogado !== 'undefined' ? usuarioLogado : null; }
  function permitted() {
    if (!user()) return [];
    return [...document.querySelectorAll('#cardsGrid .card-principal[data-card]')]
      .filter(el => !el.classList.contains('hidden-card') && !el.classList.contains('card-bloqueado') && el.style.display !== 'none' && !el.hidden)
      .map(el => ({id: el.dataset.card, label: el.querySelector('.info h3')?.textContent.trim() || el.dataset.card, el}));
  }
  function animate(state = 'idle') {
    clearTimeout(imageTimer);
    picture.src = asset(motion.matches ? 'tg-mascote-ola.png' : `tg-mascote-${state}.webp`);
    if (state !== 'idle') imageTimer = setTimeout(() => animate(), 2200);
  }
  motion.addEventListener('change', () => animate());
  picture.addEventListener('error', () => { picture.hidden = true; toggle.querySelector('span').textContent = 'Assistente TG'; });
  function message(text, from = 'tg', actions = []) {
    const item = document.createElement('div'); item.className = 'tg-message ' + (from === 'user' ? 'tg-from-user' : '');
    const p = document.createElement('p'); p.textContent = text; item.append(p);
    actions.forEach(action => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => navigate(action.id)); item.append(b);
    });
    log.append(item);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function navigate(id) {
    sync(); if (root.hidden) return;
    const current = permitted().find(a => a.id === id);
    if (!current) { message('Esta área já não está disponível no teu perfil. Consulta os atalhos atuais.'); return; }
    // Reutiliza a ação da aplicação, incluindo verificações de licença e permissões.
    current.el.click();
    setOpen(false);
  }
  function quickLinks() {
    shortcuts.replaceChildren();
    const allowed = permitted();
    const favorites = ['servicos', 'clientes', 'ponto', 'contratos', 'guia'];
    const chosen = favorites.map(id => allowed.find(a => a.id === id)).filter(Boolean);
    if (!chosen.length) chosen.push(...allowed.slice(0, 4));
    chosen.slice(0, 4).forEach(a => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label;
      b.addEventListener('click', () => navigate(a.id)); shortcuts.append(b);
    });
  }
  function welcome() {
    log.replaceChildren();
    message('Olá! Sou o TG. Posso ajudar-te a encontrar as áreas da Total Gest. Escreve, por exemplo, “abrir clientes”, ou escolhe um atalho.');
  }
  function setOpen(value) {
    opened = value; panel.hidden = !value; root.classList.toggle('tg-is-open', value);
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? 'Fechar assistente TG' : 'Abrir assistente TG');
    if (value) { quickLinks(); animate('adeus'); input.focus({preventScroll:true}); log.scrollTop = log.scrollHeight; }
    else if (!root.hidden) toggle.focus({preventScroll:true});
  }
  function sync() {
    const u = user();
    const key = u ? [u.id, u.adminId, u.tenant_id, u.role].join(':') : '';
    const kiosk = typeof _quiosqueDeveEstarAtivo === 'function' && _quiosqueDeveEstarAtivo();
    if (key !== identity) {
      identity = key; opened = false; panel.hidden = true; root.classList.remove('tg-is-open');
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir assistente TG');
      input.value = ''; minimized = false; root.classList.remove('tg-compact'); welcome();
    }
    root.hidden = !u || u.role === 'cliente' || !!kiosk;
    if (root.hidden) { panel.hidden = true; opened = false; root.classList.remove('tg-is-open'); toggle.setAttribute('aria-expanded', 'false'); clearTimeout(imageTimer); picture.removeAttribute('src'); }
    else { if (!picture.getAttribute('src')) animate(); if (opened) quickLinks(); }
  }
  function answer(raw) {
    sync(); if (root.hidden) return;
    const query = normalize(raw); if (!query) return;
    message(raw, 'user');
    if (/^(ola|bom dia|boa tarde|boa noite|oi|obrigad[oa])$/.test(query)) { message('Olá! Em que área da Total Gest precisas de ajuda?'); return; }
    const allowed = permitted();
    if (/^(ajuda|menu|opcoes|o que fazes|o que podes fazer)$/.test(query)) {
      message('Posso abrir estas áreas do teu perfil. Nesta versão, não altero registos nem consulto resultados dentro de cada módulo.', 'tg', allowed); return;
    }
    const matches = allowed.map(a => {
      const phrases = [normalize(a.label), ...(synonyms[a.id] || [])];
      const score = Math.max(0, ...phrases.filter(p => (' ' + query + ' ').includes(' ' + p + ' ')).map(p => p.length));
      return {...a, score};
    }).filter(a => a.score > 0).sort((a,b) => b.score - a.score).slice(0, 4);
    if (matches.length) {
      const consultation = /\b(atrasad|termin|venc|stock baixo|disponiv|quant|mostra|lista|procura|pesquisa)/.test(query);
      message(consultation ? 'Posso levar-te à área onde podes consultar essa informação. Ainda não analiso os registos nesta versão. Escolhe abaixo:' : 'Encontrei estas áreas. Qual queres abrir?', 'tg', matches);
    } else {
      message('Não encontrei uma área disponível com esse pedido. Experimenta “ordens de serviço”, “clientes” ou escreve “ajuda” para veres as opções do teu perfil.');
    }
  }
  toggle.addEventListener('click', () => { sync(); if (!root.hidden) setOpen(!opened); });
  root.querySelector('.tg-close').addEventListener('click', () => setOpen(false));
  root.querySelector('.tg-minimize').addEventListener('click', e => {
    minimized = !minimized; root.classList.toggle('tg-compact', minimized);
    e.currentTarget.textContent = minimized ? '+' : '−';
    e.currentTarget.setAttribute('aria-label', minimized ? 'Mostrar mascote' : 'Minimizar mascote');
    e.currentTarget.title = minimized ? 'Mostrar mascote' : 'Minimizar mascote';
    if (opened) setOpen(false);
  });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const raw = input.value.trim(); input.value = ''; if (raw) answer(raw); input.focus({preventScroll:true}); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && opened) { e.stopPropagation(); setOpen(false); } });
  window.TGAssistente = Object.freeze({sync});
  // A app notifica alterações da sessão/renderização. Sem polling, sem histórico persistido.
  document.addEventListener('tg:interface-updated', sync);
  window.addEventListener('pageshow', sync);
  sync();
})();
