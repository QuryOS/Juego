/* Capas DOM, renderer y tamaño de pantalla — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CALIDAD = E.CALIDAD;
  var el = E.el;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;

  var raiz;
  function crearDOM() {
    raiz = el('div', 'jn-raiz', document.body);
    E.lienzo = el('canvas', 'jn-canvas', raiz);
    DOMcapas.carga = el('div', 'jn-capa jn-carga', raiz);
    DOMcapas.lobby = el('div', 'jn-capa jn-lobby', raiz);
    DOMcapas.hud = el('div', 'jn-capa jn-hud', raiz);
    raiz.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  function crearRenderer() {
    try {
      E.renderer = new THREE.WebGLRenderer({ canvas: E.lienzo, antialias: jug.calidad !== 'baja', powerPreference: 'high-performance' });
    } catch (e) { return false; }
    E.renderer.setClearColor(0x02030a, 1);
    E.renderer.outputEncoding = THREE.sRGBEncoding;
    E.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    E.renderer.toneMappingExposure = 1.1;
    return true;
  }
  E.ancho = 1; E.alto = 1;
  function redimensionar() {
    E.ancho = raiz.clientWidth || global.innerWidth || 800; E.alto = raiz.clientHeight || global.innerHeight || 600;
    if (E.renderer) { E.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, CALIDAD[jug.calidad].dpr)); E.renderer.setSize(E.ancho, E.alto, false); }
    for (var k in escenas) if (escenas[k].redimensionar) escenas[k].redimensionar(E.ancho, E.alto);
  }
  function mostrarCapas(lista) {
    for (var k in DOMcapas) { if (lista.indexOf(k) >= 0) DOMcapas[k].classList.add('on'); else DOMcapas[k].classList.remove('on'); }
  }

  E.crearDOM = crearDOM;
  E.crearRenderer = crearRenderer;
  E.redimensionar = redimensionar;
  E.mostrarCapas = mostrarCapas;
})(window);
