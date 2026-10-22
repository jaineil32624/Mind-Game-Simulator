/**
 * App3.games.Figures — procedural SVG figures shared by Pattern Recognition,
 * Visual IQ and Memory Match.
 *
 * A figure is a plain data object (so generators stay pure and testable):
 *   { shape, color, rotation, fill, count, size }
 *     shape     one of SHAPES
 *     color     color id from COLORS
 *     rotation  degrees (multiples of 45)
 *     fill      'solid' | 'outline' | 'striped'
 *     count     1..6 copies of the shape
 *     size      's' | 'm' | 'l'
 *
 * Figures.key(fig) gives a *visual* identity string: rotations that look the
 * same because of a shape's symmetry collapse to the same key. Validators use
 * it to guarantee answer options are visually distinct.
 *
 * Also renders polyominoes (sets of grid cells) for mental-rotation tasks.
 */
(function (App3) {
  'use strict';

  var COLORS = [
    { id: 'red', hex: '#ef4444', name: 'red' },
    { id: 'blue', hex: '#3b82f6', name: 'blue' },
    { id: 'green', hex: '#22c55e', name: 'green' },
    { id: 'amber', hex: '#f59e0b', name: 'amber' },
    { id: 'purple', hex: '#a855f7', name: 'purple' },
    { id: 'teal', hex: '#14b8a6', name: 'teal' },
    { id: 'pink', hex: '#ec4899', name: 'pink' }
  ];
  var COLOR_IDS = COLORS.map(function (c) { return c.id; });
  var COLOR_HEX = {};
  COLORS.forEach(function (c) { COLOR_HEX[c.id] = c.hex; });

  function regular(n, r, startDeg) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (startDeg + i * 360 / n) * Math.PI / 180;
      pts.push((r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  function star(points, r1, r2) {
    var pts = [];
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 === 0 ? r1 : r2;
      var a = (-90 + i * 180 / points) * Math.PI / 180;
      pts.push((r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }

  /** Shape markup in a coordinate system centred on (0,0), radius ~42. */
  var SHAPE_MARKUP = {
    circle: '<circle cx="0" cy="0" r="38"/>',
    square: '<rect x="-34" y="-34" width="68" height="68" rx="4"/>',
    triangle: '<polygon points="0,-42 38,30 -38,30"/>',
    diamond: '<polygon points="0,-44 32,0 0,44 -32,0"/>',
    pentagon: '<polygon points="' + regular(5, 41, -90) + '"/>',
    hexagon: '<polygon points="' + regular(6, 40, -90) + '"/>',
    star: '<polygon points="' + star(5, 44, 19) + '"/>',
    cross: '<polygon points="-12,-40 12,-40 12,-12 40,-12 40,12 12,12 12,40 -12,40 -12,12 -40,12 -40,-12 -12,-12"/>',
    arrow: '<polygon points="0,-44 32,-6 11,-6 11,40 -11,40 -11,-6 -32,-6"/>',
    lshape: '<polygon points="-30,-40 -6,-40 -6,16 32,16 32,40 -30,40"/>',
    flag: '<polygon points="-28,-42 32,-22 -16,-4 -16,42 -28,42"/>',
    tee: '<polygon points="-38,-38 38,-38 38,-14 12,-14 12,40 -12,40 -12,-14 -38,-14"/>'
  };
  var SHAPES = Object.keys(SHAPE_MARKUP);
  /** Shapes with no rotational symmetry — rotation is always visible. */
  var ASYM = ['arrow', 'lshape', 'flag', 'tee'];
  /** Rotational symmetry angle per shape (0 = fully round). */
  var SYMMETRY = {
    circle: 0, square: 90, triangle: 120, diamond: 180, pentagon: 72, hexagon: 60,
    star: 72, cross: 90, arrow: 360, lshape: 360, flag: 360, tee: 360
  };
  var FILLS = ['solid', 'outline', 'striped'];
  var SIZES = ['s', 'm', 'l'];
  var SIZE_SCALE = { s: 0.62, m: 0.8, l: 1 };
  var ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315];

  /** Copy positions for count = 1..6 inside the -50..50 box, with per-copy scale. */
  var LAYOUTS = {
    1: { s: 1, p: [[0, 0]] },
    2: { s: 0.46, p: [[-24, 0], [24, 0]] },
    3: { s: 0.44, p: [[0, -22], [-24, 20], [24, 20]] },
    4: { s: 0.42, p: [[-23, -23], [23, -23], [-23, 23], [23, 23]] },
    5: { s: 0.36, p: [[-27, -27], [27, -27], [0, 0], [-27, 27], [27, 27]] },
    6: { s: 0.34, p: [[-28, -24], [0, -24], [28, -24], [-28, 24], [0, 24], [28, 24]] }
  };

  var NAMES = {
    shape: function (v) { return v === 'lshape' ? 'L-shape' : v === 'tee' ? 'T-shape' : v; },
    size: function (v) { return { s: 'small', m: 'medium', l: 'large' }[v]; }
  };
  var ATTR_LABELS = { shape: 'shape', color: 'colour', rotation: 'rotation', fill: 'fill style', count: 'number of shapes', size: 'size' };

  var uid = 0;

  function normalize(fig) {
    return {
      shape: fig.shape || 'circle',
      color: fig.color || 'blue',
      rotation: ((fig.rotation || 0) % 360 + 360) % 360,
      fill: fig.fill || 'solid',
      count: fig.count || 1,
      size: fig.size || 'm'
    };
  }

  /** Rotation as it visibly appears given the shape's symmetry. */
  function visibleRotation(fig) {
    var sym = SYMMETRY[fig.shape];
    if (sym === 0) return 0;
    var r = ((fig.rotation || 0) % 360 + 360) % 360;
    return r % sym;
  }

  /** Visual identity string. */
  function key(fig) {
    var f = normalize(fig);
    return [f.shape, f.color, visibleRotation(f), f.fill, f.count, f.size].join('|');
  }

  /** Visible value of one attribute (used by validators). */
  function visibleAttr(fig, attr) {
    var f = normalize(fig);
    return attr === 'rotation' ? visibleRotation(f) : f[attr];
  }

  /** Render a figure as an SVG string. */
  function svg(fig, opts) {
    var f = normalize(fig);
    opts = opts || {};
    var hex = COLOR_HEX[f.color] || f.color;
    var layout = LAYOUTS[f.count] || LAYOUTS[1];
    var scale = layout.s * SIZE_SCALE[f.size];
    var defs = '';
    var fillAttr, strokeAttr;
    if (f.fill === 'solid') {
      fillAttr = hex; strokeAttr = hex;
    } else if (f.fill === 'outline') {
      fillAttr = 'none'; strokeAttr = hex;
    } else {
      var pid = 'a3stripe' + (++uid);
      defs = '<defs><pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">' +
        '<rect width="3.2" height="7" fill="' + hex + '"/></pattern></defs>';
      fillAttr = 'url(#' + pid + ')'; strokeAttr = hex;
    }
    var shapes = layout.p.map(function (p) {
      return '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + scale.toFixed(3) + ') rotate(' + f.rotation + ')">' +
        SHAPE_MARKUP[f.shape] + '</g>';
    }).join('');
    var label = opts.label || describe(f);
    return '<svg class="fig" viewBox="-50 -50 100 100" role="img" aria-label="' + label + '">' + defs +
      '<g fill="' + fillAttr + '" stroke="' + strokeAttr + '" stroke-width="3.5" stroke-linejoin="round" vector-effect="non-scaling-stroke">' +
      shapes.replace(/<(circle|rect|polygon)/g, '<$1 vector-effect="non-scaling-stroke"') + '</g></svg>';
  }

  /** Human description, e.g. "2 large striped red arrows rotated 90°". */
  function describe(fig) {
    var f = normalize(fig);
    var shape = NAMES.shape(f.shape);
    var color = (COLORS.filter(function (c) { return c.id === f.color; })[0] || { name: f.color }).name;
    var rot = visibleRotation(f) ? ' rotated ' + f.rotation + '°' : '';
    return f.count + ' ' + NAMES.size(f.size) + ' ' + f.fill + ' ' + color + ' ' + shape + (f.count > 1 ? 's' : '') + rot;
  }

  /** Human-readable value of one attribute. */
  function attrValueName(attr, v) {
    if (attr === 'shape') return NAMES.shape(v);
    if (attr === 'size') return NAMES.size(v);
    if (attr === 'rotation') return v + '°';
    if (attr === 'color') return (COLORS.filter(function (c) { return c.id === v; })[0] || { name: v }).name;
    return String(v);
  }

  /** Value pool for an attribute. */
  function pool(attr, opts) {
    opts = opts || {};
    switch (attr) {
      case 'shape': return opts.asym ? ASYM.slice() : SHAPES.slice();
      case 'color': return COLOR_IDS.slice();
      case 'rotation': return ROTATIONS.slice();
      case 'fill': return FILLS.slice();
      case 'count': return opts.maxCount ? [1, 2, 3, 4, 5, 6].slice(0, opts.maxCount) : [1, 2, 3, 4];
      case 'size': return SIZES.slice();
      default: return [];
    }
  }

  /** Random figure from rng. */
  function random(rng, opts) {
    opts = opts || {};
    return {
      shape: rng.pick(opts.asym ? ASYM : SHAPES),
      color: rng.pick(COLOR_IDS),
      rotation: opts.rotate ? rng.pick(ROTATIONS) : 0,
      fill: opts.fill || 'solid',
      count: opts.count || 1,
      size: opts.size || 'm'
    };
  }

  // ---------------------------------------------------------------- polyominoes

  /** Normalize a cell list ([[x,y],...]) to origin and stable sort. */
  function polyNormalize(cells) {
    var minX = Infinity, minY = Infinity;
    cells.forEach(function (c) { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); });
    return cells.map(function (c) { return [c[0] - minX, c[1] - minY]; })
      .sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  function polyKey(cells) { return polyNormalize(cells).map(function (c) { return c[0] + ',' + c[1]; }).join(';'); }
  /** Rotate 90° clockwise (screen coordinates, y down). */
  function polyRotate(cells, times) {
    var out = cells.map(function (c) { return c.slice(); });
    for (var t = 0; t < ((times % 4) + 4) % 4; t++) out = out.map(function (c) { return [-c[1], c[0]]; });
    return polyNormalize(out);
  }
  /** Mirror left-right. */
  function polyMirror(cells) { return polyNormalize(cells.map(function (c) { return [-c[0], c[1]]; })); }
  /** Flip top-bottom. */
  function polyFlipV(cells) { return polyNormalize(cells.map(function (c) { return [c[0], -c[1]]; })); }
  function polyRotationKeys(cells) {
    var keys = {};
    for (var r = 0; r < 4; r++) keys[polyKey(polyRotate(cells, r))] = true;
    return keys;
  }

  /** Render a polyomino as SVG. */
  function polySvg(cells, opts) {
    opts = opts || {};
    var n = polyNormalize(cells);
    var w = 0, h = 0;
    n.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    var size = Math.max(w, h);
    var unit = 80 / size;
    var ox = -w * unit / 2, oy = -h * unit / 2;
    var hex = COLOR_HEX[opts.color] || opts.color || '#6366f1';
    var rects = n.map(function (c) {
      return '<rect x="' + (ox + c[0] * unit).toFixed(1) + '" y="' + (oy + c[1] * unit).toFixed(1) + '" width="' + unit.toFixed(1) +
        '" height="' + unit.toFixed(1) + '" rx="' + (unit * 0.12).toFixed(1) + '"/>';
    }).join('');
    return '<svg class="fig poly" viewBox="-50 -50 100 100" role="img" aria-label="' + (opts.label || 'block shape') + '">' +
      '<g fill="' + hex + '" stroke="var(--surface, #fff)" stroke-width="2">' + rects + '</g></svg>';
  }

  App3.games.Figures = {
    COLORS: COLORS, COLOR_IDS: COLOR_IDS, SHAPES: SHAPES, ASYM: ASYM, SYMMETRY: SYMMETRY,
    FILLS: FILLS, SIZES: SIZES, ROTATIONS: ROTATIONS, ATTR_LABELS: ATTR_LABELS,
    normalize: normalize, key: key, visibleAttr: visibleAttr, visibleRotation: visibleRotation,
    svg: svg, describe: describe, attrValueName: attrValueName, pool: pool, random: random,
    poly: {
      normalize: polyNormalize, key: polyKey, rotate: polyRotate, mirror: polyMirror,
      flipV: polyFlipV, rotationKeys: polyRotationKeys, svg: polySvg
    }
  };
})(window.App3);
