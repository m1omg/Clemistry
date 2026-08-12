/* Clemistry — molecule viewer.
 *
 * Draws the stick model on a 2D canvas: each bond is split at its midpoint and
 * coloured with the CPK colour of the atom at each end, drawn back-to-front so
 * the depth reads correctly. Ionic and metallic solids are drawn as a piece of
 * their crystal lattice instead, because they have no molecules to show.
 */
(function (global) {
  'use strict';

  var E = global.Chem.Elements;
  var St = global.Chem.Structure;
  var G = global.Chem.Geometry;
  var V = G.vec;

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
  function sup(s) { return String(s).replace(/[0-9+-]/g, function (c) { return SUP[c]; }); }

  /* ------------------------------------------------------------ lattices -- */

  function latticePoints(type, a) {
    var pts = [], i, j, k;
    function push(x, y, z) { pts.push([x * a, y * a, z * a]); }

    if (type === 'rocksalt' || type === 'diamond') {
      var n = type === 'rocksalt' ? 2 : 1;
      for (i = 0; i <= n; i++) for (j = 0; j <= n; j++) for (k = 0; k <= n; k++) push(i, j, k);
      if (type === 'diamond') {
        /* Add the face centres and the four tetrahedral interior sites. */
        var fcc = [[0, .5, .5], [.5, 0, .5], [.5, .5, 0], [1, .5, .5], [.5, 1, .5], [.5, .5, 1]];
        var tet = [[.25, .25, .25], [.75, .75, .25], [.75, .25, .75], [.25, .75, .75]];
        fcc.concat(tet).forEach(function (p) { push(p[0], p[1], p[2]); });
      }
      return pts;
    }

    if (type === 'fcc') {
      for (i = 0; i <= 1; i++) for (j = 0; j <= 1; j++) for (k = 0; k <= 1; k++) push(i, j, k);
      [[0, .5, .5], [.5, 0, .5], [.5, .5, 0], [1, .5, .5], [.5, 1, .5], [.5, .5, 1]]
        .forEach(function (p) { push(p[0], p[1], p[2]); });
      return pts;
    }

    if (type === 'bcc') {
      for (i = 0; i <= 1; i++) for (j = 0; j <= 1; j++) for (k = 0; k <= 1; k++) push(i, j, k);
      push(.5, .5, .5);
      return pts;
    }

    if (type === 'hcp') {
      /* Three close-packed layers in an ABA stack. */
      var layer = [[0, 0], [1, 0], [.5, 0.866], [-.5, .866], [-1, 0], [-.5, -.866], [.5, -.866]];
      layer.forEach(function (p) { push(p[0], p[1], 0); });
      [[0, .577], [1, .577], [.5, 1.443]].forEach(function (p) { push(p[0] - .5, p[1] - .29, 0.816); });
      [[0, .577], [1, .577], [.5, 1.443]].forEach(function (p) { push(p[0] - .5, p[1] - .29, -0.816); });
      return pts;
    }

    if (type === 'graphite') {
      /* Two offset hexagonal sheets. */
      var hex = [];
      for (i = -1; i <= 1; i++) {
        for (j = -1; j <= 1; j++) {
          var ox = i * 1.5, oy = (j + i * 0.5) * 1.732;
          hex.push([ox, oy]);
          hex.push([ox + 0.5, oy + 0.866]);
        }
      }
      hex.forEach(function (p) { push(p[0], p[1], 0); });
      hex.forEach(function (p) { push(p[0] + 0.5, p[1], 1.35); });
      return pts;
    }

    return [[0, 0, 0]];
  }

  /* Build a displayable structure for a crystalline solid. */
  function buildLattice(species) {
    var mol = St.build(species.smiles);
    var kinds = [];
    mol.fragments.forEach(function (frag) {
      frag.forEach(function (idx) { kinds.push(mol.atoms[idx]); });
    });
    /* Distinct elements, cation first for a salt. */
    var elements = [];
    kinds.forEach(function (a) {
      if (!elements.some(function (e) { return e.el === a.el; })) {
        elements.push({ el: a.el, charge: a.charge });
      }
    });
    if (!elements.length) elements = [{ el: 'C', charge: 0 }];
    elements.sort(function (x, y) { return y.charge - x.charge; });

    var type = species.lattice;
    var spacing;
    if (type === 'rocksalt' && elements.length > 1) {
      spacing = E.radius(elements[0].el, 1) + E.radius(elements[1].el, 1);
    } else if (type === 'graphite') {
      spacing = 1.42;
    } else if (type === 'diamond') {
      spacing = E.radius(elements[0].el, 1) * 4 / Math.sqrt(3);
    } else {
      spacing = E.radius(elements[0].el, 1) * 2 * Math.sqrt(2);
    }

    var pts = latticePoints(type, spacing);
    var atoms = pts.map(function (p, i) {
      var kind;
      if (type === 'rocksalt' && elements.length > 1) {
        var cell = Math.round(p[0] / spacing) + Math.round(p[1] / spacing) + Math.round(p[2] / spacing);
        kind = elements[cell % 2];
      } else {
        kind = elements[0];
      }
      return { el: kind.el, charge: kind.charge, index: i, neighbors: [], lonePairs: 0 };
    });

    /* Bond anything at the shortest repeating distance. */
    var shortest = Infinity;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var d = V.dist(pts[i], pts[j]);
        if (d > 0.1) shortest = Math.min(shortest, d);
      }
    }
    var bonds = [];
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        if (V.dist(pts[i], pts[j]) < shortest * 1.12) {
          bonds.push({ a: i, b: j, order: 1, aromatic: false, ionic: type === 'rocksalt' });
          atoms[i].neighbors.push(j);
          atoms[j].neighbors.push(i);
        }
      }
    }

    /* Corner sites with no neighbour inside the fragment we cut out just look
     * like floating specks — drop them. */
    var keep = atoms.map(function (a) { return a.neighbors.length > 0; });
    if (keep.some(function (k) { return !k; }) && keep.some(function (k) { return k; })) {
      var remap = {}, nextIndex = 0;
      var keptAtoms = [], keptPts = [];
      atoms.forEach(function (a, i) {
        if (!keep[i]) return;
        remap[i] = nextIndex++;
        keptAtoms.push(a);
        keptPts.push(pts[i]);
      });
      bonds = bonds.filter(function (b) { return keep[b.a] && keep[b.b]; })
        .map(function (b) { return { a: remap[b.a], b: remap[b.b], order: b.order, aromatic: false, ionic: b.ionic }; });
      keptAtoms.forEach(function (a, i) { a.index = i; a.neighbors = []; });
      bonds.forEach(function (b) {
        keptAtoms[b.a].neighbors.push(b.b);
        keptAtoms[b.b].neighbors.push(b.a);
      });
      atoms = keptAtoms;
      pts = keptPts;
    }

    var centered = center(pts);
    return {
      atoms: atoms, bonds: bonds, positions: centered, rings: [], fragments: [],
      isLattice: true, radius: radiusOf(centered),
      bondRefs: bonds.map(function () { return [0, 0, 1]; })
    };
  }

  function center(pts) {
    var c = [0, 0, 0];
    pts.forEach(function (p) { c = V.add(c, p); });
    c = V.scale(c, 1 / Math.max(1, pts.length));
    return pts.map(function (p) { return V.sub(p, c); });
  }
  function radiusOf(pts) {
    var r = 0;
    pts.forEach(function (p) { r = Math.max(r, V.len(p)); });
    return r || 1;
  }

  /* --------------------------------------------------------- lone pairs -- */

  /* Approximate directions for the non-bonding pairs, so they can be drawn as
   * the little paired dots a textbook would use. */
  function lonePairDirections(atom, idx, positions, neighbors) {
    var lp = atom.lonePairs || 0;
    if (!lp) return [];
    var dirs = neighbors.map(function (nb) { return V.norm(V.sub(positions[nb], positions[idx])); });
    var d;
    if (!dirs.length) {
      d = [0, 0, 1];
    } else {
      var sum = dirs.reduce(function (s, v) { return V.add(s, v); }, [0, 0, 0]);
      d = V.len(sum) < 1e-6 ? V.perp(dirs[0]) : V.norm(V.scale(sum, -1));
    }

    if (lp === 1) return [d];

    if (lp === 2) {
      /* Straddle the bond plane, the way water's two pairs do. */
      var axis = dirs.length >= 2 ? V.norm(V.sub(dirs[0], dirs[1])) : V.perp(d);
      if (Math.abs(V.dot(axis, d)) > 0.9) axis = V.perp(d);
      return [54, -54].map(function (deg) {
        return G.matVec(G.rotationAbout(axis, deg * Math.PI / 180), d);
      });
    }

    /* Three or more: spread them on a cone around d. */
    var perp = V.perp(d);
    var tilted = G.matVec(G.rotationAbout(perp, 70 * Math.PI / 180), d);
    var out = [];
    for (var i = 0; i < lp; i++) {
      out.push(G.matVec(G.rotationAbout(d, 2 * Math.PI * i / lp), tilted));
    }
    return out;
  }

  /* ------------------------------------------------------------- viewer -- */

  function Viewer(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.mode = 'stick';
    this.showH = true;
    this.showLabels = false;
    this.showLonePairs = false;
    this.autoRotate = true;
    this.rotation = { x: -0.35, y: 0.6 };
    this.zoom = 1;
    this.structure = null;
    this.species = null;
    this.empty = true;
    this._raf = null;
    this._bind();
  }

  Viewer.prototype._bind = function () {
    var self = this;
    var dragging = false, last = null;

    function down(e) {
      dragging = true;
      self.autoRotate = false;
      last = point(e);
      e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      var p = point(e);
      self.rotation.y += (p.x - last.x) * 0.011;
      self.rotation.x += (p.y - last.y) * 0.011;
      self.rotation.x = Math.max(-1.55, Math.min(1.55, self.rotation.x));
      last = p;
      e.preventDefault();
    }
    function up() { dragging = false; }
    function point(e) {
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }

    this.canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this.canvas.addEventListener('touchstart', down, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    this.canvas.addEventListener('wheel', function (e) {
      self.zoom = Math.max(0.35, Math.min(4, self.zoom * (e.deltaY > 0 ? 0.9 : 1.11)));
      e.preventDefault();
    }, { passive: false });
  };

  Viewer.prototype.setSpecies = function (species) {
    this.species = species;
    this.empty = !species;
    if (!species) { this.structure = null; return; }

    if (species.noStructure) {
      this.structure = null;
      return;
    }

    if (species.lattice) {
      this.structure = buildLattice(species);
    } else {
      var mol = St.build(species.smiles);
      var geo = G.coordinates(mol);
      this.structure = {
        atoms: mol.atoms, bonds: mol.bonds, positions: geo.positions,
        rings: mol.rings, fragments: mol.fragments,
        radius: geo.radius, bondRefs: geo.bondRefs, isLattice: false
      };
    }
    this.zoom = 1;
  };

  Viewer.prototype.start = function () {
    var self = this;
    if (this._raf) return;
    (function loop() {
      self._raf = requestAnimationFrame(loop);
      if (self.autoRotate) self.rotation.y += 0.0045;
      self.draw();
    })();
  };

  Viewer.prototype.stop = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  };

  Viewer.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
  };

  Viewer.prototype.draw = function () {
    var ctx = this.ctx;
    if (!this.cssWidth) this.resize();
    var w = this.cssWidth, h = this.cssHeight;
    ctx.clearRect(0, 0, w, h);

    if (!this.structure) {
      this._drawPlaceholder(ctx, w, h);
      return;
    }

    var s = this.structure;
    var visible = this._visibleAtoms(s);
    var rot = this._matrix();
    var scale = this._fitScale(s, visible, rot, w, h) * this.zoom;
    var cx = w / 2, cy = h / 2;

    /* Project every atom once. */
    var proj = s.positions.map(function (p) {
      var r = G.matVec(rot, p);
      var persp = 1 / (1 + r[2] * 0.045);
      return { x: cx + r[0] * scale * persp, y: cy - r[1] * scale * persp, z: r[2], s: persp };
    });

    var items = [];
    var self = this;
    var stickW = this.mode === 'stick' ? 0.19 : 0.13;

    s.bonds.forEach(function (b, bi) {
      if (!visible[b.a] || !visible[b.b]) return;
      var pa = proj[b.a], pb = proj[b.b];
      var mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      /* Aromatic rings are measured as 1.5 bonds but drawn in their Kekulé form,
       * which is how a chemist would sketch them. */
      var order = b.ionic ? 1 : b.order;
      var offsets = self._bondOffsets(s, b, bi, order, rot, scale);

      items.push({
        z: (pa.z + pb.z) / 2,
        kind: 'bond',
        draw: function () {
          offsets.forEach(function (off) {
            self._stroke(ctx, pa, mid, off, E.color(s.atoms[b.a].el), stickW * scale, b.ionic);
            self._stroke(ctx, mid, pb, off, E.color(s.atoms[b.b].el), stickW * scale, b.ionic);
          });
        }
      });
    });

    var atomScale = this.mode === 'spacefill' ? 1 : (this.mode === 'ballstick' ? 0.30 : 0.13);
    s.atoms.forEach(function (a, i) {
      if (!visible[i]) return;
      var p = proj[i];
      var rad = (self.mode === 'spacefill' ? E.vdw(a.el) : Math.max(0.28, E.radius(a.el, 1))) * atomScale * scale * p.s;
      if (self.mode === 'stick' && !self.showLabels) {
        /* In pure stick mode the joints just need to be round, not spherical. */
        rad = stickW * scale * 0.5;
      }
      /* A lone ion has no sticks to show, so it always gets a real sphere. */
      if (!a.neighbors.length) {
        rad = Math.max(rad, E.radius(a.el, 1) * 0.42 * scale * p.s, 5);
      }
      items.push({
        z: p.z, kind: 'atom',
        draw: function () { self._sphere(ctx, p, rad, E.color(a.el), a, i); }
      });
    });

    if (this.showLonePairs && !s.isLattice) {
      s.atoms.forEach(function (a, i) {
        if (!visible[i] || !a.lonePairs) return;
        var dirs = lonePairDirections(a, i, s.positions, a.neighbors.filter(function (n) { return visible[n]; }));
        dirs.forEach(function (d) {
          var base = V.add(s.positions[i], V.scale(d, Math.max(0.5, E.radius(a.el, 1) * 0.95)));
          var r = G.matVec(rot, base);
          var persp = 1 / (1 + r[2] * 0.045);
          var px = cx + r[0] * scale * persp, py = cy - r[1] * scale * persp;
          items.push({
            z: r[2], kind: 'lp',
            draw: function () { self._lonePair(ctx, px, py, scale * 0.035 * persp, rot, d, scale, persp); }
          });
        });
      });
    }

    items.sort(function (p, q) { return p.z - q.z; });
    items.forEach(function (it) { it.draw(); });

    if (this.showLabels) this._drawLabels(ctx, s, proj, visible, scale);
  };

  /* Fit the molecule to the canvas from its projected extent rather than its
   * 3D radius, so a flat molecule seen face-on fills the frame. Eased so the
   * scale does not jump about while the model spins. */
  Viewer.prototype._fitScale = function (s, visible, rot, w, h) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    var pad = 0;
    for (var i = 0; i < s.positions.length; i++) {
      if (!visible[i]) continue;
      var r = G.matVec(rot, s.positions[i]);
      if (r[0] < minX) minX = r[0];
      if (r[0] > maxX) maxX = r[0];
      if (r[1] < minY) minY = r[1];
      if (r[1] > maxY) maxY = r[1];
      pad = Math.max(pad, this.mode === 'spacefill' ? E.vdw(s.atoms[i].el) : 0.45);
    }
    if (!isFinite(minX)) return 40;

    var spanX = Math.max(0.6, maxX - minX + pad * 2);
    var spanY = Math.max(0.6, maxY - minY + pad * 2);
    var target = Math.min(w * 0.92 / spanX, h * 0.92 / spanY);

    if (this._fit === undefined || this._fitFor !== s) { this._fit = target; this._fitFor = s; }
    this._fit += (target - this._fit) * 0.12;
    return this._fit;
  };

  /* Which atoms are drawn — the hydrogen toggle hides them and their bonds. */
  Viewer.prototype._visibleAtoms = function (s) {
    var showH = this.showH;
    return s.atoms.map(function (a) { return showH || a.el !== 'H'; });
  };

  Viewer.prototype._matrix = function () {
    var rx = G.rotationAbout([1, 0, 0], this.rotation.x);
    var ry = G.rotationAbout([0, 1, 0], this.rotation.y);
    return mul(rx, ry);
  };

  function mul(a, b) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
    }
    return out;
  }

  /* Screen-space offsets for the parallel lines of a double or triple bond. */
  Viewer.prototype._bondOffsets = function (s, bond, bondIndex, order, rot, scale) {
    if (order <= 1) return [{ x: 0, y: 0 }];
    var ref = s.bondRefs[bondIndex] || [0, 0, 1];
    var r = G.matVec(rot, ref);
    var axis = G.matVec(rot, V.norm(V.sub(s.positions[bond.b], s.positions[bond.a])));
    /* Project the reference perpendicular to the bond, in screen space. */
    var px = r[0], py = -r[1];
    var ax = axis[0], ay = -axis[1];
    var alen = Math.sqrt(ax * ax + ay * ay) || 1;
    ax /= alen; ay /= alen;
    var dot = px * ax + py * ay;
    px -= dot * ax; py -= dot * ay;
    var plen = Math.sqrt(px * px + py * py);
    if (plen < 0.05) { px = -ay; py = ax; plen = 1; }
    px /= plen; py /= plen;

    var gap = scale * (this.mode === 'stick' ? 0.115 : 0.10);
    if (order === 2) {
      return [{ x: px * gap * 0.5, y: py * gap * 0.5 }, { x: -px * gap * 0.5, y: -py * gap * 0.5 }];
    }
    return [
      { x: 0, y: 0 },
      { x: px * gap, y: py * gap },
      { x: -px * gap, y: -py * gap }
    ];
  };

  Viewer.prototype._stroke = function (ctx, from, to, off, colour, width, dashed) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x + off.x, from.y + off.y);
    ctx.lineTo(to.x + off.x, to.y + off.y);

    if (dashed) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(150,160,180,0.75)';
      ctx.lineWidth = Math.max(1, width * 0.30);
      ctx.stroke();
      ctx.restore();
      return;
    }

    /* Dark casing first so neighbouring sticks stay distinguishable. */
    ctx.strokeStyle = 'rgba(8,10,16,0.85)';
    ctx.lineWidth = width + 2.2;
    ctx.stroke();

    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();

    /* A thin highlight along the top of the stick. */
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(0.8, width * 0.28);
    ctx.stroke();
    ctx.restore();
  };

  Viewer.prototype._sphere = function (ctx, p, r, colour, atom, index) {
    if (r < 0.4) return;
    var grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, mix(colour, '#ffffff', 0.55));
    grad.addColorStop(0.65, colour);
    grad.addColorStop(1, mix(colour, '#000000', 0.45));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(8,10,16,0.75)';
    ctx.stroke();
  };

  Viewer.prototype._lonePair = function (ctx, x, y, r, rot, dir, scale, persp) {
    ctx.save();
    ctx.fillStyle = 'rgba(140,190,255,0.85)';
    var d = Math.max(1.6, r * 30);
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.arc(x + side * d * 0.5, y, Math.max(1.3, d * 0.34), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  Viewer.prototype._drawLabels = function (ctx, s, proj, visible, scale) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var size = Math.max(9, Math.min(17, scale * 0.30));
    ctx.font = '600 ' + size + 'px ui-sans-serif, system-ui, sans-serif';
    s.atoms.forEach(function (a, i) {
      if (!visible[i]) return;
      if (a.el === 'H' && s.atoms.length > 14) return;
      var p = proj[i];
      var text = a.el + (a.charge ? sup((a.charge > 0 ? '+' : '-') + (Math.abs(a.charge) > 1 ? Math.abs(a.charge) : '')) : '');
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(6,8,14,0.92)';
      ctx.strokeText(text, p.x, p.y);
      ctx.fillStyle = '#f2f5fb';
      ctx.fillText(text, p.x, p.y);
    });
    ctx.restore();
  };

  Viewer.prototype._drawPlaceholder = function (ctx, w, h) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(160,175,200,0.5)';
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    var msg = this.species && this.species.noStructure
      ? 'no molecular structure'
      : 'select a substance';
    ctx.fillText(msg, w / 2, h / 2);
    ctx.restore();
  };

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function mix(a, b, t) {
    var ca = hexToRgb(a), cb = hexToRgb(b);
    return 'rgb(' + ca.map(function (v, i) {
      return Math.round(v + (cb[i] - v) * t);
    }).join(',') + ')';
  }

  global.Chem.Viewer = Viewer;
  global.Chem.Viewer.mix = mix;
  global.Chem.Viewer.sup = sup;
})(window);
