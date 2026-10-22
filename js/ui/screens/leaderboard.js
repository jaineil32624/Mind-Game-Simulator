/**
 * Leaderboard screen. Talks only to the LeaderboardProvider interface, so a
 * remote provider can be swapped in without touching this file.
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var el = utils.el;

  var remoteDemo = null; // lazily created stub provider for the "Global" tab

  App3.ui.screens.leaderboard = {
    render: function (root) {
      var LB = App3.systems.leaderboard;
      var games = App3.games.registry.list();
      root.appendChild(el('h1', { class: 'page-title' }, '🥇 Leaderboard'));

      var modeSel = el('select', { class: 'select', 'aria-label': 'Game mode' },
        games.map(function (G) { return el('option', { value: G.meta.id }, G.meta.icon + ' ' + G.meta.name); }));
      var diffSel = el('select', { class: 'select', 'aria-label': 'Difficulty' },
        App3.DIFFICULTIES.map(function (d) { return el('option', { value: d }, App3.DIFFICULTY_LABELS[d]); }));
      var srcSel = el('select', { class: 'select', 'aria-label': 'Leaderboard source' }, [
        el('option', { value: 'local' }, 'This device'),
        el('option', { value: 'remote' }, 'Global (online)')
      ]);
      var host = el('div', { class: 'lb-host' });

      function load() {
        var provider = LB.getProvider();
        if (srcSel.value === 'remote') {
          remoteDemo = remoteDemo || new LB.RemoteLeaderboardProvider({ endpoint: '' });
          provider = remoteDemo;
        }
        host.innerHTML = '<div class="loading"><span class="spinner"></span> Loading…</div>';
        provider.top(modeSel.value, diffSel.value, 10).then(function (rows) {
          host.innerHTML = '';
          if (!rows.length) {
            host.appendChild(el('p', { class: 'muted empty' }, 'No scores yet for this board — solve a puzzle to get on it!'));
            return;
          }
          host.appendChild(el('table', { class: 'data-table lb-table' }, [
            el('thead', null, el('tr', null, ['#', 'Player', 'Score', 'Time', 'Accuracy', 'Hints', 'Date'].map(function (h) { return el('th', { scope: 'col' }, h); }))),
            el('tbody', null, rows.map(function (r, i) {
              return el('tr', { class: i < 3 ? 'podium p' + (i + 1) : '' }, [
                el('td', null, i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)),
                el('td', null, r.name + (r.daily ? ' 📅' : '')),
                el('td', null, String(r.score)),
                el('td', null, utils.formatTime(r.timeMs)),
                el('td', null, utils.percent(r.accuracy)),
                el('td', null, String(r.hintsUsed || 0)),
                el('td', null, new Date(r.date).toLocaleDateString())
              ]);
            }))
          ]));
        }).catch(function (err) {
          host.innerHTML = '';
          host.appendChild(el('div', { class: 'notice' }, [
            el('strong', null, 'Online leaderboard not connected. '),
            el('span', null, err.message),
            el('p', { class: 'muted small' }, 'Developers: implement a backend and configure RemoteLeaderboardProvider in js/systems/leaderboard.js, then call App3.systems.leaderboard.setProvider(...).')
          ]));
        });
      }
      [modeSel, diffSel, srcSel].forEach(function (s) { s.addEventListener('change', load); });

      root.appendChild(el('section', { class: 'card' }, [
        el('div', { class: 'lb-filters' }, [modeSel, diffSel, srcSel]),
        host,
        el('p', { class: 'muted small' }, 'Score = difficulty × accuracy × speed vs. par, reduced 15% per hint. Change your display name in Settings.')
      ]));
      load();
    }
  };
})(window.App3);
