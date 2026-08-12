/* Clemistry — named reactions.
 *
 * Enthalpies are not stored here: the engine works out ΔH from the standard
 * enthalpies of formation of everything on each side, so the energy released is
 * whatever the thermochemistry actually says it is.
 *
 *   in / out   balanced stoichiometric coefficients
 *   minT       lowest temperature (°C) at which it goes at a useful rate
 *   needs      catalyst id, or ignite / spark / light / electricity / water
 *   rate       relative rate constant
 *   effects    what the vessel should show: gas, flame, smoke, precipitate…
 */
(function (global) {
  'use strict';

  var LIST = [];

  function R(def) {
    if (!def.rate) def.rate = 1;
    if (!def.needs) def.needs = {};
    if (!def.effects) def.effects = [];
    LIST.push(def);
    return def;
  }

  /* ========================================================== combustion == */

  R({ id: 'h2-o2', name: 'Combustion of hydrogen', type: 'combustion',
      in: { h2: 2, o2: 1 }, out: { steam: 2 }, needs: { ignite: true }, rate: 40,
      effects: ['flame', 'explosion'],
      note: 'The classic squeaky pop. A 2:1 mixture of hydrogen and oxygen detonates rather than simply burning.' });

  R({ id: 'ch4-o2', name: 'Combustion of methane', type: 'combustion',
      in: { ch4: 1, o2: 2 }, out: { co2: 1, steam: 2 }, needs: { ignite: true }, rate: 12,
      effects: ['flame'],
      note: 'A clean blue flame when oxygen is plentiful. Starve it of air and you get soot and carbon monoxide instead.' });

  R({ id: 'ch4-o2-lean', name: 'Incomplete combustion of methane', type: 'combustion',
      in: { ch4: 2, o2: 3 }, out: { co: 2, steam: 4 }, needs: { ignite: true, lowOxygen: true }, rate: 8,
      effects: ['flame', 'smoke'],
      note: 'With too little oxygen the carbon only gets halfway to carbon dioxide. This is how faulty heaters kill.' });

  R({ id: 'c-o2', name: 'Combustion of carbon', type: 'combustion',
      in: { c: 1, o2: 1 }, out: { co2: 1 }, needs: { ignite: true }, minT: 400, rate: 4,
      effects: ['flame'], note: 'Charcoal burning. Glows rather than flames, because the fuel is a solid.' });

  R({ id: 's8-o2', name: 'Combustion of sulfur', type: 'combustion',
      in: { s8: 1, o2: 8 }, out: { so2: 8 }, needs: { ignite: true }, minT: 250, rate: 6,
      effects: ['flame'], note: 'Sulfur burns with an eerie blue flame and a choking smell of sulfur dioxide.' });

  R({ id: 'p4-o2', name: 'Combustion of white phosphorus', type: 'combustion',
      in: { p4: 1, o2: 5 }, out: { p4o10: 1 }, minT: 30, rate: 20,
      effects: ['flame', 'smoke'],
      note: 'White phosphorus needs no ignition at all — it catches fire in air on its own, throwing off dense white smoke.' });

  R({ id: 'mg-o2', name: 'Combustion of magnesium', type: 'combustion',
      in: { mg: 2, o2: 1 }, out: { mgo: 2 }, needs: { ignite: true }, minT: 450, rate: 15,
      effects: ['flame', 'brightLight'],
      note: 'A blinding white light. Do not look straight at it — magnesium flames are rich in ultraviolet.' });

  R({ id: 'al-o2', name: 'Combustion of aluminium', type: 'combustion',
      in: { al: 4, o2: 3 }, out: { al2o3: 2 }, needs: { ignite: true }, minT: 700, rate: 8,
      effects: ['flame', 'brightLight'],
      note: 'Bulk aluminium is protected by its oxide film; as a powder it burns fiercely.' });

  R({ id: 'fe-o2', name: 'Rusting of iron', type: 'corrosion',
      in: { fe: 4, o2: 3 }, out: { fe2o3: 2 }, needs: { water: true }, rate: 0.04,
      effects: ['colour'],
      note: 'Slow electrochemical corrosion. It needs both oxygen and water — iron stays bright in either alone.' });

  R({ id: 'etoh-o2', name: 'Combustion of ethanol', type: 'combustion',
      in: { c2h5oh: 1, o2: 3 }, out: { co2: 2, steam: 3 }, needs: { ignite: true }, rate: 10,
      effects: ['flame'], note: 'Burns with a pale, almost invisible blue flame.' });

  R({ id: 'c2h2-o2', name: 'Oxyacetylene combustion', type: 'combustion',
      in: { c2h2: 2, o2: 5 }, out: { co2: 4, steam: 2 }, needs: { ignite: true }, rate: 25,
      effects: ['flame', 'brightLight'],
      note: 'Acetylene stores a great deal of energy in its triple bond. Burnt in pure oxygen the flame passes 3000 °C — hot enough to cut steel.' });

  R({ id: 'octane-o2', name: 'Combustion of octane', type: 'combustion',
      in: { c8h18: 2, o2: 25 }, out: { co2: 16, steam: 18 }, needs: { ignite: true }, rate: 9,
      effects: ['flame'], note: 'Petrol burning. Two molecules of fuel need twenty-five of oxygen.' });

  R({ id: 'glucose-o2', name: 'Combustion of glucose', type: 'combustion',
      in: { glucose: 1, o2: 6 }, out: { co2: 6, steam: 6 }, needs: { ignite: true }, minT: 200, rate: 5,
      effects: ['flame'],
      note: 'Exactly the reaction your cells run, only they do it in twenty careful steps instead of one violent one.' });

  /* ======================================================= metal + water == */

  R({ id: 'na-water', name: 'Sodium in water', type: 'displacement',
      in: { na: 2, water: 2 }, out: { naoh: 2, h2: 1 }, rate: 30,
      effects: ['gas', 'flame', 'fizz'],
      note: 'The sodium melts into a ball from its own reaction heat and skates about on the hydrogen it is making. Usually the hydrogen ignites.' });

  R({ id: 'k-water', name: 'Potassium in water', type: 'displacement',
      in: { k: 2, water: 2 }, out: { koh: 2, h2: 1 }, rate: 60,
      effects: ['gas', 'flame', 'fizz', 'explosion'],
      note: 'More violent than sodium: the hydrogen always ignites, burning lilac from the potassium.' });

  R({ id: 'li-water', name: 'Lithium in water', type: 'displacement',
      in: { li: 2, water: 2 }, out: { lioh: 2, h2: 1 }, rate: 12,
      effects: ['gas', 'fizz'],
      note: 'Steady fizzing rather than drama — lithium is the least violent of the alkali metals in water.' });

  R({ id: 'ca-water', name: 'Calcium in water', type: 'displacement',
      in: { ca: 1, water: 2 }, out: { caoh2: 1, h2: 1 }, rate: 6,
      effects: ['gas', 'fizz'],
      note: 'Fizzes steadily and clouds the water as the barely-soluble calcium hydroxide forms.' });

  R({ id: 'cac2-water', name: 'Calcium carbide and water', type: 'displacement',
      in: { cac2: 1, water: 2 }, out: { caoh2: 1, c2h2: 1 }, rate: 20,
      effects: ['gas', 'fizz'],
      note: 'Gives off acetylene on contact. This is how miners’ carbide lamps made their own fuel.' });

  /* ====================================================== synthesis etc. == */

  R({ id: 'haber', name: 'Haber process', type: 'synthesis',
      in: { n2: 1, h2: 3 }, out: { nh3: 2 }, minT: 400, needs: { catalyst: 'fe' }, rate: 1.2,
      reversible: true,
      note: 'Breaking the N≡N triple bond needs iron, 450 °C and 200 atmospheres. It feeds roughly half the people alive.' });

  R({ id: 'contact', name: 'Contact process', type: 'synthesis',
      in: { so2: 2, o2: 1 }, out: { so3: 2 }, minT: 400, needs: { catalyst: 'v2o5' }, rate: 2,
      reversible: true,
      note: 'The middle step in making sulfuric acid — the largest-tonnage chemical in the world.' });

  R({ id: 'so3-water', name: 'Sulfur trioxide in water', type: 'synthesis',
      in: { so3: 1, water: 1 }, out: { h2so4: 1 }, rate: 25,
      effects: ['smoke', 'heat'],
      note: 'So violently exothermic that in industry it is absorbed into existing acid rather than into water.' });

  R({ id: 'h2-cl2', name: 'Hydrogen and chlorine', type: 'synthesis',
      in: { h2: 1, cl2: 1 }, out: { hcl_g: 2 }, needs: { light: true }, rate: 30,
      effects: ['flame', 'explosion'],
      note: 'A radical chain reaction. In the dark nothing happens; in bright light the mixture explodes.' });

  R({ id: 'na-cl2', name: 'Sodium and chlorine', type: 'synthesis',
      in: { na: 2, cl2: 1 }, out: { nacl: 2 }, needs: { ignite: true }, rate: 18,
      effects: ['flame', 'brightLight'],
      note: 'A soft reactive metal and a poisonous gas combining into something you eat every day.' });

  R({ id: 'n2-o2', name: 'Nitrogen fixation by heat', type: 'synthesis',
      in: { n2: 1, o2: 1 }, out: { no: 2 }, minT: 2000, rate: 0.8,
      note: 'Endothermic and only worth it at flame or lightning temperatures. It is why engines produce NOx.' });

  R({ id: 'no-o2', name: 'Oxidation of nitric oxide', type: 'synthesis',
      in: { no: 2, o2: 1 }, out: { no2: 2 }, rate: 8, effects: ['colour'],
      note: 'Instant on contact with air: colourless NO turns brown the moment it leaves the flask.' });

  R({ id: 'no2-dimer', name: 'Dimerisation of nitrogen dioxide', type: 'equilibrium',
      in: { no2: 2 }, out: { n2o4: 1 }, maxT: 60, rate: 4, reversible: true, effects: ['colour'],
      note: 'Cool it and the brown fades as the molecules pair up; warm it and the colour comes back.' });

  R({ id: 'cao-water', name: 'Slaking of lime', type: 'synthesis',
      in: { cao: 1, water: 1 }, out: { caoh2: 1 }, rate: 15, effects: ['heat', 'steam'],
      note: 'Quicklime and water give out so much heat that the mixture hisses and steams.' });

  R({ id: 'co2-water', name: 'Carbon dioxide dissolving', type: 'equilibrium',
      in: { co2: 1, water: 1 }, out: { h2co3: 1 }, rate: 0.6, reversible: true,
      note: 'Only a small fraction actually becomes carbonic acid, but it is enough to make rainwater mildly acidic.' });

  R({ id: 'nh3-hcl', name: 'Ammonia meets hydrogen chloride', type: 'synthesis',
      in: { nh3: 1, hcl_g: 1 }, out: { nh4cl: 1 }, rate: 30, effects: ['smoke'],
      note: 'Two colourless gases meeting in mid-air to make a ring of white smoke. A classic diffusion demonstration.' });

  /* ===================================================== decomposition == */

  R({ id: 'h2o2-decomp', name: 'Decomposition of hydrogen peroxide', type: 'decomposition',
      in: { h2o2: 2 }, out: { water: 2, o2: 1 }, rate: 0.006, catalysedBy: { mno2: 90, ki: 60, fe2o3: 20 },
      effects: ['gas', 'fizz', 'foam'],
      note: 'It falls apart slowly on its own. Add manganese dioxide and it erupts — the catalyst is untouched at the end.' });

  R({ id: 'caco3-decomp', name: 'Calcination of limestone', type: 'decomposition',
      in: { caco3: 1 }, out: { cao: 1, co2: 1 }, minT: 825, rate: 3, effects: ['gas'],
      note: 'Roasting limestone drives out carbon dioxide and leaves quicklime. One of the oldest industrial processes there is.' });

  R({ id: 'nahco3-decomp', name: 'Baking soda on heating', type: 'decomposition',
      in: { nahco3: 2 }, out: { na2co3: 1, water: 1, co2: 1 }, minT: 80, rate: 4,
      effects: ['gas', 'fizz'],
      note: 'The carbon dioxide released is what lifts a cake.' });

  R({ id: 'kclo3-decomp', name: 'Decomposition of potassium chlorate', type: 'decomposition',
      in: { kclo3: 2 }, out: { kcl: 2, o2: 3 }, minT: 400, rate: 3,
      catalysedBy: { mno2: 12 }, effects: ['gas'],
      note: 'A convenient laboratory source of oxygen. Manganese dioxide drops the temperature it needs by a couple of hundred degrees.' });

  R({ id: 'nan3-decomp', name: 'Airbag reaction', type: 'decomposition',
      in: { nan3: 2 }, out: { na: 2, n2: 3 }, minT: 300, rate: 200,
      effects: ['gas', 'explosion'],
      note: 'Two grams of azide become a litre of nitrogen in about thirty milliseconds.' });

  R({ id: 'nh4no3-decomp', name: 'Ammonium nitrate on gentle heating', type: 'decomposition',
      in: { nh4no3: 1 }, out: { n2o: 1, steam: 2 }, minT: 200, maxT: 300, rate: 2,
      effects: ['gas'], note: 'Below about 300 °C it decomposes politely to nitrous oxide and steam.' });

  R({ id: 'nh4no3-detonate', name: 'Detonation of ammonium nitrate', type: 'decomposition',
      in: { nh4no3: 2 }, out: { n2: 2, o2: 1, steam: 4 }, minT: 300, rate: 400,
      effects: ['explosion', 'gas'],
      note: 'Heated hard or confined, it goes over to a genuine detonation. This is the reaction behind several of the largest accidental explosions on record.' });

  R({ id: 'h2co3-decomp', name: 'Carbonic acid falling apart', type: 'decomposition',
      in: { h2co3: 1 }, out: { water: 1, co2: 1 }, rate: 3, effects: ['gas', 'fizz'],
      note: 'It cannot be isolated — open a fizzy drink and this is the reaction you hear.' });

  R({ id: 'electrolysis', name: 'Electrolysis of water', type: 'decomposition',
      in: { water: 2 }, out: { h2: 2, o2: 1 }, needs: { electricity: true }, rate: 0.12,
      effects: ['gas', 'fizz'],
      note: 'Twice as much hydrogen as oxygen by volume, which is how the formula H₂O was first pinned down.' });

  R({ id: 'ag2o-decomp', name: 'Silver oxide on heating', type: 'decomposition',
      in: { agno3: 2 }, out: { ag: 2, no2: 2, o2: 1 }, minT: 440, rate: 2,
      effects: ['gas', 'colour'],
      note: 'Silver nitrate breaks down to metallic silver, brown nitrogen dioxide and oxygen.' });

  /* ================================================ displacement & redox == */

  R({ id: 'thermite', name: 'Thermite reaction', type: 'redox',
      in: { al: 2, fe2o3: 1 }, out: { al2o3: 1, fe: 2 }, needs: { ignite: true }, minT: 1000, rate: 30,
      effects: ['flame', 'brightLight', 'sparks'],
      note: 'Aluminium wants oxygen more than iron does. The temperature reaches about 2500 °C and the iron comes out molten.' });

  R({ id: 'zn-cuso4', name: 'Zinc displacing copper', type: 'displacement',
      in: { zn: 1, cuso4: 1 }, out: { znso4: 1, cu: 1 }, needs: { water: true }, rate: 3,
      effects: ['colour', 'deposit'],
      note: 'The blue drains out of the solution as copper plates onto the zinc. Zinc sits above copper in the activity series.' });

  R({ id: 'fe-cuso4', name: 'Iron displacing copper', type: 'displacement',
      in: { fe: 1, cuso4: 1 }, out: { feso4: 1, cu: 1 }, needs: { water: true }, rate: 1.5,
      effects: ['colour', 'deposit'],
      note: 'An iron nail left in copper sulfate comes out coated in bright copper.' });

  R({ id: 'cu-agno3', name: 'Copper displacing silver', type: 'displacement',
      in: { cu: 1, agno3: 2 }, out: { cuno32: 1, ag: 2 }, needs: { water: true }, rate: 1.2,
      effects: ['colour', 'deposit'],
      note: 'Silver grows on the copper as glittering crystals while the solution turns blue.' });

  R({ id: 'mg-co2', name: 'Magnesium burning in carbon dioxide', type: 'redox',
      in: { mg: 2, co2: 1 }, out: { mgo: 2, c: 1 }, needs: { ignite: true }, minT: 600, rate: 10,
      effects: ['flame', 'brightLight', 'smoke'],
      note: 'Magnesium tears the oxygen out of carbon dioxide and keeps burning, leaving black specks of carbon. A CO₂ extinguisher makes a magnesium fire worse.' });

  R({ id: 'cu-hno3-conc', name: 'Copper in concentrated nitric acid', type: 'redox',
      in: { cu: 1, hno3: 4 }, out: { cuno32: 1, no2: 2, water: 2 }, rate: 6,
      effects: ['gas', 'colour'],
      note: 'Ordinary acids cannot touch copper. Nitric acid can, because it is the nitrogen that does the oxidising, not the hydrogen — hence the brown fumes rather than hydrogen.' });

  R({ id: 'cu-h2so4-hot', name: 'Copper in hot concentrated sulfuric acid', type: 'redox',
      in: { cu: 1, h2so4: 2 }, out: { cuso4: 1, so2: 1, water: 2 }, minT: 150, rate: 3,
      effects: ['gas', 'colour'],
      note: 'Hot and concentrated, sulfuric acid becomes an oxidising agent too, and gives off sulfur dioxide.' });

  R({ id: 'h2o2-ki', name: 'Elephant toothpaste', type: 'decomposition',
      in: { h2o2: 2 }, out: { water: 2, o2: 1 }, needs: { catalyst: 'ki' }, rate: 45,
      effects: ['foam', 'gas', 'heat'],
      note: 'Iodide catalyses peroxide decomposition so fast that with a little soap the oxygen erupts as a column of foam.' });

  /* =========================================================== organic == */

  R({ id: 'hydrogenation', name: 'Hydrogenation of ethene', type: 'organic',
      in: { c2h4: 1, h2: 1 }, out: { c2h6: 1 }, needs: { catalyst: 'ni' }, minT: 150, rate: 3,
      note: 'Nickel holds both molecules on its surface long enough for them to react. The same chemistry hardens vegetable oil into margarine.' });

  R({ id: 'hydration', name: 'Hydration of ethene', type: 'organic',
      in: { c2h4: 1, water: 1 }, out: { c2h5oh: 1 }, needs: { catalyst: 'h3po4' }, minT: 300, rate: 1.5,
      note: 'How industrial ethanol is made — from oil, not from sugar.' });

  R({ id: 'dehydration', name: 'Dehydration of ethanol', type: 'organic',
      in: { c2h5oh: 1 }, out: { c2h4: 1, water: 1 }, needs: { catalyst: 'h2so4' }, minT: 170, rate: 2,
      note: 'Concentrated sulfuric acid pulls water straight out of the alcohol, leaving a double bond behind.' });

  R({ id: 'esterification', name: 'Esterification', type: 'organic',
      in: { ch3cooh: 1, c2h5oh: 1 }, out: { ethylacetate: 1, water: 1 },
      needs: { catalyst: 'h2so4' }, minT: 60, rate: 1.2, reversible: true,
      effects: ['smell'],
      note: 'Acid plus alcohol gives an ester and water. The reward is the smell — pear drops.' });

  R({ id: 'fermentation', name: 'Fermentation', type: 'organic',
      in: { glucose: 1 }, out: { c2h5oh: 2, co2: 2 }, needs: { catalyst: 'yeast', water: true },
      minT: 20, maxT: 40, rate: 0.8, effects: ['gas', 'fizz'],
      note: 'Yeast doing anaerobic respiration. It stops on its own near 15% alcohol, when the yeast poisons itself.' });

  R({ id: 'chlorination', name: 'Free-radical chlorination', type: 'organic',
      in: { ch4: 1, cl2: 1 }, out: { ch3cl: 1, hcl_g: 1 }, needs: { light: true }, rate: 2,
      note: 'Ultraviolet light splits Cl₂ into radicals, which then attack methane. Hard to stop at one substitution.' });

  R({ id: 'nitration', name: 'Nitration of benzene', type: 'organic',
      in: { benzene: 1, hno3: 1 }, out: { nitrobenzene: 1, water: 1 },
      needs: { catalyst: 'h2so4' }, minT: 50, maxT: 60, rate: 1.5,
      note: 'Sulfuric acid’s job is to make NO₂⁺ from the nitric acid — that is what actually attacks the ring.' });

  R({ id: 'sugar-h2so4', name: 'Dehydration of sugar', type: 'organic',
      in: { sucrose: 1 }, out: { c: 12, water: 11 }, needs: { catalyst: 'h2so4' }, rate: 6,
      effects: ['smoke', 'heat', 'colour'],
      note: 'Concentrated sulfuric acid strips out the hydrogen and oxygen as water, leaving a rising black column of pure carbon.' });

  R({ id: 'ethanol-oxidation', name: 'Oxidation of ethanol', type: 'organic',
      in: { c2h5oh: 1, o2: 1 }, out: { ch3cooh: 1, water: 1 },
      needs: { catalyst: 'k2cr2o7' }, minT: 40, rate: 1.5, effects: ['colour'],
      note: 'Orange dichromate turns green as it does the oxidising. Wine left open turns to vinegar the same way, only slower.' });

  /* ====================================================== gas generation == */

  R({ id: 'bleach-acid', name: 'Bleach and acid', type: 'redox',
      in: { naocl: 1, hcl: 2 }, out: { nacl: 1, cl2: 1, water: 1 }, rate: 12,
      effects: ['gas', 'colour'], hazardNote: true,
      note: 'Never mix bleach with an acidic cleaner. The chlorine comes off immediately and there is no warning beyond the smell.' });

  R({ id: 'feso4-oxidation', name: 'Air oxidation of iron(II)', type: 'redox',
      in: { feso4: 4, o2: 1, water: 10 }, out: { feoh3: 4, h2so4: 4 }, rate: 0.2, needs: { water: true },
      effects: ['colour', 'precipitate'],
      note: 'Pale green iron(II) solutions go cloudy and orange-brown as the air oxidises them.' });

  global.Chem.Reactions = {
    all: LIST,
    byId: LIST.reduce(function (m, r) { m[r.id] = r; return m; }, {})
  };
})(window);
