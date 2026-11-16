/* Arranque, entrada y bucle principal — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var NAVES = E.NAVES;
  var jug = E.jug;
  var escenas = E.escenas;
  var crearDOM = E.crearDOM;
  var redimensionar = E.redimensionar;

  /* ===================== NÚCLEO: escenas, entrada y bucle ===================== */
  var actual = null, tPrev = 0, corriendo = false;
  function irA(nombre, datos) {
    if (actual && actual.salir) { try { actual.salir(); } catch (e) { if (global.console) console.error(e); } }
    actual = escenas[nombre]; actual.nombre = nombre;
    if (actual.entrar) actual.entrar(datos);
  }
  function bucle(ms) {
    if (!corriendo) return;
    global.requestAnimationFrame(bucle);
    var t = ms / 1000, dt = Math.min(0.05, Math.max(0, t - tPrev)); tPrev = t;
    if (actual && actual.actualizar) {
      try { actual.actualizar(dt, t); } catch (e) { if (global.console) console.error(e); }
    }
  }
  function enlazarEntrada() {
    function ruta(tipo) {
      return function (e) { if (actual && actual.puntero) actual.puntero(tipo, e); };
    }
    E.lienzo.style.touchAction = 'none';
    E.lienzo.addEventListener('pointerdown', function (e) { try { E.lienzo.setPointerCapture(e.pointerId); } catch (x) { } ruta('abajo')(e); });
    E.lienzo.addEventListener('pointermove', ruta('mueve'));
    E.lienzo.addEventListener('pointerup', ruta('arriba'));
    E.lienzo.addEventListener('pointercancel', ruta('arriba'));
    global.addEventListener('keydown', function (e) { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (actual && actual.tecla) actual.tecla(e, true); });
    global.addEventListener('keyup', function (e) { if (actual && actual.tecla) actual.tecla(e, false); });
    global.addEventListener('blur', function () { if (actual && actual.nombre === 'mundo' && actual.tecla) { ['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach(function (c) { actual.tecla({ code: c, preventDefault: function () { } }, false); }); } });
    global.addEventListener('resize', redimensionar);
    global.addEventListener('orientationchange', function () { setTimeout(redimensionar, 200); });
  }
  function iniciar() {
    if (corriendo) return;
    crearDOM(); enlazarEntrada(); redimensionar();
    corriendo = true; tPrev = 0;
    irA('carga');
    global.requestAnimationFrame(bucle);
  }

  global.JuegoNaves = { iniciar: iniciar, CONFIG: CONFIG, irA: irA, naves: NAVES, jugador: jug, version: CONFIG.version, escena: function () { return actual ? actual.nombre : null; } };
  if (!global.JUEGO_NAVES_NO_AUTOSTART) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  }

  E.irA = irA;
})(window);
