/* Escena: pantalla de carga — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var NAVES = E.NAVES;
  var CALIDAD = E.CALIDAD;
  var CONSEJOS = E.CONSEJOS;
  var TAU = E.TAU;
  var el = E.el;
  var esc = E.esc;
  var cargarScript = E.cargarScript;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;
  var disponibles = E.disponibles;
  var planetaTex = E.planetaTex;
  var crearRenderer = E.crearRenderer;
  var redimensionar = E.redimensionar;
  var mostrarCapas = E.mostrarCapas;
  var TIPOS_PLANETA = E.TIPOS_PLANETA;
  var crearTexturaPlaneta = E.crearTexturaPlaneta;
  var crearTexturaCielo = E.crearTexturaCielo;
  var crearTexturaBrillo = E.crearTexturaBrillo;
  var crearTexturaAnillos = E.crearTexturaAnillos;
  var naveDe = E.naveDe;
  var primeraDisponible = E.primeraDisponible;
  function irA(a, b) { return E.irA(a, b); }

  /* ===================== ESCENA: CARGA ===================== */
  escenas.carga = (function () {
    var cv, g2, estrellas = [], barra, estado, consejo, tIni = 0, pasos = [], idx = 0, tCons = 0, iCons = 0, listo = false;
    function construir() {
      var L = DOMcapas.carga; L.innerHTML = '';
      cv = el('canvas', '', L);
      var c = el('div', 'c', L);
      el('div', 'jn-titulo', c, esc(CONFIG.titulo)); el('div', 'jn-sub', c, esc(CONFIG.subtitulo));
      barra = el('i', '', el('div', 'jn-barra', c)); estado = el('div', 'jn-estado', c, 'Iniciando…');
      consejo = el('div', 'jn-consejo', L, CONSEJOS[0]); el('div', 'jn-ver', L, 'v' + CONFIG.version);
      g2 = cv.getContext('2d'); estrellas = [];
      for (var i = 0; i < 150; i++) estrellas.push({ a: Math.random() * TAU, d: Math.random(), v: 0.05 + Math.random() * 0.25 });
      redimensionar2(E.ancho, E.alto);
    }
    function redimensionar2(w, h) { if (cv) { cv.width = w; cv.height = h; } }
    function descubrirNaves(fin) {   // devuelve la lista de archivos .js de la carpeta de naves (sin servidor propio)
      var ruta = CONFIG.rutaModelos, hecho = false;
      function acabar(l) { if (hecho) return; hecho = true; fin(l || []); }
      function viaListado(sig) {          // servidores que muestran el contenido de la carpeta (python -m http.server, etc.)
        fetch(ruta, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
          var l = [], re = /href="([^"?#]+\.js)"/gi, m; while ((m = re.exec(t))) l.push(decodeURIComponent(m[1]));
          l.length ? acabar(l) : sig();
        }, sig);
      }
      function viaGitHub(sig) {           // GitHub Pages: pregunta a la API qué archivos hay en la carpeta
        var h = global.location.hostname, mm = /^([^.]+)\.github\.io$/i.exec(h);
        if (!mm) return sig();
        var rep = global.location.pathname.split('/')[1]; if (!rep || /\.html?$/i.test(rep)) rep = h;
        var base = global.location.pathname.replace(/[^\/]*$/, '').split('/').filter(Boolean).slice(1).join('/'), dir = (base ? base + '/' : '') + ruta.replace(/\/$/, '');
        fetch('https://api.github.com/repos/' + mm[1] + '/' + rep + '/contents/' + dir, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) {
          var l = []; if (j && j.forEach) j.forEach(function (f) { if (f && f.name) l.push(f.name); });
          l.length ? acabar(l) : sig();
        }, sig);
      }
      function viaManifiesto(sig) {
        if (!CONFIG.manifiesto) return sig();
        fetch(ruta + CONFIG.manifiesto + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { j && j.length ? acabar(j) : sig(); }, sig);
      }
      if (typeof global.fetch !== 'function') return acabar([]);
      viaManifiesto(function () { viaListado(function () { viaGitHub(function () { acabar([]); }); }); });
    }
    function cargarNaveExtra(archivo, ok) {   // carga un .js desconocido y registra las funciones createXxx nuevas como naves
      var antes = {}, k; for (k in global) if (/^create[A-Z]/.test(k)) antes[k] = 1;
      cargarScript(CONFIG.rutaModelos + archivo, function () {
        var nuevas = []; for (k in global) if (/^create[A-Z]/.test(k) && !antes[k] && typeof global[k] === 'function') nuevas.push(k);
        nuevas.forEach(function (fn) {
          var inf = global[fn].info || {}, base = archivo.replace(/\.js$/i, ''), id = nuevas.length > 1 ? base + '_' + fn : base;
          if (naveDe(id)) return;
          NAVES.push({ id: id, nombre: inf.nombre || fn.replace(/^create/, ''), archivo: archivo, fn: fn, m: inf.m || 4, clase: inf.clase || 'Nave', vmax: inf.vmax || 150, agil: inf.agil || 0.6, blind: inf.blind || 0.6, desc: inf.desc || 'Nave nueva del hangar.' });
          disponibles[id] = true;
        });
        ok();
      }, function () { ok(); });
    }
    function armarPasos() {
      var p = [];
      if (!global.THREE) p.push({ txt: 'Descargando el motor gráfico', critico: true, run: function (ok, fallo) { cargarScript(CONFIG.urlThree, ok, fallo); } });
      NAVES.forEach(function (n) {
        p.push({ txt: 'Cargando nave: ' + n.nombre, run: function (ok) {
          if (typeof global[n.fn] === 'function') { disponibles[n.id] = true; return ok(); }
          function listo() { disponibles[n.id] = typeof global[n.fn] === 'function'; ok(); }
          cargarScript(CONFIG.rutaModelos + n.archivo, listo, function () {
            if (!CONFIG.rutaModelos) { disponibles[n.id] = false; return ok(); }      // plan B: junto al HTML
            cargarScript(n.archivo, listo, function () { disponibles[n.id] = false; ok(); });
          });
        } });
      });
      if (CONFIG.autodescubrir) p.push({ txt: 'Buscando naves nuevas', run: function (ok) {
        descubrirNaves(function (archivos) {
          var conocidos = {}, extra = [];
          NAVES.forEach(function (n) { conocidos[n.archivo.toLowerCase()] = 1; });
          archivos.forEach(function (f) { f = String(f).split('/').pop(); if (/\.js$/i.test(f) && !conocidos[f.toLowerCase()]) { conocidos[f.toLowerCase()] = 1; extra.push(f); } });
          var pos = idx + 1;
          extra.forEach(function (f) { pasos.splice(pos++, 0, { txt: 'Cargando nave: ' + f.replace(/\.js$/i, ''), run: function (ok2) { cargarNaveExtra(f, ok2); } }); });
          ok();
        });
      } });
      p.push({ txt: 'Iniciando gráficos', critico: true, run: function (ok, fallo) {
        if (!global.THREE) return fallo(new Error('Three.js no está disponible'));
        if (!E.renderer && !crearRenderer()) return fallo(new Error('Este dispositivo no admite WebGL'));
        redimensionar(); ok();
      } });
      p.push({ txt: 'Pintando el cielo', run: function (ok) { E.skyTex = crearTexturaCielo(CALIDAD[jug.calidad].cielo); E.glowTex = crearTexturaBrillo(); E.anillosTex = crearTexturaAnillos(); ok(); } });
      TIPOS_PLANETA.forEach(function (t, i) {
        p.push({ txt: 'Moldeando planetas (' + (i + 1) + '/' + TIPOS_PLANETA.length + ')', run: function (ok) { planetaTex[t] = crearTexturaPlaneta(t, CALIDAD[jug.calidad].planeta, CONFIG.semilla + i * 101); ok(); } });
      });
      p.push({ txt: 'Preparando el hangar y el mundo', critico: true, run: function (ok) { escenas.lobby.construir(); escenas.mundo.construir(); ok(); } });
      return p;
    }
    function mostrarError(e) {
      estado.innerHTML = '<span style="color:#ff9a9a">' + esc(e && e.message ? e.message : e) + '</span>';
      var b = el('button', 'jn-btn', estado.parentNode, 'REINTENTAR'); b.style.marginTop = '16px'; b.onclick = function () { global.location.reload(); };
    }
    function paso() {
      if (idx >= pasos.length) return terminar();
      var p = pasos[idx], llamado = false; estado.textContent = p.txt + '…'; barra.style.width = Math.round(idx / pasos.length * 100) + '%';
      function sig() { if (llamado) return; llamado = true; idx++; setTimeout(paso, 25); }
      function err(e) { if (llamado) return; llamado = true; if (p.critico) mostrarError(e); else { idx++; setTimeout(paso, 25); } }
      try { p.run(sig, err); } catch (e) { err(e); }
    }
    function terminar() {
      barra.style.width = '100%';
      if (primeraDisponible() < 0) { mostrarError(new Error('No se encontró ningún modelo de nave. Revisa que los .js estén junto a este archivo (o CONFIG.rutaModelos).')); return; }
      estado.textContent = 'Listo';
      var resto = Math.max(0, 1500 - (Date.now() - tIni));
      setTimeout(function () { listo = true; irA('lobby'); }, resto);
    }
    return {
      construir: construir, redimensionar: redimensionar2,
      entrar: function () { mostrarCapas(['carga']); construir(); tIni = Date.now(); pasos = armarPasos(); idx = 0; listo = false; setTimeout(paso, 60); },
      salir: function () { },
      actualizar: function (dt) {
        if (!g2) return;
        var w = cv.width, h = cv.height, cx = w / 2, cy = h * 0.45, R = Math.max(w, h) * 0.7, i;
        g2.fillStyle = 'rgba(2,3,10,0.28)'; g2.fillRect(0, 0, w, h);
        for (i = 0; i < estrellas.length; i++) {
          var s = estrellas[i], d0 = s.d; s.d += dt * s.v * (0.4 + s.d * 2.2);
          if (s.d > 1) { s.d = 0.02; s.a = Math.random() * TAU; }
          var x0 = cx + Math.cos(s.a) * d0 * R, y0 = cy + Math.sin(s.a) * d0 * R, x1 = cx + Math.cos(s.a) * s.d * R, y1 = cy + Math.sin(s.a) * s.d * R;
          g2.strokeStyle = 'rgba(190,215,255,' + (0.15 + s.d * 0.8).toFixed(2) + ')'; g2.lineWidth = 0.6 + s.d * 1.6; g2.beginPath(); g2.moveTo(x0, y0); g2.lineTo(x1, y1); g2.stroke();
        }
        tCons += dt; if (tCons > 4) { tCons = 0; iCons = (iCons + 1) % CONSEJOS.length; if (consejo) consejo.textContent = CONSEJOS[iCons]; }
      }
    };
  })();


})(window);
