/* Clemistry — the beaker.
 *
 * A small particle system that reacts to what the engine reports: bubbles when
 * gas comes off, grains settling out when something precipitates, flame and
 * smoke over a combustion, wisps of steam at the boil, and a glow that tracks
 * the temperature.
 */
(function (global) {
  'use strict';

  function VesselView(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.flame = 0;
    this.smoke = 0;
    this.foam = 0;
    this.shake = 0;
    this.glow = 0;
    this.snapshot = null;
    this.time = 0;
    this._raf = null;
  }

  VesselView.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  };

  VesselView.prototype.update = function (snapshot) {
    this.snapshot = snapshot;
  };

  /* Effects arriving from the engine this tick. */
  VesselView.prototype.applyEvents = function (events) {
    var self = this;
    events.forEach(function (e) {
      if (e.kind !== 'effect') return;
      switch (e.effect) {
        case 'gas': case 'fizz': self.spawnBubbles(4); break;
        case 'foam': self.foam = Math.min(1, self.foam + 0.25); self.spawnBubbles(10); break;
        case 'flame': case 'brightLight': self.flame = Math.min(1, self.flame + 0.35); break;
        case 'smoke': self.smoke = Math.min(1, self.smoke + 0.3); break;
        case 'steam': self.spawnSteam(2); break;
        case 'explosion': self.shake = 1; self.flame = 1; break;
        case 'sparks': self.spawnSparks(8); break;
        case 'precipitate': self.spawnPrecipitate(5, e.colour); break;
        case 'deposit': self.spawnPrecipitate(3, e.colour || '#c87533'); break;
      }
    });
  };

  VesselView.prototype.liquidRect = function () {
    var s = this.snapshot;
    /* The beaker grows with the canvas rather than sitting at a fixed size in
     * the middle of it — a tall phone or tablet canvas would otherwise show a
     * postage stamp adrift in the dark. */
    var beakerH = Math.min(this.h * 0.62, 330);
    var beakerW = Math.min(this.w * 0.52, beakerH * 0.9);
    var x = (this.w - beakerW) / 2;
    var y = this.h * 0.80 - beakerH;
    var volume = s ? (s.liquidVolume !== undefined ? s.liquidVolume : s.volume) : 0;
    var fill = Math.max(0, Math.min(0.88, volume / 1.6));
    return {
      x: x, y: y, w: beakerW, h: beakerH,
      levelY: y + beakerH * (1 - fill),
      fill: fill
    };
  };

  VesselView.prototype.spawnBubbles = function (n) {
    var r = this.liquidRect();
    if (r.fill < 0.02) return;
    for (var i = 0; i < n; i++) {
      this.particles.push({
        type: 'bubble',
        x: r.x + 10 + Math.random() * (r.w - 20),
        y: r.y + r.h - 6 - Math.random() * 10,
        vy: -18 - Math.random() * 26,
        r: 1.4 + Math.random() * 3,
        life: 1
      });
    }
  };

  VesselView.prototype.spawnSteam = function (n) {
    var r = this.liquidRect();
    for (var i = 0; i < n; i++) {
      this.particles.push({
        type: 'steam',
        x: r.x + r.w * (0.25 + Math.random() * 0.5),
        y: r.levelY - 2,
        vy: -22 - Math.random() * 18,
        vx: (Math.random() - 0.5) * 12,
        r: 5 + Math.random() * 9,
        life: 1
      });
    }
  };

  VesselView.prototype.spawnSparks = function (n) {
    var r = this.liquidRect();
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
      var sp = 60 + Math.random() * 140;
      this.particles.push({
        type: 'spark',
        x: r.x + r.w / 2 + (Math.random() - 0.5) * r.w * 0.5,
        y: r.levelY - 4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 1 + Math.random() * 1.6,
        life: 1
      });
    }
  };

  VesselView.prototype.spawnPrecipitate = function (n, colour) {
    var r = this.liquidRect();
    for (var i = 0; i < n; i++) {
      this.particles.push({
        type: 'grain',
        x: r.x + 12 + Math.random() * (r.w - 24),
        y: r.levelY + Math.random() * Math.max(4, (r.y + r.h - r.levelY) * 0.5),
        vy: 8 + Math.random() * 14,
        r: 1.2 + Math.random() * 2.4,
        colour: colour || '#e8e8ee',
        life: 1,
        settled: false
      });
    }
    /* Keep the pile from growing without limit. */
    var grains = this.particles.filter(function (p) { return p.type === 'grain'; });
    if (grains.length > 260) this.particles.splice(this.particles.indexOf(grains[0]), 40);
  };

  VesselView.prototype.start = function () {
    var self = this, last = performance.now();
    if (this._raf) return;
    (function loop(now) {
      self._raf = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      self.step(dt);
      self.draw();
    })(last);
  };

  VesselView.prototype.step = function (dt) {
    this.time += dt;
    var r = this.liquidRect();
    var floor = r.y + r.h - 5;

    this.particles = this.particles.filter(function (p) {
      if (p.type === 'grain') {
        if (!p.settled) {
          p.y += p.vy * dt;
          p.x += Math.sin(p.y * 0.1) * 4 * dt;
          if (p.y >= floor - p.r) { p.y = floor - p.r; p.settled = true; }
        }
        return true;
      }
      p.life -= dt * (p.type === 'spark' ? 1.6 : p.type === 'steam' ? 0.8 : 1.2);
      p.x += (p.vx || 0) * dt;
      p.y += p.vy * dt;
      if (p.type === 'spark') p.vy += 220 * dt;
      if (p.type === 'steam') { p.r += 12 * dt; p.vy *= 0.98; }
      if (p.type === 'bubble' && p.y < r.levelY) return false;
      return p.life > 0;
    });

    this.flame = Math.max(0, this.flame - dt * 0.9);
    this.smoke = Math.max(0, this.smoke - dt * 0.5);
    this.foam = Math.max(0, this.foam - dt * 0.35);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    var TC = this.snapshot ? this.snapshot.TC : 25;
    var target = Math.max(0, Math.min(1, (TC - 380) / 700));
    this.glow += (target - this.glow) * Math.min(1, dt * 3);

    if (this.flame > 0.05 && Math.random() < 0.5) this.spawnSparks(1);
    if (TC > 99 && this.snapshot && this.snapshot.volume > 0.01 && Math.random() < 0.4) this.spawnSteam(1);
  };

  VesselView.prototype.draw = function () {
    var ctx = this.ctx;
    if (!this.w) this.resize();
    var w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);

    var s = this.snapshot;
    var r = this.liquidRect();

    ctx.save();
    if (this.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * this.shake * 9, (Math.random() - 0.5) * this.shake * 9);
    }

    this._drawBench(ctx, r, h);
    if (this.glow > 0.02) this._drawGlow(ctx, r);
    this._drawLiquid(ctx, r, s);
    this._drawGas(ctx, r, s);
    this._drawParticles(ctx, r);
    this._drawBeaker(ctx, r);
    if (s && s.gas && s.gas.overflowing) this._drawFumes(ctx, r, s.gas);
    if (this.flame > 0.02) this._drawFlame(ctx, r);
    if (this.smoke > 0.02) this._drawSmoke(ctx, r);
    this._drawReadout(ctx, r, s);

    ctx.restore();
  };

  VesselView.prototype._drawBench = function (ctx, r, h) {
    var y = r.y + r.h;
    var g = ctx.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, this.w, h - y);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(this.w, y + 0.5);
    ctx.stroke();
  };

  VesselView.prototype._drawGlow = function (ctx, r) {
    var cx = r.x + r.w / 2, cy = r.y + r.h * 0.7;
    var rad = r.w * (0.9 + this.glow * 0.6);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    var a = this.glow;
    g.addColorStop(0, 'rgba(255,170,60,' + (0.36 * a).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(255,90,30,' + (0.18 * a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  };

  VesselView.prototype._drawLiquid = function (ctx, r, s) {
    if (!s || r.fill < 0.005) return;
    var top = r.levelY;
    var bottom = r.y + r.h - 3;
    var colour = s.solutionColour;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r.x + 3, r.y);
    ctx.lineTo(r.x + 3, bottom);
    ctx.quadraticCurveTo(r.x + 3, r.y + r.h, r.x + 14, r.y + r.h);
    ctx.lineTo(r.x + r.w - 14, r.y + r.h);
    ctx.quadraticCurveTo(r.x + r.w - 3, r.y + r.h, r.x + r.w - 3, bottom);
    ctx.lineTo(r.x + r.w - 3, r.y);
    ctx.closePath();
    ctx.clip();

    var base = colour
      ? 'rgba(' + Math.round(colour.r) + ',' + Math.round(colour.g) + ',' + Math.round(colour.b) + ','
        + (0.30 + 0.55 * colour.strength).toFixed(2) + ')'
      : 'rgba(150,190,225,0.30)';

    var grad = ctx.createLinearGradient(0, top, 0, r.y + r.h);
    grad.addColorStop(0, base);
    grad.addColorStop(1, colour
      ? 'rgba(' + Math.round(colour.r * 0.65) + ',' + Math.round(colour.g * 0.65) + ',' + Math.round(colour.b * 0.65) + ',0.9)'
      : 'rgba(110,150,190,0.55)');
    ctx.fillStyle = grad;

    /* A gently moving meniscus. */
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h + 4);
    ctx.lineTo(r.x, top);
    var wob = this.foam > 0.05 ? 5 : 2;
    for (var x = 0; x <= r.w; x += 6) {
      var y = top + Math.sin((x * 0.05) + this.time * 2.2) * wob;
      ctx.lineTo(r.x + x, y);
    }
    ctx.lineTo(r.x + r.w, r.y + r.h + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(r.x, top - 1.5, r.w, 2);

    if (this.foam > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.30 * this.foam).toFixed(2) + ')';
      for (var i = 0; i < 40; i++) {
        var fx = r.x + ((i * 37) % r.w);
        var fy = top - Math.random() * 34 * this.foam;
        ctx.beginPath();
        ctx.arc(fx, fy, 3 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  function rgba(c, a) {
    return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' +
      Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }

  /* The gas standing in the beaker. It fills everything above the liquid — the
   * amount shows as depth of colour, not as a level. */
  VesselView.prototype._drawGas = function (ctx, r, s) {
    var gas = s && s.gas;
    if (!gas) return;

    var colour = gas.colour || { r: 214, g: 228, b: 244 };
    /* Even a beaker packed with chlorine is something you can see through. */
    var alpha = gas.colour ? Math.min(0.62, gas.opacity) : gas.haze * 0.2;
    if (alpha < 0.006) return;

    var top = r.y + 2;
    var bottom = Math.min(r.levelY, r.y + r.h - 4);
    var height = bottom - top;
    if (height < 4) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 3, r.y, r.w - 6, r.h - 4);
    ctx.clip();

    /* Denser toward the bottom: most of these gases are heavier than air. */
    var grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, rgba(colour, alpha * 0.5));
    grad.addColorStop(1, rgba(colour, alpha));
    ctx.fillStyle = grad;
    ctx.fillRect(r.x + 3, top, r.w - 6, height);

    /* Slow convection, so it reads as a gas rather than a flat wash. */
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 7; i++) {
      var t = this.time * 0.34 + i * 1.7;
      var x = r.x + r.w * (0.5 + 0.33 * Math.sin(t * 0.8 + i));
      var y = top + height * (0.5 + 0.4 * Math.sin(t * 0.53 + i * 2.1));
      var rad = Math.max(5, Math.min(r.w, height) * (0.26 + 0.11 * Math.sin(t + i)));
      var swirl = ctx.createRadialGradient(x, y, 0, x, y, rad);
      swirl.addColorStop(0, rgba(colour, alpha * 0.12));
      swirl.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = swirl;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* More gas than the beaker holds spills over the rim. */
  VesselView.prototype._drawFumes = function (ctx, r, gas) {
    var colour = gas.colour || { r: 214, g: 228, b: 244 };
    var alpha = (gas.colour ? Math.min(0.62, gas.opacity) : gas.haze * 0.2) * 0.42;
    if (alpha < 0.004) return;

    ctx.save();
    for (var i = 0; i < 12; i++) {
      var t = this.time * 0.5 + i * 0.62;
      var climb = (t % 3) / 3;
      var side = i % 2 ? 1 : -1;
      /* Heavier than air, so it rolls over the lip and falls down the outside. */
      var x = r.x + r.w * (0.5 + side * (0.44 + climb * 0.30)) + Math.sin(t * 1.3) * 5;
      var y = r.y + 4 + Math.sin(climb * Math.PI) * -14 + climb * r.h * 0.30;
      var rad = 8 + climb * 20;
      var puff = ctx.createRadialGradient(x, y, 0, x, y, rad);
      puff.addColorStop(0, rgba(colour, alpha * (1 - climb)));
      puff.addColorStop(1, rgba(colour, 0));
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  VesselView.prototype._drawParticles = function (ctx, r) {
    var self = this;
    this.particles.forEach(function (p) {
      ctx.save();
      if (p.type === 'bubble') {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * p.life).toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'grain') {
        ctx.fillStyle = p.colour;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = 'rgba(255,' + Math.round(160 + 80 * p.life) + ',80,' + p.life.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'steam') {
        ctx.fillStyle = 'rgba(220,232,245,' + (0.16 * p.life).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  };

  VesselView.prototype._drawBeaker = function (ctx, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,228,248,0.55)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(r.x - 6, r.y - 6);
    ctx.lineTo(r.x + 3, r.y);
    ctx.lineTo(r.x + 3, r.y + r.h - 12);
    ctx.quadraticCurveTo(r.x + 3, r.y + r.h, r.x + 16, r.y + r.h);
    ctx.lineTo(r.x + r.w - 16, r.y + r.h);
    ctx.quadraticCurveTo(r.x + r.w - 3, r.y + r.h, r.x + r.w - 3, r.y + r.h - 12);
    ctx.lineTo(r.x + r.w - 3, r.y);
    ctx.lineTo(r.x + r.w + 6, r.y - 6);
    ctx.stroke();

    /* Graduations. */
    ctx.strokeStyle = 'rgba(210,228,248,0.25)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 4; i++) {
      var y = r.y + r.h * (i / 5);
      ctx.beginPath();
      ctx.moveTo(r.x + r.w - 3, y);
      ctx.lineTo(r.x + r.w - 15, y);
      ctx.stroke();
    }

    /* Glass highlight. */
    var g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x + 3, r.y, r.w - 6, r.h);
    ctx.restore();
  };

  VesselView.prototype._drawFlame = function (ctx, r) {
    var cx = r.x + r.w / 2;
    var base = Math.min(r.levelY, r.y + r.h * 0.4);
    var scale = this.flame;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 16; i++) {
      var t = this.time * 5 + i;
      var x = cx + Math.sin(t * 0.9 + i) * r.w * 0.20;
      var height = (48 + Math.sin(t) * 22) * scale;
      var y = base - i * 3 - Math.abs(Math.sin(t * 0.6)) * 12;
      var rad = (16 + Math.sin(t * 1.3) * 6) * scale;
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,244,200,' + (0.35 * scale).toFixed(3) + ')');
      g.addColorStop(0.4, 'rgba(255,170,50,' + (0.22 * scale).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - height * 0.3, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  VesselView.prototype._drawSmoke = function (ctx, r) {
    var cx = r.x + r.w / 2;
    ctx.save();
    for (var i = 0; i < 10; i++) {
      var t = this.time * 0.8 + i * 0.7;
      var y = r.y - (i * 14) - (t % 3) * 20;
      var x = cx + Math.sin(t + i) * (14 + i * 3);
      ctx.fillStyle = 'rgba(120,125,140,' + (0.16 * this.smoke * (1 - i / 12)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 12 + i * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  VesselView.prototype._drawReadout = function (ctx, r, s) {
    if (!s) return;
    ctx.save();
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(190,205,228,0.75)';
    ctx.textAlign = 'center';
    var litres = s.liquidVolume !== undefined ? s.liquidVolume : s.volume;
    var label = litres > 0.005 ? (litres.toFixed(2) + ' L') : 'dry';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h + 18);

    /* Name the gas standing in the beaker — colour alone cannot do it, and half
     * of them have no colour at all. */
    if (s.gas) {
      var gas = s.gas;
      var name = (gas.dominant ? gas.dominant.formula + ' · ' : '') +
        gas.volume.toFixed(1) + ' L gas';
      ctx.fillStyle = gas.colour
        ? rgba(gas.colour, 0.55 + 0.4 * gas.opacity)
        : 'rgba(190,205,228,0.6)';
      ctx.fillText(name, r.x + r.w / 2, r.y + r.h + 33);
    }
    ctx.restore();
  };

  global.Chem.VesselView = VesselView;
})(window);
