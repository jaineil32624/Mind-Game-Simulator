/**
 * App3 entry point — loads the save, wires global UI (theme, sound, level
 * pill, toasts) to the event bus, registers screens and starts the router.
 */
(function (App3) {
  'use strict';

  var storage = App3.core.storage;
  var events = App3.core.events;
  var screens = App3.ui.screens;
  var router = App3.ui.router;
  var toasts = App3.ui.toasts;

  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolvedTheme() {
    var t = storage.state.settings.theme;
    if (t === 'light' || t === 'dark') return t;
    return media && media.matches ? 'dark' : 'light';
  }

  function applyTheme() {
    var t = resolvedTheme();
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  /** Public so the settings screen can change it. */
  App3.setTheme = function (theme) {
    storage.state.settings.theme = theme;
    storage.save();
    applyTheme();
  };

  function applySoundButton() {
    var btn = document.getElementById('btn-sound');
    var muted = App3.core.audio.isMuted();
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    btn.setAttribute('aria-pressed', String(muted));
  }

  function updateLevelPill() {
    var info = App3.systems.xp.current();
    document.getElementById('level-num').textContent = 'Lv ' + info.level;
    document.getElementById('level-bar').style.width = Math.round(info.progress * 100) + '%';
    document.getElementById('level-pill').title = 'Level ' + info.level + ' — ' + info.into + ' / ' + info.needed + ' XP';
  }

  function init() {
    storage.load();
    applyTheme();
    applySoundButton();
    updateLevelPill();

    if (media) {
      var onScheme = function () { if (storage.state.settings.theme === 'auto') applyTheme(); };
      if (media.addEventListener) media.addEventListener('change', onScheme);
      else if (media.addListener) media.addListener(onScheme);
    }

    document.getElementById('btn-theme').addEventListener('click', function () {
      App3.setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('btn-sound').addEventListener('click', function () {
      App3.core.audio.setMuted(!App3.core.audio.isMuted());
      App3.core.audio.play('click');
    });

    // Browsers require a gesture before audio can play.
    var unlock = function () { App3.core.audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    events.on('xp:changed', updateLevelPill);
    events.on('settings:changed', applySoundButton);
    events.on('level:up', function (e) {
      App3.core.audio.play('levelup');
      var pill = document.getElementById('level-pill');
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
      toasts.show('You reached level ' + e.to + '!', { type: 'xp', icon: '⬆️', title: 'Level up!', duration: 4000 });
    });
    events.on('achievement:unlocked', function (e) { toasts.achievement(e.achievement); });
    events.on('storage:replaced', function () {
      applyTheme();
      applySoundButton();
      updateLevelPill();
      router.refresh();
    });

    router.register('home', screens.home);
    router.register('play', screens.game);
    router.register('daily', screens.game);
    router.register('stats', screens.stats);
    router.register('achievements', screens.achievements);
    router.register('leaderboard', screens.leaderboard);
    router.register('settings', screens.settings);
    router.start(document.getElementById('app'));

    // Badges that depend only on saved state (e.g. after an import).
    App3.systems.achievements.evaluate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.App3);
