/**
 * App3.ui.charts — tiny dependency-free SVG charts.
 * Colours come from CSS custom properties so charts follow the theme.
 */
(function (App3) {
  'use strict';

  var esc = App3.core.utils.escapeHtml;

  /**
   * Grouped bar chart.
   * @param {{labels:string[], series:Array<{name:string, values:number[], cls:string}>, height?:number}} cfg
   * @returns {string} SVG markup
   */
  function barChart(cfg) {
    var W = 640, H = cfg.height || 240, padL = 34, padR = 10, padT = 14, padB = 46;
    var n = cfg.labels.length, s = cfg.series.length;
    var max = 1;
    cfg.series.forEach(function (sr) { sr.values.forEach(function (v) { max = Math.max(max, v); }); });
    var niceMax = Math.max(4, Math.ceil(max / 4) * 4);
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var groupW = plotW / Math.max(1, n);
    var barW = Math.min(28, (groupW * 0.7) / s);
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.title || 'Bar chart') + '">';
    for (var g = 0; g <= 4; g++) {
      var y = padT + plotH - (plotH * g / 4);
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>';
      out += '<text class="axis" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(niceMax * g / 4) + '</text>';
    }
    cfg.labels.forEach(function (label, i) {
      var gx = padL + groupW * i + (groupW - barW * s) / 2;
      cfg.series.forEach(function (sr, j) {
        var v = sr.values[i] || 0;
        var h = plotH * v / niceMax;
        var x = gx + j * barW;
        out += '<rect class="bar ' + sr.cls + '" x="' + x.toFixed(1) + '" y="' + (padT + plotH - h).toFixed(1) + '" width="' + (barW - 3).toFixed(1) +
          '" height="' + Math.max(0, h).toFixed(1) + '" rx="3"><title>' + esc(sr.name + ' — ' + label + ': ' + v) + '</title></rect>';
      });
      out += '<text class="axis label" x="' + (padL + groupW * i + groupW / 2) + '" y="' + (H - padB + 18) + '" text-anchor="middle">' + esc(label) + '</text>';
    });
    // legend
    var lx = padL;
    cfg.series.forEach(function (sr) {
      out += '<rect class="bar ' + sr.cls + '" x="' + lx + '" y="' + (H - 16) + '" width="12" height="12" rx="2"/>' +
        '<text class="axis" x="' + (lx + 18) + '" y="' + (H - 6) + '">' + esc(sr.name) + '</text>';
      lx += 26 + sr.name.length * 7.5;
    });
    return out + '</svg>';
  }

  /**
   * Line chart for values in [0, 1] (accuracy trend).
   * @param {{values:number[], height?:number, title?:string}} cfg
   */
  function lineChart(cfg) {
    var W = 640, H = cfg.height || 200, padL = 40, padR = 12, padT = 12, padB = 24;
    var vals = cfg.values;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.title || 'Line chart') + '">';
    [0, 0.5, 1].forEach(function (g) {
      var y = padT + plotH - plotH * g;
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="axis" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(g * 100) + '%</text>';
    });
    if (!vals.length) {
      return out + '<text class="axis" x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle">No games yet</text></svg>';
    }
    var step = vals.length > 1 ? plotW / (vals.length - 1) : 0;
    var pts = vals.map(function (v, i) {
      return [padL + (vals.length > 1 ? step * i : plotW / 2), padT + plotH - plotH * Math.max(0, Math.min(1, v))];
    });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = path + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + plotH) + ' L' + pts[0][0].toFixed(1) + ' ' + (padT + plotH) + ' Z';
    out += '<path class="area" d="' + area + '"/><path class="line" d="' + path + '"/>';
    pts.forEach(function (p, i) {
      out += '<circle class="dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5"><title>' + Math.round(vals[i] * 100) + '%</title></circle>';
    });
    return out + '</svg>';
  }

  App3.ui.charts = { barChart: barChart, lineChart: lineChart };
})(window.App3);
