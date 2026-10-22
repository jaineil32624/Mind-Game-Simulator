/**
 * Achievements screen: badge grid (locked badges are greyed out).
 */
(function (App3) {
  'use strict';

  var el = App3.core.utils.el;
  var C = App3.ui.components;

  App3.ui.screens.achievements = {
    render: function (root) {
      var A = App3.systems.achievements;
      var list = A.list();
      var count = A.count();
      root.appendChild(el('h1', { class: 'page-title' }, '🏆 Achievements'));
      root.appendChild(el('div', { class: 'card ach-summary' }, [
        el('strong', null, count + ' of ' + list.length + ' unlocked'),
        C.progressBar(count / list.length, 'Achievements unlocked'),
        el('span', { class: 'muted small' }, 'Each badge grants +' + A.XP_REWARD + ' XP.')
      ]));
      var grid = el('div', { class: 'ach-grid' });
      list.forEach(function (a) {
        var unlocked = !!a.unlockedAt;
        grid.appendChild(el('div', { class: 'ach card' + (unlocked ? ' unlocked' : ' locked'), title: a.desc }, [
          el('div', { class: 'ach-icon', 'aria-hidden': 'true' }, unlocked ? a.icon : '🔒'),
          el('div', null, [
            el('h3', null, a.name),
            el('p', { class: 'muted small' }, a.desc),
            unlocked ? el('span', { class: 'small ach-date' }, 'Unlocked ' + new Date(a.unlockedAt).toLocaleDateString()) : null
          ])
        ]));
      });
      root.appendChild(grid);
    }
  };
})(window.App3);
