/* Navigation and keyboard behavior for the public landing page. */
(() => {
  'use strict';
  const root = document.getElementById('tg-landing');
  if (!root) return;
  const menu = document.getElementById('tg-public-nav');
  const menuButton = root.querySelector('.tg-menu-toggle');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const closeMenu = () => { menu.classList.remove('tg-nav-open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menu'); };
  menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('tg-nav-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  root.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.getAttribute('href') === '#' || link.hasAttribute('onclick')) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault(); closeMenu();
    target.scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block:'start'});
    if (target.id === 'tg-entrar') document.getElementById('landEmail').focus({preventScroll:true});
    else { target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
    history.replaceState(null,'',link.getAttribute('href'));
  });
  document.addEventListener('click', e => { if (!e.target.closest('.nav')) closeMenu(); });
  const preview = document.getElementById('tg-platform-preview');
  root.querySelector('[data-tg-preview]').addEventListener('click', () => preview.showModal());
  root.querySelector('[data-tg-preview-close]').addEventListener('click', () => preview.close());
  preview.addEventListener('click', e => { if (e.target === preview) { const b=preview.getBoundingClientRect(); if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)preview.close(); } });

  const overlays = [
    {id:'tg-calc-wizard-overlay', close: () => fecharWizardCalc()},
    {id:'tg-signup-overlay', close: () => fecharModalSignup()}
  ];
  let returnFocus = null;
  // Capture before inline onclick handlers open a dialog.
  document.addEventListener('click', e => {
    if (!overlays.some(o => document.getElementById(o.id).classList.contains('open')) && !e.target.closest('#tg-platform-preview')) returnFocus = e.target.closest('a,button') || document.activeElement;
  }, true);
  overlays.forEach(o => {
    const overlay = document.getElementById(o.id);
    let wasOpen = false;
    new MutationObserver(() => {
      const open = overlay.classList.contains('open');
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) {
        const dialog = overlay.querySelector('[role="dialog"]');
        if (!overlay.contains(document.activeElement)) dialog.focus();
      } else if (!overlays.some(x => document.getElementById(x.id).classList.contains('open')) && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    }).observe(overlay,{attributes:true,attributeFilter:['class']});
    overlay.addEventListener('click', e => { if (e.target === overlay) o.close(); });
  });
  document.addEventListener('keydown', e => {
    const active = overlays.find(o => document.getElementById(o.id).classList.contains('open'));
    if (e.key === 'Escape') {
      if (active) { e.preventDefault(); active.close(); }
      else if (menu.classList.contains('tg-nav-open')) { closeMenu(); menuButton.focus(); }
      return;
    }
    if (e.key !== 'Tab' || !active) return;
    const overlay = document.getElementById(active.id);
    const nodes = [...overlay.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const first = nodes[0], last = nodes.at(-1);
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
})();
