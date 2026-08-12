/* Clemistry — molecular structure.
 *
 * Parses a practical subset of SMILES into an explicit atom/bond graph, fills in
 * implicit hydrogens from standard valences, kekulizes aromatic rings, and works
 * out lone-pair counts and VSEPR steric numbers for every atom.
 *
 * Supported: organic-subset atoms, bracket atoms with isotope/charge/H-count,
 * bond symbols - = # : / \, branches, ring-closure digits and %nn, and the
 * fragment separator '.' (which is how the salts in this game are written).
 */
(function (global) {
  'use strict';

  var E = global.Chem.Elements;

  /* Common valences, lowest first. An atom takes the smallest valence that is
   * at least as large as the sum of its explicit bond orders. */
  var VALENCE = {
    H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1],
    Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1, 3, 5, 7],
    As: [3, 5], Se: [2, 4, 6], Br: [1, 3, 5], Te: [2, 4, 6], I: [1, 3, 5, 7],
    Xe: [0, 2, 4, 6, 8], Kr: [0, 2]
  };

  /* Elements that get implicit hydrogens when written without brackets. */
  var ORGANIC_SUBSET = { B: 1, C: 1, N: 1, O: 1, P: 1, S: 1, F: 1, Cl: 1, Br: 1, I: 1 };

  var BRACKET_RE = /^(\d+)?([A-Z][a-z]?|[bcnops]|se|as)(@{1,2})?(?:H(\d*))?((?:[+-]\d+)|\++|-+)?(?::\d+)?$/;

  function valenceElectrons(symbol) {
    var el = E.get(symbol);
    if (!el) return 4;
    if (symbol === 'H') return 1;
    if (symbol === 'He') return 2;
    var g = el.group;
    if (g >= 13) return g - 10;
    if (g === 1 || g === 2) return g;
    return 0; /* transition metals: treated as bare ions here */
  }

  function ParseError(msg, pos) {
    var e = new Error('SMILES error at ' + pos + ': ' + msg);
    e.position = pos;
    return e;
  }

  function parseCharge(str) {
    if (!str) return 0;
    if (/^[+-]\d+$/.test(str)) return parseInt(str, 10);
    return str[0] === '+' ? str.length : -str.length;
  }

  /* ---------------------------------------------------------------- parse -- */

  function parseSmiles(smiles) {
    var atoms = [];
    var bonds = [];
    var stack = [];
    var rings = {};          /* ring number -> { atom, order, pos } */
    var prev = -1;
    var pendingOrder = null;
    var i = 0;
    var n = smiles.length;

    function addAtom(spec) {
      atoms.push({
        index: atoms.length,
        el: spec.el,
        charge: spec.charge || 0,
        aromatic: !!spec.aromatic,
        explicitH: spec.explicitH,      /* null when unspecified */
        isotope: spec.isotope || null,
        bracket: !!spec.bracket,
        hcount: 0,
        neighbors: [],
        bondsTo: []
      });
      return atoms.length - 1;
    }

    function addBond(a, b, order) {
      if (a === b) return;
      for (var k = 0; k < bonds.length; k++) {
        if ((bonds[k].a === a && bonds[k].b === b) || (bonds[k].a === b && bonds[k].b === a)) return;
      }
      bonds.push({ a: a, b: b, order: order, aromatic: order === 1.5 });
    }

    function linkPrev(idx) {
      if (prev >= 0) {
        var order = pendingOrder;
        if (order === null) {
          order = (atoms[prev].aromatic && atoms[idx].aromatic) ? 1.5 : 1;
        }
        addBond(prev, idx, order);
      }
      pendingOrder = null;
      prev = idx;
    }

    while (i < n) {
      var c = smiles[i];

      if (c === '(') { stack.push(prev); i++; continue; }
      if (c === ')') {
        if (!stack.length) throw ParseError('unmatched )', i);
        prev = stack.pop(); i++; continue;
      }
      if (c === '.') { prev = -1; pendingOrder = null; i++; continue; }
      if (c === '-') { pendingOrder = 1; i++; continue; }
      if (c === '=') { pendingOrder = 2; i++; continue; }
      if (c === '#') { pendingOrder = 3; i++; continue; }
      if (c === ':') { pendingOrder = 1.5; i++; continue; }
      if (c === '/' || c === '\\') { pendingOrder = 1; i++; continue; } /* E/Z ignored */

      if (c === '%' || (c >= '0' && c <= '9')) {
        var num, consumed;
        if (c === '%') {
          num = parseInt(smiles.substr(i + 1, 2), 10);
          consumed = 3;
        } else {
          num = parseInt(c, 10);
          consumed = 1;
        }
        if (isNaN(num)) throw ParseError('bad ring number', i);
        if (prev < 0) throw ParseError('ring closure with no preceding atom', i);
        if (rings[num]) {
          var open = rings[num];
          var order = pendingOrder !== null ? pendingOrder : (open.order !== null ? open.order : null);
          if (order === null) {
            order = (atoms[open.atom].aromatic && atoms[prev].aromatic) ? 1.5 : 1;
          }
          addBond(open.atom, prev, order);
          delete rings[num];
        } else {
          rings[num] = { atom: prev, order: pendingOrder };
        }
        pendingOrder = null;
        i += consumed;
        continue;
      }

      if (c === '[') {
        var close = smiles.indexOf(']', i);
        if (close < 0) throw ParseError('unmatched [', i);
        var body = smiles.slice(i + 1, close);
        var m = BRACKET_RE.exec(body);
        if (!m) throw ParseError('cannot read bracket atom "' + body + '"', i);
        var sym = m[2];
        var aromatic = /^[bcnops]$|^se$|^as$/.test(sym);
        if (aromatic) sym = sym[0].toUpperCase() + sym.slice(1);
        /* In brackets the hydrogen count is always explicit: "H" means one,
         * "Hn" means n, and no H at all means none. */
        var explicitH = m[4] === undefined ? 0 : (m[4] === '' ? 1 : parseInt(m[4], 10));
        var idx = addAtom({
          el: sym,
          charge: parseCharge(m[5]),
          aromatic: aromatic,
          explicitH: explicitH,
          isotope: m[1] ? parseInt(m[1], 10) : null,
          bracket: true
        });
        linkPrev(idx);
        i = close + 1;
        continue;
      }

      /* Organic subset — try a two-letter symbol first. */
      var two = smiles.substr(i, 2);
      var sym2 = null;
      if (two === 'Cl' || two === 'Br') sym2 = two;
      if (sym2) {
        linkPrev(addAtom({ el: sym2, explicitH: null }));
        i += 2;
        continue;
      }
      if (/[A-Za-z]/.test(c)) {
        var upper = c.toUpperCase();
        if (!ORGANIC_SUBSET[upper]) throw ParseError('element "' + c + '" needs brackets', i);
        linkPrev(addAtom({ el: upper, aromatic: c !== upper, explicitH: null }));
        i += 1;
        continue;
      }

      throw ParseError('unexpected character "' + c + '"', i);
    }

    if (stack.length) throw ParseError('unmatched (', n);
    for (var r in rings) {
      if (Object.prototype.hasOwnProperty.call(rings, r)) throw ParseError('ring bond ' + r + ' never closed', n);
    }

    return { atoms: atoms, bonds: bonds };
  }

  /* ------------------------------------------------------------ kekulize -- */

  /* Turn aromatic (order 1.5) bonds into alternating single/double bonds so the
   * geometry and the drawing both have something concrete to work with. */
  function kekulize(atoms, bonds) {
    var aromaticBonds = bonds.filter(function (b) { return b.order === 1.5; });
    if (!aromaticBonds.length) return;

    var adj = {};
    aromaticBonds.forEach(function (b) {
      (adj[b.a] = adj[b.a] || []).push(b);
      (adj[b.b] = adj[b.b] || []).push(b);
    });

    /* Which aromatic atoms must carry exactly one double bond?  Pyrrole-type
     * N/O/S donate a lone pair instead and stay all-single. */
    var needs = {};
    Object.keys(adj).forEach(function (key) {
      var idx = parseInt(key, 10);
      var a = atoms[idx];
      var sigma = 0;
      bonds.forEach(function (b) {
        if (b.a === idx || b.b === idx) sigma += (b.order === 1.5 ? 1 : b.order);
      });
      var h = a.explicitH || 0;
      var ve = valenceElectrons(a.el) - a.charge;
      var target = a.el === 'C' ? 4 : (a.el === 'N' ? 3 + (a.charge > 0 ? 1 : 0) : 2);
      if (a.el === 'O' || a.el === 'S') target = 2;
      var used = sigma + h;
      needs[idx] = (used < target) && (ve - used - h >= 0);
      if (a.el === 'N' && h > 0) needs[idx] = false;
      if ((a.el === 'O' || a.el === 'S') && adj[idx].length >= 2) needs[idx] = false;
    });

    var pending = Object.keys(needs).filter(function (k) { return needs[k]; }).map(Number);
    var assigned = {};

    function match(list) {
      if (!list.length) return true;
      var atomIdx = list[0];
      if (assigned[atomIdx]) return match(list.slice(1));
      var options = adj[atomIdx] || [];
      for (var i = 0; i < options.length; i++) {
        var b = options[i];
        var other = b.a === atomIdx ? b.b : b.a;
        if (assigned[other] || !needs[other]) continue;
        assigned[atomIdx] = b; assigned[other] = b;
        b.order = 2;
        if (match(list.slice(1))) return true;
        b.order = 1.5;
        delete assigned[atomIdx]; delete assigned[other];
      }
      return false;
    }

    if (!match(pending)) {
      /* No perfect matching (odd ring, unusual charge state) — take whatever
       * double bonds we can place greedily rather than losing all of them. */
      assigned = {};
      pending.forEach(function (atomIdx) {
        if (assigned[atomIdx]) return;
        (adj[atomIdx] || []).some(function (b) {
          var other = b.a === atomIdx ? b.b : b.a;
          if (assigned[other] || !needs[other]) return false;
          assigned[atomIdx] = b; assigned[other] = b; b.order = 2;
          return true;
        });
      });
    }

    /* Everything still at 1.5 becomes a single bond, but remember it was
     * aromatic so the renderer can draw the ring properly. */
    bonds.forEach(function (b) { if (b.order === 1.5) b.order = 1; });
  }

  /* -------------------------------------------------------- hydrogens etc -- */

  function bondOrderSum(idx, bonds) {
    var s = 0;
    bonds.forEach(function (b) { if (b.a === idx || b.b === idx) s += b.order; });
    return s;
  }

  function addImplicitHydrogens(atoms, bonds) {
    var base = atoms.length;
    for (var i = 0; i < base; i++) {
      var a = atoms[i];
      var sum = bondOrderSum(i, bonds);
      var h;
      if (a.explicitH !== null && a.explicitH !== undefined) {
        h = a.explicitH;
      } else {
        var vals = VALENCE[a.el];
        if (!vals) { h = 0; }
        else {
          var target = vals[vals.length - 1];
          for (var v = 0; v < vals.length; v++) {
            if (vals[v] >= sum) { target = vals[v]; break; }
          }
          /* A charge adds (cation of group 15/16) or removes bonding capacity. */
          if (a.el === 'N' || a.el === 'P') target += a.charge;
          else if (a.el === 'O' || a.el === 'S') target += a.charge;
          else target -= Math.abs(a.charge);
          h = Math.max(0, Math.round(target - sum));
        }
      }
      a.hcount = h;
      for (var k = 0; k < h; k++) {
        atoms.push({
          index: atoms.length, el: 'H', charge: 0, aromatic: false,
          explicitH: 0, isotope: null, bracket: false, hcount: 0,
          neighbors: [], bondsTo: [], isImplicitH: true
        });
        bonds.push({ a: i, b: atoms.length - 1, order: 1, aromatic: false });
      }
    }
  }

  function buildAdjacency(atoms, bonds) {
    atoms.forEach(function (a) { a.neighbors = []; a.bondsTo = []; });
    bonds.forEach(function (b) {
      atoms[b.a].neighbors.push(b.b);
      atoms[b.b].neighbors.push(b.a);
      atoms[b.a].bondsTo.push(b);
      atoms[b.b].bondsTo.push(b);
    });
  }

  /* Lone pairs and the VSEPR steric number. */
  function assignVsepr(atoms, bonds) {
    atoms.forEach(function (a, i) {
      var ve = valenceElectrons(a.el) - a.charge;
      var sum = bondOrderSum(i, bonds);
      var nonbonding = ve - sum;
      var lp = Math.max(0, Math.floor(nonbonding / 2));
      /* Transition metals and heavy p-block ions: don't invent lone pairs we
       * cannot place sensibly. */
      var el = E.get(a.el);
      if (el && (el.category === 'transition' || el.category === 'lanthanide' || el.category === 'actinide')) lp = 0;
      if (a.el === 'B' || a.el === 'Al') lp = 0;
      a.lonePairs = lp;
      a.steric = a.neighbors.length + lp;
      a.geometry = geometryName(a.neighbors.length, lp);
    });
  }

  var GEOMETRY_NAMES = {
    '1,0': 'terminal', '2,0': 'linear', '2,1': 'bent', '2,2': 'bent',
    '2,3': 'linear', '3,0': 'trigonal planar', '3,1': 'trigonal pyramidal',
    '3,2': 'T-shaped', '4,0': 'tetrahedral', '4,1': 'seesaw',
    '4,2': 'square planar', '5,0': 'trigonal bipyramidal',
    '5,1': 'square pyramidal', '6,0': 'octahedral'
  };

  function geometryName(bonded, lp) {
    return GEOMETRY_NAMES[bonded + ',' + lp] || (bonded + '-coordinate');
  }

  /* ------------------------------------------------------------- formula -- */

  function hillFormula(atoms) {
    var counts = {};
    atoms.forEach(function (a) { counts[a.el] = (counts[a.el] || 0) + 1; });
    var keys = Object.keys(counts);
    var ordered = [];
    if (counts.C) {
      ordered.push('C');
      if (counts.H) ordered.push('H');
      keys.filter(function (k) { return k !== 'C' && k !== 'H'; }).sort().forEach(function (k) { ordered.push(k); });
    } else {
      keys.sort().forEach(function (k) { ordered.push(k); });
    }
    return ordered.map(function (k) {
      return k + (counts[k] > 1 ? counts[k] : '');
    }).join('');
  }

  function molarMass(atoms) {
    return atoms.reduce(function (sum, a) {
      var el = E.get(a.el);
      return sum + (el ? el.mass : 0);
    }, 0);
  }

  /* Connected components — each '.'-separated ion is its own fragment. */
  function components(atoms) {
    var seen = new Array(atoms.length);
    var groups = [];
    for (var i = 0; i < atoms.length; i++) {
      if (seen[i]) continue;
      var queue = [i], group = [];
      seen[i] = true;
      while (queue.length) {
        var cur = queue.shift();
        group.push(cur);
        atoms[cur].neighbors.forEach(function (nb) {
          if (!seen[nb]) { seen[nb] = true; queue.push(nb); }
        });
      }
      groups.push(group);
    }
    return groups;
  }

  /* Smallest-set-of-rings, good enough for the ring systems in the library:
   * take the fundamental cycles of a BFS spanning tree, shortest first. */
  function findRings(atoms, bonds) {
    var parent = {}, depth = {}, seen = {};
    var rings = [];
    var treeEdges = {};

    function edgeKey(a, b) { return Math.min(a, b) + '-' + Math.max(a, b); }

    for (var start = 0; start < atoms.length; start++) {
      if (seen[start]) continue;
      seen[start] = true; parent[start] = -1; depth[start] = 0;
      var queue = [start];
      while (queue.length) {
        var cur = queue.shift();
        atoms[cur].neighbors.forEach(function (nb) {
          if (!seen[nb]) {
            seen[nb] = true; parent[nb] = cur; depth[nb] = depth[cur] + 1;
            treeEdges[edgeKey(cur, nb)] = true;
            queue.push(nb);
          }
        });
      }
    }

    bonds.forEach(function (b) {
      if (treeEdges[edgeKey(b.a, b.b)]) return;
      /* Walk both ends up to their common ancestor. */
      var x = b.a, y = b.b, pathX = [x], pathY = [y];
      while (depth[x] > depth[y]) { x = parent[x]; pathX.push(x); }
      while (depth[y] > depth[x]) { y = parent[y]; pathY.push(y); }
      var guard = 0;
      while (x !== y && guard++ < 200) {
        x = parent[x]; y = parent[y];
        if (x === undefined || y === undefined || x < 0 || y < 0) return;
        pathX.push(x); pathY.push(y);
      }
      if (x !== y) return;
      pathY.pop();
      var ring = pathX.concat(pathY.reverse());
      if (ring.length >= 3 && ring.length <= 10) rings.push(ring);
    });

    rings.sort(function (p, q) { return p.length - q.length; });
    return rings;
  }

  /* ---------------------------------------------------------------- build -- */

  var cache = {};

  function build(smiles) {
    if (cache[smiles]) return cache[smiles];
    var parsed = parseSmiles(smiles);
    var atoms = parsed.atoms, bonds = parsed.bonds;

    buildAdjacency(atoms, bonds);
    kekulize(atoms, bonds);
    addImplicitHydrogens(atoms, bonds);
    buildAdjacency(atoms, bonds);
    assignVsepr(atoms, bonds);

    var mol = {
      smiles: smiles,
      atoms: atoms,
      bonds: bonds,
      formula: hillFormula(atoms),
      mass: molarMass(atoms),
      charge: atoms.reduce(function (s, a) { return s + a.charge; }, 0),
      rings: findRings(atoms, bonds),
      fragments: components(atoms)
    };
    cache[smiles] = mol;
    return mol;
  }

  global.Chem.Structure = {
    build: build,
    parse: parseSmiles,
    hillFormula: hillFormula,
    valenceElectrons: valenceElectrons,
    geometryName: geometryName
  };
})(window);
