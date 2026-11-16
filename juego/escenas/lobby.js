/* Escena: lobby (hangar) — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var NAVES = E.NAVES;
  var ACENTOS = E.ACENTOS;
  var CALIDAD = E.CALIDAD;
  var PI = E.PI;
  var clamp = E.clamp;
  var guardar = E.guardar;
  var el = E.el;
  var esc = E.esc;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;
  var disponibles = E.disponibles;
  var cache = E.cache;
  var redimensionar = E.redimensionar;
  var mostrarCapas = E.mostrarCapas;
  var medidas = E.medidas;
  var obtenerModelo = E.obtenerModelo;
  var actualizarModelo = E.actualizarModelo;
  var primeraDisponible = E.primeraDisponible;
  function irA(a, b) { return E.irA(a, b); }

  /* ===================== ESCENA: LOBBY (HANGAR) ===================== */
  escenas.lobby = (function () {
    var sc, cam, girar, escalar = null, plataforma, matAc, luzAc, cielo, idx = 0, vel = 0.25, arr = null, uiHecha = false, ui = {}, modeloAct = null, offX = 0, offY = 0, ambiente = [];
    function construir() {
      sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
      var hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1020, 0.8), key = new THREE.DirectionalLight(0xfff1e0, 2.4), rim = new THREE.DirectionalLight(0x5fb8ff, 1.5), fill = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(6, 10, 8); rim.position.set(-8, 3, -6); fill.position.set(0, -2, 6); sc.add(hemi, key, rim, fill);
      cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.MeshBasicMaterial({ map: E.skyTex, side: THREE.BackSide, depthWrite: false, toneMapped: false })); sc.add(cielo);
      matAc = new THREE.MeshBasicMaterial({ color: jug.acento });
      plataforma = new THREE.Group();
      var disco = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.6, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x151c2a, metalness: 0.7, roughness: 0.4 })); plataforma.add(disco);
      var a1 = new THREE.Mesh(new THREE.TorusGeometry(8.7, 0.08, 8, 96), matAc); a1.rotation.x = PI / 2; a1.position.y = 0.27; plataforma.add(a1);
      var a2 = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.05, 8, 80), matAc); a2.rotation.x = PI / 2; a2.position.y = 0.27; plataforma.add(a2);
      var brillo = new THREE.Mesh(new THREE.CircleGeometry(8.5, 64), new THREE.MeshBasicMaterial({ color: jug.acento, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })); brillo.rotation.x = -PI / 2; brillo.position.y = 0.28; plataforma.add(brillo);
      ambiente.push(brillo.material);
      luzAc = new THREE.PointLight(jug.acento, 1.4, 44); luzAc.position.set(0, 1.5, 0); plataforma.add(luzAc);
      sc.add(plataforma);
      girar = new THREE.Group(); sc.add(girar);
    }
    function aplicarAcento() { if (matAc) matAc.color.setHex(jug.acento); if (luzAc) luzAc.color.setHex(jug.acento); ambiente.forEach(function (m) { m.color.setHex(jug.acento); }); }
    function mostrar(i) {
      var n = NAVES[i], m = obtenerModelo(n.id); if (!m) return false;
      if (escalar) { girar.remove(escalar); escalar = null; }
      var md = medidas[n.id], s = 5 / md.radio; escalar = new THREE.Group();
      escalar.scale.setScalar(n.m * s); escalar.position.copy(md.centro).multiplyScalar(-s); escalar.add(m.group); girar.add(escalar);
      plataforma.position.y = -(md.alto * s) / 2 - 1.0; modeloAct = m; idx = i;
      try { if (m.setAccent) m.setAccent(jug.acento); } catch (e) { }
      jug.nave = n.id; guardar('nave', n.id); panel(n, md);
      return true;
    }
    function panel(n, md) {
      ui.nom.textContent = n.nombre.toUpperCase(); ui.clase.textContent = n.clase; ui.desc.textContent = n.desc;
      var barras = ui.stats.querySelectorAll('i'); barras[0].style.width = Math.round(n.vmax / 300 * 100) + '%'; barras[1].style.width = Math.round(clamp(n.agil / 1.25, 0.08, 1) * 100) + '%'; barras[2].style.width = Math.round(n.blind * 100) + '%';
      ui.eslora.textContent = Math.round(md.largo) + ' m · ' + n.vmax + ' m/s';
      for (var i = 0; i < ui.cols.length; i++) ui.cols[i].className = 'jn-col' + (ACENTOS[i] === jug.acento ? ' on' : '');
    }
    function cambiar(d) {
      var i = idx, k;
      for (k = 0; k < NAVES.length; k++) { i = (i + d + NAVES.length) % NAVES.length; if (disponibles[NAVES[i].id] && mostrar(i)) return; }
    }
    function construirUI() {
      var L = DOMcapas.lobby; L.innerHTML = '';
      var top = el('div', 'jn-top', L); el('div', 'jn-logo', top, esc(CONFIG.titulo));
      var bAj = el('div', 'jn-ico', top, '⚙');
      ui.aj = el('div', 'jn-ajustes', L,
        '<h4>CALIDAD GRÁFICA</h4><div class="jn-seg" data-k="calidad"><button class="jn-btn" data-v="baja">Baja</button><button class="jn-btn" data-v="media">Media</button><button class="jn-btn" data-v="alta">Alta</button></div>' +
        '<h4>EJE VERTICAL (CABECEO)</h4><div class="jn-seg" data-k="inv"><button class="jn-btn" data-v="0">Natural</button><button class="jn-btn" data-v="1">Invertido</button></div>' +
        '<div style="font-size:11px;opacity:.55">La calidad de las texturas se aplica al reiniciar la página.</div>');
      function marcarAj() {
        var b = ui.aj.querySelectorAll('.jn-seg button'), i;
        for (i = 0; i < b.length; i++) { var k = b[i].parentNode.getAttribute('data-k'), v = b[i].getAttribute('data-v'); b[i].className = 'jn-btn' + ((k === 'calidad' && jug.calidad === v) || (k === 'inv' && String(jug.invertirY ? 1 : 0) === v) ? ' on' : ''); }
      }
      ui.aj.addEventListener('click', function (e) {
        var b = e.target; if (!b || !b.getAttribute) return; var v = b.getAttribute('data-v'); if (v == null) return; var k = b.parentNode.getAttribute('data-k');
        if (k === 'calidad') { jug.calidad = v; guardar('calidad', v); redimensionar(); } else { jug.invertirY = v === '1'; guardar('invY', jug.invertirY); }
        marcarAj();
      });
      bAj.onclick = function () { ui.aj.classList.toggle('on'); marcarAj(); };
      ui.fi = el('div', 'jn-flecha i', L, '‹'); ui.fd = el('div', 'jn-flecha d', L, '›');
      ui.fi.onclick = function () { cambiar(-1); }; ui.fd.onclick = function () { cambiar(1); };
      ui.panel = el('div', 'jn-panel', L);
      ui.nom = el('div', 'jn-nom', ui.panel); ui.clase = el('div', 'jn-clase', ui.panel); ui.desc = el('div', 'jn-desc', ui.panel);
      ui.stats = el('div', 'jn-stats', ui.panel, '<b>Velocidad</b><span><i></i></span><b>Agilidad</b><span><i></i></span><b>Blindaje</b><span><i></i></span><b>Datos</b><em style="font-style:normal"></em>');
      ui.eslora = ui.stats.querySelector('em');
      var fc = el('div', 'jn-fila', ui.panel); ui.cols = [];
      ACENTOS.forEach(function (c) {
        var d = el('div', 'jn-col', fc); d.style.background = '#' + ('000000' + c.toString(16)).slice(-6);
        d.onclick = function () { jug.acento = c; guardar('acento', c); aplicarAcento(); if (modeloAct && modeloAct.setAccent) { try { modeloAct.setAccent(c); } catch (e) { } } for (var i in cache) { try { if (cache[i].setAccent) cache[i].setAccent(c); } catch (e2) { } } panel(NAVES[idx], medidas[NAVES[idx].id]); };
        ui.cols.push(d);
      });
      var fn = el('div', 'jn-fila', ui.panel); ui.in = el('input', 'jn-in', fn); ui.in.maxLength = 16; ui.in.placeholder = 'Tu nombre de piloto'; ui.in.value = jug.nombre;
      ui.in.onchange = function () { jug.nombre = (ui.in.value || 'Piloto').replace(/[<>]/g, '').slice(0, 16); guardar('nombre', jug.nombre); };
      var ac = el('div', 'jn-acc', ui.panel);
      ui.jugar = el('button', 'jn-btn jn-grande', ac, 'JUGAR'); ui.jugar.onclick = function () { ui.in.onchange(); irA('mundo', { modo: 'solo' }); };
      ui.red = el('button', 'jn-btn', ac, CONFIG.servidor ? 'MULTIJUGADOR' : 'MULTIJUGADOR · sin servidor'); ui.red.disabled = !CONFIG.servidor; ui.red.style.fontSize = '12px';
      ui.red.onclick = function () { ui.in.onchange(); irA('mundo', { modo: 'red' }); };
      uiHecha = true;
    }
    function redimensionar3(w, h) {
      if (!cam) return;
      cam.aspect = w / h;
      var vf = 40 * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect), dV = 5 / Math.sin(vf / 2) * 1.3, dH = 5 / Math.sin(hf / 2) * 1.3, d = Math.max(dV, dH);
      cam.position.set(0, d * 0.16, d); cam.lookAt(0, 0, 0);
      var corta = w > h && h < 560;
      if (corta) cam.setViewOffset(w, h, w * 0.2, 0, w, h); else if (h > w) cam.setViewOffset(w, h, 0, h * 0.11, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
    return {
      construir: construir, redimensionar: redimensionar3,
      entrar: function () {
        mostrarCapas(['lobby']); if (!uiHecha) construirUI(); aplicarAcento();
        var i = -1, k; for (k = 0; k < NAVES.length; k++) if (NAVES[k].id === jug.nave && disponibles[NAVES[k].id]) i = k;
        if (i < 0) i = primeraDisponible(); mostrar(i); redimensionar3(E.ancho, E.alto);
      },
      salir: function () { if (escalar) { girar.remove(escalar); escalar = null; } ui.aj.classList.remove('on'); },
      tecla: function (e) { if (e.code === 'ArrowLeft') cambiar(-1); else if (e.code === 'ArrowRight') cambiar(1); else if (e.code === 'Enter' && document.activeElement !== ui.in) ui.jugar.onclick(); },
      puntero: function (tipo, e) {
        if (tipo === 'abajo') arr = { id: e.pointerId, x: e.clientX };
        else if (tipo === 'mueve' && arr && arr.id === e.pointerId) { girar.rotation.y += (e.clientX - arr.x) * 0.012; arr.x = e.clientX; vel = 0; }
        else if (tipo === 'arriba' && arr && arr.id === e.pointerId) arr = null;
      },
      actualizar: function (dt, t) {
        if (!sc) return;
        if (!arr) { vel += (0.25 - vel) * Math.min(1, dt * 1.5); girar.rotation.y += vel * dt; }
        cielo.rotation.y += dt * 0.008;
        actualizarModelo(modeloAct, t, 0.35 + 0.1 * Math.sin(t * 1.3));
        E.renderer.render(sc, cam);
      }
    };
  })();


})(window);
