/* Clemistry — the reaction vessel.
 *
 * Each tick the engine:
 *   1. dissolves what the water can dissolve, releasing ions
 *   2. runs the named reactions whose conditions are met
 *   3. runs the rules that need no table at all — neutralisation, precipitation
 *      by solubility product, displacement by the activity series, and the
 *      combustion of any carbon compound
 *   4. balances the energy books and moves the temperature accordingly
 *
 * Nothing here invents an enthalpy: ΔH always comes from the standard
 * enthalpies of formation of the species involved.
 */
(function (global) {
  'use strict';

  var Sp = global.Chem.Species;
  var Rx = global.Chem.Reactions;
  var St = global.Chem.Structure;

  /* Ions that act as weak acids, keyed by their own pKa. */
  var ION_ACIDS = { 'nh4+': 9.25, 'hco3-': 10.33, 'h2po4-': 7.20 };
  /* Ions that act as weak bases, keyed by the pKa of their conjugate acid. */
  var ION_BASES = {
    'co3-2': 10.33, 'ch3coo-': 4.76, 'f-': 3.17, 'cn-': 9.21,
    'hcoo-': 3.75, 'ocl-': 7.50, 's-2': 12.90, 'hco3-': 6.35, 'po4-3': 12.35
  };

  var KW = 1.0e-14;
  var R_GAS = 8.314;
  var AMBIENT_K = 298.15;
  var MAX_FLAME_K = 3500;
  var WATER_MOLAR_VOLUME = 0.018;   /* litres per mole */

  /* Aqueous ion and usual oxidation state for each metal. */
  var METAL_IONS = {
    li: { ion: 'li+', n: 1 }, na: { ion: 'na+', n: 1 }, k: { ion: 'k+', n: 1 },
    ca: { ion: 'ca+2', n: 2 }, mg: { ion: 'mg+2', n: 2 }, al: { ion: 'al+3', n: 3 },
    zn: { ion: 'zn+2', n: 2 }, fe: { ion: 'fe+2', n: 2 }, pb: { ion: 'pb+2', n: 2 },
    cu: { ion: 'cu+2', n: 2 }, ag: { ion: 'ag+', n: 1 }
  };
  var ION_METAL = {};
  Object.keys(METAL_IONS).forEach(function (m) { ION_METAL[METAL_IONS[m].ion] = m; });

  /* Metals whose reaction with water is already covered by a named reaction —
   * the generic acid rule must not double up on them. */
  var EXPLICIT_WATER_METALS = { na: 1, k: 1, li: 1, ca: 1 };

  function activityRank(metal) {
    var i = Sp.activitySeries.indexOf(metal);
    return i < 0 ? 999 : i;
  }

  /* Atom counts for a species, cached. */
  var atomCache = {};
  function atomsOf(id) {
    if (atomCache[id]) return atomCache[id];
    var sp = Sp.get(id);
    var counts = {};
    if (sp && !sp.noStructure) {
      try {
        St.build(sp.smiles).atoms.forEach(function (a) {
          counts[a.el] = (counts[a.el] || 0) + 1;
        });
      } catch (e) { /* leave empty */ }
    }
    atomCache[id] = counts;
    return counts;
  }

  /* Fuels that already have a hand-written combustion reaction. */
  var EXPLICIT_FUELS = {};
  Rx.all.forEach(function (r) {
    if (r.type === 'combustion') {
      Object.keys(r.in).forEach(function (id) { if (id !== 'o2') EXPLICIT_FUELS[id] = true; });
    }
  });

  /* ------------------------------------------------------------- vessel -- */

  function Vessel() {
    this.reset();
  }

  Vessel.prototype.reset = function () {
    this.amounts = {};
    this.T = AMBIENT_K;
    this.time = 0;
    this.heater = 0;            /* target temperature in K, 0 = off */
    this.stirring = false;
    this.electricity = false;
    this.light = false;
    this.igniteUntil = 0;
    this.log = [];
    this.events = [];
    this.discovered = {};
    this.lastReactions = {};
    this.pH = null;
    this.exploded = false;
    this.peakT = AMBIENT_K;
  };

  Vessel.prototype.add = function (id, moles) {
    var sp = Sp.get(id);
    if (!sp) return;
    this.amounts[id] = (this.amounts[id] || 0) + moles;
    this.emit('add', sp.name + ' — ' + fmt(moles) + ' mol added', { species: id });
  };

  Vessel.prototype.remove = function (id, moles) {
    if (!this.amounts[id]) return;
    var taken = moles === undefined ? this.amounts[id] : Math.min(moles, this.amounts[id]);
    this.amounts[id] -= taken;
    if (this.amounts[id] < 1e-12) delete this.amounts[id];
    var sp = Sp.get(id);
    this.emit('remove', (sp ? sp.name : id) + ' — ' + fmt(taken) + ' mol removed');
  };

  Vessel.prototype.clear = function () {
    var wasEmpty = !Object.keys(this.amounts).length;
    this.reset();
    if (!wasEmpty) this.emit('clear', 'Vessel emptied and rinsed.');
  };

  Vessel.prototype.ignite = function () {
    this.igniteUntil = this.time + 2.5;
    this.emit('ignite', 'Ignition source applied.');
  };

  Vessel.prototype.emit = function (kind, message, extra) {
    var entry = { kind: kind, message: message, t: this.time, T: this.T };
    if (extra) Object.keys(extra).forEach(function (k) { entry[k] = extra[k]; });
    this.log.push(entry);
    if (this.log.length > 400) this.log.shift();
    this.events.push(entry);
  };

  Vessel.prototype.takeEvents = function () {
    var e = this.events;
    this.events = [];
    return e;
  };

  Vessel.prototype.moles = function (id) { return this.amounts[id] || 0; };

  Vessel.prototype.waterLitres = function () {
    return this.moles('water') * WATER_MOLAR_VOLUME;
  };

  /* Molar concentration of a dissolved species. */
  Vessel.prototype.conc = function (id) {
    var v = this.waterLitres();
    return v > 1e-9 ? this.moles(id) / v : 0;
  };

  Vessel.prototype.heatCapacity = function () {
    var total = 0, self = this;
    Object.keys(this.amounts).forEach(function (id) {
      var sp = Sp.get(id);
      if (sp) total += self.amounts[id] * (sp.cp || 60);
    });
    return Math.max(1, total);
  };

  /* Release (negative dH) or absorb heat, in kJ. */
  Vessel.prototype.addHeat = function (kJ) {
    this.T += (kJ * 1000) / this.heatCapacity();
    if (this.T < 3) this.T = 3;
    /* Past about 3500 K the products start pulling themselves apart again, and
     * that dissociation soaks up any further energy. Real flames sit near here:
     * hydrogen in oxygen reaches ~3200 K, oxyacetylene ~3400 K. */
    if (this.T > MAX_FLAME_K) this.T = MAX_FLAME_K;
    if (this.T > (this.peakT || 0)) this.peakT = this.T;
  };

  /* ---------------------------------------------------------- dissolving -- */

  Vessel.prototype._dissolve = function (dt) {
    var self = this;
    var volume = this.waterLitres();
    if (volume < 1e-6) return;

    Object.keys(this.amounts).slice().forEach(function (id) {
      var sp = Sp.get(id);
      if (!sp || !sp.ions || sp.insoluble) return;
      /* A weak acid or base stays molecular — only a small equilibrium fraction
       * is ever ionised, and the pH solver accounts for that from its Ka. */
      if ((sp.pKa !== undefined && !sp.strongAcid) || (sp.pKb !== undefined && !sp.strongBase)) return;
      var n = self.amounts[id];
      if (n <= 1e-12) return;

      /* Sparingly soluble solids stop once the ion product reaches Ksp. */
      var portion = n;
      if (sp.ksp) {
        var q = 1, ok = true;
        Object.keys(sp.ions).forEach(function (ion) {
          if (ion === 'water') return;
          q *= Math.pow(self.conc(ion), sp.ions[ion]);
        });
        if (q >= sp.ksp) return;
        portion = Math.min(n, volume * 0.5 * dt);
      } else {
        portion = Math.min(n, n * 6 * dt + 1e-6);
      }

      self.amounts[id] -= portion;
      if (self.amounts[id] < 1e-12) delete self.amounts[id];
      Object.keys(sp.ions).forEach(function (ion) {
        self.amounts[ion] = (self.amounts[ion] || 0) + portion * sp.ions[ion];
      });

      /* Lattice energy versus hydration energy shows up as a temperature change. */
      var dh = enthalpyOfDissolution(sp);
      if (dh) self.addHeat(-dh * portion);
    });
  };

  function enthalpyOfDissolution(sp) {
    if (!sp.ions) return 0;
    var sum = 0;
    Object.keys(sp.ions).forEach(function (ion) {
      var isp = Sp.get(ion);
      if (isp) sum += isp.dHf * sp.ions[ion];
    });
    return sum - sp.dHf;
  }

  /* ------------------------------------------------------------------ pH -- */

  /* Solve the electroneutrality condition for [H+] by bisection. This handles
   * strong and weak acids and bases together, which the usual shortcuts do not. */
  Vessel.prototype.computePH = function () {
    var volume = this.waterLitres();
    if (volume < 1e-6) { this.pH = null; return null; }

    var strongAcid = this.conc('h+');
    var strongBase = this.conc('oh-');
    var weakAcids = [];
    var weakBases = [];
    var self = this;

    Object.keys(this.amounts).forEach(function (id) {
      var sp = Sp.get(id);
      if (!sp) return;
      var c = self.conc(id);
      if (c <= 0) return;
      if (sp.state === 'aq' || sp.state === 'l' || sp.state === 'g') {
        if (sp.pKa !== undefined && !sp.strongAcid && sp.cat === 'acid') {
          weakAcids.push({ c: c, ka: Math.pow(10, -sp.pKa) });
        }
        if (sp.pKb !== undefined) {
          weakBases.push({ c: c, kaConj: KW / Math.pow(10, -sp.pKb) });
        }
      }
    });
    /* Ions that are themselves acids or bases. The number is the pKa of the
     * conjugate acid of the pair. */
    Object.keys(ION_ACIDS).forEach(function (id) {
      var c = self.conc(id);
      if (c > 0) weakAcids.push({ c: c, ka: Math.pow(10, -ION_ACIDS[id]) });
    });
    Object.keys(ION_BASES).forEach(function (id) {
      var c = self.conc(id);
      if (c > 0) weakBases.push({ c: c, kaConj: Math.pow(10, -ION_BASES[id]) });
    });

    function f(h) {
      var v = h - KW / h + strongBase - strongAcid;
      weakAcids.forEach(function (a) { v -= a.c * a.ka / (a.ka + h); });
      weakBases.forEach(function (b) { v += b.c * h / (h + b.kaConj); });
      return v;
    }

    var lo = 1e-15, hi = 10;
    for (var i = 0; i < 80; i++) {
      var mid = Math.sqrt(lo * hi);
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    var h = Math.sqrt(lo * hi);
    this.pH = Math.max(-1, Math.min(15, -Math.log(h) / Math.LN10));
    return this.pH;
  };

  /* ------------------------------------------------- generic ion reactions -- */

  Vessel.prototype._neutralise = function (dt) {
    var volume = this.waterLitres();
    if (volume < 1e-6) return;
    var h = this.moles('h+'), oh = this.moles('oh-');
    if (h > 1e-12 && oh > 1e-12) {
      var extent = Math.min(h, oh);
      this.amounts['h+'] -= extent;
      this.amounts['oh-'] -= extent;
      this.amounts.water = (this.amounts.water || 0) + extent;
      cleanup(this.amounts);
      /* H+ + OH- -> H2O is -55.8 kJ/mol, the standard heat of neutralisation. */
      this.addHeat(55.8 * extent);
      this.discover('neutralisation', 'Neutralisation',
        'H⁺ + OH⁻ → H₂O, releasing 55.8 kJ for every mole of water formed. The same figure comes out of any strong acid with any strong base, because this is the only reaction actually happening.');
    }
  };

  /* Weak acids present as whole molecules, with the ion they leave behind. */
  Vessel.prototype._weakAcids = function () {
    var out = [], self = this;
    Object.keys(this.amounts).forEach(function (id) {
      var sp = Sp.get(id);
      if (!sp || sp.strongAcid || sp.pKa === undefined || !sp.ions) return;
      var conjugate = Object.keys(sp.ions).filter(function (i) { return i !== 'h+'; })[0];
      if (!conjugate) return;
      out.push({ id: id, sp: sp, conjugate: conjugate, pKa: sp.pKa, moles: self.amounts[id] });
    });
    return out;
  };

  /* Weak bases present as whole molecules, with the ion they become. */
  Vessel.prototype._weakBases = function () {
    var out = [], self = this;
    Object.keys(this.amounts).forEach(function (id) {
      var sp = Sp.get(id);
      if (!sp || sp.strongBase || sp.pKb === undefined || !sp.ions) return;
      var conjugate = Object.keys(sp.ions).filter(function (i) { return i !== 'oh-'; })[0];
      if (!conjugate) return;
      out.push({ id: id, sp: sp, conjugate: conjugate, moles: self.amounts[id] });
    });
    return out;
  };

  /* Carbonates and bicarbonates fizz with any acid — including a weak one, so
   * long as it is stronger than carbonic acid. Vinegar on baking soda is
   * exactly this, and it must not need free H+ to work. */
  Vessel.prototype._carbonateAcid = function (dt) {
    var volume = this.waterLitres();
    if (volume < 1e-6) return;
    var self = this;

    /* Proton sources, strongest first: free H+, then weak acids below pH 6.35. */
    var sources = [{ id: 'h+', conjugate: null, moles: this.moles('h+') }];
    this._weakAcids().forEach(function (a) {
      if (a.pKa < 6.35) sources.push(a);
    });

    [['co3-2', 2], ['hco3-', 1]].forEach(function (pair) {
      var id = pair[0], protons = pair[1];
      sources.forEach(function (src) {
        var carbonate = self.moles(id);
        var acid = self.moles(src.id);
        if (carbonate < 1e-12 || acid < 1e-12) return;

        var extent = Math.min(carbonate, acid / protons) * Math.min(1, 8 * dt);
        if (extent < 1e-12) return;

        self.amounts[id] -= extent;
        self.amounts[src.id] -= extent * protons;
        if (src.conjugate) {
          self.amounts[src.conjugate] = (self.amounts[src.conjugate] || 0) + extent * protons;
        }
        self.amounts.co2 = (self.amounts.co2 || 0) + extent;
        self.amounts.water = (self.amounts.water || 0) + extent;
        cleanup(self.amounts);
        self.addHeat(2.0 * extent);
        self.emitEffect('gas');
        self.discover('carbonate-acid', 'Carbonate and acid',
          'Any acid stronger than carbonic acid drives carbon dioxide out of a carbonate: ' +
          'CO₃²⁻ + 2H⁺ → H₂O + CO₂. It is the fizz when vinegar hits baking soda, and the ' +
          'standard test for a carbonate.');
      });
    });
  };

  /* A weak acid still gets neutralised by a strong base, and a weak base by a
   * strong acid — neither shows up in the free-ion balance, so both need
   * handling explicitly. */
  Vessel.prototype._weakNeutralisation = function (dt) {
    if (this.waterLitres() < 1e-6) return;
    var self = this;

    this._weakAcids().forEach(function (a) {
      var oh = self.moles('oh-');
      if (oh < 1e-12 || self.moles(a.id) < 1e-12) return;
      var extent = Math.min(self.moles(a.id), oh) * Math.min(1, 9 * dt);
      if (extent < 1e-12) return;
      self.amounts[a.id] -= extent;
      self.amounts['oh-'] -= extent;
      self.amounts[a.conjugate] = (self.amounts[a.conjugate] || 0) + extent;
      self.amounts.water = (self.amounts.water || 0) + extent;
      cleanup(self.amounts);
      var dh = (Sp.get(a.conjugate).dHf + Sp.get('water').dHf) - (a.sp.dHf + Sp.get('oh-').dHf);
      self.addHeat(-dh * extent);
      self.discover('weak-acid-base-' + a.id, a.sp.name + ' neutralised',
        a.sp.name + ' is a weak acid, but a strong base pulls its proton off anyway and ' +
        'leaves the ' + Sp.get(a.conjugate).name.toLowerCase() + ' behind. Titrating it gives a ' +
        'basic end point rather than a neutral one.');
    });

    this._weakBases().forEach(function (b) {
      var h = self.moles('h+');
      if (h < 1e-12 || self.moles(b.id) < 1e-12) return;
      var extent = Math.min(self.moles(b.id), h) * Math.min(1, 9 * dt);
      if (extent < 1e-12) return;
      self.amounts[b.id] -= extent;
      self.amounts['h+'] -= extent;
      self.amounts[b.conjugate] = (self.amounts[b.conjugate] || 0) + extent;
      cleanup(self.amounts);
      var dh2 = Sp.get(b.conjugate).dHf - (b.sp.dHf + Sp.get('h+').dHf);
      self.addHeat(-dh2 * extent);
      self.discover('weak-base-acid-' + b.id, b.sp.name + ' neutralised',
        b.sp.name + ' takes the proton from the acid to become ' +
        Sp.get(b.conjugate).formula + '. The resulting salt solution is mildly acidic, not neutral.');
    });
  };

  /* Precipitation whenever the ion product exceeds the solubility product. */
  Vessel.prototype._precipitate = function (dt) {
    var volume = this.waterLitres();
    if (volume < 1e-6) return;
    var self = this;

    Sp.precipitates.forEach(function (rule) {
      var solid = Sp.get(rule.solid);
      var stoich = solid.ions || {};
      var a = stoich[rule.cation] || 1;
      var b = stoich[rule.anion] || 1;
      var cc = self.conc(rule.cation), ca = self.conc(rule.anion);
      if (cc <= 0 || ca <= 0) return;
      var q = Math.pow(cc, a) * Math.pow(ca, b);
      var ksp = solid.ksp;
      if (!ksp || q <= ksp) return;

      /* Take out enough to move the ion product back toward Ksp. */
      var frac = 1 - Math.pow(ksp / q, 1 / (a + b));
      var extent = Math.min(self.moles(rule.cation) / a, self.moles(rule.anion) / b) * frac * Math.min(1, 6 * dt);
      if (extent < 1e-12) return;

      self.amounts[rule.cation] -= extent * a;
      self.amounts[rule.anion] -= extent * b;
      self.amounts[rule.solid] = (self.amounts[rule.solid] || 0) + extent;
      cleanup(self.amounts);

      var dh = solid.dHf - (Sp.get(rule.cation).dHf * a + Sp.get(rule.anion).dHf * b);
      self.addHeat(-dh * extent);
      self.emitEffect('precipitate', solid.color);
      self.discover('precip-' + rule.solid, 'Precipitation of ' + solid.name,
        solid.formula + ' has a solubility product of ' + ksp.toExponential(1) +
        '. Once the ions exceed that, it has no choice but to come out of solution.');
    });
  };

  /* Metals above hydrogen dissolve in acid; metals displace less reactive ions. */
  Vessel.prototype._displace = function (dt) {
    var self = this;
    var volume = this.waterLitres();

    Object.keys(this.amounts).forEach(function (metalId) {
      var info = METAL_IONS[metalId];
      if (!info) return;
      var metalMoles = self.moles(metalId);
      if (metalMoles < 1e-12) return;
      var rank = activityRank(metalId);

      /* Metal + acid -> salt + hydrogen. */
      if (volume > 1e-6 && rank < activityRank('h') && !EXPLICIT_WATER_METALS[metalId]) {
        var h = self.moles('h+');
        if (h > 1e-12) {
          var extent = Math.min(metalMoles, h / info.n) * Math.min(1, 2.5 * dt * (1 + (self.T - 298) / 60));
          if (extent > 1e-12) {
            self.amounts[metalId] -= extent;
            self.amounts['h+'] -= extent * info.n;
            self.amounts[info.ion] = (self.amounts[info.ion] || 0) + extent;
            self.amounts.h2 = (self.amounts.h2 || 0) + extent * info.n / 2;
            cleanup(self.amounts);
            var dh = Sp.get(info.ion).dHf - Sp.get(metalId).dHf;
            self.addHeat(-dh * extent);
            self.emitEffect('gas');
            self.discover('acid-' + metalId, Sp.get(metalId).name + ' in acid',
              Sp.get(metalId).name + ' sits above hydrogen in the activity series, so it pushes hydrogen out of the acid: ' +
              Sp.get(metalId).formula + ' + ' + info.n + 'H⁺ → ' + Sp.get(info.ion).formula + ' + ' + (info.n / 2) + 'H₂.');
          }
        }
      }

      /* Metal + ion of a less reactive metal -> displacement. */
      if (volume > 1e-6) {
        Object.keys(ION_METAL).forEach(function (ionId) {
          var otherMetal = ION_METAL[ionId];
          if (otherMetal === metalId) return;
          if (activityRank(otherMetal) <= rank) return;
          var ionMoles = self.moles(ionId);
          if (ionMoles < 1e-12) return;
          var otherN = METAL_IONS[otherMetal].n;
          var extent = Math.min(self.moles(metalId) / otherN, ionMoles / info.n) *
            Math.min(1, 1.6 * dt);
          if (extent < 1e-12) return;

          self.amounts[metalId] -= extent * otherN;
          self.amounts[ionId] -= extent * info.n;
          self.amounts[info.ion] = (self.amounts[info.ion] || 0) + extent * otherN;
          self.amounts[otherMetal] = (self.amounts[otherMetal] || 0) + extent * info.n;
          cleanup(self.amounts);

          var dh2 = (Sp.get(info.ion).dHf * otherN + Sp.get(otherMetal).dHf * info.n) -
            (Sp.get(metalId).dHf * otherN + Sp.get(ionId).dHf * info.n);
          self.addHeat(-dh2 * extent);
          self.emitEffect('deposit');
          self.discover('displace-' + metalId + '-' + otherMetal,
            Sp.get(metalId).name + ' displaces ' + Sp.get(otherMetal).name,
            Sp.get(metalId).name + ' is the more reactive metal, so it hands over its electrons and ' +
            Sp.get(otherMetal).name.toLowerCase() + ' plates out as the free metal.');
        });
      }
    });
  };

  /* Any carbon compound with no hand-written combustion still burns properly. */
  Vessel.prototype._genericCombustion = function (dt) {
    if (!this.isIgnited()) return;
    var o2 = this.moles('o2');
    if (o2 < 1e-9) return;
    var self = this;

    Object.keys(this.amounts).forEach(function (id) {
      if (EXPLICIT_FUELS[id] || id === 'o2' || id === 'water' || id === 'co2') return;
      var sp = Sp.get(id);
      if (!sp || sp.cat === 'ion' || sp.noStructure) return;
      var counts = atomsOf(id);
      var c = counts.C || 0, hAt = counts.H || 0, o = counts.O || 0, s = counts.S || 0, n = counts.N || 0;
      if (!c && !hAt) return;
      if (sp.cat === 'oxide' || sp.cat === 'salt' || sp.cat === 'precipitate') return;

      var o2Need = (2 * c + hAt / 2 + 2 * s - o) / 2;
      if (o2Need <= 0) return;

      var fuel = self.moles(id);
      var extent = Math.min(fuel, self.moles('o2') / o2Need) * Math.min(1, 3 * dt);
      if (extent < 1e-12) return;

      self.amounts[id] -= extent;
      self.amounts.o2 -= extent * o2Need;
      if (c) self.amounts.co2 = (self.amounts.co2 || 0) + extent * c;
      if (hAt) self.amounts.steam = (self.amounts.steam || 0) + extent * hAt / 2;
      if (s) self.amounts.so2 = (self.amounts.so2 || 0) + extent * s;
      if (n) self.amounts.n2 = (self.amounts.n2 || 0) + extent * n / 2;
      cleanup(self.amounts);

      var products = (c ? Sp.get('co2').dHf * c : 0) + (hAt ? Sp.get('steam').dHf * hAt / 2 : 0) +
        (s ? Sp.get('so2').dHf * s : 0);
      var dh = products - sp.dHf;
      self.addHeat(-dh * extent);
      self.emitEffect('flame');
      self.discover('burn-' + id, 'Combustion of ' + sp.name,
        sp.name + ' burns to carbon dioxide and water, giving out ' + Math.abs(dh).toFixed(0) +
        ' kJ for every mole burnt.');
    });
  };

  /* ----------------------------------------------------- named reactions -- */

  Vessel.prototype.isIgnited = function () {
    return this.time < this.igniteUntil || this.T > 873;
  };

  Vessel.prototype.hasCatalyst = function (id) {
    if (!id) return true;
    return this.moles(id) > 1e-12;
  };

  Vessel.prototype._namedReactions = function (dt) {
    var self = this;
    Rx.all.forEach(function (r) {
      var conditionNote = self._conditionsMet(r);
      if (!conditionNote.ok) return;

      /* Limiting reagent sets how far the reaction can go this tick. */
      var limit = Infinity;
      var possible = true;
      Object.keys(r.in).forEach(function (id) {
        var need = r.in[id];
        var have = self.moles(id);
        if (have < 1e-12) { possible = false; return; }
        limit = Math.min(limit, have / need);
      });
      if (!possible || !isFinite(limit) || limit <= 1e-12) return;

      var k = r.rate * conditionNote.factor * self._tempFactor(r);
      if (self.stirring) k *= 1.35;
      var extent = Math.min(limit, limit * k * dt);
      if (extent < 1e-13) return;

      /* Reversible reactions settle rather than running to completion. */
      if (r.reversible) {
        var productAmount = Object.keys(r.out).reduce(function (m, id) {
          return Math.min(m, self.moles(id) / r.out[id]);
        }, Infinity);
        if (productAmount > limit * 2.2) return;
      }

      Object.keys(r.in).forEach(function (id) {
        self.amounts[id] -= extent * r.in[id];
      });
      Object.keys(r.out).forEach(function (id) {
        self.amounts[id] = (self.amounts[id] || 0) + extent * r.out[id];
      });
      cleanup(self.amounts);

      /* An electrolysis is driven by the power supply, not by the solution's own
       * heat — it must not chill the beaker to pay for itself. */
      if (!(r.needs && r.needs.electricity)) self.addHeat(-enthalpyOf(r) * extent);
      r.effects.forEach(function (fx) { self.emitEffect(fx); });
      if (r.effects.indexOf('explosion') >= 0 && extent > 0.02) self.exploded = true;

      self.discover(r.id, r.name, r.note, r);
      self.lastReactions[r.id] = self.time;
    });
  };

  Vessel.prototype._conditionsMet = function (r) {
    var needs = r.needs || {};
    var factor = 1;

    if (needs.ignite && !this.isIgnited()) return { ok: false };
    if (needs.electricity && !this.electricity) return { ok: false };
    if (needs.light && !this.light) return { ok: false };
    if (needs.water && this.waterLitres() < 1e-6) return { ok: false };
    if (needs.catalyst && !this.hasCatalyst(needs.catalyst)) return { ok: false };
    /* An ignition source supplies the local heat itself — a magnesium fuse is
     * how you start thermite, and it does not need the whole vessel at 1000 °C. */
    var ignitionSupplies = needs.ignite && this.isIgnited();
    if (!ignitionSupplies && r.minT !== undefined && this.T < r.minT + 273.15 - 40) return { ok: false };
    if (r.maxT !== undefined && this.T > r.maxT + 273.15 + 60) return { ok: false };

    /* An optional catalyst simply makes it go faster. */
    if (r.catalysedBy) {
      var best = 1, self = this;
      Object.keys(r.catalysedBy).forEach(function (cat) {
        if (self.moles(cat) > 1e-12) best = Math.max(best, r.catalysedBy[cat]);
      });
      factor *= best;
    }
    if (needs.lowOxygen) {
      var fuel = 0, self2 = this;
      Object.keys(r.in).forEach(function (id) { if (id !== 'o2') fuel += self2.moles(id); });
      if (this.moles('o2') > fuel * 2) return { ok: false };
    }
    return { ok: true, factor: factor };
  };

  /* Smooth switch-on around the stated minimum temperature, then a modest
   * Arrhenius-style acceleration above it. */
  Vessel.prototype._tempFactor = function (r) {
    var minK = (r.minT !== undefined ? r.minT : 0) + 273.15;
    var gate = (r.needs && r.needs.ignite && this.isIgnited())
      ? 1
      : 1 / (1 + Math.exp((minK - this.T) / 12));
    var accel = Math.exp(Math.min(3.2, (this.T - AMBIENT_K) / 200));
    if (r.maxT !== undefined) {
      var maxK = r.maxT + 273.15;
      gate *= 1 / (1 + Math.exp((this.T - maxK) / 20));
    }
    return gate * accel;
  };

  function enthalpyOf(r) {
    var sum = function (side) {
      return Object.keys(side).reduce(function (s, id) {
        var sp = Sp.get(id);
        return s + (sp ? sp.dHf * side[id] : 0);
      }, 0);
    };
    return sum(r.out) - sum(r.in);
  }

  /* -------------------------------------------------------- phase changes -- */

  Vessel.prototype._phases = function (dt) {
    var self = this;
    var TC = this.T - 273.15;
    /* Water is the one we track through all three states. */
    if (TC >= 100 && this.moles('water') > 0) {
      var boiled = Math.min(this.moles('water'), this.moles('water') * 2 * dt + 0.001);
      this.amounts.water -= boiled;
      this.amounts.steam = (this.amounts.steam || 0) + boiled;
      this.addHeat(-40.7 * boiled);          /* latent heat of vaporisation */
      cleanup(this.amounts);
      this.emitEffect('steam');
    } else if (TC < 100 && this.moles('steam') > 0 && this.moles('steam') > 1e-9) {
      var condensed = Math.min(this.moles('steam'), this.moles('steam') * 1.2 * dt);
      this.amounts.steam -= condensed;
      this.amounts.water = (this.amounts.water || 0) + condensed;
      this.addHeat(40.7 * condensed);
      cleanup(this.amounts);
    }
    if (TC <= 0 && this.moles('water') > 0) {
      var frozen = Math.min(this.moles('water'), this.moles('water') * 1.5 * dt);
      this.amounts.water -= frozen;
      this.amounts.ice = (this.amounts.ice || 0) + frozen;
      this.addHeat(6.0 * frozen);
      cleanup(this.amounts);
    } else if (TC > 0 && this.moles('ice') > 0) {
      var melted = Math.min(this.moles('ice'), this.moles('ice') * 1.5 * dt);
      this.amounts.ice -= melted;
      this.amounts.water = (this.amounts.water || 0) + melted;
      this.addHeat(-6.0 * melted);
      cleanup(this.amounts);
    }
  };

  /* ------------------------------------------------------------- effects -- */

  Vessel.prototype.emitEffect = function (kind, colour) {
    this.events.push({ kind: 'effect', effect: kind, colour: colour, t: this.time });
  };

  Vessel.prototype.discover = function (id, title, note, reaction) {
    if (this.discovered[id]) return;
    this.discovered[id] = { id: id, title: title, note: note, t: this.time, reaction: reaction || null };
    this.emit('reaction', title, { discovery: id, note: note });
  };

  /* ---------------------------------------------------------------- tick -- */

  Vessel.prototype.tick = function (dt) {
    dt = Math.min(dt, 0.1);
    this.time += dt;

    this._dissolve(dt);
    this._namedReactions(dt);
    this._genericCombustion(dt);
    this._neutralise(dt);
    this._weakNeutralisation(dt);
    this._carbonateAcid(dt);
    this._precipitate(dt);
    this._displace(dt);
    this._phases(dt);
    this.computePH();

    /* Heat exchange with the surroundings, plus whatever the burner supplies. */
    var C = this.heatCapacity();
    if (this.heater) {
      var drive = (this.heater - this.T);
      this.T += Math.sign(drive) * Math.min(Math.abs(drive), 900 * dt * (600 / C + 0.25));
    }
    /* Newton cooling to the room, plus a radiative term that only matters once
     * things are glowing — which is what makes a flame die back so quickly. */
    var loss = 2.5 * (this.T - AMBIENT_K) * dt / Math.max(30, C);
    var rad = 0.6 * (Math.pow(this.T / 1000, 4) - Math.pow(AMBIENT_K / 1000, 4)) * 1000 * dt / Math.max(30, C);
    this.T -= loss + Math.max(0, rad);
    if (this.T < AMBIENT_K && !this.heater) this.T = Math.max(this.T, AMBIENT_K - 80);
    if (this.T > (this.peakT || 0)) this.peakT = this.T;

    return this.takeEvents();
  };

  /* --------------------------------------------------------- description -- */

  /* Everything the UI needs to describe the vessel right now. */
  Vessel.prototype.snapshot = function () {
    var self = this;
    var contents = Object.keys(this.amounts)
      .filter(function (id) { return self.amounts[id] > 1e-9; })
      .map(function (id) {
        var sp = Sp.get(id);
        return {
          id: id, species: sp, moles: self.amounts[id],
          grams: self.amounts[id] * massOf(id),
          conc: self.conc(id)
        };
      })
      .sort(function (a, b) { return b.moles - a.moles; });

    return {
      contents: contents,
      T: this.T,
      TC: this.T - 273.15,
      pH: this.pH,
      volume: this.waterLitres(),
      gasMoles: contents.reduce(function (s, c) {
        return s + (c.species && c.species.state === 'g' ? c.moles : 0);
      }, 0),
      solidMoles: contents.reduce(function (s, c) {
        return s + (c.species && c.species.state === 's' ? c.moles : 0);
      }, 0),
      solutionColour: this.solutionColour(contents),
      discovered: this.discovered
    };
  };

  var massCache = {};
  function massOf(id) {
    if (massCache[id] !== undefined) return massCache[id];
    var sp = Sp.get(id);
    var m = 0;
    if (sp && !sp.noStructure) {
      try { m = St.build(sp.smiles).mass; } catch (e) { m = 0; }
    }
    massCache[id] = m;
    return m;
  }

  /* Blend the colours of everything dissolved, weighted by concentration. */
  Vessel.prototype.solutionColour = function (contents) {
    var volume = this.waterLitres();
    if (volume < 1e-6) return null;
    var r = 0, g = 0, b = 0, weight = 0;
    contents.forEach(function (c) {
      if (!c.species || !c.species.color) return;
      if (c.species.state !== 'aq' && c.species.cat !== 'ion') return;
      var strength = Math.min(1, c.conc / 0.5);
      var rgb = hexToRgb(c.species.color);
      r += rgb[0] * strength; g += rgb[1] * strength; b += rgb[2] * strength;
      weight += strength;
    });
    if (weight < 0.01) return null;
    return { r: r / weight, g: g / weight, b: b / weight, strength: Math.min(1, weight) };
  };

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function cleanup(amounts) {
    Object.keys(amounts).forEach(function (id) {
      if (!(amounts[id] > 1e-12)) delete amounts[id];
    });
  }

  function fmt(n) {
    if (n >= 100) return n.toFixed(0);
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.001) return n.toFixed(3);
    return n.toExponential(1);
  }

  global.Chem.Vessel = Vessel;
  global.Chem.enthalpyOf = enthalpyOf;
  global.Chem.massOf = massOf;
  global.Chem.fmtMoles = fmt;
})(window);
