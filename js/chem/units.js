/* Clemistry — amounts in the units a chemist actually uses.
 *
 * The simulation works in moles, because that is what stoichiometry needs, but
 * nobody weighs out moles. This module converts between moles, grams and
 * millilitres so solids can be handled by mass, liquids by volume, and gases by
 * mass or by volume.
 *
 * Pouring an aqueous reagent adds its water too — 50 mL of bench hydrochloric
 * acid is mostly water, and the dilution matters to the pH. The strength and
 * the density of each bench solution live together on the species, so the pair
 * always describes the same liquid.
 */
(function (global) {
  'use strict';

  var Sp = global.Chem.Species;
  var St = global.Chem.Structure;

  var R_GAS = 8.314;
  var ATM = 101325;
  var ROOM_K = 298.15;
  var WATER_MM = 18.015;

  var massCache = {};

  /* Grams per mole. Zero means the species has no structure to weigh — yeast is
   * the one such entry — and every caller has to cope rather than divide by it. */
  function molarMass(id) {
    if (massCache[id] !== undefined) return massCache[id];
    var sp = Sp.get(id);
    var m = 0;
    if (sp && !sp.noStructure) {
      try { m = St.build(sp.smiles).mass; } catch (e) { m = 0; }
    }
    massCache[id] = m;
    return m;
  }

  function hasMass(id) { return molarMass(id) > 0; }

  function grams(id, moles) { return moles * molarMass(id); }

  function molesFromGrams(id, g) {
    var mm = molarMass(id);
    return mm > 0 ? g / mm : 0;
  }

  /* Volume of a condensed phase, in millilitres. Null when we cannot say. */
  function millilitres(id, moles) {
    var sp = Sp.get(id);
    if (!sp || !sp.density || !hasMass(id)) return null;
    return grams(id, moles) / sp.density;
  }

  /* Ideal gas, in litres. Defaults to room temperature; the vessel passes its
   * own so the beaker and the contents list quote the same figure. */
  function litresGas(moles, kelvin) {
    return moles * R_GAS * (kelvin || ROOM_K) / ATM * 1000;
  }

  var GAS_MOLAR_VOLUME = litresGas(1);

  /* The molarity of the bench solution, if this reagent is one. */
  function benchConcentration(spOrId) {
    var sp = typeof spOrId === 'string' ? Sp.get(spOrId) : spOrId;
    return sp && sp.bench ? sp.bench : null;
  }

  /* What you would reach for to measure this out. */
  function inputUnit(sp) {
    if (!sp) return 'g';
    /* Nothing without a molar mass can be weighed; count it out instead. */
    if (!hasMass(sp.id)) return 'mol';
    return (sp.state === 'l' || sp.state === 'aq') ? 'mL' : 'g';
  }

  /* A sensible quantity to start from for each kind of reagent. The shelf sets
   * the amount control to this when you select a substance, which is what keeps
   * a solvent and a solute in a sane ratio: one litre of water against ten
   * grams of salt is 0.17 M, where ten millilitres of water would be 17 M. */
  function defaultAmount(sp) {
    if (!sp) return { value: 10, unit: 'g' };
    if (!hasMass(sp.id)) return { value: 0.05, unit: 'mol' };
    if (sp.solvent) return { value: 1000, unit: 'mL' };
    if (sp.state === 'g') return { value: 1, unit: 'L' };
    if (sp.state === 'l' || sp.state === 'aq') return { value: 25, unit: 'mL' };
    if (sp.catalyst) return { value: 2, unit: 'g' };
    return { value: 10, unit: 'g' };
  }

  /* Turn a measured amount into moles of the substance itself. For a bench
   * solution this also reports the water that comes with it. */
  function toMoles(sp, value, unit) {
    var none = { moles: 0, water: 0 };
    if (!sp || !isFinite(value) || !(value > 0)) return none;

    if (unit === 'mol') return { moles: value, water: 0 };
    if (unit === 'g') return { moles: molesFromGrams(sp.id, value), water: 0 };
    if (unit === 'L') return { moles: value / GAS_MOLAR_VOLUME, water: 0 };

    if (unit === 'mL') {
      var conc = benchConcentration(sp);
      if (conc) {
        /* A bench solution: solute by concentration, the rest is water. */
        var solute = value / 1000 * conc;
        var totalMass = value * (sp.density || 1.0);
        var waterMoles = Math.max(0, (totalMass - grams(sp.id, solute)) / WATER_MM);
        return { moles: solute, water: waterMoles };
      }
      if (sp.solvent) return { moles: value * (sp.density || 1) / WATER_MM, water: 0 };
      if (sp.density && hasMass(sp.id)) {
        return { moles: molesFromGrams(sp.id, value * sp.density), water: 0 };
      }
      if (sp.state === 'g') return { moles: value / 1000 / GAS_MOLAR_VOLUME, water: 0 };
      return none;
    }

    return none;
  }

  function round(v) {
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1000) return v.toFixed(0);
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    if (a >= 0.01) return v.toFixed(3);
    if (a === 0) return '0';
    return v.toExponential(1);
  }

  /* How an amount should be written in the vessel list: mass for solids and
   * gases, volume for liquids, with the amount in moles alongside. */
  function describe(sp, moles, kelvin) {
    if (!sp || !hasMass(sp.id)) {
      return { primary: round(moles) + ' mol', secondary: '' };
    }

    var g = grams(sp.id, moles);

    if (sp.state === 'l') {
      var mL = millilitres(sp.id, moles);
      if (mL !== null) {
        return { primary: round(mL) + ' mL', secondary: round(g) + ' g · ' + round(moles) + ' mol' };
      }
    }

    if (sp.state === 'g') {
      return {
        primary: round(g) + ' g',
        secondary: round(litresGas(moles, kelvin)) + ' L · ' + round(moles) + ' mol'
      };
    }

    /* Solids, and anything dissolved. */
    return { primary: round(g) + ' g', secondary: round(moles) + ' mol' };
  }

  global.Chem.Units = {
    molarMass: molarMass,
    hasMass: hasMass,
    grams: grams,
    molesFromGrams: molesFromGrams,
    millilitres: millilitres,
    litresGas: litresGas,
    gasMolarVolume: GAS_MOLAR_VOLUME,
    roomKelvin: ROOM_K,
    benchConcentration: benchConcentration,
    inputUnit: inputUnit,
    defaultAmount: defaultAmount,
    toMoles: toMoles,
    describe: describe,
    round: round
  };
})(window);
