/* Clemistry — 3D coordinate generation.
 *
 * Coordinates are built the way a chemist would sketch them: every atom gets the
 * VSEPR electron-domain geometry implied by its steric number, ring systems are
 * seeded as polygons, and the whole thing is then relaxed under a small force
 * field (bond lengths, 1-3 angle distances, sp2/aromatic planarity, and
 * non-bonded repulsion) until it settles.
 */
(function (global) {
  'use strict';

  var E = global.Chem.Elements;
  var DEG = Math.PI / 180;

  /* ------------------------------------------------------------- vectors -- */
  var V = {
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    scale: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    },
    len: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    norm: function (a) {
      var l = V.len(a);
      return l < 1e-9 ? [0, 0, 1] : [a[0] / l, a[1] / l, a[2] / l];
    },
    dist: function (a, b) { return V.len(V.sub(a, b)); },
    perp: function (a) {
      var t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      return V.norm(V.cross(a, t));
    }
  };

  function matVec(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  }

  /* Rotation about a unit axis by theta (Rodrigues). */
  function rotationAbout(axis, theta) {
    var u = V.norm(axis), c = Math.cos(theta), s = Math.sin(theta), t = 1 - c;
    var x = u[0], y = u[1], z = u[2];
    return [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c
    ];
  }

  /* Rotation taking unit vector a onto unit vector b. */
  function rotationAligning(a, b) {
    var c = V.dot(a, b);
    if (c > 0.999999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (c < -0.999999) return rotationAbout(V.perp(a), Math.PI);
    return rotationAbout(V.norm(V.cross(a, b)), Math.acos(Math.max(-1, Math.min(1, c))));
  }

  /* ----------------------------------------------------------- templates -- */
  var S3 = 1 / Math.sqrt(3);
  var SIN120 = Math.sin(120 * DEG), COS120 = Math.cos(120 * DEG);

  var TEMPLATES = {
    0: [[0, 0, 1]],
    1: [[0, 0, 1]],
    2: [[0, 0, 1], [0, 0, -1]],
    3: [[0, 0, 1], [0, SIN120, COS120], [0, -SIN120, COS120]],
    4: [[S3, S3, S3], [S3, -S3, -S3], [-S3, S3, -S3], [-S3, -S3, S3]],
    /* trigonal bipyramidal: equatorial slots 0-2, axial slots 3-4 */
    5: [[0, 0, 1], [0, SIN120, COS120], [0, -SIN120, COS120], [1, 0, 0], [-1, 0, 0]],
    6: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  };

  /* Which template slots the lone pairs take. Lone pairs prefer equatorial
   * sites in a trigonal bipyramid and go trans to each other in an octahedron. */
  function lonePairSlots(steric, lp) {
    if (lp <= 0) return [];
    if (steric === 5) return [2, 1, 0].slice(0, lp);
    if (steric === 6) return lp === 1 ? [0] : [0, 1].concat([2, 3, 4, 5]).slice(0, lp);
    var slots = [];
    for (var i = 0; i < lp; i++) slots.push(steric - 1 - i);
    return slots;
  }

  /* Ideal bond angle between two occupied slots, with the usual lone-pair
   * compression applied to the tetrahedral and trigonal-planar cases. */
  function idealAngle(steric, lp, t1, t2) {
    var base = Math.acos(Math.max(-1, Math.min(1, V.dot(t1, t2)))) / DEG;
    if (steric === 4 && base > 100) base = 109.47 - 2.4 * lp;
    else if (steric === 3 && base > 100) base = 120 - 3 * lp;
    else if (steric === 2) base = 180;
    return base;
  }

  /* True for an -O- linking two atoms heavier than carbon, as in P4O10, the
   * silicates and the polyphosphates. Ethers are not included: C-O-C really is
   * close to tetrahedral. */
  function isBridgingOxygen(mol, centre, a, b) {
    var atom = mol.atoms[centre];
    if (atom.el !== 'O' || atom.neighbors.length !== 2) return false;
    return [a, b].every(function (n) {
      var el = E.get(mol.atoms[n].el);
      return el && el.period >= 3;
    });
  }

  function bondLengthFor(mol, bond) {
    var order = bond.aromatic ? 1.5 : bond.order;
    return E.bondLength(mol.atoms[bond.a].el, mol.atoms[bond.b].el, order);
  }

  /* --------------------------------------------------------- ring seeding -- */

  function seedRings(mol, pos, placed) {
    var rings = mol.rings;
    if (!rings.length) return;

    var seedNormal = [0, 0, 1];
    var seeded = false;

    rings.forEach(function (ring, ringIdx) {
      var n = ring.length;
      var known = ring.filter(function (a) { return placed[a]; });

      /* Only the first ring is seeded blind. A ring that shares no atom with
       * anything placed yet would otherwise land on top of it; those are left
       * for the breadth-first walk and the relaxation to position. */
      if (!known.length && seeded) return;

      /* Average bond length around the ring gives the polygon radius. */
      var lsum = 0, lcount = 0;
      for (var i = 0; i < n; i++) {
        var a = ring[i], b = ring[(i + 1) % n];
        var bond = findBond(mol, a, b);
        if (bond) { lsum += bondLengthFor(mol, bond); lcount++; }
      }
      var L = lcount ? lsum / lcount : 1.5;
      var R = L / (2 * Math.sin(Math.PI / n));

      if (!known.length) {
        /* First ring: a flat polygon in the xy-plane. Saturated six-rings get a
         * small alternating pucker so relaxation finds a chair, not a flat ring. */
        /* A saturated ring is never flat. Seeding an alternating pucker breaks
         * the symmetry so relaxation can find the chair or the crown — a flat
         * start is a symmetric local minimum it would otherwise sit in. */
        var aromatic = ringIsConjugated(mol, ring);
        var pucker = aromatic ? 0 : (n === 6 ? 0.25 : n >= 7 ? 0.45 : 0.12);
        for (var k = 0; k < n; k++) {
          var ang = 2 * Math.PI * k / n;
          pos[ring[k]] = [R * Math.cos(ang), R * Math.sin(ang), (k % 2 ? pucker : -pucker)];
          placed[ring[k]] = true;
        }
        seeded = true;
        return;
      }

      /* Fused ring: find two adjacent atoms already placed and grow the new
       * polygon on the far side of that shared bond. */
      var fusion = findFusionBond(ring, placed);
      if (!fusion) return;   /* spiro or scattered — leave it to BFS + relaxation */

      var p = pos[fusion.a], q = pos[fusion.b];
      var mid = V.scale(V.add(p, q), 0.5);
      var along = V.norm(V.sub(q, p));
      var normal = ringIdx === 0 ? seedNormal : bestNormal(ring, pos, placed, along);
      var outward = V.norm(V.cross(normal, along));

      /* Point away from the atoms we already have. */
      var centroid = [0, 0, 0], cnt = 0;
      Object.keys(placed).forEach(function (key) {
        var idx = parseInt(key, 10);
        if (placed[idx] && pos[idx]) { centroid = V.add(centroid, pos[idx]); cnt++; }
      });
      if (cnt) {
        centroid = V.scale(centroid, 1 / cnt);
        if (V.dot(outward, V.sub(centroid, mid)) > 0) outward = V.scale(outward, -1);
      }

      var apothem = Math.sqrt(Math.max(0, R * R - Math.pow(V.dist(p, q) / 2, 2)));
      var center = V.add(mid, V.scale(outward, apothem));

      /* Walk the ring from the fusion bond, spacing atoms evenly around it. */
      var startPos = ring.indexOf(fusion.a);
      var dir = ring[(startPos + 1) % n] === fusion.b ? 1 : -1;
      var v0 = V.sub(p, center);
      var step = 2 * Math.PI / n * dir;
      for (var j = 1; j < n; j++) {
        var atom = ring[((startPos + j * dir) % n + n) % n];
        if (placed[atom]) continue;
        var rot = rotationAbout(normal, step * j);
        pos[atom] = V.add(center, matVec(rot, v0));
        placed[atom] = true;
      }
    });
  }

  function bestNormal(ring, pos, placed, along) {
    /* Use any two placed ring neighbours to define the ring plane; fall back to
     * something perpendicular to the fusion bond. */
    var pts = ring.filter(function (a) { return placed[a] && pos[a]; }).map(function (a) { return pos[a]; });
    if (pts.length >= 3) {
      var n = V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0]));
      if (V.len(n) > 1e-6) return V.norm(n);
    }
    return V.perp(along);
  }

  function findFusionBond(ring, placed) {
    var n = ring.length;
    for (var i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      if (placed[a] && placed[b]) return { a: a, b: b };
    }
    return null;
  }

  function ringIsConjugated(mol, ring) {
    return ring.every(function (a) { return mol.atoms[a].steric === 3 || mol.atoms[a].aromatic; });
  }

  function findBond(mol, a, b) {
    for (var i = 0; i < mol.bonds.length; i++) {
      var bd = mol.bonds[i];
      if ((bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) return bd;
    }
    return null;
  }

  /* ----------------------------------------------------------- placement -- */

  function initialPositions(mol) {
    var atoms = mol.atoms;
    var pos = new Array(atoms.length);
    var placed = {};
    var parentOf = {};

    seedRings(mol, pos, placed);

    /* Slot bookkeeping: which template direction each neighbour occupies. */
    var slotMap = atoms.map(function () { return {}; });

    mol.fragments.forEach(function (fragment) {
      var seed = fragment.filter(function (a) { return placed[a]; })[0];
      if (seed === undefined) {
        seed = fragment.slice().sort(function (x, y) {
          return atoms[y].neighbors.length - atoms[x].neighbors.length;
        })[0];
        pos[seed] = [0, 0, 0];
        placed[seed] = true;
      }

      var queue = fragment.filter(function (a) { return placed[a]; });
      var visited = {};
      queue.forEach(function (a) { visited[a] = true; });

      while (queue.length) {
        var a = queue.shift();
        var atom = atoms[a];
        var steric = Math.max(1, Math.min(6, atom.steric || atom.neighbors.length));
        var template = TEMPLATES[steric] || TEMPLATES[4];
        var lpSlots = lonePairSlots(steric, atom.lonePairs || 0);
        var bondSlots = [];
        for (var s = 0; s < template.length; s++) {
          if (lpSlots.indexOf(s) < 0) bondSlots.push(s);
        }

        /* Orient the template: slot 0 points at the parent (or at an already
         * placed neighbour), then roll so the next bond is staggered. */
        var anchor = parentOf[a];
        if (anchor === undefined) {
          anchor = atom.neighbors.filter(function (nb) { return placed[nb]; })[0];
        }
        var dirs;
        if (anchor === undefined || !pos[anchor]) {
          dirs = template.map(function (d) { return d.slice(); });
        } else {
          var u = V.norm(V.sub(pos[anchor], pos[a]));
          var R0 = rotationAligning(template[bondSlots[0]], u);
          dirs = template.map(function (d) { return matVec(R0, d); });
          slotMap[a][anchor] = bondSlots[0];

          if (bondSlots.length > 1) {
            var ref = null;
            var gp = parentOf[anchor];
            if (gp !== undefined && pos[gp]) ref = V.sub(pos[gp], pos[anchor]);
            if (ref) {
              var refPerp = V.sub(ref, V.scale(u, V.dot(ref, u)));
              if (V.len(refPerp) > 1e-6) {
                var w = dirs[bondSlots[1]];
                var wPerp = V.sub(w, V.scale(u, V.dot(w, u)));
                if (V.len(wPerp) > 1e-6) {
                  refPerp = V.norm(refPerp); wPerp = V.norm(wPerp);
                  var target = V.scale(refPerp, -1);       /* anti-periplanar */
                  var cosA = Math.max(-1, Math.min(1, V.dot(wPerp, target)));
                  var sign = V.dot(V.cross(wPerp, target), u) < 0 ? -1 : 1;
                  var R1 = rotationAbout(u, sign * Math.acos(cosA));
                  dirs = dirs.map(function (d) { return matVec(R1, d); });
                }
              }
            }
          }
        }

        /* Hand out the remaining slots to neighbours that still need a home. */
        var free = bondSlots.filter(function (s) {
          return !Object.keys(slotMap[a]).some(function (nb) { return slotMap[a][nb] === s; });
        });
        atom.neighbors.forEach(function (nb) {
          if (slotMap[a][nb] !== undefined) return;
          var slot = free.shift();
          if (slot === undefined) slot = bondSlots[bondSlots.length - 1];
          slotMap[a][nb] = slot;
          if (!placed[nb]) {
            var bond = findBond(mol, a, nb);
            var L = bond ? bondLengthFor(mol, bond) : 1.5;
            pos[nb] = V.add(pos[a], V.scale(V.norm(dirs[slot]), L));
            placed[nb] = true;
            parentOf[nb] = a;
          }
          if (!visited[nb]) { visited[nb] = true; queue.push(nb); }
        });
      }
    });

    /* Anything still unplaced (shouldn't happen) gets a spot near the origin. */
    for (var i = 0; i < pos.length; i++) {
      if (!pos[i]) pos[i] = [Math.cos(i) * 1.5, Math.sin(i) * 1.5, (i % 3) * 0.4];
    }
    return { pos: pos, slotMap: slotMap };
  }

  /* ---------------------------------------------------------- relaxation -- */

  /* Topological distance up to `max` bonds, used to skip non-bonded terms for
   * atoms that are already constrained by bonds and angles. */
  function topoDistances(mol, max) {
    var n = mol.atoms.length;
    var dist = [];
    for (var i = 0; i < n; i++) {
      var d = {};
      d[i] = 0;
      var frontier = [i];
      for (var lvl = 1; lvl <= max; lvl++) {
        var next = [];
        frontier.forEach(function (cur) {
          mol.atoms[cur].neighbors.forEach(function (nb) {
            if (d[nb] === undefined) { d[nb] = lvl; next.push(nb); }
          });
        });
        frontier = next;
      }
      dist.push(d);
    }
    return dist;
  }

  function buildRestraints(mol, slotMap) {
    var bondTerms = [];
    mol.bonds.forEach(function (b) {
      bondTerms.push({ a: b.a, b: b.b, d: bondLengthFor(mol, b) });
    });

    /* Inside a three- or four-membered ring the bond angles are set by the ring
     * itself, not by VSEPR — P4 really does have 60 degree angles. Let the bond
     * restraints define those, and drop the angle term that would fight them. */
    var strained = {};
    mol.rings.forEach(function (ring) {
      if (ring.length > 4) return;
      for (var k = 0; k < ring.length; k++) {
        var prev = ring[(k - 1 + ring.length) % ring.length];
        var next = ring[(k + 1) % ring.length];
        strained[ring[k] + '|' + Math.min(prev, next) + '|' + Math.max(prev, next)] = true;
      }
    });

    var angleTerms = [];
    mol.atoms.forEach(function (atom, i) {
      var nbs = atom.neighbors;
      if (nbs.length < 2) return;
      var steric = Math.max(1, Math.min(6, atom.steric || nbs.length));
      var template = TEMPLATES[steric] || TEMPLATES[4];
      var lp = atom.lonePairs || 0;
      for (var x = 0; x < nbs.length; x++) {
        for (var y = x + 1; y < nbs.length; y++) {
          if (strained[i + '|' + Math.min(nbs[x], nbs[y]) + '|' + Math.max(nbs[x], nbs[y])]) continue;
          /* Two neighbours bonded to each other close a triangle around this
           * atom — a cage like P4 has faces that ring perception never lists. */
          if (mol.atoms[nbs[x]].neighbors.indexOf(nbs[y]) >= 0) continue;
          var sx = slotMap[i][nbs[x]], sy = slotMap[i][nbs[y]];
          var theta;
          if (isBridgingOxygen(mol, i, nbs[x], nbs[y])) {
            /* An oxygen bridging two heavier atoms opens up far past the VSEPR
             * ideal — P–O–P in P4O10 is 124°, Si–O–Si in silicates about 144°.
             * Forcing 104.5° here strains every cage and network apart. */
            theta = 126;
          } else if (sx !== undefined && sy !== undefined && sx !== sy) {
            theta = idealAngle(steric, lp, template[sx], template[sy]);
          } else {
            theta = steric === 2 ? 180 : steric === 3 ? 120 - 3 * lp : 109.47 - 2.4 * lp;
          }
          var b1 = findBond(mol, i, nbs[x]), b2 = findBond(mol, i, nbs[y]);
          var l1 = b1 ? bondLengthFor(mol, b1) : 1.5;
          var l2 = b2 ? bondLengthFor(mol, b2) : 1.5;
          var target = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(theta * DEG));
          angleTerms.push({ a: nbs[x], b: nbs[y], d: target });
        }
      }
    });

    return { bonds: bondTerms, angles: angleTerms };
  }

  function relax(mol, pos, slotMap, iterations, opts) {
    opts = opts || {};
    var bondWeight = opts.bondWeight || 1.0;
    var angleWeight = opts.angleWeight === undefined ? 0.55 : opts.angleWeight;
    var repelWeight = opts.repelWeight === undefined ? 0.28 : opts.repelWeight;
    var n = mol.atoms.length;
    var restraints = opts.restraints || buildRestraints(mol, slotMap);
    var dist = topoDistances(mol, 3);

    /* Separate ions are positioned by layoutFragments, so they must not shove
     * each other around during relaxation. */
    var fragOf = new Array(n);
    mol.fragments.forEach(function (frag, fi) {
      frag.forEach(function (a) { fragOf[a] = fi; });
    });
    var planarAtoms = [];
    mol.atoms.forEach(function (a, i) {
      if (a.neighbors.length === 3 && a.steric === 3) planarAtoms.push(i);
    });
    var flatRings = mol.rings.filter(function (r) { return ringIsConjugated(mol, r); });

    var vdw = mol.atoms.map(function (a) { return E.vdw(a.el); });

    for (var iter = 0; iter < iterations; iter++) {
      var step = 0.18 * (1 - iter / iterations) + 0.02;
      var force = [];
      for (var i = 0; i < n; i++) force.push([0, 0, 0]);

      function pull(i, j, target, weight) {
        var d = V.sub(pos[j], pos[i]);
        var len = V.len(d);
        if (len < 1e-6) { d = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]; len = V.len(d); }
        var delta = (len - target) / len * 0.5 * weight;
        var f = V.scale(d, delta);
        force[i] = V.add(force[i], f);
        force[j] = V.sub(force[j], f);
      }

      restraints.bonds.forEach(function (t) { pull(t.a, t.b, t.d, bondWeight); });
      restraints.angles.forEach(function (t) { pull(t.a, t.b, t.d, angleWeight); });

      /* Non-bonded repulsion, one-sided (only pushes apart). */
      for (var p = 0; p < n; p++) {
        for (var q = p + 1; q < n; q++) {
          if (fragOf[p] !== fragOf[q]) continue;
          if (dist[p][q] !== undefined && dist[p][q] <= 3) continue;
          var dv = V.sub(pos[q], pos[p]);
          var len2 = V.dot(dv, dv);
          var minD = 0.78 * (vdw[p] + vdw[q]);
          if (len2 >= minD * minD || len2 < 1e-9) continue;
          var len = Math.sqrt(len2);
          var push = V.scale(dv, (len - minD) / len * repelWeight);
          force[p] = V.add(force[p], push);
          force[q] = V.sub(force[q], push);
        }
      }

      /* sp2 centres want to sit in the plane of their three neighbours. */
      planarAtoms.forEach(function (i) {
        var nbs = mol.atoms[i].neighbors;
        var normal = V.cross(V.sub(pos[nbs[1]], pos[nbs[0]]), V.sub(pos[nbs[2]], pos[nbs[0]]));
        if (V.len(normal) < 1e-6) return;
        normal = V.norm(normal);
        var offset = V.dot(V.sub(pos[i], pos[nbs[0]]), normal);
        var corr = V.scale(normal, -offset * 0.5);
        force[i] = V.add(force[i], corr);
        nbs.forEach(function (nb) { force[nb] = V.sub(force[nb], V.scale(corr, 1 / 3)); });
      });

      /* Aromatic / conjugated rings want to be flat. */
      flatRings.forEach(function (ring) {
        var centroid = [0, 0, 0];
        ring.forEach(function (a) { centroid = V.add(centroid, pos[a]); });
        centroid = V.scale(centroid, 1 / ring.length);
        var normal = ringNormal(ring, pos, centroid);
        if (!normal) return;
        ring.forEach(function (a) {
          var off = V.dot(V.sub(pos[a], centroid), normal);
          force[a] = V.add(force[a], V.scale(normal, -off * 0.45));
        });
      });

      for (var k = 0; k < n; k++) {
        pos[k] = V.add(pos[k], V.scale(force[k], step));
      }
    }
    return pos;
  }

  function ringNormal(ring, pos, centroid) {
    /* Newell's method — robust for slightly non-planar rings. */
    var nx = 0, ny = 0, nz = 0;
    for (var i = 0; i < ring.length; i++) {
      var a = pos[ring[i]], b = pos[ring[(i + 1) % ring.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var n = [nx, ny, nz];
    return V.len(n) < 1e-6 ? null : V.norm(n);
  }

  /* --------------------------------------------------------- fragment lay -- */

  /* Salts and other multi-fragment species are drawn as separate ions, spaced
   * out along x so they read as discrete particles. */
  /* Arrange the separate ions of a salt or hydrate on a grid rather than in a
   * line, so six fragments do not stretch into a thin unreadable strip. */
  function layoutFragments(mol, pos) {
    var frags = mol.fragments;
    if (frags.length < 2) return;

    var boxes = frags.map(function (frag) {
      var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      frag.forEach(function (a) {
        for (var d = 0; d < 3; d++) {
          min[d] = Math.min(min[d], pos[a][d]);
          max[d] = Math.max(max[d], pos[a][d]);
        }
      });
      return {
        frag: frag,
        centre: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
        w: max[0] - min[0], h: max[1] - min[1]
      };
    });

    var cols = Math.ceil(Math.sqrt(frags.length));
    var rows = Math.ceil(frags.length / cols);
    var gap = 1.9;
    var cellW = Math.max.apply(null, boxes.map(function (b) { return b.w; })) + gap;
    var cellH = Math.max.apply(null, boxes.map(function (b) { return b.h; })) + gap;

    boxes.forEach(function (box, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var dx = (col - (cols - 1) / 2) * cellW;
      var dy = ((rows - 1) / 2 - row) * cellH;
      box.frag.forEach(function (a) {
        pos[a] = [
          pos[a][0] - box.centre[0] + dx,
          pos[a][1] - box.centre[1] + dy,
          pos[a][2] - box.centre[2]
        ];
      });
    });
  }

  function center(pos) {
    var c = [0, 0, 0];
    pos.forEach(function (p) { c = V.add(c, p); });
    c = V.scale(c, 1 / Math.max(1, pos.length));
    return pos.map(function (p) { return V.sub(p, c); });
  }

  function radiusOf(pos) {
    var r = 0;
    pos.forEach(function (p) { r = Math.max(r, V.len(p)); });
    return r || 1;
  }

  /* ------------------------------------------------------------------ api -- */

  var cache = {};

  function coordinates(mol) {
    if (cache[mol.smiles]) return cache[mol.smiles];

    var init = initialPositions(mol);
    var pos = init.pos;
    var restraints = buildRestraints(mol, init.slotMap);
    var iterations = mol.atoms.length > 40 ? 340 : 600;

    /* First pass finds the overall shape, the second tightens bond lengths back
     * to their target values after the repulsion terms have had their say. */
    relax(mol, pos, init.slotMap, iterations, { restraints: restraints });
    relax(mol, pos, init.slotMap, 160, {
      restraints: restraints, bondWeight: 1.6, angleWeight: 0.45, repelWeight: 0.12
    });

    layoutFragments(mol, pos);
    pos = center(pos);

    var result = {
      positions: pos,
      radius: radiusOf(pos),
      /* Reference direction for drawing double bonds: perpendicular to the bond
       * and lying in the local plane, so the two lines look chemically right. */
      bondRefs: mol.bonds.map(function (b) { return doubleBondRef(mol, pos, b); })
    };
    cache[mol.smiles] = result;
    return result;
  }

  function doubleBondRef(mol, pos, bond) {
    var axis = V.norm(V.sub(pos[bond.b], pos[bond.a]));
    var candidates = [];
    mol.atoms[bond.a].neighbors.forEach(function (nb) { if (nb !== bond.b) candidates.push(nb); });
    mol.atoms[bond.b].neighbors.forEach(function (nb) { if (nb !== bond.a) candidates.push(nb); });
    for (var i = 0; i < candidates.length; i++) {
      var d = V.sub(pos[candidates[i]], pos[bond.a]);
      var perp = V.sub(d, V.scale(axis, V.dot(d, axis)));
      if (V.len(perp) > 0.2) return V.norm(perp);
    }
    return V.perp(axis);
  }

  global.Chem.Geometry = {
    coordinates: coordinates,
    vec: V,
    rotationAbout: rotationAbout,
    matVec: matVec
  };
})(window);
