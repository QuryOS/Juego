/* Utilidades y estado compartido — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var ACENTOS = E.ACENTOS;

  var PI = Math.PI, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash3(x, y, z, s) { var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  function leer(k, def) { try { var v = global.localStorage.getItem('jn_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
  function guardar(k, v) { try { global.localStorage.setItem('jn_' + k, JSON.stringify(v)); } catch (e) { } }
  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; }
  function cargarScript(src, ok, fallo) {
    var v = global.JN_V; if (v && !/^(https?:)?\/\//.test(src)) src += (src.indexOf('?') < 0 ? '?' : '&') + 'v=' + encodeURIComponent(v);
    var s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = function () { ok(); }; s.onerror = function () { fallo(new Error('No se pudo cargar ' + src)); };
    document.head.appendChild(s);
  }
  function tex(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    if ('encoding' in t && THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    if ('colorSpace' in t && THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function limpiar(o) {   // libera geometrías/materiales NO compartidos de un objeto
    if (!o) return;
    o.traverse(function (c) { if (c.userData && c.userData.propio) { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } } });
  }

  /* ===================== ESTADO COMPARTIDO ===================== */
  var DOMcapas = {};
  var jug = {   // preferencias del jugador (se guardan en el navegador)
    nombre: leer('nombre', 'Piloto'), nave: leer('nave', 'centinela'), acento: leer('acento', ACENTOS[0]),
    calidad: leer('calidad', 'media'), invertirY: leer('invY', false)
  };
  var escenas = {};
  var disponibles = {};     // id de nave -> true si su .js cargó
  var cache = {};           // id -> modelo creado (se reutiliza entre lobby y mundo)
  var planetaTex = {};      // texturas de planetas pregeneradas

  E.PI = PI;
  E.TAU = TAU;
  E.clamp = clamp;
  E.lerp = lerp;
  E.mulberry32 = mulberry32;
  E.hash3 = hash3;
  E.leer = leer;
  E.guardar = guardar;
  E.el = el;
  E.esc = esc;
  E.fmtDist = fmtDist;
  E.cargarScript = cargarScript;
  E.tex = tex;
  E.limpiar = limpiar;
  E.DOMcapas = DOMcapas;
  E.jug = jug;
  E.escenas = escenas;
  E.disponibles = disponibles;
  E.cache = cache;
  E.planetaTex = planetaTex;
})(window);
