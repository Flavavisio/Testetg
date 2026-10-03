/* TG Smart — navegação local. Não envia conversas para serviços de IA. */
(() => {
  'use strict';
  if (window.TGAssistente) return;
  const base = new URL('.', document.currentScript.src);
  const asset = name => new URL('assets/' + name, base).href;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('tg-assistente.css?v=4.0.0-teco', base).href;
  document.head.append(css);
  const root = document.createElement('aside');
  root.id = 'tg-assistente'; root.hidden = true;
  root.innerHTML = `
    <section class="tg-chat" hidden role="dialog" aria-labelledby="tg-chat-title">
      <header><img class="tg-header-mascot" alt="" width="45" height="54"><div><strong id="tg-chat-title">Teco · O teu assistente</strong><small><span class="tg-state-label">Pronto para ajudar</span></small></div><button type="button" class="tg-close" aria-label="Fechar assistente">×</button></header>
      <div class="tg-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa com o Teco"></div>
      <div class="tg-tools"><button type="button" data-tg-query="resumo">O meu dia</button><button type="button" data-tg-query="pedidos do portal">Portal</button><button type="button" data-tg-query="alertas">Alertas</button><button type="button" class="tg-snooze">Silenciar 1 h</button></div><div class="tg-shortcuts" aria-label="Atalhos disponíveis"></div>
      <form class="tg-form"><label class="tg-sr" for="tg-question">O que precisas de encontrar?</label><input id="tg-question" maxlength="300" autocomplete="off" placeholder="Ex.: o que tenho hoje?"><button type="submit" aria-label="Enviar pedido">➜</button></form>
      <footer>Consulta dos dados carregados · sem IA paga</footer>
    </section>
    <div class="tg-proactive" hidden><button type="button" class="tg-alert-open"></button><button type="button" class="tg-alert-dismiss" aria-label="Dispensar aviso">×</button></div><div class="tg-launcher"><button type="button" class="tg-minimize" aria-label="Minimizar mascote" title="Minimizar mascote">−</button><button type="button" class="tg-open" aria-label="Abrir assistente Teco" aria-expanded="false"><img alt="" width="124" height="132"><span>Precisas de ajuda?</span><b class="tg-badge" hidden></b></button></div>`;
  document.body.append(root);
  const panel = root.querySelector('.tg-chat'), log = root.querySelector('.tg-messages');
  const input = root.querySelector('input'), toggle = root.querySelector('.tg-open');
  const picture = toggle.querySelector('img'), shortcuts = root.querySelector('.tg-shortcuts');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let identity = '', opened = false, minimized = false, imageTimer, replyTimer, stateTimer, hintTimer;
  let lastContext = '', lastAlertKey = '', mutedUntil = 0, lastHintAt = 0;
  const hint = root.querySelector('.tg-proactive'), badge = root.querySelector('.tg-badge');
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
    clearTimeout(imageTimer); clearTimeout(stateTimer);
    const current = ['alert','thinking','success','wave'].includes(state) ? state : 'idle';
    root.dataset.state = current;
    const src = asset('toto.png');
    if (picture.src !== src) picture.src = src;
    const portrait=root.querySelector('.tg-header-mascot');if(portrait.src!==src)portrait.src=src;
    root.querySelector('.tg-state-label').textContent=({idle:'Pronto para ajudar',wave:'Olá! Conta comigo.',thinking:'A consultar os teus dados…',success:'Consulta concluída',alert:'Há assuntos a tratar'})[current];
    if (current === 'wave' || current === 'success') stateTimer=setTimeout(() => animate(), 3200);
  }
  function snapshot() {
    if (!window.TGSmartData) return null;
    return window.TGSmartData.snapshot(typeof dados !== 'undefined' ? dados : null,user(),permitted().map(a=>a.id),{
      today: typeof getDataHoje === 'function' ? getDataHoje() : undefined,
      licensed: typeof _licencaValidaTenant !== 'function' || _licencaValidaTenant()
    });
  }
  function refreshAlerts() {
    const snap = snapshot();
    const alerts = snap ? window.TGSmartData.alerts(snap) : [];
    const total = alerts.reduce((n,a)=>n+a.items.length,0);
    badge.hidden = !total; badge.textContent = total > 99 ? '99+' : String(total);
    badge.setAttribute('aria-label', `${total} alertas`);
    const key=alerts.map(a=>a.kind+':'+a.items.map(x=>x.id).sort().join(',')).join('|');
    if(!total){hint.hidden=true;lastAlertKey='';if(root.dataset.state==='alert')animate();}
    if(key && key!==lastAlertKey && !opened && Date.now()>=mutedUntil && Date.now()-lastHintAt>60000){
      lastAlertKey=key;lastHintAt=Date.now();
      root.querySelector('.tg-alert-open').textContent=`${alerts[0]?.title || 'Assuntos a tratar'}: ${alerts[0]?.items.length || total}. Tens ${total} ${total === 1 ? 'alerta' : 'alertas'}. Queres ver o que precisa de atenção?`;
      hint.hidden=false;animate('alert');
      clearTimeout(hintTimer);hintTimer=setTimeout(()=>{hint.hidden=true;animate();},12000);
    }
    return snap;
  }
  function smartAnswer(raw) {
    const snap=snapshot();
    if(!snap || /^(abrir|abre|ir para|vai para)\b/.test(normalize(raw))) return false;
    const response=window.TGSmartData.reply(raw,snap,lastContext);
    if(!response)return false;
    if(response.context)lastContext=response.context;
    message(response.text,'tg',response.actions);
    animate(response.state);return true;
  }
  motion.addEventListener('change', () => animate());
  picture.addEventListener('error', () => { picture.hidden = true; toggle.querySelector('span').textContent = 'Assistente Teco'; });
  function message(text, from = 'tg', actions = []) {
    const item = document.createElement('div'); item.className = 'tg-message ' + (from === 'user' ? 'tg-from-user' : '');
    const p = document.createElement('p'); p.textContent = text; item.append(p);
    actions.forEach(action => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', () => action.query ? answer(action.query) : action.recordType ? openRecord(action) : navigate(action.id)); item.append(b);
    });
    log.append(item);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function openRecord(action) {
    sync(); if(root.hidden)return;
    const snap=snapshot();if(!snap?.ready)return;
    const type=action.recordType,id=action.recordId;
    const item=(type==='os'||type==='drafts'?snap.os:type==='clients'?snap.clients:type==='assistance'?snap.assistance:[]).find(x=>x.id===id);
    if(!item){message('Este registo já não está disponível no teu perfil. Faz uma nova consulta.');return;}
    setOpen(false);
    if(type==='os'||type==='drafts'){abrirVerOS(id);if(type==='drafts')_verOsMostrar(id,'relatorios');}
    else if(type==='clients')abrirWorkspaceCliente(id);
    else if(type==='assistance'){
      if(permitted().some(a=>a.id==='clientes')){abrirWorkspaceCliente(item.clienteId);_wsClienteAba(item.clienteId,'assistencias');}
      else navigate('assistencias');
    }
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
    message('Olá! Sou o Teco. Posso ajudar-te a decidir o que tratar primeiro: pedidos do portal, assistências urgentes, OS atrasadas e relatórios em rascunho. Também pesquiso clientes, contratos e stock, e abro o registo que escolheres. Experimenta “o que tenho hoje?” ou “alertas”. As respostas usam os dados carregados da tua empresa e do teu perfil.');
  }
  function setOpen(value) {
    opened = value; panel.hidden = !value; root.classList.toggle('tg-is-open', value);
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? 'Fechar assistente Teco' : 'Abrir assistente Teco');
    if (value) { hint.hidden=true; quickLinks(); animate('wave'); input.focus({preventScroll:true}); log.scrollTop = log.scrollHeight; }
    else if (!root.hidden) toggle.focus({preventScroll:true});
  }
  function sync() {
    const u = user();
    const key = u ? [u.id, u.adminId, u.tenant_id, u.role].join(':') : '';
    const kiosk = typeof _quiosqueDeveEstarAtivo === 'function' && _quiosqueDeveEstarAtivo();
    if (key !== identity) {
      identity = key; opened = false; panel.hidden = true; root.classList.remove('tg-is-open');
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir assistente Teco');
      clearTimeout(replyTimer); clearTimeout(hintTimer); lastContext=''; lastAlertKey=''; mutedUntil=0; lastHintAt=0; hint.hidden=true; badge.hidden=true; root.querySelector('.tg-snooze').textContent='Silenciar 1 h'; input.disabled=false; root.querySelector('.tg-form button').disabled=false; input.value = ''; minimized = false; root.classList.remove('tg-compact'); welcome();
    }
    root.hidden = !u || u.role === 'cliente' || !!kiosk;
    if (root.hidden) { input.disabled=false;root.querySelector('.tg-form button').disabled=false;panel.hidden = true; opened = false; root.classList.remove('tg-is-open'); toggle.setAttribute('aria-expanded', 'false'); clearTimeout(imageTimer); clearTimeout(stateTimer); clearTimeout(replyTimer); hint.hidden=true; picture.removeAttribute('src'); }
    else { if (!picture.getAttribute('src')) animate(); if (opened) quickLinks(); refreshAlerts(); }
  }
  function answer(raw) {
    sync(); if (root.hidden) return;
    const query = normalize(raw); if (!query) return;
    message(raw, 'user');
    if (smartAnswer(raw)) return;
    if (/^(ola|bom dia|boa tarde|boa noite|oi|obrigad[oa])$/.test(query)) { message('Olá! Em que área da Total Gest precisas de ajuda?'); return; }
    const allowed = permitted();
    if (/^(ajuda|menu|opcoes|o que fazes|o que podes fazer)$/.test(query)) {
      message('Posso consultar o teu dia, pedidos do portal, assistências urgentes, relatórios por assinar, contratos a vencer e stock. Experimenta “OS do cliente João”, “stock de cabo” ou “como concluir um serviço”. Experimenta também “resumo” ou “alertas”. Para navegar, escolhe uma área:', 'tg', allowed); return;
    }
    const matches = allowed.map(a => {
      const phrases = [normalize(a.label), ...(synonyms[a.id] || [])];
      const score = Math.max(0, ...phrases.filter(p => (' ' + query + ' ').includes(' ' + p + ' ')).map(p => p.length));
      return {...a, score};
    }).filter(a => a.score > 0).sort((a,b) => b.score - a.score).slice(0, 4);
    if (matches.length) {
      const consultation = /\b(atrasad|termin|venc|stock baixo|disponiv|quant|mostra|lista|procura|pesquisa)/.test(query);
      message(consultation ? 'Posso levar-te à área onde podes consultar essa informação. Para este pedido, consulta os detalhes no módulo. Escolhe abaixo:' : 'Encontrei estas áreas. Qual queres abrir?', 'tg', matches);
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
  root.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); const raw=input.value.trim(); if(!raw)return;
    input.value=''; input.disabled=true; root.querySelector('.tg-form button').disabled=true; animate('thinking');
    const requestIdentity=identity;
    clearTimeout(replyTimer);replyTimer=setTimeout(()=>{
      input.disabled=false;root.querySelector('.tg-form button').disabled=false;
      sync();if(root.hidden||identity!==requestIdentity)return;
      answer(raw);if(root.dataset.state==='thinking')animate();input.focus({preventScroll:true});
    },350);
  });
  root.querySelectorAll('[data-tg-query]').forEach(b=>b.addEventListener('click',()=>answer(b.dataset.tgQuery)));
  root.querySelector('.tg-alert-open').addEventListener('click',()=>{setOpen(true);answer('alertas');});
  root.querySelector('.tg-alert-dismiss').addEventListener('click',()=>{hint.hidden=true;animate();});
  root.querySelector('.tg-snooze').addEventListener('click',e=>{
    mutedUntil=Date.now()<mutedUntil?0:Date.now()+3600000;
    e.currentTarget.textContent=mutedUntil?'Reativar avisos':'Silenciar 1 h';hint.hidden=true;animate();
  });
  const refreshTimer=setInterval(()=>{if(!document.hidden)sync();},60000);
  window.addEventListener('pagehide',()=>{clearTimeout(replyTimer);clearTimeout(hintTimer);clearTimeout(stateTimer);});

  root.addEventListener('keydown', e => { if (e.key === 'Escape' && opened) { e.stopPropagation(); setOpen(false); } });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if(opened)log.scrollTop=log.scrollHeight; }).observe(log);
  window.TGAssistente = Object.freeze({sync});
  // A app notifica alterações da sessão/renderização. Atualização local a cada minuto, sem pedidos de rede nem histórico persistido.
  document.addEventListener('tg:interface-updated', sync);
  window.addEventListener('pageshow', sync);
  sync();
})();
