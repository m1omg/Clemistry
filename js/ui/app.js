/* Clemistry — user interface. */
(function (global) {
  'use strict';

  var E = global.Chem.Elements;
  var Sp = global.Chem.Species;
  var Rx = global.Chem.Reactions;
  var St = global.Chem.Structure;
  var fmt = global.Chem.fmtMoles;

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var vessel = new global.Chem.Vessel();
  var viewer, vesselView;
  var selectedId = null;
  var activeCategory = 'all';
  var searchTerm = '';
  var selectedElement = null;

  /* Reagents are shown on the shelf; bare aqueous ions are not — they appear
   * when something dissolves. */
  var SHELF = Sp.all.filter(function (sp) { return sp.cat !== 'ion'; });

  var CATEGORY_ORDER = ['all', 'element', 'acid', 'base', 'salt', 'oxide', 'organic',
    'biochem', 'gas', 'oxidiser', 'energetic', 'solvent', 'mineral', 'precipitate', 'catalyst'];

  /* How much of a thing a single click adds. */
  function defaultAmount(sp) {
    if (sp.solvent) return 55.5;              /* one litre of water */
    if (sp.state === 'g') return 1;
    if (sp.cat === 'ion') return 0.5;
    if (sp.catalyst) return 0.05;             /* a catalyst is not consumed */
    return 0.5;
  }

  /* =========================================================== shelf ==== */

  function buildCategoryChips() {
    var host = $('#category-chips');
    var present = {};
    SHELF.forEach(function (sp) { present[sp.cat] = true; });
    host.innerHTML = '';
    CATEGORY_ORDER.filter(function (c) { return c === 'all' || present[c]; }).forEach(function (cat) {
      var b = document.createElement('button');
      b.className = 'chip' + (cat === activeCategory ? ' active' : '');
      b.textContent = cat;
      b.addEventListener('click', function () {
        activeCategory = cat;
        buildCategoryChips();
        renderShelf();
      });
      host.appendChild(b);
    });
  }

  function matches(sp) {
    if (activeCategory !== 'all' && sp.cat !== activeCategory) return false;
    if (!searchTerm) return true;
    var q = searchTerm.toLowerCase();
    return sp.name.toLowerCase().indexOf(q) >= 0 ||
      plain(sp.formula).toLowerCase().indexOf(q) >= 0 ||
      sp.id.indexOf(q) >= 0;
  }

  var SUBSCRIPTS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  function plain(s) {
    return String(s).replace(/[₀-₉]/g, function (c) { return SUBSCRIPTS[c]; });
  }

  function renderShelf() {
    var host = $('#shelf-list');
    host.innerHTML = '';
    var list = SHELF.filter(matches);
    if (!list.length) {
      host.innerHTML = '<p class="empty-note">Nothing matches that search.</p>';
      return;
    }
    list.forEach(function (sp) {
      var row = document.createElement('div');
      row.className = 'shelf-item' + (sp.id === selectedId ? ' selected' : '');

      var swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = sp.color || fallbackColour(sp);

      var text = document.createElement('div');
      text.className = 'shelf-text';
      text.innerHTML =
        '<div class="shelf-name">' + escapeHtml(sp.name) + '</div>' +
        '<div class="shelf-formula">' + escapeHtml(sp.formula) +
        ' <span class="shelf-state">' + sp.state + '</span></div>';

      var add = document.createElement('button');
      add.className = 'add-btn';
      add.textContent = '+';
      add.title = 'Add ' + fmt(defaultAmount(sp)) + ' mol';
      add.addEventListener('click', function (ev) {
        ev.stopPropagation();
        vessel.add(sp.id, defaultAmount(sp));
        refreshAll();
      });

      row.appendChild(swatch);
      row.appendChild(text);
      row.appendChild(add);
      row.addEventListener('click', function () { select(sp.id); });
      host.appendChild(row);
    });
  }

  function fallbackColour(sp) {
    try {
      var mol = St.build(sp.smiles);
      var heavy = mol.atoms.filter(function (a) { return a.el !== 'H'; });
      return E.color((heavy[0] || mol.atoms[0]).el);
    } catch (e) { return '#3a4457'; }
  }

  /* ======================================================== selection ==== */

  function select(id) {
    selectedId = id;
    var sp = Sp.get(id);
    viewer.setSpecies(sp);
    $('#viewer-badge').textContent = sp ? sp.formula : '';
    renderShelf();
    renderSpeciesInfo(sp);
    showInfoTab('info');
  }

  function renderSpeciesInfo(sp) {
    var host = $('#species-info');
    if (!sp) {
      host.innerHTML = '<p class="empty-note">Select a substance to see its structure and data.</p>';
      return;
    }

    var mol = null;
    try { if (!sp.noStructure) mol = St.build(sp.smiles); } catch (e) { mol = null; }

    var rows = [];
    if (mol) rows.push(['Molar mass', mol.mass.toFixed(2) + ' g/mol']);
    rows.push(['State at 25 °C', stateName(sp.state)]);
    rows.push(['ΔH°f', (sp.approxDHf ? '≈ ' : '') + sp.dHf.toFixed(1) + ' kJ/mol']);
    rows.push(['Cp', sp.cp.toFixed(1) + ' J/(mol·K)']);
    if (sp.mp !== undefined) rows.push(['Melting point', sp.mp + ' °C']);
    if (sp.bp !== undefined) rows.push(['Boiling point', sp.bp + ' °C']);
    if (sp.pKa !== undefined) rows.push(['pKa', String(sp.pKa) + (sp.strongAcid ? '  (strong)' : '  (weak)')]);
    if (sp.pKb !== undefined) rows.push(['pKb', String(sp.pKb)]);
    if (sp.ksp !== undefined) rows.push(['Ksp', sp.ksp.toExponential(1)]);
    if (mol) {
      rows.push(['Atoms', String(mol.atoms.length)]);
      var central = centralAtom(mol);
      if (central) rows.push(['Shape at ' + central.el, central.geometry]);
    }
    if (sp.lattice) rows.push(['Crystal', latticeName(sp.lattice)]);

    var flame = Sp.flameColours[sp.id];

    host.innerHTML =
      '<h3>' + escapeHtml(sp.name) + '</h3>' +
      '<div class="species-formula">' + escapeHtml(sp.formula) + '</div>' +
      (sp.desc ? '<p class="species-desc">' + escapeHtml(sp.desc) + '</p>' : '') +
      (sp.hazards && sp.hazards.length
        ? '<div class="hazards">' + sp.hazards.map(function (h) {
            return '<span class="hazard ' + h + '">' + h + '</span>';
          }).join('') + '</div>'
        : '') +
      '<dl class="data-grid">' + rows.map(function (r) {
        return '<dt>' + r[0] + '</dt><dd>' + escapeHtml(String(r[1])) + '</dd>';
      }).join('') + '</dl>' +
      (flame ? '<p class="muted" style="margin-top:8px">Flame test: ' + flame.label + '</p>' : '') +
      reactionsInvolving(sp.id);
  }

  /* The most interesting atom to quote a shape for is the one bonded to the most
   * heavy atoms — quoting "tetrahedral" for a methyl group tells you nothing. */
  function centralAtom(mol) {
    var best = null, bestHeavy = -1;
    mol.atoms.forEach(function (a) {
      if (a.el === 'H') return;
      var heavy = a.neighbors.filter(function (n) { return mol.atoms[n].el !== 'H'; }).length;
      if (heavy > bestHeavy || (heavy === bestHeavy && best && a.lonePairs > best.lonePairs)) {
        best = a; bestHeavy = heavy;
      }
    });
    return best && best.neighbors.length >= 2 ? best : null;
  }

  function latticeName(t) {
    return ({
      rocksalt: 'rock salt (face-centred cubic)',
      fcc: 'face-centred cubic',
      bcc: 'body-centred cubic',
      hcp: 'hexagonal close-packed',
      diamond: 'diamond cubic',
      graphite: 'hexagonal layers'
    })[t] || t;
  }

  function stateName(s) {
    return ({ s: 'solid', l: 'liquid', g: 'gas', aq: 'aqueous solution' })[s] || s;
  }

  /* Which known reactions this substance takes part in. */
  function reactionsInvolving(id) {
    var involved = Rx.all.filter(function (r) {
      return r.in[id] !== undefined || r.out[id] !== undefined;
    });
    if (!involved.length) return '';
    return '<div class="data-grid" style="grid-template-columns:1fr">' +
      '<dt style="margin-bottom:2px">Takes part in</dt>' +
      involved.slice(0, 8).map(function (r) {
        return '<dd style="font-family:var(--sans);font-size:12px;color:var(--text-dim)">· ' +
          escapeHtml(r.name) + '</dd>';
      }).join('') + '</div>';
  }

  /* ================================================== periodic table ==== */

  function buildPeriodicTable() {
    var host = $('#periodic-table');
    host.innerHTML = '';
    var cells = {};

    E.all.forEach(function (el) {
      var col, row;
      if (el.category === 'lanthanide' && el.Z >= 58) { row = 9; col = el.Z - 58 + 3; }
      else if (el.category === 'actinide' && el.Z >= 90) { row = 10; col = el.Z - 90 + 3; }
      else { row = el.period; col = el.group; }
      cells[row + ',' + col] = el;
    });

    for (var row = 1; row <= 10; row++) {
      for (var col = 1; col <= 18; col++) {
        var el = cells[row + ',' + col];
        var cell = document.createElement('div');
        if (!el) {
          cell.className = 'pt-gap';
          cell.style.gridRow = row;
          cell.style.gridColumn = col;
          host.appendChild(cell);
          continue;
        }
        cell.className = 'pt-cell';
        cell.style.gridRow = row;
        cell.style.gridColumn = col;
        cell.style.background = categoryColour(el.category);
        cell.textContent = el.symbol;
        cell.title = el.name + ' (' + el.Z + ')';
        (function (element) {
          cell.addEventListener('click', function () {
            selectedElement = element.symbol;
            $$('.pt-cell').forEach(function (c) { c.classList.remove('selected'); });
            cell.classList.add('selected');
            renderElementDetail(element);
          });
        })(el);
        host.appendChild(cell);
      }
    }
  }

  var CATEGORY_COLOURS = {
    nonmetal: '#8ed3a0', noble: '#a9b8f0', alkali: '#ff9a76', alkaline: '#ffc36e',
    metalloid: '#8fd4d4', halogen: '#f2e07a', transition: '#c9a6e8',
    post: '#a8bcd4', lanthanide: '#f0a8c8', actinide: '#f28fa8', unknown: '#7d8a9c'
  };
  function categoryColour(c) { return CATEGORY_COLOURS[c] || '#7d8a9c'; }

  function renderElementDetail(el) {
    var species = Sp.all.filter(function (sp) {
      if (sp.cat === 'ion') return false;
      try {
        return St.build(sp.smiles).atoms.some(function (a) { return a.el === el.symbol; });
      } catch (e) { return false; }
    });

    var elemental = species.filter(function (sp) {
      try {
        var mol = St.build(sp.smiles);
        return mol.atoms.every(function (a) { return a.el === el.symbol; });
      } catch (e) { return false; }
    })[0];

    $('#element-detail').innerHTML =
      '<h3>' + el.name + ' <span class="muted">' + el.symbol + ' · Z = ' + el.Z + '</span></h3>' +
      '<p style="margin:4px 0 0;color:var(--text-dim);font-size:12px">' + el.categoryLabel + '</p>' +
      '<dl class="el-grid">' +
        row('Atomic mass', el.mass.toFixed(3) + ' u') +
        row('Group / period', (el.group || '—') + ' / ' + el.period) +
        row('Electronegativity', el.en === null ? '—' : el.en.toFixed(2)) +
        row('Melting point', el.melt === null ? '—' : el.melt + ' °C') +
        row('Boiling point', el.boil === null ? '—' : el.boil + ' °C') +
        row('Covalent radius', el.covalent + ' pm') +
        row('State at 25 °C', stateName(el.phase)) +
      '</dl>' +
      (elemental
        ? '<button class="btn accent" style="margin-top:10px" data-add-element="' + elemental.id + '">Add ' +
          escapeHtml(elemental.name) + '</button>'
        : '<p class="muted" style="margin-top:10px">Not available as a reagent in this sandbox.</p>') +
      (species.length
        ? '<p class="muted" style="margin-top:10px">Appears in ' + species.length + ' substance' +
          (species.length === 1 ? '' : 's') + ' on the shelf.</p>'
        : '');

    var btn = $('#element-detail [data-add-element]');
    if (btn) {
      btn.addEventListener('click', function () {
        var sp = Sp.get(btn.getAttribute('data-add-element'));
        vessel.add(sp.id, defaultAmount(sp));
        select(sp.id);
        refreshAll();
      });
    }
  }

  function row(k, v) { return '<dt>' + k + '</dt><dd>' + escapeHtml(String(v)) + '</dd>'; }

  /* ======================================================== the bench ==== */

  function renderContents(snapshot) {
    var host = $('#contents-list');
    var list = snapshot.contents;
    $('#contents-count').textContent = list.length
      ? list.length + ' species'
      : '';

    if (!list.length) {
      host.innerHTML = '<p class="empty-note">The vessel is empty. Pick something from the shelf.</p>';
      return;
    }

    host.innerHTML = '';
    list.forEach(function (item) {
      var sp = item.species;
      var row = document.createElement('div');
      row.className = 'content-row';
      row.innerHTML =
        '<span class="content-formula">' + escapeHtml(sp ? sp.formula : item.id) + '</span>' +
        '<span class="state-tag ' + (sp ? sp.state : '') + '">' + (sp ? sp.state : '?') + '</span>' +
        '<span class="content-name">' + escapeHtml(sp ? sp.name : item.id) + '</span>' +
        '<span class="content-amount">' + fmt(item.moles) + ' mol' +
          (item.conc > 0.0005 ? ' · ' + item.conc.toFixed(2) + ' M' : '') + '</span>';

      var rm = document.createElement('button');
      rm.className = 'remove-btn';
      rm.textContent = '×';
      rm.title = 'Remove all';
      rm.addEventListener('click', function (ev) {
        ev.stopPropagation();
        vessel.remove(item.id);
        refreshAll();
      });
      row.appendChild(rm);
      row.addEventListener('click', function () { if (sp) select(sp.id); });
      host.appendChild(row);
    });
  }

  function renderGauges(snapshot) {
    $('#gauge-temp').textContent = snapshot.TC.toFixed(1) + ' °C';
    $('#gauge-temp').style.color = snapshot.TC > 120 ? '#ff9d4d'
      : snapshot.TC < 5 ? '#7fc8ff' : '';

    var phEl = $('#gauge-ph'), marker = $('#ph-marker');
    if (snapshot.pH === null) {
      phEl.textContent = '—';
      marker.style.opacity = 0;
    } else {
      phEl.textContent = snapshot.pH.toFixed(2);
      marker.style.opacity = 1;
      marker.style.left = Math.max(0, Math.min(100, (snapshot.pH / 14) * 100)) + '%';
    }

    $('#gauge-volume').textContent = snapshot.volume.toFixed(2) + ' L';
    $('#gauge-gas').textContent = snapshot.gasMoles.toFixed(2) + ' mol';
  }

  function renderLog() {
    var host = $('#log-list');
    var entries = vessel.log.slice(-70).reverse();
    if (!entries.length) {
      host.innerHTML = '<p class="empty-note">Nothing has happened yet.</p>';
      return;
    }
    host.innerHTML = entries.map(function (e) {
      return '<div class="log-entry ' + e.kind + '">' +
        '<span class="log-time">' + e.t.toFixed(1) + 's</span>' +
        '<span>' + escapeHtml(e.message) + '</span></div>';
    }).join('');
  }

  var lastJournalCount = -1;
  function renderJournal() {
    var ids = Object.keys(vessel.discovered);
    $('#journal-count').textContent = ids.length;
    if (ids.length === lastJournalCount) return;
    lastJournalCount = ids.length;

    var host = $('#journal-list');
    if (!ids.length) {
      host.innerHTML = '<p class="empty-note">Reactions you trigger will be recorded here, ' +
        'with an explanation of what happened.</p>';
      return;
    }
    host.innerHTML = ids.map(function (id) {
      var d = vessel.discovered[id];
      var eq = d.reaction ? equationHtml(d.reaction) : '';
      var dh = d.reaction ? global.Chem.enthalpyOf(d.reaction) : null;
      return '<div class="journal-card">' +
        '<h4>' + escapeHtml(d.title) + '</h4>' +
        (eq ? '<p class="journal-eq">' + eq + '</p>' : '') +
        (dh !== null
          ? '<p class="journal-dh ' + (dh < 0 ? 'exo' : 'endo') + '">ΔH = ' + dh.toFixed(1) +
            ' kJ · ' + (dh < 0 ? 'exothermic' : 'endothermic') + '</p>'
          : '') +
        '<p style="margin-top:6px">' + escapeHtml(d.note || '') + '</p>' +
        '</div>';
    }).reverse().join('');
  }

  function equationHtml(r) {
    var side = function (obj) {
      return Object.keys(obj).map(function (id) {
        var sp = Sp.get(id);
        var n = obj[id];
        return (n === 1 ? '' : n + ' ') + (sp ? sp.formula : id);
      }).join(' + ');
    };
    var arrow = r.reversible ? ' ⇌ ' : ' → ';
    return escapeHtml(side(r.in)) + arrow + escapeHtml(side(r.out));
  }

  /* ========================================================== plumbing ==== */

  function refreshAll() {
    var snapshot = vessel.snapshot();
    renderContents(snapshot);
    renderGauges(snapshot);
    renderLog();
    renderJournal();
    vesselView.update(snapshot);
  }

  function showInfoTab(name) {
    $$('[data-info-tab]').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-info-tab') === name);
    });
    $$('[data-info-panel]').forEach(function (p) {
      p.classList.toggle('hidden', p.getAttribute('data-info-panel') !== name);
    });
  }

  function bindUI() {
    $('#search').addEventListener('input', function (e) {
      searchTerm = e.target.value.trim();
      renderShelf();
    });

    $$('[data-shelf-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-shelf-tab');
        $$('[data-shelf-tab]').forEach(function (t) { t.classList.toggle('active', t === tab); });
        $$('[data-shelf-panel]').forEach(function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-shelf-panel') !== name);
        });
      });
    });

    $$('[data-info-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () { showInfoTab(tab.getAttribute('data-info-tab')); });
    });

    $('#burner').addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      vessel.heater = v > 0 ? v + 273.15 : 0;
      $('#burner-value').textContent = v > 0 ? v + ' °C' : 'off';
    });

    $('#btn-ignite').addEventListener('click', function () {
      vessel.ignite();
      vesselView.flame = Math.max(vesselView.flame, 0.5);
      refreshAll();
    });

    toggleButton('#btn-stir', function (on) { vessel.stirring = on; });
    toggleButton('#btn-current', function (on) { vessel.electricity = on; });
    toggleButton('#btn-light', function (on) { vessel.light = on; });

    $('#btn-water').addEventListener('click', function () {
      vessel.add('water', 55.5);
      refreshAll();
    });

    $('#btn-clear').addEventListener('click', function () {
      vessel.clear();
      $('#burner').value = 0;
      $('#burner-value').textContent = 'off';
      $$('.btn.toggle').forEach(function (b) { b.classList.remove('on'); });
      vesselView.particles = [];
      vesselView.flame = vesselView.smoke = vesselView.foam = 0;
      lastJournalCount = -1;
      refreshAll();
    });

    $('#btn-help').addEventListener('click', function () { $('#help-modal').classList.remove('hidden'); });
    $('#btn-help-close').addEventListener('click', function () { $('#help-modal').classList.add('hidden'); });
    $('#help-modal').addEventListener('click', function (e) {
      if (e.target === $('#help-modal')) $('#help-modal').classList.add('hidden');
    });

    /* Viewer options */
    $$('#mode-seg .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#mode-seg .seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        viewer.mode = b.getAttribute('data-mode');
      });
    });
    $('#opt-h').addEventListener('change', function (e) { viewer.showH = e.target.checked; });
    $('#opt-labels').addEventListener('change', function (e) { viewer.showLabels = e.target.checked; });
    $('#opt-lp').addEventListener('change', function (e) { viewer.showLonePairs = e.target.checked; });
    $('#opt-spin').addEventListener('change', function (e) { viewer.autoRotate = e.target.checked; });

    window.addEventListener('resize', function () {
      viewer.resize();
      vesselView.resize();
    });
  }

  function toggleButton(sel, onChange) {
    var btn = $(sel);
    btn.addEventListener('click', function () {
      btn.classList.toggle('on');
      onChange(btn.classList.contains('on'));
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* ============================================================== boot ==== */

  function boot() {
    viewer = new global.Chem.Viewer($('#viewer-canvas'));
    vesselView = new global.Chem.VesselView($('#vessel-canvas'));

    buildCategoryChips();
    renderShelf();
    buildPeriodicTable();
    bindUI();

    viewer.resize();
    vesselView.resize();
    viewer.start();
    vesselView.start();

    select('water');
    refreshAll();

    /* Simulation clock — fixed 20 Hz, independent of the animation frame rate. */
    var last = performance.now();
    var uiAccumulator = 0;
    setInterval(function () {
      var now = performance.now();
      var dt = Math.min(0.25, (now - last) / 1000);
      last = now;

      var events = vessel.tick(dt);
      vesselView.applyEvents(events);

      uiAccumulator += dt;
      if (uiAccumulator > 0.2 || events.some(function (e) { return e.kind !== 'effect'; })) {
        uiAccumulator = 0;
        refreshAll();
      } else {
        vesselView.update(vessel.snapshot());
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
