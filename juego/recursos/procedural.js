/* Texturas procedurales (cielo, planetas, anillos) — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var PI = E.PI;
  var TAU = E.TAU;
  var clamp = E.clamp;
  var mulberry32 = E.mulberry32;
  var hash3 = E.hash3;
  var el = E.el;
  var tex = E.tex;

  /* ===================== RECURSOS PROCEDURALES ===================== */
  function noise3(x, y, z, s) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), K = 1 / 4294967296;
    var a = hash3(xi, yi, zi, s) * K, b = hash3(xi + 1, yi, zi, s) * K, c = hash3(xi, yi + 1, zi, s) * K, d = hash3(xi + 1, yi + 1, zi, s) * K;
    var e = hash3(xi, yi, zi + 1, s) * K, f = hash3(xi + 1, yi, zi + 1, s) * K, g = hash3(xi, yi + 1, zi + 1, s) * K, h = hash3(xi + 1, yi + 1, zi + 1, s) * K;
    var x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
    var y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
  }
  function fbm(x, y, z, s, oct) { var sum = 0, amp = 0.5, fr = 1, tot = 0, o; for (o = 0; o < oct; o++) { sum += amp * noise3(x * fr, y * fr, z * fr, s + o * 17); tot += amp; fr *= 2; amp *= 0.5; } return sum / tot; }

  var TIPOS_PLANETA = ['arido', 'rocoso', 'hielo', 'gaseoso', 'gaseoso2', 'lava', 'tormenta'];
  var COLOR_ATM = { arido: [1.0, 0.62, 0.32], rocoso: [0.6, 0.7, 0.9], hielo: [0.55, 0.8, 1.0], gaseoso: [1.0, 0.75, 0.5], gaseoso2: [0.45, 0.75, 1.0], lava: [1.0, 0.35, 0.15], tormenta: [0.9, 0.55, 0.3] };
  function mezcla(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function crearTexturaPlaneta(tipo, tam, semilla) {
    var w = tam, h = tam >> 1, c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, x, y, i = 0, k;
    for (y = 0; y < h; y++) {
      var lat = (0.5 - (y + 0.5) / h) * PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (x = 0; x < w; x++) {
        var lon = (x + 0.5) / w * TAU, nx = Math.cos(lon) * cl, nz = Math.sin(lon) * cl, ny = sl, col;
        if (tipo === 'arido') {
          var n1 = fbm(nx * 2.2, ny * 2.2, nz * 2.2, semilla, 5), n2 = fbm(nx * 6 + 3, ny * 14, nz * 6, semilla + 5, 3);
          col = mezcla([150, 92, 48], [228, 176, 104], n1); col = mezcla(col, [110, 62, 34], clamp((n2 - 0.5) * 2.2, 0, 0.6));
        } else if (tipo === 'rocoso') {
          var r1 = fbm(nx * 3, ny * 3, nz * 3, semilla, 6), r2 = fbm(nx * 9, ny * 9, nz * 9, semilla + 9, 4);
          col = mezcla([78, 76, 74], [176, 170, 162], r1); col = mezcla(col, [36, 34, 36], clamp((r2 - 0.55) * 3, 0, 0.7));
        } else if (tipo === 'hielo') {
          var i1 = fbm(nx * 2.5, ny * 2.5, nz * 2.5, semilla, 5), cr = Math.abs(fbm(nx * 5, ny * 5, nz * 5, semilla + 3, 4) - 0.5);
          col = mezcla([170, 205, 238], [246, 250, 255], i1); if (cr < 0.035) col = mezcla(col, [90, 130, 190], 0.7);
          col = mezcla(col, [235, 245, 255], clamp(Math.abs(ny) - 0.7, 0, 1) * 2.2);
        } else if (tipo === 'gaseoso' || tipo === 'gaseoso2') {
          var tb = fbm(nx * 3, ny * 9, nz * 3, semilla, 4) * 2.2, band = 0.5 + 0.5 * Math.sin(ny * 17 + tb * 3.4 + fbm(nx * 8, ny * 2, nz * 8, semilla + 2, 3) * 2);
          col = tipo === 'gaseoso' ? mezcla([128, 82, 52], [244, 218, 170], band) : mezcla([42, 82, 138], [186, 226, 238], band);
          col = mezcla(col, tipo === 'gaseoso' ? [190, 64, 36] : [20, 50, 96], clamp((fbm(nx * 14, ny * 4, nz * 14, semilla + 7, 3) - 0.62) * 4, 0, 0.55));
        } else if (tipo === 'lava') {
          var l1 = fbm(nx * 3, ny * 3, nz * 3, semilla, 5), rid = 1 - Math.abs(2 * fbm(nx * 4.5, ny * 4.5, nz * 4.5, semilla + 4, 5) - 1);
          col = mezcla([22, 16, 18], [74, 50, 44], l1);
          if (rid > 0.9) col = mezcla(col, [255, 120, 30], clamp((rid - 0.9) * 14, 0, 1));
        } else { // tormenta de polvo
          var wx = nx + (fbm(nx * 2, ny * 2, nz * 2, semilla + 1, 3) - 0.5) * 1.1, wy = ny + (fbm(nx * 2 + 9, ny * 2, nz * 2, semilla + 2, 3) - 0.5) * 1.1, wz = nz + (fbm(nx * 2, ny * 2 + 9, nz * 2, semilla + 3, 3) - 0.5) * 1.1;
          var s1 = fbm(wx * 3, wy * 6, wz * 3, semilla + 6, 5);
          col = mezcla([96, 66, 44], [214, 150, 96], s1); col = mezcla(col, [240, 214, 168], clamp((s1 - 0.62) * 3, 0, 0.5));
        }
        d[i++] = col[0]; d[i++] = col[1]; d[i++] = col[2]; d[i++] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return tex(c);
  }
  function crearTexturaCielo(w) {
    var h = w >> 1, c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), r = mulberry32(CONFIG.semilla ^ 0x5eed), i, paleta = ['60,90,255', '150,60,255', '255,80,140', '40,190,220', '255,140,60'];
    g.fillStyle = '#02030a'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < 52; i++) {
      var x = r() * w, y = h * (0.12 + 0.76 * r()), rad = w * (0.025 + 0.085 * r()), col = paleta[(r() * paleta.length) | 0], gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(' + col + ',0.11)'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (i = 0; i < w * 3; i++) {     // franja de la galaxia
      var xx = r() * w, yy = h * 0.5 + Math.sin(xx / w * TAU * 2 + 1) * h * 0.09 + (r() + r() + r() - 1.5) * h * 0.13;
      g.fillStyle = 'rgba(' + (180 + (r() * 60 | 0)) + ',' + (190 + (r() * 50 | 0)) + ',255,' + (0.1 + r() * 0.35).toFixed(2) + ')'; g.fillRect(xx, yy, 1.4, 1.1);
    }
    for (i = 0; i < w * 1.6; i++) {   // estrellas (el ancho se compensa hacia los polos)
      var sx = r() * w, sy = r() * h, sn = Math.max(0.14, Math.sin(sy / h * PI)), sz = r() < 0.04 ? 2.4 : (r() < 0.2 ? 1.5 : 1), br = 0.35 + r() * 0.65;
      var tint = r(); g.fillStyle = 'rgba(' + (tint < 0.2 ? '255,200,170' : tint < 0.4 ? '170,200,255' : '255,255,255') + ',' + br.toFixed(2) + ')';
      g.fillRect(sx, sy, sz / sn, sz);
    }
    g.globalCompositeOperation = 'source-over';
    return tex(c);
  }
  function crearTexturaBrillo() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,244,220,0.95)'); gr.addColorStop(0.25, 'rgba(255,200,120,0.35)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return tex(c);
  }
  function crearTexturaAnillos() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 8; var g = c.getContext('2d'), r = mulberry32(777), x;
    for (x = 0; x < 512; x++) { var a = 0.12 + 0.55 * noise3(x / 9, 0.3, 0.7, 31) * (0.6 + 0.4 * Math.sin(x * 0.7)); if (x < 24 || x > 490) a *= 0.3; g.fillStyle = 'rgba(' + (200 + (r() * 30 | 0)) + ',' + (185 + (r() * 30 | 0)) + ',160,' + a.toFixed(2) + ')'; g.fillRect(x, 0, 1, 8); }
    return tex(c);
  }

  E.noise3 = noise3;
  E.fbm = fbm;
  E.TIPOS_PLANETA = TIPOS_PLANETA;
  E.COLOR_ATM = COLOR_ATM;
  E.mezcla = mezcla;
  E.crearTexturaPlaneta = crearTexturaPlaneta;
  E.crearTexturaCielo = crearTexturaCielo;
  E.crearTexturaBrillo = crearTexturaBrillo;
  E.crearTexturaAnillos = crearTexturaAnillos;
})(window);
