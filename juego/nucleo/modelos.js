/* Gestor de modelos de naves — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var NAVES = E.NAVES;
  var jug = E.jug;
  var disponibles = E.disponibles;
  var cache = E.cache;

  /* ===================== MODELOS (compartidos entre lobby y mundo) ===================== */
  var medidas = {};
  function naveDe(id) { for (var i = 0; i < NAVES.length; i++) if (NAVES[i].id === id) return NAVES[i]; return null; }
  function medir(n, m) {   // tamaño del modelo ya escalado a metros
    var w = new THREE.Group(); w.scale.setScalar(n.m); w.add(m.group); w.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    w.remove(m.group);
    if (!isFinite(s.x + s.y + s.z) || s.z <= 0) { s.set(10, 4, 14); c.set(0, 0, 0); }
    return { largo: s.z, ancho: s.x, alto: s.y, radio: Math.max(Math.max(s.x, s.y), s.z) / 2, centro: c };
  }
  function obtenerModelo(id) {
    if (cache[id]) return cache[id];
    var n = naveDe(id); if (!n || !disponibles[id]) return null;
    var m = null;
    try { m = global[n.fn](THREE, { accent: jug.acento }); } catch (e) { if (global.console) console.error('Error creando ' + id, e); disponibles[id] = false; return null; }
    if (!m || !m.group) { disponibles[id] = false; return null; }
    cache[id] = m; medidas[id] = medir(n, m);
    try { if (m.setAccent) m.setAccent(jug.acento); } catch (e2) { }
    return m;
  }
  function crearModeloNuevo(id, acento) {   // instancia independiente (jugadores remotos)
    var n = naveDe(id); if (!n || !disponibles[id]) return null;
    try { var m = global[n.fn](THREE, { accent: acento }); if (m && m.group) return { n: n, m: m }; } catch (e) { }
    return null;
  }
  function actualizarModelo(m, t, thr) { try { if (m.update) m.update(t, thr); } catch (e) { } }
  function primeraDisponible() { for (var i = 0; i < NAVES.length; i++) if (disponibles[NAVES[i].id]) return i; return -1; }

  E.medidas = medidas;
  E.naveDe = naveDe;
  E.medir = medir;
  E.obtenerModelo = obtenerModelo;
  E.crearModeloNuevo = crearModeloNuevo;
  E.actualizarModelo = actualizarModelo;
  E.primeraDisponible = primeraDisponible;
})(window);
