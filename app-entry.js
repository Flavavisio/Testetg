// Existing installed apps may still launch the old start_url. Keep deep links intact.
(() => {
  const installed = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const index = /\/$|\/index\.html$/.test(location.pathname);
  if (index && (installed || location.hash === '#tg-entrar')) {
    location.replace(new URL('login.html' + location.search + (location.hash === '#tg-entrar' ? '' : location.hash), location.href));
  }
})();
