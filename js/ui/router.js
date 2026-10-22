/**
 * App3.ui.router — hash-based router (works on file://).
 *
 *   #/home                       -> screens.home
 *   #/play/<mode>/<difficulty>   -> screens.game
 *   #/daily/<index>              -> screens.game (daily challenge)
 *   #/stats, #/achievements, #/leaderboard, #/settings
 *
 * A screen is an object { render(root, params), destroy?() }.
 */
(function (App3) {
  'use strict';

  var routes = {};
  var current = null;
  var root = null;

  function parse() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || 'home', params: parts.slice(1) };
  }

  function handle() {
    var r = parse();
    var screen = routes[r.name] || routes.home;
    if (current && current.destroy) {
      try { current.destroy(); } catch (e) { console.error(e); }
    }
    App3.ui.components.closeAllModals();
    root.innerHTML = '';
    root.className = 'container screen-' + r.name;
    current = screen;
    window.scrollTo(0, 0);
    try {
      screen.render(root, r.params);
    } catch (e) {
      console.error(e);
      root.innerHTML = '<div class="card"><h2>Something went wrong</h2><p class="muted">' +
        App3.core.utils.escapeHtml(e.message) + '</p><a class="btn primary" href="#/home">Back home</a></div>';
    }
    var navName = r.name === 'play' || r.name === 'daily' ? 'home' : r.name;
    document.querySelectorAll('#nav a').forEach(function (a) {
      var active = a.dataset.route === navName;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  App3.ui.router = {
    register: function (name, screen) { routes[name] = screen; },
    start: function (rootEl) {
      root = rootEl;
      window.addEventListener('hashchange', handle);
      handle();
    },
    navigate: function (path) {
      var target = '#/' + path;
      if (location.hash === target) handle();
      else location.hash = target;
    },
    refresh: handle,
    current: function () { return current; }
  };
})(window.App3);
