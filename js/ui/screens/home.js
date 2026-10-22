/**
 * Home dashboard: level & XP, daily challenge, game mode cards.
 */
(function (App3) {
  'use strict';

  var utils = App3.core.utils;
  var el = utils.el;
  var C = App3.ui.components;

  var Home = {
    timer: null,

    render: function (root) {
      var storage = App3.core.storage;
      var xp = App3.systems.xp.current();
      var overall = App3.systems.stats.overall();
      var daily = App3.systems.daily;
      var name = storage.state.profile.name || 'Player';

      // --- hero -------------------------------------------------------------
      var hero = el('section', { class: 'hero card' }, [
        el('div', { class: 'hero-level', 'aria-label': 'Level ' + xp.level }, [
          el('span', { class: 'hero-level-num' }, String(xp.level)),
          el('span', { class: 'hero-level-cap' }, 'LEVEL')
        ]),
        el('div', { class: 'hero-main' }, [
          el('h1', null, greeting() + ', ' + name + '!'),
          el('div', { class: 'xp-row' }, [
            C.progressBar(xp.progress, 'Experience to next level'),
            el('span', { class: 'xp-text muted small' }, xp.into + ' / ' + xp.needed + ' XP to level ' + (xp.level + 1))
          ]),
          el('div', { class: 'hero-stats' }, [
            C.statTile('Played', overall.played),
            C.statTile('Win rate', utils.percent(overall.winRate)),
            C.statTile('Streak', '🔥 ' + daily.currentStreak()),
            C.statTile('Badges', App3.systems.achievements.count() + '/' + App3.systems.achievements.total())
          ])
        ])
      ]);

      // --- daily ------------------------------------------------------------
      var key = daily.todayKey();
      var challenge = daily.getChallenge(key);
      var dayDone = daily.isDayComplete(key);
      var list = el('ul', { class: 'daily-list' });
      challenge.items.forEach(function (it) {
        var G = App3.games.registry.get(it.mode);
        if (!G) return;
        var done = daily.isDone(key, it.index);
        list.appendChild(el('li', { class: 'daily-item' + (done ? ' done' : '') }, [
          el('span', { class: 'mode-icon sm', style: { background: G.meta.color } }, G.meta.icon),
          el('div', { class: 'daily-text' }, [el('strong', null, G.meta.name), C.difficultyChip(it.difficulty)]),
          done
            ? el('span', { class: 'daily-check', 'aria-label': 'Completed' }, '✓')
            : el('a', { class: 'btn small primary', href: '#/daily/' + it.index }, 'Play')
        ]));
      });
      var countdown = el('span', { class: 'muted small' });
      var dailyCard = el('section', { class: 'daily card' + (dayDone ? ' complete' : '') }, [
        el('div', { class: 'section-head' }, [
          el('div', null, [
            el('h2', null, '📅 Daily Challenge'),
            el('span', { class: 'muted small' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · same puzzles for everyone · 2× XP')
          ]),
          el('div', { class: 'streak' }, [
            el('span', { class: 'streak-num' }, '🔥 ' + daily.currentStreak()),
            el('span', { class: 'muted small' }, 'best ' + daily.bestStreak())
          ])
        ]),
        list,
        dayDone ? el('p', { class: 'daily-done' }, ['🎉 Day complete! Next challenge in ', countdown]) : null
      ]);
      if (dayDone) {
        var tick = function () { countdown.textContent = utils.formatTime(daily.msUntilTomorrow()); };
        tick();
        this.timer = setInterval(tick, 1000);
      }

      // --- modes ------------------------------------------------------------
      var grid = el('div', { class: 'mode-grid' });
      App3.games.registry.list().forEach(function (G) {
        var m = G.meta;
        var s = App3.systems.stats.summary(m.id);
        var card = el('button', {
          class: 'mode-card card', type: 'button', style: { '--accent': m.color },
          onclick: function () { C.difficultyPicker(G); }
        }, [
          el('span', { class: 'mode-icon', style: { background: m.color } }, m.icon),
          el('h3', null, m.name),
          el('p', { class: 'muted small' }, m.description),
          el('span', { class: 'mode-stats small' }, s.played
            ? s.won + ' won · ' + s.played + ' played' + (s.bestTime ? ' · best ' + utils.formatTime(s.bestTime) : '')
            : 'New — give it a try!'),
          el('span', { class: 'mode-play' }, 'Play →')
        ]);
        grid.appendChild(card);
      });

      root.appendChild(hero);
      root.appendChild(dailyCard);
      root.appendChild(el('section', null, [
        el('h2', { class: 'section-title' }, 'Game modes'),
        grid
      ]));
    },

    destroy: function () {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
  };

  function greeting() {
    var h = new Date().getHours();
    return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  App3.ui.screens.home = Home;
})(window.App3);
