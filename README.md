# Clemistry

A chemistry sandbox that runs in the browser. Add reagents to a beaker, set the
conditions, and watch what the chemistry actually does — with the molecules
drawn as three-dimensional stick models built from real structural data.

**Play it: https://m1omg.github.io/Clemistry/**

Or clone the repository and open `index.html` directly. There is no build step
and no dependencies.

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push
to the default branch. There is nothing to build — the repository root is
uploaded as the Pages artifact exactly as it is.

Pages is already switched on for this repository, with **Settings → Pages →
Source** set to **GitHub Actions**. That step has to be done by hand once per
repository: the Actions token may deploy to Pages but is not permitted to create
the Pages site, so the workflow cannot enable the feature for itself.

## What makes it realistic

**Structures are derived, not drawn.** Every substance is defined by its
connectivity (as a SMILES string). The app parses that into an atom-and-bond
graph, fills in implicit hydrogens from standard valences, kekulizes aromatic
rings, and works out how many lone pairs each atom carries. Coordinates then
come from VSEPR: each atom is given the electron-domain geometry implied by its
steric number, rings are seeded as polygons, and the whole molecule is relaxed
under a small force field of bond lengths, 1-3 angle distances, sp²/aromatic
planarity and non-bonded repulsion.

The results match measured values:

| Molecule | Predicted | Measured |
|---|---|---|
| H–O–H angle in water | 104.7° | 104.5° |
| H–N–H angle in ammonia | 107.1° | 107.8° |
| H–C–H angle in methane | 109.5° | 109.5° |
| O=C=O in carbon dioxide | 180.0° | 180° |
| C–C in benzene | 1.39 Å, all six equal | 1.39 Å |
| P–P–P in white phosphorus | 60.0° | 60° |
| S₈ ring | puckered crown, 104.7° | crown, 108° |

Bond lengths come from covalent radii that depend on bond order, so a C=C comes
out shorter than a C–C, and an aromatic bond lands between the two. Ionic and
metallic solids are drawn as a piece of their actual crystal lattice — rock
salt, face- and body-centred cubic, hexagonal close-packed, diamond, graphite —
because they have no molecules to show.

**Energy is never invented.** The heat of any reaction is computed from the
standard enthalpies of formation of its products and reactants, and that heat is
distributed according to the molar heat capacities of everything in the vessel.
Thermite comes out at −851.5 kJ, methane at −802.5 kJ per mole, glucose at
−2803 kJ per mole against liquid water. All 95 named reactions are verified
balanced for both mass and charge.

**Solutions are modelled as ions.** Soluble compounds dissociate; weak acids and
bases stay molecular and are handled through their Ka. pH comes from solving the
electroneutrality condition by bisection, which is why the numbers behave
properly:

| System | Clemistry | Textbook |
|---|---|---|
| 0.1 M acetic acid | pH 2.88 | 2.87 |
| 0.1 M ammonia | pH 11.12 | 11.13 |
| 0.25 M sodium acetate (from titration) | pH 9.17 | ~9.2 |
| 0.25 M ammonium chloride (from titration) | pH 4.94 | ~4.93 |

**Amounts are measured the way you would measure them.** Solids and gases are
handled in grams, liquids in millilitres; the simulation converts to moles
underneath, because that is what stoichiometry needs. Gases also report their
volume, and dissolved species their molarity. Each substance starts at the
quantity you would actually reach for — a litre of water, ten grams of a salt,
a litre of a gas — so a solvent and a solute stay in a sensible ratio; type your
own figure and it is used instead.

Pouring a bench reagent brings its water with it: 50 mL of 2 M hydrochloric acid
is 0.1 mol of HCl and 2.66 mol of water, and that dilution shows up in the pH.
The strength and the density of each bench solution are stored together on the
species, so the pair always describes the same liquid. Concentrated sulfuric
acid and the dilute bench bottle are separate reagents, because they behave
differently — one chars sugar, the other is an ordinary strong acid.

**Some chemistry needs no reaction table at all.** Precipitation happens
whenever an ion product passes the solubility product. Metals displace each
other and dissolve in acid according to the activity series. Halogens displace
each other down group 17, so chlorine drives bromine out of a bromide and
bromine drives out iodine, while iodine does nothing to either. Basic oxides
dissolve in acid. Carbonates, sulfides, sulfites and ammonium salts each give up
their gas to the right reagent. Any carbon compound burns, with the equation
balanced on the fly. So combinations that were never explicitly listed still
behave correctly.

**Conditions matter.** Reactions may need igniting, heating past a threshold, a
catalyst, an electric current, or ultraviolet light. Hydrogen peroxide sits
almost unchanged until you drop in manganese dioxide. Thermite needs a real
ignition source. Electrolysis draws its energy from the supply rather than
chilling the beaker.

## Things to try

- Zinc in hydrochloric acid — steady fizzing, and the pH climbs as the acid is used up
- Silver nitrate with sodium chloride — a curdy white precipitate
- Lead nitrate with potassium iodide — golden rain
- Hydrogen peroxide, then manganese dioxide — nothing, then everything
- Aluminium with iron(III) oxide, then Ignite — thermite at over 2000 °C
- Sucrose with concentrated sulfuric acid — a black column of carbon
- Sodium in water, and then potassium in water
- Barium chloride with dilute sulfuric acid — the standard test for sulfate
- Water with the current on — hydrogen and oxygen in a 2:1 ratio
- Fluorine in water — it oxidises the water itself and sets the oxygen free
- Chlorine with potassium iodide, then iodine with potassium bromide (only one of them reacts)
- Limewater with carbon dioxide — the classic milky test
- Anhydrous copper sulfate with a few drops of water — white to blue

## Layout

```
index.html
css/app.css
js/
  data/elements.js     118 elements: masses, electronegativities, radii, CPK colours
  data/species.js      195 substances and aqueous ions: thermochemistry, densities
  chem/units.js        moles / grams / millilitres, and bench-solution strengths
  data/reactions.js    95 named reactions with their conditions
  chem/structure.js    SMILES parser, kekulization, valence and VSEPR analysis
  chem/geometry.js     3D coordinate generation and relaxation
  render/viewer.js     stick / ball-and-stick / space-filling molecule viewer
  render/vessel.js     the beaker, its particles and its flame
  sim/engine.js        dissolution, kinetics, pH, precipitation, energy balance
  ui/app.js            interface
```

## Sources

Atomic weights follow IUPAC 2021; physical constants, enthalpies of formation
and heat capacities are CRC Handbook / NIST values; covalent radii are the
Pyykkö–Cordero consensus set; colours are the standard Jmol CPK palette; VSEPR
geometries and the solubility rules follow the usual general-chemistry
treatment.

Where a value is an estimate rather than a measurement it is marked as such in
the data and shown with a `≈` in the interface.
