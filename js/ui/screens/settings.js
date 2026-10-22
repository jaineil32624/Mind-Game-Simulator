/**
 * Settings screen: profile name, theme, sound, gameplay options and the
 * save system (export / import / reset).
 */
(function (App3) {
  'use strict';

  var el = App3.core.utils.el;
  var C = App3.ui.components;

  App3.ui.screens.settings = {
    render: function (root) {
      var storage = App3.core.storage;
      var st = storage.state;
      var toast = App3.ui.toasts.show;

      root.appendChild(el('h1', { class: 'page-title' }, '⚙️ Settings'));

      // --- profile -------------------------------------------------------------
      var nameInput = el('input', { class: 'input', type: 'text', maxlength: 20, value: st.profile.name, 'aria-label': 'Display name' });
      nameInput.addEventListener('change', function () {
        var v = nameInput.value.trim().slice(0, 20) || 'Player';
        nameInput.value = v;
        st.profile.name = v;
        storage.save();
        toast('Name saved.', { type: 'success', icon: '✓' });
      });

      // --- preferences ---------------------------------------------------------
      var themeSel = el('select', { class: 'select', 'aria-label': 'Theme' }, [
        el('option', { value: 'auto' }, 'Match system'),
        el('option', { value: 'light' }, 'Light'),
        el('option', { value: 'dark' }, 'Dark')
      ]);
      themeSel.value = st.settings.theme || 'auto';
      themeSel.addEventListener('change', function () { App3.setTheme(themeSel.value); });

      var sound = el('input', { type: 'checkbox', id: 'set-sound' });
      sound.checked = !st.settings.muted;
      sound.addEventListener('change', function () { App3.core.audio.setMuted(!sound.checked); if (sound.checked) App3.core.audio.play('correct'); });

      var auto = el('input', { type: 'checkbox', id: 'set-auto' });
      auto.checked = st.settings.autoCross !== false;
      auto.addEventListener('change', function () { st.settings.autoCross = auto.checked; storage.save(); });

      // --- save data -----------------------------------------------------------
      var fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            storage.importJSON(String(reader.result));
            toast('Save imported successfully.', { type: 'success', icon: '📥' });
          } catch (e) {
            toast('Import failed: ' + e.message, { type: 'error', icon: '⚠️', duration: 5000 });
          }
          fileInput.value = '';
        };
        reader.readAsText(f);
      });

      function exportSave() {
        var blob = new Blob([storage.exportJSON()], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: 'app3-save-' + App3.core.utils.dateKey() + '.json' });
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
        toast('Save exported.', { type: 'success', icon: '📤' });
      }

      function resetSave() {
        C.confirm('Reset all progress?', 'This permanently deletes your XP, stats, badges, streaks and leaderboard entries on this device. Export a backup first if you might want it back.', 'Reset everything', true)
          .then(function (ok) {
            if (!ok) return;
            storage.reset();
            toast('Progress reset.', { type: 'info', icon: '🧹' });
          });
      }

      function row(label, control, help) {
        return el('div', { class: 'set-row' }, [
          el('div', null, [el('div', { class: 'set-label' }, label), help ? el('div', { class: 'muted small' }, help) : null]),
          control
        ]);
      }

      root.appendChild(el('section', { class: 'card settings' }, [
        el('h2', null, 'Profile'),
        row('Display name', nameInput, 'Shown on leaderboards.')
      ]));
      root.appendChild(el('section', { class: 'card settings' }, [
        el('h2', null, 'Preferences'),
        row('Theme', themeSel),
        row(el('label', { for: 'set-sound' }, 'Sound effects'), el('label', { class: 'switch' }, [sound, el('span', { class: 'slider' })]), 'Synthesized with the Web Audio API.'),
        row(el('label', { for: 'set-auto' }, 'Logic Grid auto-✗'), el('label', { class: 'switch' }, [auto, el('span', { class: 'slider' })]), 'Automatically cross out the row and column after placing a ✓.')
      ]));
      root.appendChild(el('section', { class: 'card settings' }, [
        el('h2', null, 'Save data'),
        el('p', { class: 'muted small' }, 'Progress is saved automatically in this browser (schema v' + storage.VERSION + ')' +
          (storage.persistent ? '.' : ' — storage is unavailable, so progress lasts only for this session. Export to keep it!')),
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn', type: 'button', onclick: exportSave }, '📤 Export save'),
          el('button', { class: 'btn', type: 'button', onclick: function () { fileInput.click(); } }, '📥 Import save'),
          el('button', { class: 'btn danger', type: 'button', onclick: resetSave }, '🧹 Reset progress'),
          fileInput
        ])
      ]));
      root.appendChild(el('section', { class: 'card settings' }, [
        el('h2', null, 'About'),
        el('p', { class: 'muted small' }, 'App3 v' + App3.VERSION + ' · ' + App3.games.registry.list().length + ' game modes · Leaderboard provider: ' +
          App3.systems.leaderboard.getProvider().label + '. MIT licensed.')
      ]));
    }
  };
})(window.App3);
