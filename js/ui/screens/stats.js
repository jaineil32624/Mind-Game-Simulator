/**
 * Statistics screen: overview tiles, charts and a per-mode table.
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var el = utils.el;
  var C = App3.ui.components;

  var StatsScreen = {
    render: function (root) {
      var S = App3.systems;
      var games = App3.games.registry.list();
      var o = S.stats.overall();
      var xp = S.xp.current();

      root.appendChild(el('h1', { class: 'page-title' }, '📊 Statistics'));

      root.appendChild(el('section', { class: 'tiles' }, [
        C.statTile('Level', xp.level, xp.total + ' XP total'),
        C.statTile('Puzzles played', o.played),
        C.statTile('Won', o.won, utils.percent(o.winRate) + ' win rate'),
        C.statTile('Avg accuracy', utils.percent(o.accuracy)),
        C.statTile('Hints used', App3.core.storage.state.counters.hintsUsed || 0),
        C.statTile('Best streak', '🔥 ' + S.daily.bestStreak())
      ]));

      var bar = App3.ui.charts.barChart({
        title: 'Games played and won per mode',
        labels: games.map(function (G) { return G.meta.name.split(' ')[0]; }),
        series: [
          { name: 'Played', cls: 's1', values: games.map(function (G) { return S.stats.summary(G.meta.id).played; }) },
          { name: 'Won', cls: 's2', values: games.map(function (G) { return S.stats.summary(G.meta.id).won; }) }
        ]
      });

      var select = el('select', { class: 'select', 'aria-label': 'Mode for accuracy trend' },
        [el('option', { value: '' }, 'All modes')].concat(games.map(function (G) { return el('option', { value: G.meta.id }, G.meta.name); })));
      var lineHost = el('div', { class: 'chart-host' });
      function drawLine() {
        var hist = S.stats.recent(select.value || null, 30);
        lineHost.innerHTML = App3.ui.charts.lineChart({ title: 'Accuracy, last 30 games', values: hist.map(function (h) { return h.acc; }) });
      }
      select.addEventListener('change', drawLine);
      drawLine();

      root.appendChild(el('div', { class: 'two-col' }, [
        el('section', { class: 'card' }, [el('h2', null, 'Played vs won'), el('div', { class: 'chart-host', html: bar })]),
        el('section', { class: 'card' }, [
          el('div', { class: 'section-head' }, [el('h2', null, 'Accuracy trend'), select]),
          lineHost
        ])
      ]));

      var rows = games.map(function (G) {
        var s = S.stats.summary(G.meta.id);
        return el('tr', null, [
          el('th', { scope: 'row' }, [el('span', { class: 'mode-icon xs', style: { background: G.meta.color } }, G.meta.icon), ' ', G.meta.name]),
          el('td', null, String(s.played)),
          el('td', null, String(s.won)),
          el('td', null, utils.percent(s.winRate)),
          el('td', null, utils.formatTime(s.bestTime)),
          el('td', null, utils.formatTime(s.avgTime)),
          el('td', null, utils.percent(s.accuracy))
        ]);
      });
      root.appendChild(el('section', { class: 'card' }, [
        el('h2', null, 'By mode'),
        el('div', { class: 'table-scroll' }, el('table', { class: 'data-table' }, [
          el('thead', null, el('tr', null, ['Mode', 'Played', 'Won', 'Win %', 'Best time', 'Avg time', 'Accuracy'].map(function (h) { return el('th', { scope: 'col' }, h); }))),
          el('tbody', null, rows)
        ])),
        el('p', { class: 'muted small' }, 'Best/avg times count solved puzzles only. Accuracy = correct moves or answers ÷ total.')
      ]));

      // Best time per difficulty
      var diffRows = games.map(function (G) {
        var s = S.stats.summary(G.meta.id);
        return el('tr', null, [el('th', { scope: 'row' }, G.meta.name)].concat(App3.DIFFICULTIES.map(function (d) {
          return el('td', null, utils.formatTime(s.bestTimeByDifficulty[d]));
        })));
      });
      root.appendChild(el('section', { class: 'card' }, [
        el('h2', null, 'Best times by difficulty'),
        el('div', { class: 'table-scroll' }, el('table', { class: 'data-table' }, [
          el('thead', null, el('tr', null, [el('th', null, 'Mode')].concat(App3.DIFFICULTIES.map(function (d) { return el('th', { scope: 'col' }, App3.DIFFICULTY_LABELS[d]); })))),
          el('tbody', null, diffRows)
        ]))
      ]));
    }
  };

  App3.ui.screens.stats = StatsScreen;
})(window.App3);
