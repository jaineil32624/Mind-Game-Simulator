/**
 * App3.core.utils — small, dependency-free helpers shared by every layer.
 */
(function (App3) {
  'use strict';

  /** Ordered list of difficulty ids used by every game mode. */
  var DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];
  var DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

  /**
   * Tiny hyperscript-style DOM builder.
   *   el('button', { class: 'btn', onclick: fn }, ['Label'])
   * Special attrs: class, text, html, style (object), dataset (object), on* (listeners).
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach(function (p) {
            if (p.indexOf('--') === 0) node.style.setProperty(p, v[p]);
            else node.style[p] = v[p];
          });
        }
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    append(node, children);
    return node;
  }

  /** Append a child, string, number or array of those to a node. */
  function append(node, children) {
    if (children === null || children === undefined || children === false) return node;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { append(node, c); return; }
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 83000 -> "1:23"; 3723000 -> "1:02:03". */
  function formatTime(ms) {
    if (ms === null || ms === undefined || !isFinite(ms)) return '—';
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
  }

  /** Local-time date key "YYYY-MM-DD" (daily challenges are per local day). */
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** Shift a date key by n days. */
  function addDays(key, n) {
    var p = key.split('-').map(Number);
    return dateKey(new Date(p[0], p[1] - 1, p[2] + n));
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function isPlainObject(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o);
  }

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  /**
   * Fill `over` with any keys missing relative to `base` (recursively).
   * Values in `over` win; arrays are taken from `over` wholesale.
   */
  function deepMerge(base, over) {
    if (over === undefined) return clone(base);
    if (!isPlainObject(base) || !isPlainObject(over)) return over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = deepMerge(base[k], over[k]); });
    Object.keys(over).forEach(function (k) { if (!(k in out)) out[k] = over[k]; });
    return out;
  }

  function percent(x) { return (x === null || x === undefined || !isFinite(x)) ? '—' : Math.round(x * 100) + '%'; }

  function range(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = i; return a; }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  App3.DIFFICULTIES = DIFFICULTIES;
  App3.DIFFICULTY_LABELS = DIFFICULTY_LABELS;
  App3.core.utils = {
    el: el, append: append, escapeHtml: escapeHtml, formatTime: formatTime,
    dateKey: dateKey, addDays: addDays, clamp: clamp, clone: clone,
    deepMerge: deepMerge, isPlainObject: isPlainObject, percent: percent,
    range: range, capitalize: capitalize
  };
})(window.App3);
