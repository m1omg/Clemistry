/* Clemistry — amounts in the units a chemist actually uses.
 *
 * The simulation works in moles, because that is what stoichiometry needs, but
 * nobody weighs out moles. This module converts between moles, grams and
 * millilitres so solids can be handled by mass, liquids by volume, and gases by
 * mass or by volume at room temperature.
 *
 * Pouring an aqueous reagent adds its water too — 50 mL of bench hydrochloric
 * acid is mostly water, and the dilution matters to the pH.
 */
(function (global) {
  'use strict';

  var Sp = global.Chem.Species;
  var St = global.Chem.Structure;

  /* Molar volume of an ideal gas at 25 °C and 1 atm, in litres per mole. */
  var GAS_MOLAR_VOLUME = 8.314 * 298.15 / 101325 * 1000;   /* 24.47 L/mol */
  var WATER_MM = 18.015;

  /* Concentrations of the bench solutions, mol/L. Pouring one of these adds
   * solute and water in the right proportion. */
  var BENCH = {
    hcl: 2.0, hno3: 2.0, hbr: 1.0, hi: 1.0, hf: 1.0, h3po4: 1.0,
    hcn: 1.0, h2so3: 0.5, hocl: 0.1, h2co3: 0.03, cahco32: 0.05,
    naocl: 0.70, nh4oh: 2.0
  };

  var massCache = {};

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

  function grams(id, moles) { return moles * molarMass(id); }
  function molesFromGrams(id, g) {
    var mm = molarMass(id);
    return mm > 0 ? g / mm : 0;
  }

  /* Volume of a condensed phase, in millilitres. */
  function millilitres(id, moles) {
    var sp = Sp.get(id);
    if (!sp || !sp.density) return null;
    return grams(id, moles) / sp.density;
  }

  function litresGas(moles) { return moles * GAS_MOLAR_VOLUME / 1; }

  function benchConcentration(id) { return BENCH[id] || null; }

  /* What you would reach for to measure this out. */
  function inputUnit(sp) {
    if (!sp) return 'g';
    if (sp.state === 'l' || sp.state === 'aq') return 'mL';
    if (sp.state === 'g') return 'g';
    return 'g';
  }

  /* Turn a measured amount into moles of the substance itself. For a bench
   * solution this also reports the water that comes with it. */
  function toMoles(sp, value, unit) {
    if (!sp || !(value > 0)) return { moles: 0, water: 0 };

    if (unit === 'mol') return { moles: value, water: 0 };

    if (unit === 'g') {
      return { moles: molesFromGrams(sp.id, value), water: 0 };
    }

    if (unit === 'L') {
      /* Gas volume at room temperature. */
      return { moles: value / GAS_MOLAR_VOLUME, water: 0 };
    }

    if (unit === 'mL') {
      var conc = benchConcentration(sp.id);
      if (conc) {
        /* A bench solution: solute by concentration, the rest is water. */
        var solute = value / 1000 * conc;
        var totalMass = value * (sp.density || 1.0);
        var soluteMass = grams(sp.id, solute);
        var waterMoles = Math.max(0, (totalMass - soluteMass) / WATER_MM);
        return { moles: solute, water: waterMoles };
      }
      if (sp.solvent) {
        /* Water itself. */
        return { moles: value * (sp.density || 1) / WATER_MM, water: 0 };
      }
      if (sp.density) {
        return { moles: molesFromGrams(sp.id, value * sp.density), water: 0 };
      }
      if (sp.state === 'g') {
        return { moles: value / 1000 / GAS_MOLAR_VOLUME, water: 0 };
      }
      return { moles: 0, water: 0 };
    }

    return { moles: value, water: 0 };
  }

  function round(v) {
    if (!isFinite(v)) return '0';
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
  function describe(sp, moles) {
    if (!sp) return { primary: round(moles) + ' mol', secondary: '' };

    var g = grams(sp.id, moles);

    if (sp.state === 'l' && sp.density) {
      return {
        primary: round(g / sp.density) + ' mL',
        secondary: round(g) + ' g · ' + round(moles) + ' mol'
      };
    }

    if (sp.state === 'g') {
      return {
        primary: round(g) + ' g',
        secondary: round(litresGas(moles)) + ' L · ' + round(moles) + ' mol'
      };
    }

    /* Solids, and anything dissolved. */
    return {
      primary: round(g) + ' g',
      secondary: round(moles) + ' mol'
    };
  }

  global.Chem.Units = {
    molarMass: molarMass,
    grams: grams,
    molesFromGrams: molesFromGrams,
    millilitres: millilitres,
    litresGas: litresGas,
    gasMolarVolume: GAS_MOLAR_VOLUME,
    benchConcentration: benchConcentration,
    bench: BENCH,
    inputUnit: inputUnit,
    toMoles: toMoles,
    describe: describe,
    round: round
  };
})(window);
