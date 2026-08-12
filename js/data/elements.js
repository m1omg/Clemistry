/* Clemistry — periodic table data.
 * Fields: Z | symbol | name | atomic mass (u) | category | group | period |
 *         Pauling electronegativity | melting point (C) | boiling point (C) | phase at 25C
 * Sources: IUPAC 2021 standard atomic weights, CRC Handbook 104th ed.
 * A dash means "not applicable / not measured".
 */
(function (global) {
  'use strict';

  var RAW = [
    '1|H|Hydrogen|1.008|nonmetal|1|1|2.20|-259.16|-252.88|g',
    '2|He|Helium|4.0026|noble|18|1|-|-272.20|-268.93|g',
    '3|Li|Lithium|6.94|alkali|1|2|0.98|180.5|1342|s',
    '4|Be|Beryllium|9.0122|alkaline|2|2|1.57|1287|2469|s',
    '5|B|Boron|10.81|metalloid|13|2|2.04|2076|3927|s',
    '6|C|Carbon|12.011|nonmetal|14|2|2.55|3550|4027|s',
    '7|N|Nitrogen|14.007|nonmetal|15|2|3.04|-210.0|-195.79|g',
    '8|O|Oxygen|15.999|nonmetal|16|2|3.44|-218.79|-182.96|g',
    '9|F|Fluorine|18.998|halogen|17|2|3.98|-219.67|-188.11|g',
    '10|Ne|Neon|20.180|noble|18|2|-|-248.59|-246.05|g',
    '11|Na|Sodium|22.990|alkali|1|3|0.93|97.79|882.9|s',
    '12|Mg|Magnesium|24.305|alkaline|2|3|1.31|650|1090|s',
    '13|Al|Aluminium|26.982|post|13|3|1.61|660.32|2470|s',
    '14|Si|Silicon|28.085|metalloid|14|3|1.90|1414|3265|s',
    '15|P|Phosphorus|30.974|nonmetal|15|3|2.19|44.15|280.5|s',
    '16|S|Sulfur|32.06|nonmetal|16|3|2.58|115.21|444.6|s',
    '17|Cl|Chlorine|35.45|halogen|17|3|3.16|-101.5|-34.04|g',
    '18|Ar|Argon|39.95|noble|18|3|-|-189.34|-185.85|g',
    '19|K|Potassium|39.098|alkali|1|4|0.82|63.5|759|s',
    '20|Ca|Calcium|40.078|alkaline|2|4|1.00|842|1484|s',
    '21|Sc|Scandium|44.956|transition|3|4|1.36|1541|2836|s',
    '22|Ti|Titanium|47.867|transition|4|4|1.54|1668|3287|s',
    '23|V|Vanadium|50.942|transition|5|4|1.63|1910|3407|s',
    '24|Cr|Chromium|51.996|transition|6|4|1.66|1907|2671|s',
    '25|Mn|Manganese|54.938|transition|7|4|1.55|1246|2061|s',
    '26|Fe|Iron|55.845|transition|8|4|1.83|1538|2862|s',
    '27|Co|Cobalt|58.933|transition|9|4|1.88|1495|2927|s',
    '28|Ni|Nickel|58.693|transition|10|4|1.91|1455|2913|s',
    '29|Cu|Copper|63.546|transition|11|4|1.90|1084.6|2562|s',
    '30|Zn|Zinc|65.38|transition|12|4|1.65|419.53|907|s',
    '31|Ga|Gallium|69.723|post|13|4|1.81|29.76|2400|s',
    '32|Ge|Germanium|72.630|metalloid|14|4|2.01|938.25|2833|s',
    '33|As|Arsenic|74.922|metalloid|15|4|2.18|817|614|s',
    '34|Se|Selenium|78.971|nonmetal|16|4|2.55|221|685|s',
    '35|Br|Bromine|79.904|halogen|17|4|2.96|-7.2|58.8|l',
    '36|Kr|Krypton|83.798|noble|18|4|3.00|-157.37|-153.42|g',
    '37|Rb|Rubidium|85.468|alkali|1|5|0.82|39.31|688|s',
    '38|Sr|Strontium|87.62|alkaline|2|5|0.95|777|1377|s',
    '39|Y|Yttrium|88.906|transition|3|5|1.22|1526|3345|s',
    '40|Zr|Zirconium|91.224|transition|4|5|1.33|1855|4409|s',
    '41|Nb|Niobium|92.906|transition|5|5|1.60|2477|4744|s',
    '42|Mo|Molybdenum|95.95|transition|6|5|2.16|2623|4639|s',
    '43|Tc|Technetium|98|transition|7|5|1.90|2157|4265|s',
    '44|Ru|Ruthenium|101.07|transition|8|5|2.20|2334|4150|s',
    '45|Rh|Rhodium|102.91|transition|9|5|2.28|1964|3695|s',
    '46|Pd|Palladium|106.42|transition|10|5|2.20|1554.9|2963|s',
    '47|Ag|Silver|107.87|transition|11|5|1.93|961.78|2162|s',
    '48|Cd|Cadmium|112.41|transition|12|5|1.69|321.07|767|s',
    '49|In|Indium|114.82|post|13|5|1.78|156.6|2072|s',
    '50|Sn|Tin|118.71|post|14|5|1.96|231.93|2602|s',
    '51|Sb|Antimony|121.76|metalloid|15|5|2.05|630.63|1587|s',
    '52|Te|Tellurium|127.60|metalloid|16|5|2.10|449.51|988|s',
    '53|I|Iodine|126.90|halogen|17|5|2.66|113.7|184.3|s',
    '54|Xe|Xenon|131.29|noble|18|5|2.60|-111.75|-108.10|g',
    '55|Cs|Caesium|132.91|alkali|1|6|0.79|28.44|671|s',
    '56|Ba|Barium|137.33|alkaline|2|6|0.89|727|1845|s',
    '57|La|Lanthanum|138.91|lanthanide|3|6|1.10|920|3464|s',
    '58|Ce|Cerium|140.12|lanthanide|0|6|1.12|795|3443|s',
    '59|Pr|Praseodymium|140.91|lanthanide|0|6|1.13|935|3520|s',
    '60|Nd|Neodymium|144.24|lanthanide|0|6|1.14|1024|3074|s',
    '61|Pm|Promethium|145|lanthanide|0|6|1.13|1042|3000|s',
    '62|Sm|Samarium|150.36|lanthanide|0|6|1.17|1072|1794|s',
    '63|Eu|Europium|151.96|lanthanide|0|6|1.20|826|1529|s',
    '64|Gd|Gadolinium|157.25|lanthanide|0|6|1.20|1312|3273|s',
    '65|Tb|Terbium|158.93|lanthanide|0|6|1.10|1356|3230|s',
    '66|Dy|Dysprosium|162.50|lanthanide|0|6|1.22|1407|2562|s',
    '67|Ho|Holmium|164.93|lanthanide|0|6|1.23|1461|2600|s',
    '68|Er|Erbium|167.26|lanthanide|0|6|1.24|1529|2868|s',
    '69|Tm|Thulium|168.93|lanthanide|0|6|1.25|1545|1950|s',
    '70|Yb|Ytterbium|173.05|lanthanide|0|6|1.10|824|1196|s',
    '71|Lu|Lutetium|174.97|lanthanide|3|6|1.27|1652|3402|s',
    '72|Hf|Hafnium|178.49|transition|4|6|1.30|2233|4603|s',
    '73|Ta|Tantalum|180.95|transition|5|6|1.50|3017|5458|s',
    '74|W|Tungsten|183.84|transition|6|6|2.36|3422|5555|s',
    '75|Re|Rhenium|186.21|transition|7|6|1.90|3186|5596|s',
    '76|Os|Osmium|190.23|transition|8|6|2.20|3033|5012|s',
    '77|Ir|Iridium|192.22|transition|9|6|2.20|2466|4428|s',
    '78|Pt|Platinum|195.08|transition|10|6|2.28|1768.3|3825|s',
    '79|Au|Gold|196.97|transition|11|6|2.54|1064.18|2856|s',
    '80|Hg|Mercury|200.59|transition|12|6|2.00|-38.83|356.73|l',
    '81|Tl|Thallium|204.38|post|13|6|1.62|304|1473|s',
    '82|Pb|Lead|207.2|post|14|6|2.33|327.46|1749|s',
    '83|Bi|Bismuth|208.98|post|15|6|2.02|271.4|1564|s',
    '84|Po|Polonium|209|post|16|6|2.00|254|962|s',
    '85|At|Astatine|210|halogen|17|6|2.20|302|337|s',
    '86|Rn|Radon|222|noble|18|6|2.20|-71|-61.7|g',
    '87|Fr|Francium|223|alkali|1|7|0.70|21|650|s',
    '88|Ra|Radium|226|alkaline|2|7|0.90|700|1737|s',
    '89|Ac|Actinium|227|actinide|3|7|1.10|1050|3200|s',
    '90|Th|Thorium|232.04|actinide|0|7|1.30|1750|4788|s',
    '91|Pa|Protactinium|231.04|actinide|0|7|1.50|1568|4027|s',
    '92|U|Uranium|238.03|actinide|0|7|1.38|1135|4131|s',
    '93|Np|Neptunium|237|actinide|0|7|1.36|644|3902|s',
    '94|Pu|Plutonium|244|actinide|0|7|1.28|639.4|3228|s',
    '95|Am|Americium|243|actinide|0|7|1.13|1176|2011|s',
    '96|Cm|Curium|247|actinide|0|7|1.28|1345|3110|s',
    '97|Bk|Berkelium|247|actinide|0|7|1.30|1050|2627|s',
    '98|Cf|Californium|251|actinide|0|7|1.30|900|1470|s',
    '99|Es|Einsteinium|252|actinide|0|7|1.30|860|996|s',
    '100|Fm|Fermium|257|actinide|0|7|1.30|1527|-|s',
    '101|Md|Mendelevium|258|actinide|0|7|1.30|827|-|s',
    '102|No|Nobelium|259|actinide|0|7|1.30|827|-|s',
    '103|Lr|Lawrencium|266|actinide|3|7|1.30|1627|-|s',
    '104|Rf|Rutherfordium|267|transition|4|7|-|2100|5500|s',
    '105|Db|Dubnium|268|transition|5|7|-|-|-|s',
    '106|Sg|Seaborgium|269|transition|6|7|-|-|-|s',
    '107|Bh|Bohrium|270|transition|7|7|-|-|-|s',
    '108|Hs|Hassium|269|transition|8|7|-|-|-|s',
    '109|Mt|Meitnerium|278|unknown|9|7|-|-|-|s',
    '110|Ds|Darmstadtium|281|unknown|10|7|-|-|-|s',
    '111|Rg|Roentgenium|282|unknown|11|7|-|-|-|s',
    '112|Cn|Copernicium|285|transition|12|7|-|-|357|g',
    '113|Nh|Nihonium|286|unknown|13|7|-|700|1400|s',
    '114|Fl|Flerovium|289|unknown|14|7|-|-|-|s',
    '115|Mc|Moscovium|290|unknown|15|7|-|700|1400|s',
    '116|Lv|Livermorium|293|unknown|16|7|-|-|-|s',
    '117|Ts|Tennessine|294|unknown|17|7|-|700|883|s',
    '118|Og|Oganesson|294|unknown|18|7|-|-|350|g'
  ];

  /* Jmol / CPK colours. Anything not listed falls back to the "other" pink. */
  var CPK = {
    H: '#ffffff', He: '#d9ffff', Li: '#cc80ff', Be: '#c2ff00', B: '#ffb5b5',
    C: '#909090', N: '#3050f8', O: '#ff0d0d', F: '#90e050', Ne: '#b3e3f5',
    Na: '#ab5cf2', Mg: '#8aff00', Al: '#bfa6a6', Si: '#f0c8a0', P: '#ff8000',
    S: '#ffff30', Cl: '#1ff01f', Ar: '#80d1e3', K: '#8f40d4', Ca: '#3dff00',
    Sc: '#e6e6e6', Ti: '#bfc2c7', V: '#a6a6ab', Cr: '#8a99c7', Mn: '#9c7ac7',
    Fe: '#e06633', Co: '#f090a0', Ni: '#50d050', Cu: '#c88033', Zn: '#7d80b0',
    Ga: '#c28f8f', Ge: '#668f8f', As: '#bd80e3', Se: '#ffa100', Br: '#a62929',
    Kr: '#5cb8d1', Rb: '#702eb0', Sr: '#00ff00', Y: '#94ffff', Zr: '#94e0e0',
    Nb: '#73c2c9', Mo: '#54b5b5', Tc: '#3b9e9e', Ru: '#248f8f', Rh: '#0a7d8c',
    Pd: '#006985', Ag: '#c0c0c0', Cd: '#ffd98f', In: '#a67573', Sn: '#668080',
    Sb: '#9e63b5', Te: '#d47a00', I: '#940094', Xe: '#429eb0', Cs: '#57178f',
    Ba: '#00c900', La: '#70d4ff', Ce: '#ffffc7', Pr: '#d9ffc7', Nd: '#c7ffc7',
    Pm: '#a3ffc7', Sm: '#8fffc7', Eu: '#61ffc7', Gd: '#45ffc7', Tb: '#30ffc7',
    Dy: '#1fffc7', Ho: '#00ff9c', Er: '#00e675', Tm: '#00d452', Yb: '#00bf38',
    Lu: '#00ab24', Hf: '#4dc2ff', Ta: '#4da6ff', W: '#2194d6', Re: '#267dab',
    Os: '#266696', Ir: '#175487', Pt: '#d0d0e0', Au: '#ffd123', Hg: '#b8b8d0',
    Tl: '#a6544d', Pb: '#575961', Bi: '#9e4fb5', Po: '#ab5c00', At: '#754f45',
    Rn: '#428296', Fr: '#420066', Ra: '#007d00', Ac: '#70abfa', Th: '#00baff',
    Pa: '#00a1ff', U: '#008fff', Np: '#0080ff', Pu: '#006bff', Am: '#545cf2',
    Cm: '#785ce3', Bk: '#8a4fe3', Cf: '#a136d4', Es: '#b31fd4', Fm: '#b31fba',
    Md: '#b30da6', No: '#bd0d87', Lr: '#c70066'
  };
  var CPK_DEFAULT = '#ff1493';

  /* Single-bond covalent radii in pm (Pyykko / Cordero consensus values).
   * Multiple-bond radii for the second-row elements come from the same tables. */
  var COVALENT = {
    H: 32, He: 46, Li: 133, Be: 102, B: 85, C: 75, N: 71, O: 63, F: 64, Ne: 67,
    Na: 155, Mg: 139, Al: 126, Si: 116, P: 111, S: 103, Cl: 99, Ar: 96,
    K: 196, Ca: 171, Sc: 148, Ti: 136, V: 134, Cr: 122, Mn: 119, Fe: 116,
    Co: 111, Ni: 110, Cu: 112, Zn: 118, Ga: 124, Ge: 121, As: 121, Se: 116,
    Br: 114, Kr: 117, Rb: 210, Sr: 185, Y: 163, Zr: 154, Nb: 147, Mo: 138,
    Tc: 128, Ru: 125, Rh: 125, Pd: 120, Ag: 128, Cd: 136, In: 142, Sn: 140,
    Sb: 140, Te: 136, I: 133, Xe: 131, Cs: 232, Ba: 196, La: 180, Ce: 163,
    Hf: 152, Ta: 146, W: 137, Re: 131, Os: 129, Ir: 122, Pt: 123, Au: 124,
    Hg: 133, Tl: 144, Pb: 144, Bi: 151, Po: 145, At: 147, Rn: 142,
    Fr: 223, Ra: 201, Ac: 186, Th: 175, U: 170, Pu: 187
  };
  var COVALENT_DEFAULT = 140;

  /* Bond-order specific radii where good data exists; otherwise a bond of
   * order n is shortened by the generic factors below. */
  var COVALENT_MULTI = {
    C: { 1.5: 69.5, 2: 67, 3: 60 }, N: { 1.5: 66, 2: 60, 3: 54 },
    O: { 1.5: 60, 2: 57, 3: 53 },
    S: { 2: 94 }, P: { 2: 102 }, B: { 2: 78 }, Si: { 2: 107 }
  };
  var ORDER_SHRINK = { 1: 1, 1.5: 0.93, 2: 0.90, 3: 0.83 };

  /* Van der Waals radii (pm) — used for space-filling mode and clash checks. */
  var VDW = {
    H: 120, He: 140, Li: 182, Be: 153, B: 192, C: 170, N: 155, O: 152, F: 147,
    Ne: 154, Na: 227, Mg: 173, Al: 184, Si: 210, P: 180, S: 180, Cl: 175,
    Ar: 188, K: 275, Ca: 231, Fe: 194, Ni: 163, Cu: 140, Zn: 139, Ga: 187,
    Ge: 211, As: 185, Se: 190, Br: 185, Kr: 202, Ag: 172, Cd: 158, Sn: 217,
    Sb: 206, Te: 206, I: 198, Xe: 216, Ba: 268, Pt: 175, Au: 166, Hg: 155,
    Pb: 202, U: 186
  };
  var VDW_DEFAULT = 175;

  var CATEGORY_LABEL = {
    nonmetal: 'Reactive nonmetal', noble: 'Noble gas', alkali: 'Alkali metal',
    alkaline: 'Alkaline earth metal', metalloid: 'Metalloid',
    halogen: 'Halogen', transition: 'Transition metal',
    post: 'Post-transition metal', lanthanide: 'Lanthanide',
    actinide: 'Actinide', unknown: 'Unknown properties'
  };

  var ELEMENTS = [];
  var BY_SYMBOL = {};

  function num(v) { return v === '-' ? null : parseFloat(v); }

  RAW.forEach(function (line) {
    var f = line.split('|');
    var el = {
      Z: parseInt(f[0], 10),
      symbol: f[1],
      name: f[2],
      mass: parseFloat(f[3]),
      category: f[4],
      categoryLabel: CATEGORY_LABEL[f[4]],
      group: parseInt(f[5], 10) || 0,
      period: parseInt(f[6], 10),
      en: num(f[7]),
      melt: num(f[8]),
      boil: num(f[9]),
      phase: f[10],
      color: CPK[f[1]] || CPK_DEFAULT,
      covalent: COVALENT[f[1]] || COVALENT_DEFAULT,
      vdw: VDW[f[1]] || VDW_DEFAULT
    };
    ELEMENTS.push(el);
    BY_SYMBOL[el.symbol] = el;
  });

  /* Covalent radius for a given element and bond order, in angstroms. */
  function radius(symbol, order) {
    var multi = COVALENT_MULTI[symbol];
    if (multi && multi[order]) return multi[order] / 100;
    var base = (BY_SYMBOL[symbol] ? BY_SYMBOL[symbol].covalent : COVALENT_DEFAULT) / 100;
    return base * (ORDER_SHRINK[order] || 1);
  }

  /* A few bonds where the radius sum is a poor predictor and the measured
   * value is well known. */
  var BOND_OVERRIDE = { 'H-H-1': 0.74, 'F-F-1': 1.42, 'O-O-1': 1.48, 'N-N-1': 1.45 };

  /* Predicted length of a bond between two elements, in angstroms. */
  function bondLength(a, b, order) {
    var key = (a < b ? a + '-' + b : b + '-' + a) + '-' + order;
    if (BOND_OVERRIDE[key]) return BOND_OVERRIDE[key];
    return radius(a, order) + radius(b, order);
  }

  function get(symbol) { return BY_SYMBOL[symbol] || null; }

  function color(symbol) {
    var el = BY_SYMBOL[symbol];
    return el ? el.color : CPK_DEFAULT;
  }

  global.Chem = global.Chem || {};
  global.Chem.Elements = {
    all: ELEMENTS,
    bySymbol: BY_SYMBOL,
    get: get,
    color: color,
    radius: radius,
    bondLength: bondLength,
    vdw: function (s) { return (VDW[s] || VDW_DEFAULT) / 100; },
    categoryLabel: CATEGORY_LABEL
  };
})(window);
