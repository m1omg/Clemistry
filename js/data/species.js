/* Clemistry — the chemical shelf.
 *
 * Every substance carries the data the simulation actually needs:
 *   smiles   structural formula, used to build the 3D stick model
 *   dHf      standard enthalpy of formation, kJ/mol, for the listed state
 *            (CRC Handbook / NIST values; 0 by definition for elements)
 *   cp       molar heat capacity, J/(mol K) — drives the temperature change
 *   ions     what it breaks into when dissolved in water
 *   pKa/pKb  acid or base strength;  ksp  solubility product
 *
 * Aqueous ions are listed at the bottom and are what the solution chemistry
 * (pH, precipitation, displacement) actually operates on.
 */
(function (global) {
  'use strict';

  var LIST = [];
  var BY_ID = {};

  var CP_DEFAULT = { s: 60, l: 90, g: 33, aq: 80 };

  function S(def) {
    if (def.cp === undefined) def.cp = CP_DEFAULT[def.state] || 60;
    if (def.hazards === undefined) def.hazards = [];
    if (def.tags === undefined) def.tags = [];
    def.tags = def.tags.concat([def.cat]);
    LIST.push(def);
    BY_ID[def.id] = def;
    return def;
  }

  /* ===================================================== elements & gases == */

  S({ id: 'h2', name: 'Hydrogen', formula: 'H₂', smiles: '[H][H]', state: 'g', cat: 'element',
      dHf: 0, cp: 28.8, mp: -259.2, bp: -252.9, hazards: ['flammable'],
      desc: 'The lightest gas. Burns in air with a nearly invisible flame and a sharp squeaky pop when a mixture with oxygen is ignited.' });
  S({ id: 'o2', name: 'Oxygen', formula: 'O₂', smiles: 'O=O', state: 'g', cat: 'element',
      dHf: 0, cp: 29.4, mp: -218.8, bp: -183, hazards: ['oxidiser'],
      desc: 'Supports combustion. The O=O double bond is strong, which is why so much of oxygen chemistry needs a push to get started but releases a great deal once it does.' });
  S({ id: 'n2', name: 'Nitrogen', formula: 'N₂', smiles: 'N#N', state: 'g', cat: 'element',
      dHf: 0, cp: 29.1, mp: -210, bp: -195.8,
      desc: '78% of the atmosphere. The N≡N triple bond is one of the strongest in chemistry, which makes nitrogen almost inert at room temperature.' });
  S({ id: 'cl2', name: 'Chlorine', formula: 'Cl₂', smiles: 'ClCl', state: 'g', cat: 'element',
      dHf: 0, cp: 33.9, mp: -101.5, bp: -34, color: '#d8e84a', hazards: ['toxic', 'oxidiser'],
      desc: 'A yellow-green choking gas. A vigorous oxidiser that attacks most metals directly.' });
  S({ id: 'f2', name: 'Fluorine', formula: 'F₂', smiles: 'FF', state: 'g', cat: 'element',
      dHf: 0, cp: 31.3, mp: -219.7, bp: -188.1, color: '#e8ee9a', hazards: ['toxic', 'oxidiser'],
      desc: 'The most reactive element there is. It oxidises nearly everything, including water and glass.' });
  S({ id: 'br2', name: 'Bromine', formula: 'Br₂', smiles: 'BrBr', state: 'l', cat: 'element',
      dHf: 0, cp: 75.7, mp: -7.2, bp: 58.8, color: '#8b2318', hazards: ['toxic', 'corrosive'],
      desc: 'The only nonmetal that is liquid at room temperature. Dense, dark red, and constantly giving off brown vapour.' });
  S({ id: 'i2', name: 'Iodine', formula: 'I₂', smiles: 'II', state: 's', cat: 'element',
      dHf: 0, cp: 54.4, mp: 113.7, bp: 184.3, color: '#4b0f6b', hazards: ['irritant'],
      desc: 'Lustrous violet-black plates that sublime to a purple vapour when warmed.' });
  S({ id: 'he', name: 'Helium', formula: 'He', smiles: '[He]', state: 'g', cat: 'element',
      dHf: 0, cp: 20.8, bp: -268.9, desc: 'A noble gas with a full 1s shell. It forms no ordinary compounds at all.' });
  S({ id: 'ne', name: 'Neon', formula: 'Ne', smiles: '[Ne]', state: 'g', cat: 'element',
      dHf: 0, cp: 20.8, bp: -246, desc: 'Inert noble gas; glows orange-red in a discharge tube.' });
  S({ id: 'ar', name: 'Argon', formula: 'Ar', smiles: '[Ar]', state: 'g', cat: 'element',
      dHf: 0, cp: 20.8, bp: -185.8, desc: 'Cheap inert gas used as a blanket for welding and for air-sensitive chemistry.' });

  S({ id: 'na', name: 'Sodium', formula: 'Na', smiles: '[Na]', state: 's', cat: 'element', lattice: 'bcc',
      dHf: 0, cp: 28.2, mp: 97.8, bp: 883, color: '#c8c8d0', hazards: ['flammable', 'corrosive'],
      desc: 'A soft silvery metal cut with a knife. Reacts violently with water, skating across the surface on the hydrogen it liberates.' });
  S({ id: 'k', name: 'Potassium', formula: 'K', smiles: '[K]', state: 's', cat: 'element', lattice: 'bcc',
      dHf: 0, cp: 29.6, mp: 63.5, bp: 759, color: '#c4c4cc', hazards: ['flammable', 'corrosive'],
      desc: 'Even more reactive than sodium — its reaction with water usually ignites the hydrogen, giving a lilac flame.' });
  S({ id: 'li', name: 'Lithium', formula: 'Li', smiles: '[Li]', state: 's', cat: 'element', lattice: 'bcc',
      dHf: 0, cp: 24.9, mp: 180.5, bp: 1342, color: '#d0d0d8', hazards: ['flammable', 'corrosive'],
      desc: 'The lightest metal. Reacts steadily with water and, unusually, directly with nitrogen.' });
  S({ id: 'mg', name: 'Magnesium', formula: 'Mg', smiles: '[Mg]', state: 's', cat: 'element', lattice: 'hcp',
      dHf: 0, cp: 24.9, mp: 650, bp: 1090, color: '#d6d6d2', hazards: ['flammable'],
      desc: 'Burns with a blinding white light, hot enough to strip oxygen out of carbon dioxide.' });
  S({ id: 'ca', name: 'Calcium', formula: 'Ca', smiles: '[Ca]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 25.9, mp: 842, bp: 1484, color: '#d9d9cc', hazards: ['flammable'],
      desc: 'A reactive silvery metal that fizzes in water and burns with a brick-red flame.' });
  S({ id: 'al', name: 'Aluminium', formula: 'Al', smiles: '[Al]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 24.2, mp: 660.3, bp: 2470, color: '#cfd2d6',
      desc: 'Protected by a tough transparent oxide film. Strip that film and it becomes a powerful reducing agent.' });
  S({ id: 'fe', name: 'Iron', formula: 'Fe', smiles: '[Fe]', state: 's', cat: 'element', lattice: 'bcc',
      dHf: 0, cp: 25.1, mp: 1538, bp: 2862, color: '#b0b3b8',
      desc: 'Rusts in moist air, dissolves in acid to give pale green iron(II), and is the backbone of steel.' });
  S({ id: 'cu', name: 'Copper', formula: 'Cu', smiles: '[Cu]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 24.4, mp: 1084.6, bp: 2562, color: '#c87533',
      desc: 'Sits below hydrogen in the activity series, so ordinary acids leave it alone — only oxidising acids attack it.' });
  S({ id: 'zn', name: 'Zinc', formula: 'Zn', smiles: '[Zn]', state: 's', cat: 'element', lattice: 'hcp',
      dHf: 0, cp: 25.4, mp: 419.5, bp: 907, color: '#b8bcc4',
      desc: 'The classic classroom metal for making hydrogen: drop it into dilute acid and it fizzes steadily.' });
  S({ id: 'ag', name: 'Silver', formula: 'Ag', smiles: '[Ag]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 25.4, mp: 961.8, bp: 2162, color: '#d8d8dc',
      desc: 'The best electrical conductor of all the elements. Tarnishes black through traces of sulfur in the air.' });
  S({ id: 'au', name: 'Gold', formula: 'Au', smiles: '[Au]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 25.4, mp: 1064.2, bp: 2856, color: '#e8b923',
      desc: 'So unreactive that only aqua regia — nitric plus hydrochloric acid — will dissolve it.' });
  S({ id: 'pb', name: 'Lead', formula: 'Pb', smiles: '[Pb]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 26.4, mp: 327.5, bp: 1749, color: '#8e8e96', hazards: ['toxic'],
      desc: 'Dense, soft and cumulatively poisonous. Its insoluble salts are strikingly coloured.' });
  S({ id: 'hg', name: 'Mercury', formula: 'Hg', smiles: '[Hg]', state: 'l', cat: 'element',
      dHf: 0, cp: 28.0, mp: -38.8, bp: 356.7, color: '#c0c0c8', hazards: ['toxic'],
      desc: 'The only metal liquid at room temperature. Its vapour is invisible and seriously toxic.' });
  S({ id: 'c', name: 'Carbon (graphite)', formula: 'C', smiles: '[C]', state: 's', cat: 'element', lattice: 'graphite',
      dHf: 0, cp: 8.5, mp: 3550, color: '#2b2b2b',
      desc: 'Sheets of fused hexagons stacked loosely on top of each other — which is why graphite is soft and conducts along the layers.' });
  S({ id: 'diamond', name: 'Diamond', formula: 'C', smiles: '[C]', state: 's', cat: 'element', lattice: 'diamond',
      dHf: 1.9, cp: 6.1, mp: 3550, color: '#dff2ff',
      desc: 'The same element as graphite, but every carbon is tetrahedrally bonded to four others in one giant covalent crystal.' });
  S({ id: 's8', name: 'Sulfur', formula: 'S₈', smiles: 'S1SSSSSSS1', state: 's', cat: 'element',
      dHf: 0, cp: 22.6, mp: 115.2, bp: 444.6, color: '#e8dc3c', hazards: ['flammable'],
      desc: 'Yellow crowns of eight atoms. Melts to a straw liquid that darkens and thickens as the rings crack open into chains.' });
  S({ id: 'p4', name: 'White phosphorus', formula: 'P₄', smiles: 'P12P3P1P23', state: 's', cat: 'element',
      dHf: 0, cp: 23.8, mp: 44.2, bp: 280.5, color: '#f2e6b0', hazards: ['flammable', 'toxic'],
      desc: 'A strained tetrahedron with 60° bond angles. It ignites spontaneously in air and is stored under water.' });
  S({ id: 'si', name: 'Silicon', formula: 'Si', smiles: '[Si]', state: 's', cat: 'element', lattice: 'diamond',
      dHf: 0, cp: 20.0, mp: 1414, color: '#5a5f6b',
      desc: 'A metalloid with the diamond structure; the substrate of every integrated circuit.' });

  /* ============================================================== oxides == */

  S({ id: 'water', name: 'Water', formula: 'H₂O', smiles: 'O', state: 'l', cat: 'solvent',
      dHf: -285.8, cp: 75.3, mp: 0, bp: 100, solvent: true,
      desc: 'Bent at 104.5° because the two lone pairs on oxygen squeeze the O–H bonds together. That bend is why water is polar, and why it dissolves so much.' });
  S({ id: 'steam', name: 'Steam', formula: 'H₂O', smiles: 'O', state: 'g', cat: 'gas',
      dHf: -241.8, cp: 33.6, desc: 'Gaseous water. Carries 40.7 kJ/mol more energy than the liquid.' });
  S({ id: 'ice', name: 'Ice', formula: 'H₂O', smiles: 'O', state: 's', cat: 'solid',
      dHf: -291.8, cp: 37.1, desc: 'Hydrogen-bonded into an open hexagonal lattice, which is why it is less dense than liquid water.' });
  S({ id: 'h2o2', name: 'Hydrogen peroxide', formula: 'H₂O₂', smiles: 'OO', state: 'l', cat: 'oxidiser',
      dHf: -187.8, cp: 89.1, mp: -0.4, bp: 150.2, hazards: ['oxidiser', 'corrosive'],
      desc: 'A skewed molecule with the two O–H bonds twisted out of plane. Decomposes to water and oxygen, explosively fast if catalysed.' });
  S({ id: 'co2', name: 'Carbon dioxide', formula: 'CO₂', smiles: 'O=C=O', state: 'g', cat: 'gas',
      dHf: -393.5, cp: 37.1, bp: -78.5,
      desc: 'Linear and nonpolar despite two polar bonds — the dipoles cancel exactly. Dissolves in water to give a weakly acidic solution.' });
  S({ id: 'co', name: 'Carbon monoxide', formula: 'CO', smiles: '[C-]#[O+]', state: 'g', cat: 'gas',
      dHf: -110.5, cp: 29.1, bp: -191.5, hazards: ['toxic', 'flammable'],
      desc: 'Odourless and deadly: it binds haemoglobin some 200 times more tightly than oxygen does.' });
  S({ id: 'so2', name: 'Sulfur dioxide', formula: 'SO₂', smiles: 'O=S=O', state: 'g', cat: 'gas',
      dHf: -296.8, cp: 39.9, bp: -10, hazards: ['toxic'],
      desc: 'Bent, not linear — sulfur keeps a lone pair. The sharp smell of a struck match.' });
  S({ id: 'so3', name: 'Sulfur trioxide', formula: 'SO₃', smiles: 'O=S(=O)=O', state: 'g', cat: 'gas',
      dHf: -395.7, cp: 50.7, bp: 45, hazards: ['corrosive'],
      desc: 'Trigonal planar. Fumes furiously in moist air, forming sulfuric acid.' });
  S({ id: 'no', name: 'Nitric oxide', formula: 'NO', smiles: '[N]=O', state: 'g', cat: 'gas',
      dHf: 91.3, cp: 29.8, hazards: ['toxic'],
      desc: 'An odd-electron radical, and a signalling molecule in the human body. Turns brown instantly in air.' });
  S({ id: 'no2', name: 'Nitrogen dioxide', formula: 'NO₂', smiles: 'O=[N]=O', state: 'g', cat: 'gas',
      dHf: 33.2, cp: 37.2, color: '#a8521c', hazards: ['toxic', 'oxidiser'],
      desc: 'The brown haze of photochemical smog and of nitric acid attacking copper.' });
  S({ id: 'n2o', name: 'Nitrous oxide', formula: 'N₂O', smiles: 'N#[N+][O-]', state: 'g', cat: 'gas',
      dHf: 81.6, cp: 38.6, desc: 'Laughing gas. Linear, and a surprisingly strong greenhouse gas.' });
  S({ id: 'nh3', name: 'Ammonia', formula: 'NH₃', smiles: 'N', state: 'g', cat: 'base',
      dHf: -45.9, cp: 35.1, bp: -33.3, pKb: 4.75, hazards: ['toxic', 'corrosive'],
      desc: 'A trigonal pyramid with a lone pair on top — that pair is what makes it a base and a good ligand.' });
  S({ id: 'h2s', name: 'Hydrogen sulfide', formula: 'H₂S', smiles: 'S', state: 'g', cat: 'gas',
      dHf: -20.6, cp: 34.2, bp: -60, pKa: 7.0, hazards: ['toxic', 'flammable'],
      desc: 'Smells of rotten eggs at trace levels and deadens the sense of smell at dangerous ones.' });
  S({ id: 'cao', name: 'Calcium oxide (quicklime)', formula: 'CaO', smiles: '[Ca+2].[O-2]', state: 's', cat: 'oxide',
      dHf: -634.9, cp: 42.0, mp: 2613, hazards: ['corrosive'],
      desc: 'Made by roasting limestone. Slakes with water in a reaction hot enough to boil it.' });
  S({ id: 'mgo', name: 'Magnesium oxide', formula: 'MgO', smiles: '[Mg+2].[O-2]', state: 's', cat: 'oxide',
      dHf: -601.6, cp: 37.2, mp: 2852,
      desc: 'The white ash left when magnesium burns. A refractory with a very high melting point.' });
  S({ id: 'fe2o3', name: 'Iron(III) oxide (rust)', formula: 'Fe₂O₃', smiles: '[Fe+3].[Fe+3].[O-2].[O-2].[O-2]', state: 's', cat: 'oxide',
      dHf: -824.2, cp: 103.9, color: '#8c3a1e',
      desc: 'Red-brown rust. Thermite is nothing more than this plus aluminium powder.' });
  S({ id: 'cuo', name: 'Copper(II) oxide', formula: 'CuO', smiles: '[Cu+2].[O-2]', state: 's', cat: 'oxide',
      dHf: -157.3, cp: 42.3, color: '#1a1a1a',
      desc: 'The black coating that forms when copper is heated in air.' });
  S({ id: 'al2o3', name: 'Aluminium oxide', formula: 'Al₂O₃', smiles: '[Al+3].[Al+3].[O-2].[O-2].[O-2]', state: 's', cat: 'oxide',
      dHf: -1675.7, cp: 79.0, mp: 2072,
      desc: 'Corundum. Extremely hard and extremely stable — the reason thermite gives up so much energy.' });
  S({ id: 'sio2', name: 'Silicon dioxide', formula: 'SiO₂', smiles: 'O=[Si]=O', state: 's', cat: 'oxide',
      dHf: -910.7, cp: 44.4, mp: 1713,
      desc: 'Quartz and sand. In reality a giant covalent network of corner-sharing SiO₄ tetrahedra.' });
  S({ id: 'mno2', name: 'Manganese dioxide', formula: 'MnO₂', smiles: '[Mn+4].[O-2].[O-2]', state: 's', cat: 'oxide',
      dHf: -520.0, cp: 54.1, color: '#15151a', catalyst: true,
      desc: 'A black solid, best known as the catalyst that tears hydrogen peroxide apart on contact.' });

  /* =============================================================== acids == */

  S({ id: 'hcl', name: 'Hydrochloric acid', formula: 'HCl', smiles: 'Cl', state: 'aq', cat: 'acid',
      dHf: -167.2, cp: 100, pKa: -6.3, strongAcid: true,
      ions: { 'h+': 1, 'cl-': 1 }, hazards: ['corrosive'],
      desc: 'A strong acid: in water essentially every molecule hands its proton to a water molecule.' });
  S({ id: 'hcl_g', name: 'Hydrogen chloride', formula: 'HCl', smiles: 'Cl', state: 'g', cat: 'gas',
      dHf: -92.3, cp: 29.1, bp: -85, hazards: ['corrosive', 'toxic'],
      desc: 'A colourless gas that fumes in moist air. Extremely soluble — one litre of water takes up over 400 litres of it.' });
  S({ id: 'h2so4', name: 'Sulfuric acid (concentrated)', formula: 'H₂SO₄', smiles: 'O=S(=O)(O)O', state: 'l', cat: 'acid',
      dHf: -814.0, cp: 138.9, mp: 10.3, bp: 337, pKa: -3, strongAcid: true, protons: 2,
      ions: { 'h+': 2, 'so4-2': 1 }, hazards: ['corrosive', 'oxidiser'],
      desc: 'Sulfur sits at the centre of a distorted tetrahedron. Concentrated, it is a dehydrating agent that chars sugar to carbon.' });
  S({ id: 'h2so4_dil', name: 'Sulfuric acid (dilute)', formula: 'H₂SO₄(aq)', smiles: 'O=S(=O)(O)O',
      state: 'aq', cat: 'acid', dHf: -909.3, cp: 100, pKa: -3, strongAcid: true, protons: 2,
      ions: { 'h+': 2, 'so4-2': 1 }, hazards: ['corrosive'],
      desc: 'The bench bottle. Dilute enough to be an ordinary strong acid, without the dehydrating and oxidising behaviour of the concentrated liquid.' });
  S({ id: 'hno3', name: 'Nitric acid', formula: 'HNO₃', smiles: 'O[N+](=O)[O-]', state: 'l', cat: 'acid',
      dHf: -174.1, cp: 109.9, mp: -42, bp: 83, pKa: -1.4, strongAcid: true,
      ions: { 'h+': 1, 'no3-': 1 }, hazards: ['corrosive', 'oxidiser'],
      desc: 'Both a strong acid and a strong oxidiser — which is why it dissolves copper, a metal ordinary acids cannot touch.' });
  S({ id: 'h3po4', name: 'Phosphoric acid', formula: 'H₃PO₄', smiles: 'OP(=O)(O)O', state: 'aq', cat: 'acid',
      dHf: -1284.4, cp: 106, pKa: 2.15, protons: 3, ions: { 'h+': 1, 'h2po4-': 1 }, hazards: ['corrosive'],
      desc: 'A weak triprotic acid, and the tang in cola drinks.' });
  S({ id: 'ch3cooh', name: 'Acetic acid', formula: 'CH₃COOH', smiles: 'CC(=O)O', state: 'l', cat: 'acid',
      dHf: -484.3, cp: 123.1, mp: 16.6, bp: 118, pKa: 4.76,
      ions: { 'h+': 1, 'ch3coo-': 1 }, hazards: ['corrosive', 'flammable'],
      desc: 'The acid in vinegar. Weak enough that in solution only about one molecule in a hundred is ionised.' });
  S({ id: 'h2co3', name: 'Carbonic acid', formula: 'H₂CO₃', smiles: 'OC(=O)O', state: 'aq', cat: 'acid',
      dHf: -699.7, cp: 100, pKa: 6.35, protons: 2, ions: { 'h+': 1, 'hco3-': 1 },
      desc: 'Formed when carbon dioxide dissolves. Unstable — it falls apart back to CO₂ and water as fast as it forms.' });
  S({ id: 'hf', name: 'Hydrofluoric acid', formula: 'HF', smiles: 'F', state: 'aq', cat: 'acid',
      dHf: -320.1, cp: 100, pKa: 3.17, ions: { 'h+': 1, 'f-': 1 }, hazards: ['corrosive', 'toxic'],
      desc: 'A weak acid that nonetheless etches glass, and one of the most dangerous reagents in any lab.' });
  S({ id: 'hcn', name: 'Hydrogen cyanide', formula: 'HCN', smiles: 'C#N', state: 'l', cat: 'acid',
      dHf: 108.9, cp: 70.6, bp: 25.6, pKa: 9.21, ions: { 'h+': 1, 'cn-': 1 }, hazards: ['toxic', 'flammable'],
      desc: 'Linear, smells faintly of almonds, and blocks cellular respiration outright.' });
  S({ id: 'hbr', name: 'Hydrobromic acid', formula: 'HBr', smiles: 'Br', state: 'aq', cat: 'acid',
      dHf: -121.6, cp: 100, pKa: -9, strongAcid: true, ions: { 'h+': 1, 'br-': 1 }, hazards: ['corrosive'],
      desc: 'Stronger than hydrochloric acid — the H–Br bond is longer and weaker than H–Cl.' });
  S({ id: 'hcooh', name: 'Formic acid', formula: 'HCOOH', smiles: 'OC=O', state: 'l', cat: 'acid',
      dHf: -425.0, cp: 99.0, bp: 100.8, pKa: 3.75, ions: { 'h+': 1, 'hcoo-': 1 }, hazards: ['corrosive'],
      desc: 'The simplest carboxylic acid, and the sting in an ant bite.' });
  S({ id: 'c6h5cooh', name: 'Benzoic acid', formula: 'C₇H₆O₂', smiles: 'O=C(O)c1ccccc1', state: 's', cat: 'acid',
      dHf: -385.2, cp: 146.8, mp: 122.4, pKa: 4.20,
      desc: 'White needles. A common food preservative, and the classic standard for bomb calorimetry.' });
  S({ id: 'citric', name: 'Citric acid', formula: 'C₆H₈O₇', smiles: 'OC(=O)CC(O)(C(=O)O)CC(=O)O', state: 's', cat: 'acid',
      dHf: -1543.8, cp: 226.5, mp: 153, pKa: 3.13, protons: 3,
      desc: 'Three carboxyl groups around a central alcohol — the sourness of citrus and a workhorse chelating agent.' });

  /* =============================================================== bases == */

  S({ id: 'naoh', name: 'Sodium hydroxide', formula: 'NaOH', smiles: '[Na+].[OH-]', state: 's', cat: 'base',
      dHf: -425.6, cp: 59.5, mp: 318, strongBase: true, ions: { 'na+': 1, 'oh-': 1 }, hazards: ['corrosive'],
      desc: 'Caustic soda. Dissolving it in water is strongly exothermic, and it dissolves skin as readily as it does grease.' });
  S({ id: 'koh', name: 'Potassium hydroxide', formula: 'KOH', smiles: '[K+].[OH-]', state: 's', cat: 'base',
      dHf: -424.6, cp: 64.9, mp: 360, strongBase: true, ions: { 'k+': 1, 'oh-': 1 }, hazards: ['corrosive'],
      desc: 'Caustic potash — like sodium hydroxide but more soluble still.' });
  S({ id: 'lioh', name: 'Lithium hydroxide', formula: 'LiOH', smiles: '[Li+].[OH-]', state: 's', cat: 'base',
      dHf: -487.5, cp: 49.6, strongBase: true, ions: { 'li+': 1, 'oh-': 1 }, hazards: ['corrosive'],
      desc: 'Used aboard spacecraft to scrub carbon dioxide out of the cabin air.' });
  S({ id: 'caoh2', name: 'Calcium hydroxide', formula: 'Ca(OH)₂', smiles: '[Ca+2].[OH-].[OH-]', state: 's', cat: 'base',
      dHf: -985.2, cp: 87.5, strongBase: true, ksp: 5.5e-6, ions: { 'ca+2': 1, 'oh-': 2 }, hazards: ['corrosive'],
      desc: 'Slaked lime. Only slightly soluble; its saturated solution is the limewater that turns milky with CO₂.' });
  S({ id: 'nh4oh', name: 'Aqueous ammonia', formula: 'NH₃(aq)', smiles: 'N', state: 'aq', cat: 'base',
      dHf: -80.3, cp: 100, pKb: 4.75, ions: { 'nh4+': 1, 'oh-': 1 }, weakBase: true, hazards: ['corrosive'],
      desc: 'A weak base: most of the ammonia stays as neutral molecules, with only a small fraction grabbing a proton from water.' });
  S({ id: 'nahco3', name: 'Sodium bicarbonate', formula: 'NaHCO₃', smiles: '[Na+].OC(=O)[O-]', state: 's', cat: 'base',
      dHf: -950.8, cp: 87.6, ions: { 'na+': 1, 'hco3-': 1 },
      desc: 'Baking soda. Amphoteric — it neutralises acids by fizzing off carbon dioxide, and decomposes on heating.' });
  S({ id: 'na2co3', name: 'Sodium carbonate', formula: 'Na₂CO₃', smiles: '[Na+].[Na+].[O-]C(=O)[O-]', state: 's', cat: 'base',
      dHf: -1130.7, cp: 112.3, ions: { 'na+': 2, 'co3-2': 1 },
      desc: 'Washing soda. A moderately strong base thanks to the carbonate ion pulling protons off water.' });

  /* =============================================================== salts == */

  S({ id: 'nacl', name: 'Sodium chloride', formula: 'NaCl', smiles: '[Na+].[Cl-]', state: 's', cat: 'salt',
      lattice: 'rocksalt', dHf: -411.2, cp: 50.5, mp: 801, ions: { 'na+': 1, 'cl-': 1 },
      desc: 'Table salt. Not molecules at all but a cubic lattice in which every ion is surrounded by six of the opposite charge.' });
  S({ id: 'kcl', name: 'Potassium chloride', formula: 'KCl', smiles: '[K+].[Cl-]', state: 's', cat: 'salt',
      lattice: 'rocksalt', dHf: -436.5, cp: 51.3, mp: 770, ions: { 'k+': 1, 'cl-': 1 },
      desc: 'A rock-salt structure like NaCl. Used as a salt substitute and a potassium fertiliser.' });
  S({ id: 'kno3', name: 'Potassium nitrate', formula: 'KNO₃', smiles: '[K+].[O-][N+](=O)[O-]', state: 's', cat: 'salt',
      dHf: -494.6, cp: 96.4, mp: 334, ions: { 'k+': 1, 'no3-': 1 }, hazards: ['oxidiser'],
      desc: 'Saltpetre — the oxidiser in black powder. Dissolving it is strongly endothermic, so the solution goes cold.' });
  S({ id: 'nano3', name: 'Sodium nitrate', formula: 'NaNO₃', smiles: '[Na+].[O-][N+](=O)[O-]', state: 's', cat: 'salt',
      dHf: -467.9, cp: 92.9, ions: { 'na+': 1, 'no3-': 1 }, hazards: ['oxidiser'],
      desc: 'Chile saltpetre. All nitrates are soluble, without exception.' });
  S({ id: 'caco3', name: 'Calcium carbonate', formula: 'CaCO₃', smiles: '[Ca+2].[O-]C(=O)[O-]', state: 's', cat: 'mineral',
      dHf: -1207.6, cp: 81.9, ksp: 3.3e-9, ions: { 'ca+2': 1, 'co3-2': 1 },
      desc: 'Limestone, chalk, marble and seashells. Fizzes in acid and decomposes to quicklime when roasted.' });
  S({ id: 'caso4', name: 'Calcium sulfate', formula: 'CaSO₄', smiles: '[Ca+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -1434.5, cp: 99.6, ksp: 4.9e-5, ions: { 'ca+2': 1, 'so4-2': 1 },
      desc: 'Gypsum and plaster of Paris. Only sparingly soluble, which is why it scales up boilers.' });
  S({ id: 'cacl2', name: 'Calcium chloride', formula: 'CaCl₂', smiles: '[Ca+2].[Cl-].[Cl-]', state: 's', cat: 'salt',
      dHf: -795.4, cp: 72.9, mp: 772, ions: { 'ca+2': 1, 'cl-': 2 },
      desc: 'Ferociously hygroscopic and strongly exothermic in water — the chemistry behind self-heating cans.' });
  S({ id: 'cuso4', name: 'Copper(II) sulfate', formula: 'CuSO₄', smiles: '[Cu+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -771.4, cp: 98.9, color: '#dcdcdc', ions: { 'cu+2': 1, 'so4-2': 1 }, hazards: ['irritant'],
      desc: 'Anhydrous it is a dull white powder; add water and it turns the famous blue as each copper ion picks up its water ligands.' });
  S({ id: 'cuso4_5h2o', name: 'Copper(II) sulfate pentahydrate', formula: 'CuSO₄·5H₂O', smiles: '[Cu+2].[O-]S(=O)(=O)[O-].O.O.O.O.O', state: 's', cat: 'salt',
      dHf: -2279.7, cp: 281.0, color: '#1667c4', ions: { 'cu+2': 1, 'so4-2': 1, 'water': 5 }, hazards: ['irritant'],
      desc: 'Deep blue triclinic crystals. Four waters bind the copper directly; the fifth is held by the sulfate.' });
  S({ id: 'feso4', name: 'Iron(II) sulfate', formula: 'FeSO₄', smiles: '[Fe+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -928.4, cp: 100.6, color: '#7fae7a', ions: { 'fe+2': 1, 'so4-2': 1 },
      desc: 'Green vitriol. Its pale green solutions oxidise slowly in air to yellow-brown iron(III).' });
  S({ id: 'fecl3', name: 'Iron(III) chloride', formula: 'FeCl₃', smiles: '[Fe+3].[Cl-].[Cl-].[Cl-]', state: 's', cat: 'salt',
      dHf: -399.5, cp: 96.7, color: '#8a4a10', ions: { 'fe+3': 1, 'cl-': 3 }, hazards: ['corrosive'],
      desc: 'Dissolves to a strongly acidic yellow-brown solution because the hydrated Fe³⁺ ion hydrolyses water.' });
  S({ id: 'agno3', name: 'Silver nitrate', formula: 'AgNO₃', smiles: '[Ag+].[O-][N+](=O)[O-]', state: 's', cat: 'salt',
      dHf: -124.4, cp: 93.1, mp: 212, ions: { 'ag+': 1, 'no3-': 1 }, hazards: ['corrosive', 'oxidiser'],
      desc: 'The standard test reagent for halides. Stains skin black as the silver is reduced by light.' });
  S({ id: 'agcl', name: 'Silver chloride', formula: 'AgCl', smiles: '[Ag+].[Cl-]', state: 's', cat: 'precipitate',
      dHf: -127.0, cp: 50.8, ksp: 1.8e-10, color: '#f2f2f2', insoluble: true,
      desc: 'A curdy white precipitate that darkens in sunlight — the basis of photographic film.' });
  S({ id: 'agbr', name: 'Silver bromide', formula: 'AgBr', smiles: '[Ag+].[Br-]', state: 's', cat: 'precipitate',
      dHf: -100.4, cp: 52.4, ksp: 5.4e-13, color: '#efe4c0', insoluble: true,
      desc: 'Pale cream, and far more light-sensitive than the chloride.' });
  S({ id: 'agi', name: 'Silver iodide', formula: 'AgI', smiles: '[Ag+].[I-]', state: 's', cat: 'precipitate',
      dHf: -61.8, cp: 56.8, ksp: 8.5e-17, color: '#e8dc84', insoluble: true,
      desc: 'Bright yellow and almost completely insoluble. Seeded into clouds to trigger rain.' });
  S({ id: 'baso4', name: 'Barium sulfate', formula: 'BaSO₄', smiles: '[Ba+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'precipitate',
      dHf: -1473.2, cp: 101.8, ksp: 1.1e-10, color: '#fbfbfb', insoluble: true,
      desc: 'So insoluble that it can be swallowed safely as an X-ray contrast agent, despite barium being toxic.' });
  S({ id: 'pbi2', name: 'Lead(II) iodide', formula: 'PbI₂', smiles: '[Pb+2].[I-].[I-]', state: 's', cat: 'precipitate',
      dHf: -175.5, cp: 77.4, ksp: 9.8e-9, color: '#ffd21a', insoluble: true, hazards: ['toxic'],
      desc: 'The "golden rain" precipitate — brilliant yellow flakes that redissolve when hot and recrystallise on cooling.' });
  S({ id: 'pbno32', name: 'Lead(II) nitrate', formula: 'Pb(NO₃)₂', smiles: '[Pb+2].[O-][N+](=O)[O-].[O-][N+](=O)[O-]', state: 's', cat: 'salt',
      dHf: -451.9, cp: 116.0, ions: { 'pb+2': 1, 'no3-': 2 }, hazards: ['toxic', 'oxidiser'],
      desc: 'One of the few soluble lead salts, which is exactly what makes it useful for precipitation reactions.' });
  S({ id: 'bacl2', name: 'Barium chloride', formula: 'BaCl₂', smiles: '[Ba+2].[Cl-].[Cl-]', state: 's', cat: 'salt',
      dHf: -855.0, cp: 75.1, ions: { 'ba+2': 1, 'cl-': 2 }, hazards: ['toxic'],
      desc: 'The standard test reagent for sulfate: add it and any sulfate present drops out at once as a dense white precipitate.' });
  S({ id: 'ki', name: 'Potassium iodide', formula: 'KI', smiles: '[K+].[I-]', state: 's', cat: 'salt',
      dHf: -327.9, cp: 52.9, ions: { 'k+': 1, 'i-': 1 },
      desc: 'Added to table salt to prevent goitre. Its solutions dissolve iodine to a deep brown triiodide.' });
  S({ id: 'nh4cl', name: 'Ammonium chloride', formula: 'NH₄Cl', smiles: '[NH4+].[Cl-]', state: 's', cat: 'salt',
      dHf: -314.4, cp: 84.1, ions: { 'nh4+': 1, 'cl-': 1 },
      desc: 'Sal ammoniac. Dissolving it draws in heat sharply, and its solutions are mildly acidic.' });
  S({ id: 'nh4no3', name: 'Ammonium nitrate', formula: 'NH₄NO₃', smiles: '[NH4+].[O-][N+](=O)[O-]', state: 's', cat: 'salt',
      dHf: -365.6, cp: 139.3, ions: { 'nh4+': 1, 'no3-': 1 }, hazards: ['oxidiser', 'explosive'],
      desc: 'A fertiliser that is also the classic instant cold pack — and, confined and heated, a notorious explosive.' });
  S({ id: 'kmno4', name: 'Potassium permanganate', formula: 'KMnO₄', smiles: '[K+].[O-][Mn](=O)(=O)=O', state: 's', cat: 'oxidiser',
      dHf: -837.2, cp: 119.2, color: '#4a1259', ions: { 'k+': 1, 'mno4-': 1 }, hazards: ['oxidiser', 'corrosive'],
      desc: 'An intense purple that stains everything. A powerful oxidiser whose colour vanishes as it is reduced.' });
  S({ id: 'k2cr2o7', name: 'Potassium dichromate', formula: 'K₂Cr₂O₇', smiles: '[K+].[K+].[O-][Cr](=O)(=O)O[Cr](=O)(=O)[O-]', state: 's', cat: 'oxidiser',
      dHf: -2061.5, cp: 219.0, color: '#e8620d', hazards: ['oxidiser', 'toxic'],
      desc: 'Orange crystals. Turns green as chromium(VI) is reduced to chromium(III) — the old breathalyser test.' });
  S({ id: 'kclo3', name: 'Potassium chlorate', formula: 'KClO₃', smiles: '[K+].[O-]Cl(=O)=O', state: 's', cat: 'oxidiser',
      dHf: -397.7, cp: 100.3, ions: { 'k+': 1, 'clo3-': 1 }, hazards: ['oxidiser'],
      desc: 'Releases oxygen readily when heated, especially with a catalyst. The oxidiser in match heads.' });
  S({ id: 'naocl', name: 'Sodium hypochlorite', formula: 'NaOCl', smiles: '[Na+].[O-]Cl', state: 'aq', cat: 'oxidiser',
      dHf: -347.1, cp: 100, ions: { 'na+': 1, 'ocl-': 1 }, hazards: ['corrosive', 'oxidiser'],
      desc: 'Household bleach. Mixing it with acid releases chlorine gas — a genuinely dangerous accident.' });
  S({ id: 'znso4', name: 'Zinc sulfate', formula: 'ZnSO₄', smiles: '[Zn+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -982.8, cp: 99.2, ions: { 'zn+2': 1, 'so4-2': 1 },
      desc: 'White vitriol. Colourless in solution, unlike its copper and iron cousins.' });
  S({ id: 'na2so4', name: 'Sodium sulfate', formula: 'Na₂SO₄', smiles: '[Na+].[Na+].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -1387.1, cp: 128.2, ions: { 'na+': 2, 'so4-2': 1 },
      desc: 'Glauber’s salt. Its solubility peaks sharply near 32 °C, which makes it a useful heat store.' });
  S({ id: 'mgso4', name: 'Magnesium sulfate', formula: 'MgSO₄', smiles: '[Mg+2].[O-]S(=O)(=O)[O-]', state: 's', cat: 'salt',
      dHf: -1284.9, cp: 96.5, ions: { 'mg+2': 1, 'so4-2': 1 },
      desc: 'Epsom salt. Bitter, soluble, and a mild laxative.' });
  S({ id: 'cuoh2', name: 'Copper(II) hydroxide', formula: 'Cu(OH)₂', smiles: '[Cu+2].[OH-].[OH-]', state: 's', cat: 'precipitate',
      dHf: -449.8, cp: 96.0, ksp: 2.2e-20, color: '#3d9be0', insoluble: true,
      desc: 'A pale blue gelatinous precipitate that dehydrates to black copper(II) oxide when warmed.' });
  S({ id: 'feoh3', name: 'Iron(III) hydroxide', formula: 'Fe(OH)₃', smiles: '[Fe+3].[OH-].[OH-].[OH-]', state: 's', cat: 'precipitate',
      dHf: -823.0, cp: 101.0, ksp: 2.8e-39, color: '#a0522d', insoluble: true,
      desc: 'A rust-brown sludge with a vanishingly small solubility product — it precipitates from the faintest trace of Fe³⁺.' });
  S({ id: 'mgoh2', name: 'Magnesium hydroxide', formula: 'Mg(OH)₂', smiles: '[Mg+2].[OH-].[OH-]', state: 's', cat: 'precipitate',
      dHf: -924.5, cp: 77.0, ksp: 5.6e-12, color: '#fafafa', insoluble: true,
      desc: 'Milk of magnesia — insoluble enough to be a gentle antacid rather than a caustic one.' });

  /* ============================================================ organics == */

  S({ id: 'ch4', name: 'Methane', formula: 'CH₄', smiles: 'C', state: 'g', cat: 'organic',
      dHf: -74.6, cp: 35.7, bp: -161.5, hazards: ['flammable'],
      desc: 'Perfectly tetrahedral. Natural gas, and a greenhouse gas some 80 times more potent than CO₂ over 20 years.' });
  S({ id: 'c2h6', name: 'Ethane', formula: 'C₂H₆', smiles: 'CC', state: 'g', cat: 'organic',
      dHf: -84.0, cp: 52.5, bp: -88.6, hazards: ['flammable'],
      desc: 'Two tetrahedral carbons. The staggered conformation is about 12 kJ/mol more stable than the eclipsed one.' });
  S({ id: 'c2h4', name: 'Ethene', formula: 'C₂H₄', smiles: 'C=C', state: 'g', cat: 'organic',
      dHf: 52.4, cp: 43.6, bp: -103.7, hazards: ['flammable'],
      desc: 'Flat and rigid — the π bond locks rotation. Plants use it as a ripening hormone; industry makes polythene from it.' });
  S({ id: 'c2h2', name: 'Ethyne (acetylene)', formula: 'C₂H₂', smiles: 'C#C', state: 'g', cat: 'organic',
      dHf: 227.4, cp: 44.0, bp: -84, hazards: ['flammable'],
      desc: 'Linear and badly strained. Burns in oxygen at over 3000 °C, hot enough to cut steel.' });
  S({ id: 'c3h8', name: 'Propane', formula: 'C₃H₈', smiles: 'CCC', state: 'g', cat: 'organic',
      dHf: -103.8, cp: 73.6, bp: -42, hazards: ['flammable'], desc: 'Bottled gas — easily liquefied under modest pressure.' });
  S({ id: 'c4h10', name: 'Butane', formula: 'C₄H₁₀', smiles: 'CCCC', state: 'g', cat: 'organic',
      dHf: -125.7, cp: 97.5, bp: -0.5, hazards: ['flammable'], desc: 'Lighter fuel. Liquid under only a couple of atmospheres.' });
  S({ id: 'c8h18', name: 'Octane', formula: 'C₈H₁₈', smiles: 'CCCCCCCC', state: 'l', cat: 'organic',
      dHf: -250.1, cp: 254.6, bp: 125.6, hazards: ['flammable'],
      desc: 'A representative petrol molecule. Its combustion is the reaction that moved the twentieth century.' });
  S({ id: 'ch3oh', name: 'Methanol', formula: 'CH₃OH', smiles: 'CO', state: 'l', cat: 'organic',
      dHf: -239.2, cp: 81.1, bp: 64.7, hazards: ['flammable', 'toxic'],
      desc: 'Wood alcohol. Metabolised to formaldehyde and formic acid, which is why it blinds and kills.' });
  S({ id: 'c2h5oh', name: 'Ethanol', formula: 'C₂H₅OH', smiles: 'CCO', state: 'l', cat: 'organic',
      dHf: -277.6, cp: 112.3, bp: 78.4, hazards: ['flammable'],
      desc: 'The alcohol of fermented drinks. The –OH group hydrogen-bonds, which is why it boils so much higher than ethane.' });
  S({ id: 'propanol', name: 'Isopropanol', formula: 'C₃H₈O', smiles: 'CC(C)O', state: 'l', cat: 'organic',
      dHf: -318.1, cp: 156.5, bp: 82.6, hazards: ['flammable'],
      desc: 'Rubbing alcohol. A secondary alcohol — its –OH sits on a carbon flanked by two others.' });
  S({ id: 'glycol', name: 'Ethylene glycol', formula: 'C₂H₆O₂', smiles: 'OCCO', state: 'l', cat: 'organic',
      dHf: -454.8, cp: 149.8, bp: 197.3, hazards: ['toxic'],
      desc: 'Antifreeze. Two hydroxyls give it a high boiling point and a sweet taste that makes it dangerously palatable.' });
  S({ id: 'acetone', name: 'Acetone', formula: 'C₃H₆O', smiles: 'CC(C)=O', state: 'l', cat: 'organic',
      dHf: -248.4, cp: 125.5, bp: 56.1, hazards: ['flammable'],
      desc: 'The simplest ketone. A trigonal planar carbonyl carbon, and a solvent that dissolves almost everything organic.' });
  S({ id: 'ch2o', name: 'Formaldehyde', formula: 'CH₂O', smiles: 'C=O', state: 'g', cat: 'organic',
      dHf: -108.6, cp: 35.4, bp: -19, hazards: ['toxic'],
      desc: 'The simplest aldehyde. Flat, reactive, and a preservative because it cross-links proteins.' });
  S({ id: 'benzene', name: 'Benzene', formula: 'C₆H₆', smiles: 'c1ccccc1', state: 'l', cat: 'organic',
      dHf: 49.1, cp: 136.0, bp: 80.1, hazards: ['flammable', 'toxic'],
      desc: 'A flat hexagon in which all six C–C bonds are identical at 1.39 Å — halfway between single and double. That delocalisation is what "aromatic" means.' });
  S({ id: 'toluene', name: 'Toluene', formula: 'C₇H₈', smiles: 'Cc1ccccc1', state: 'l', cat: 'organic',
      dHf: 12.4, cp: 157.3, bp: 110.6, hazards: ['flammable'],
      desc: 'Benzene with a methyl group. Far less toxic than benzene itself, and the feedstock for TNT.' });
  S({ id: 'phenol', name: 'Phenol', formula: 'C₆H₅OH', smiles: 'Oc1ccccc1', state: 's', cat: 'organic',
      dHf: -165.1, cp: 127.4, mp: 40.5, pKa: 9.95, hazards: ['corrosive', 'toxic'],
      desc: 'An –OH bolted onto a benzene ring, which makes it far more acidic than an ordinary alcohol.' });
  S({ id: 'naphthalene', name: 'Naphthalene', formula: 'C₁₀H₈', smiles: 'c1ccc2ccccc2c1', state: 's', cat: 'organic',
      dHf: 78.5, cp: 165.7, mp: 80.3, hazards: ['flammable'],
      desc: 'Two fused aromatic rings. Mothballs — it sublimes straight from solid to vapour.' });
  S({ id: 'glucose', name: 'Glucose', formula: 'C₆H₁₂O₆', smiles: 'OCC1OC(O)C(O)C(O)C1O', state: 's', cat: 'biochem',
      dHf: -1273.3, cp: 218.6, mp: 146,
      desc: 'In solution it mostly curls into this six-membered pyranose ring. Burning it releases 2803 kJ/mol — the same energy your cells extract slowly.' });
  S({ id: 'sucrose', name: 'Sucrose', formula: 'C₁₂H₂₂O₁₁', smiles: 'OCC1OC(CO)(OC2OC(CO)C(O)C(O)C2O)C(O)C1O', state: 's', cat: 'biochem',
      dHf: -2226.1, cp: 425.0, mp: 186,
      desc: 'Table sugar: a glucose and a fructose locked together. Concentrated sulfuric acid strips the water straight out of it, leaving a black column of carbon.' });
  S({ id: 'glycine', name: 'Glycine', formula: 'C₂H₅NO₂', smiles: 'NCC(=O)O', state: 's', cat: 'biochem',
      dHf: -528.5, cp: 99.2, mp: 233,
      desc: 'The smallest amino acid, and the only one without a handedness.' });
  S({ id: 'caffeine', name: 'Caffeine', formula: 'C₈H₁₀N₄O₂', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', state: 's', cat: 'biochem',
      dHf: -310.0, cp: 246.0, mp: 235, approxDHf: true,
      desc: 'A fused purine ring system. It works by blocking adenosine receptors — your brain simply stops being told it is tired.' });
  S({ id: 'aspirin', name: 'Aspirin', formula: 'C₉H₈O₄', smiles: 'CC(=O)Oc1ccccc1C(=O)O', state: 's', cat: 'biochem',
      dHf: -815.6, cp: 232.0, mp: 135, pKa: 3.5,
      desc: 'Acetylsalicylic acid. The acetyl group is what it hands to cyclooxygenase, shutting the enzyme down for good.' });
  S({ id: 'urea', name: 'Urea', formula: 'CH₄N₂O', smiles: 'NC(N)=O', state: 's', cat: 'biochem',
      dHf: -333.1, cp: 93.1, mp: 133,
      desc: 'How mammals dispose of nitrogen. Wöhler making it from an inorganic salt in 1828 ended the idea of a "vital force".' });
  S({ id: 'ccl4', name: 'Carbon tetrachloride', formula: 'CCl₄', smiles: 'ClC(Cl)(Cl)Cl', state: 'l', cat: 'organic',
      dHf: -128.2, cp: 131.3, bp: 76.7, hazards: ['toxic'],
      desc: 'Perfectly tetrahedral and therefore nonpolar despite four polar bonds. A banned refrigerant and ozone destroyer.' });
  S({ id: 'chcl3', name: 'Chloroform', formula: 'CHCl₃', smiles: 'ClC(Cl)Cl', state: 'l', cat: 'organic',
      dHf: -134.1, cp: 114.2, bp: 61.2, hazards: ['toxic'],
      desc: 'An early anaesthetic, abandoned once its effect on the liver and heart became clear.' });

  /* ======================================================== energetics etc == */

  S({ id: 'nitroglycerin', name: 'Nitroglycerin', formula: 'C₃H₅N₃O₉', smiles: '[O-][N+](=O)OCC(O[N+](=O)[O-])CO[N+](=O)[O-]', state: 'l', cat: 'energetic',
      dHf: -370.9, cp: 250.0, hazards: ['explosive', 'toxic'],
      desc: 'Carries its own oxygen, so it needs nothing from the air. A shock is enough to set off the whole sample at once.' });
  S({ id: 'tnt', name: 'TNT', formula: 'C₇H₅N₃O₆', smiles: 'Cc1c([N+](=O)[O-])cc([N+](=O)[O-])cc1[N+](=O)[O-]', state: 's', cat: 'energetic',
      dHf: -63.2, cp: 243.3, mp: 80.4, hazards: ['explosive'],
      desc: 'Oxygen-poor, so it burns quietly unless detonated — which is exactly why it is safe enough to handle.' });
  S({ id: 'nan3', name: 'Sodium azide', formula: 'NaN₃', smiles: '[Na+].[N-]=[N+]=[N-]', state: 's', cat: 'energetic',
      dHf: 21.7, cp: 76.6, hazards: ['toxic', 'explosive'],
      desc: 'Decomposes to sodium and a burst of nitrogen — the reaction that inflates an airbag in 30 milliseconds.' });
  S({ id: 'cac2', name: 'Calcium carbide', formula: 'CaC₂', smiles: '[Ca+2].[C-]#[C-]', state: 's', cat: 'salt',
      dHf: -59.8, cp: 62.7, hazards: ['flammable'],
      desc: 'Contains a genuine C≡C²⁻ ion. Drop it in water and it gives off acetylene — the fuel of old miners’ lamps.' });
  S({ id: 'sf6', name: 'Sulfur hexafluoride', formula: 'SF₆', smiles: 'FS(F)(F)(F)(F)F', state: 'g', cat: 'gas',
      dHf: -1220.5, cp: 97.0, bp: -64,
      desc: 'A perfect octahedron. So inert and so dense that you can float a boat on it — and the worst greenhouse gas known.' });
  S({ id: 'nh4clo4', name: 'Ammonium perchlorate', formula: 'NH₄ClO₄', smiles: '[NH4+].[O-]Cl(=O)(=O)=O', state: 's', cat: 'oxidiser',
      dHf: -295.3, cp: 128.1, hazards: ['oxidiser', 'explosive'],
      desc: 'The oxidiser in solid rocket boosters, mixed with aluminium powder and a rubbery binder.' });

  /* ========================================================== catalysts == */

  S({ id: 'ni', name: 'Nickel', formula: 'Ni', smiles: '[Ni]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 26.1, mp: 1455, color: '#b6bcc0', catalyst: true,
      desc: 'A hydrogenation catalyst: it adsorbs hydrogen onto its surface and hands it to a double bond.' });
  S({ id: 'pt', name: 'Platinum', formula: 'Pt', smiles: '[Pt]', state: 's', cat: 'element', lattice: 'fcc',
      dHf: 0, cp: 25.9, mp: 1768, color: '#d4d4dc', catalyst: true,
      desc: 'Almost chemically inert, yet one of the finest catalysts known — the active metal in a car’s catalytic converter.' });
  S({ id: 'v2o5', name: 'Vanadium(V) oxide', formula: 'V₂O₅', smiles: 'O=[V](=O)O[V](=O)=O', state: 's', cat: 'oxide',
      dHf: -1550.6, cp: 127.7, mp: 690, color: '#e0932b', catalyst: true, hazards: ['toxic'],
      desc: 'The catalyst of the Contact process. It works by being reduced and re-oxidised over and over.' });
  S({ id: 'yeast', name: 'Yeast', formula: '—', smiles: '[C]', state: 's', cat: 'catalyst',
      dHf: 0, cp: 100, color: '#d9bb7a', catalyst: true, biological: true, noStructure: true,
      desc: 'Not a chemical but a living catalyst: a fungus whose enzymes turn sugar into ethanol and carbon dioxide.' });

  /* ================================================= reaction products etc == */

  S({ id: 'p4o10', name: 'Phosphorus pentoxide', formula: 'P₄O₁₀', smiles: 'O=P1(OP2(=O)OP3(=O)O1)OP(=O)(O2)O3',
      state: 's', cat: 'oxide', dHf: -2984.0, cp: 211.0, hazards: ['corrosive'],
      desc: 'A cage of four phosphorus atoms bridged by six oxygens, with one more on each corner. The most aggressive drying agent in common use.' });
  S({ id: 'n2o4', name: 'Dinitrogen tetroxide', formula: 'N₂O₄', smiles: 'O=[N+]([O-])[N+](=O)[O-]', state: 'g', cat: 'gas',
      dHf: 11.1, cp: 77.3, bp: 21.2, hazards: ['toxic', 'oxidiser'],
      desc: 'Two NO₂ molecules pairing up. Colourless when joined, brown when they split — the equilibrium shifts visibly with temperature.' });
  S({ id: 'zncl2', name: 'Zinc chloride', formula: 'ZnCl₂', smiles: '[Zn+2].[Cl-].[Cl-]', state: 's', cat: 'salt',
      dHf: -415.1, cp: 71.3, ions: { 'zn+2': 1, 'cl-': 2 }, hazards: ['corrosive'],
      desc: 'So hygroscopic it deliquesces in damp air, and concentrated solutions will dissolve cellulose.' });
  S({ id: 'mgcl2', name: 'Magnesium chloride', formula: 'MgCl₂', smiles: '[Mg+2].[Cl-].[Cl-]', state: 's', cat: 'salt',
      dHf: -641.3, cp: 71.4, ions: { 'mg+2': 1, 'cl-': 2 },
      desc: 'Extracted from seawater, and the bittern left behind after salt is crystallised.' });
  S({ id: 'cuno32', name: 'Copper(II) nitrate', formula: 'Cu(NO₃)₂', smiles: '[Cu+2].[O-][N+](=O)[O-].[O-][N+](=O)[O-]',
      state: 's', cat: 'salt', dHf: -302.9, cp: 155.0, color: '#2f7fd1', ions: { 'cu+2': 1, 'no3-': 2 }, hazards: ['oxidiser'],
      desc: 'The blue solution left when nitric acid dissolves copper.' });
  S({ id: 'ch3cl', name: 'Chloromethane', formula: 'CH₃Cl', smiles: 'CCl', state: 'g', cat: 'organic',
      dHf: -81.9, cp: 40.8, bp: -24.2, hazards: ['flammable', 'toxic'],
      desc: 'The first product of chlorinating methane — though the reaction rarely stops there.' });
  S({ id: 'ethylacetate', name: 'Ethyl acetate', formula: 'C₄H₈O₂', smiles: 'CCOC(C)=O', state: 'l', cat: 'organic',
      dHf: -479.0, cp: 170.7, bp: 77.1, hazards: ['flammable'],
      desc: 'The smell of nail polish remover and of pear drops. Made by boiling acetic acid with ethanol over an acid catalyst.' });
  S({ id: 'nitrobenzene', name: 'Nitrobenzene', formula: 'C₆H₅NO₂', smiles: 'O=[N+]([O-])c1ccccc1', state: 'l', cat: 'organic',
      dHf: 12.5, cp: 185.8, bp: 210.9, hazards: ['toxic'],
      desc: 'Made by nitrating benzene with a mixture of nitric and sulfuric acid. Smells of almonds and is absorbed straight through skin.' });

  /* ================================================ halogens and their salts == */

  S({ id: 'hf_g', name: 'Hydrogen fluoride', formula: 'HF', smiles: 'F', state: 'g', cat: 'gas',
      dHf: -273.3, cp: 29.1, bp: 19.5, hazards: ['corrosive', 'toxic'],
      desc: 'Hydrogen-bonds so strongly that it boils 100 °C higher than HCl despite being lighter.' });
  S({ id: 'hi', name: 'Hydroiodic acid', formula: 'HI', smiles: 'I', state: 'aq', cat: 'acid',
      dHf: -55.2, cp: 100, pKa: -10, strongAcid: true, ions: { 'h+': 1, 'i-': 1 }, hazards: ['corrosive'],
      desc: 'The strongest of the common hydrohalic acids — the H–I bond is the longest and weakest.' });
  S({ id: 'hocl', name: 'Hypochlorous acid', formula: 'HOCl', smiles: 'OCl', state: 'aq', cat: 'acid',
      dHf: -120.9, cp: 100, pKa: 7.53, ions: { 'h+': 1, 'ocl-': 1 }, hazards: ['oxidiser'],
      desc: 'The species that actually does the disinfecting in chlorinated water. Weak as an acid, strong as an oxidiser.' });
  S({ id: 'nabr', name: 'Sodium bromide', formula: 'NaBr', smiles: '[Na+].[Br-]', state: 's', cat: 'salt',
      lattice: 'rocksalt', dHf: -361.1, cp: 51.4, ions: { 'na+': 1, 'br-': 1 },
      desc: 'A rock-salt structure like table salt, and the usual laboratory source of bromide.' });
  S({ id: 'nai', name: 'Sodium iodide', formula: 'NaI', smiles: '[Na+].[I-]', state: 's', cat: 'salt',
      lattice: 'rocksalt', dHf: -287.8, cp: 52.1, ions: { 'na+': 1, 'i-': 1 },
      desc: 'Very soluble, and slowly turns yellow in air as traces of iodide are oxidised to iodine.' });
  S({ id: 'kbr', name: 'Potassium bromide', formula: 'KBr', smiles: '[K+].[Br-]', state: 's', cat: 'salt',
      lattice: 'rocksalt', dHf: -393.8, cp: 52.3, ions: { 'k+': 1, 'br-': 1 },
      desc: 'Transparent well into the infrared, which is why spectroscopists press their samples into discs of it.' });
  S({ id: 'caf2', name: 'Calcium fluoride', formula: 'CaF₂', smiles: '[Ca+2].[F-].[F-]', state: 's', cat: 'mineral',
      dHf: -1228.0, cp: 67.0, ksp: 3.9e-11, insoluble: true, color: '#e8eef2',
      desc: 'Fluorite. The mineral that gave fluorescence its name, and the source of nearly all fluorine chemistry.' });

  /* ============================================== sulfur and nitrogen salts == */

  S({ id: 'h2so3', name: 'Sulfurous acid', formula: 'H₂SO₃', smiles: 'OS(=O)O', state: 'aq', cat: 'acid',
      dHf: -608.8, cp: 100, pKa: 1.86, protons: 2, ions: { 'h+': 1, 'hso3-': 1 }, hazards: ['corrosive'],
      desc: 'What sulfur dioxide becomes in water, and one half of why coal smoke makes acid rain.' });
  S({ id: 'na2so3', name: 'Sodium sulfite', formula: 'Na₂SO₃', smiles: '[Na+].[Na+].[O-]S(=O)[O-]', state: 's', cat: 'salt',
      dHf: -1100.8, cp: 120.3, ions: { 'na+': 2, 'so3-2': 1 },
      desc: 'A reducing agent and oxygen scavenger; the preservative that makes some wines smell of struck matches.' });
  S({ id: 'na2s', name: 'Sodium sulfide', formula: 'Na₂S', smiles: '[Na+].[Na+].[S-2]', state: 's', cat: 'salt',
      dHf: -364.8, cp: 97.0, ions: { 'na+': 2, 's-2': 1 }, hazards: ['corrosive'],
      desc: 'Its solutions smell of rotten eggs, because sulfide pulls protons off water to make H₂S.' });
  S({ id: 'fes', name: 'Iron(II) sulfide', formula: 'FeS', smiles: '[Fe+2].[S-2]', state: 's', cat: 'precipitate',
      dHf: -100.0, cp: 50.5, ksp: 6.0e-19, color: '#1c1c22', insoluble: true,
      desc: 'The black solid made by heating iron with sulfur, and the classic laboratory source of hydrogen sulfide.' });
  S({ id: 'zns', name: 'Zinc sulfide', formula: 'ZnS', smiles: '[Zn+2].[S-2]', state: 's', cat: 'precipitate',
      dHf: -206.0, cp: 45.8, ksp: 2.0e-25, color: '#f4f4ee', insoluble: true,
      desc: 'Sphalerite. Glows when struck by radiation — Rutherford counted alpha particles by watching it flash.' });
  S({ id: 'cus', name: 'Copper(II) sulfide', formula: 'CuS', smiles: '[Cu+2].[S-2]', state: 's', cat: 'precipitate',
      dHf: -53.1, cp: 47.8, ksp: 6.0e-37, color: '#0d0d10', insoluble: true,
      desc: 'So insoluble it precipitates from acidic solution, which is what separates copper from most other metals in analysis.' });
  S({ id: 'kno2', name: 'Potassium nitrite', formula: 'KNO₂', smiles: '[K+].[O-]N=O', state: 's', cat: 'salt',
      dHf: -369.8, cp: 107.4, ions: { 'k+': 1, 'no2-': 1 }, hazards: ['oxidiser', 'toxic'],
      desc: 'What potassium nitrate leaves behind when it gives up an oxygen on heating.' });
  S({ id: 'cahco32', name: 'Calcium bicarbonate', formula: 'Ca(HCO₃)₂', smiles: '[Ca+2].OC(=O)[O-].OC(=O)[O-]',
      state: 'aq', cat: 'salt', dHf: -1925.6, cp: 200, ions: { 'ca+2': 1, 'hco3-': 2 },
      desc: 'Only ever exists in solution. It is temporary hardness in water, and the reason limestone caves have stalactites.' });

  /* ============================================================ aqueous ions == */

  function ION(id, name, formula, smiles, charge, dHf, opts) {
    opts = opts || {};
    return S({
      id: id, name: name, formula: formula, smiles: smiles, state: 'aq', cat: 'ion',
      dHf: dHf, cp: opts.cp || 60, charge: charge, color: opts.color,
      spectator: opts.spectator, metal: opts.metal, desc: opts.desc || ''
    });
  }

  ION('h+', 'Hydrogen ion', 'H⁺', '[H+]', 1, 0, { desc: 'In water it never travels bare — it rides as H₃O⁺, hopping from molecule to molecule. Its concentration is what pH measures.' });
  ION('oh-', 'Hydroxide ion', 'OH⁻', '[OH-]', -1, -230.0, { desc: 'The counterpart to H⁺. Their product is fixed at 10⁻¹⁴ in water at 25 °C.' });
  ION('na+', 'Sodium ion', 'Na⁺', '[Na+]', 1, -240.1, { spectator: true, metal: 'na', desc: 'A spectator in almost every reaction, and a bright yellow flame test.' });
  ION('k+', 'Potassium ion', 'K⁺', '[K+]', 1, -252.4, { spectator: true, metal: 'k', desc: 'Lilac flame test, best seen through blue cobalt glass.' });
  ION('li+', 'Lithium ion', 'Li⁺', '[Li+]', 1, -278.5, { spectator: true, metal: 'li', desc: 'Crimson flame test.' });
  ION('ca+2', 'Calcium ion', 'Ca²⁺', '[Ca+2]', 2, -542.8, { metal: 'ca', desc: 'Orange-red flame test. Hard water is largely calcium.' });
  ION('mg+2', 'Magnesium ion', 'Mg²⁺', '[Mg+2]', 2, -466.9, { metal: 'mg' });
  ION('ba+2', 'Barium ion', 'Ba²⁺', '[Ba+2]', 2, -537.6, { metal: 'ba', desc: 'Pale green flame test. Toxic unless locked up as the insoluble sulfate.' });
  ION('al+3', 'Aluminium ion', 'Al³⁺', '[Al+3]', 3, -531.0, { metal: 'al' });
  ION('zn+2', 'Zinc ion', 'Zn²⁺', '[Zn+2]', 2, -153.9, { metal: 'zn' });
  ION('fe+2', 'Iron(II) ion', 'Fe²⁺', '[Fe+2]', 2, -89.1, { color: '#9dc49a', metal: 'fe', desc: 'Pale green in solution, and slowly oxidised by air to iron(III).' });
  ION('fe+3', 'Iron(III) ion', 'Fe³⁺', '[Fe+3]', 3, -48.5, { color: '#c98a3a', metal: 'fe', desc: 'Yellow-brown and distinctly acidic, because it pulls protons off its own water ligands.' });
  ION('cu+2', 'Copper(II) ion', 'Cu²⁺', '[Cu+2]', 2, 64.8, { color: '#2a7fd4', metal: 'cu', desc: 'The blue of copper solutions is the hexaaqua ion, [Cu(H₂O)₆]²⁺.' });
  ION('ag+', 'Silver ion', 'Ag⁺', '[Ag+]', 1, 105.6, { metal: 'ag' });
  ION('pb+2', 'Lead(II) ion', 'Pb²⁺', '[Pb+2]', 2, -1.7, { metal: 'pb' });
  ION('nh4+', 'Ammonium ion', 'NH₄⁺', '[NH4+]', 1, -133.3, { desc: 'A perfect tetrahedron, and the conjugate acid of ammonia.' });
  ION('cl-', 'Chloride ion', 'Cl⁻', '[Cl-]', -1, -167.2, { spectator: true });
  ION('br-', 'Bromide ion', 'Br⁻', '[Br-]', -1, -121.6, { spectator: true });
  ION('i-', 'Iodide ion', 'I⁻', '[I-]', -1, -55.2, { spectator: true });
  ION('f-', 'Fluoride ion', 'F⁻', '[F-]', -1, -332.6, { spectator: true });
  ION('so4-2', 'Sulfate ion', 'SO₄²⁻', '[O-]S(=O)(=O)[O-]', -2, -909.3, { desc: 'A tetrahedron of oxygens around sulfur, with the charge spread evenly over all four.' });
  ION('no3-', 'Nitrate ion', 'NO₃⁻', '[O-][N+](=O)[O-]', -1, -205.0, { spectator: true, desc: 'Trigonal planar and delocalised — every nitrogen–oxygen bond is identical.' });
  ION('co3-2', 'Carbonate ion', 'CO₃²⁻', '[O-]C(=O)[O-]', -2, -677.1, { desc: 'Flat and delocalised. Reacts with any acid to give off carbon dioxide.' });
  ION('hco3-', 'Bicarbonate ion', 'HCO₃⁻', 'OC(=O)[O-]', -1, -692.0, { desc: 'The buffer that holds your blood at pH 7.4.' });
  ION('po4-3', 'Phosphate ion', 'PO₄³⁻', '[O-]P(=O)([O-])[O-]', -3, -1277.4);
  ION('h2po4-', 'Dihydrogen phosphate', 'H₂PO₄⁻', 'OP(=O)(O)[O-]', -1, -1296.3);
  ION('ch3coo-', 'Acetate ion', 'CH₃COO⁻', 'CC(=O)[O-]', -1, -486.0, { desc: 'The two C–O bonds are equal — the charge is shared between both oxygens.' });
  ION('hcoo-', 'Formate ion', 'HCOO⁻', '[O-]C=O', -1, -425.6);
  ION('mno4-', 'Permanganate ion', 'MnO₄⁻', '[O-][Mn](=O)(=O)=O', -1, -541.4, { color: '#5b1470', desc: 'Manganese in its +7 state, and intensely purple for it.' });
  ION('cn-', 'Cyanide ion', 'CN⁻', '[C-]#N', -1, 151.0);
  ION('clo3-', 'Chlorate ion', 'ClO₃⁻', '[O-]Cl(=O)=O', -1, -104.0);
  ION('ocl-', 'Hypochlorite ion', 'ClO⁻', '[O-]Cl', -1, -107.1);
  ION('s-2', 'Sulfide ion', 'S²⁻', '[S-2]', -2, 33.1);
  ION('no2-', 'Nitrite ion', 'NO₂⁻', '[O-]N=O', -1, -104.6, { desc: 'Bent, unlike the flat trigonal nitrate — the nitrogen keeps a lone pair.' });
  ION('so3-2', 'Sulfite ion', 'SO₃²⁻', '[O-]S(=O)[O-]', -2, -635.5, { desc: 'Trigonal pyramidal, and readily oxidised on to sulfate.' });
  ION('hso3-', 'Bisulfite ion', 'HSO₃⁻', 'OS(=O)[O-]', -1, -626.2);

  /* Which cation/anion pairs come out of solution, and as what. */
  var PRECIPITATES = [
    { cation: 'ag+', anion: 'cl-', solid: 'agcl' },
    { cation: 'ag+', anion: 'br-', solid: 'agbr' },
    { cation: 'ag+', anion: 'i-', solid: 'agi' },
    { cation: 'ba+2', anion: 'so4-2', solid: 'baso4' },
    { cation: 'pb+2', anion: 'i-', solid: 'pbi2' },
    { cation: 'ca+2', anion: 'co3-2', solid: 'caco3' },
    { cation: 'ca+2', anion: 'so4-2', solid: 'caso4' },
    { cation: 'cu+2', anion: 'oh-', solid: 'cuoh2' },
    { cation: 'fe+3', anion: 'oh-', solid: 'feoh3' },
    { cation: 'mg+2', anion: 'oh-', solid: 'mgoh2' },
    { cation: 'ca+2', anion: 'oh-', solid: 'caoh2' },
    { cation: 'fe+2', anion: 's-2', solid: 'fes' },
    { cation: 'zn+2', anion: 's-2', solid: 'zns' },
    { cation: 'cu+2', anion: 's-2', solid: 'cus' },
    { cation: 'ca+2', anion: 'f-', solid: 'caf2' }
  ];

  /* Halogens in order of oxidising power. Any of them displaces the halides of
   * everything below it: Cl2 + 2Br- -> 2Cl- + Br2, and so on down. */
  var HALOGENS = [
    { id: 'f2', ion: 'f-', name: 'fluorine' },
    { id: 'cl2', ion: 'cl-', name: 'chlorine' },
    { id: 'br2', ion: 'br-', name: 'bromine' },
    { id: 'i2', ion: 'i-', name: 'iodine' }
  ];

  /* Standard reduction-potential ordering, most reactive metal first. A metal
   * displaces any ion of a metal that appears later in this list. */
  var ACTIVITY_SERIES = ['li', 'k', 'ba', 'ca', 'na', 'mg', 'al', 'zn', 'fe', 'pb', 'h', 'cu', 'ag', 'hg', 'au'];

  var FLAME_COLOURS = {
    'na+': { colour: '#ffb31a', label: 'intense yellow' },
    'k+': { colour: '#c77dff', label: 'lilac' },
    'li+': { colour: '#e0245e', label: 'crimson' },
    'ca+2': { colour: '#ff6b35', label: 'orange-red' },
    'ba+2': { colour: '#9ae66e', label: 'pale green' },
    'cu+2': { colour: '#3ddad7', label: 'blue-green' }
  };

  /* Densities in g/cm³ at room temperature, so amounts can be shown as grams for
   * solids and as millilitres for liquids. Aqueous reagents carry the density of
   * the bench solution rather than of the pure substance. Gases are not listed —
   * their volume comes from the ideal gas law instead. */
  var DENSITY = {
    water: 1.000, ice: 0.917, h2o2: 1.450, br2: 3.102, hg: 13.534,
    h2so4: 1.831, ch3cooh: 1.049, hcooh: 1.220, citric: 1.665,
    /* Bench solutions: the density of the diluted solution you actually pour,
       to match the molarity in BENCH below. The concentrated-reagent figure
       would overstate the water each pour carries by 15% or more. */
    hcl: 1.033, hno3: 1.063, hbr: 1.077, hi: 1.120, hf: 1.018,
    h3po4: 1.052, hcn: 0.999, h2so3: 1.024, hocl: 1.001, h2co3: 1.000,
    cahco32: 1.004, naocl: 1.037, nh4oh: 0.985, h2so4_dil: 1.060,
    ch3oh: 0.792, c2h5oh: 0.789, propanol: 0.786, glycol: 1.113,
    acetone: 0.784, benzene: 0.876, toluene: 0.867, ccl4: 1.594, chcl3: 1.489,
    c8h18: 0.703, ethylacetate: 0.902, nitrobenzene: 1.199, nitroglycerin: 1.600,

    li: 0.534, na: 0.968, k: 0.862, mg: 1.738, ca: 1.550, al: 2.700,
    fe: 7.874, cu: 8.960, zn: 7.140, ag: 10.490, au: 19.300, pb: 11.340,
    ni: 8.908, pt: 21.450, c: 2.267, diamond: 3.510, si: 2.329,
    s8: 2.070, p4: 1.823, i2: 4.930,

    nacl: 2.165, kcl: 1.984, nabr: 3.210, nai: 3.670, kbr: 2.750, ki: 3.120,
    kno3: 2.110, nano3: 2.257, kno2: 1.915, caco3: 2.711, caso4: 2.960,
    cacl2: 2.150, mgcl2: 2.325, zncl2: 2.907, bacl2: 3.856, caf2: 3.180,
    cuso4: 3.600, cuso4_5h2o: 2.286, feso4: 2.840, fecl3: 2.900,
    agno3: 4.350, agcl: 5.560, agbr: 6.473, agi: 5.675, baso4: 4.490,
    pbi2: 6.160, pbno32: 4.530, cuno32: 3.050,
    nh4cl: 1.527, nh4no3: 1.725, nh4clo4: 1.950,
    kmno4: 2.703, k2cr2o7: 2.676, kclo3: 2.340,
    znso4: 3.540, na2so4: 2.664, mgso4: 2.660, na2so3: 2.633, na2s: 1.856,
    fes: 4.840, zns: 4.090, cus: 4.760,
    naoh: 2.130, koh: 2.120, caoh2: 2.211, lioh: 1.460, mgoh2: 2.345,
    cuoh2: 3.368, feoh3: 4.250, nahco3: 2.200, na2co3: 2.540,
    cao: 3.340, mgo: 3.580, fe2o3: 5.242, cuo: 6.315, al2o3: 3.950,
    sio2: 2.650, mno2: 5.026, v2o5: 3.357, p4o10: 2.390,
    glucose: 1.540, sucrose: 1.587, glycine: 1.607, caffeine: 1.230,
    aspirin: 1.400, urea: 1.320, c6h5cooh: 1.266, phenol: 1.070,
    naphthalene: 1.140, tnt: 1.654, nan3: 1.846, cac2: 2.220, yeast: 1.000
  };

  /* Molarity of each bench solution. A liquid reagent without an entry here is
   * the neat substance — concentrated sulfuric acid, ethanol, bromine. */
  var BENCH = {
    hcl: 2.0, hno3: 2.0, hbr: 1.0, hi: 1.0, hf: 1.0, h3po4: 1.0,
    hcn: 1.0, h2so3: 0.5, hocl: 0.1, h2co3: 0.03, cahco32: 0.05,
    naocl: 0.70, nh4oh: 2.0, h2so4_dil: 1.0
  };

  LIST.forEach(function (sp) {
    if (DENSITY[sp.id] !== undefined) sp.density = DENSITY[sp.id];
    if (BENCH[sp.id] !== undefined) sp.bench = BENCH[sp.id];
  });

  global.Chem.Species = {
    all: LIST,
    halogens: HALOGENS,
    byId: BY_ID,
    get: function (id) { return BY_ID[id] || null; },
    precipitates: PRECIPITATES,
    activitySeries: ACTIVITY_SERIES,
    flameColours: FLAME_COLOURS,
    categories: ['element', 'acid', 'base', 'salt', 'oxide', 'organic', 'biochem',
      'gas', 'solvent', 'oxidiser', 'precipitate', 'mineral', 'energetic', 'ion', 'solid']
  };
})(window);
