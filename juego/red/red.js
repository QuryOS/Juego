/* Capa de red (WebSocket, opcional) — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var el = E.el;

  /* ===================== RED (multijugador, opcional) ===================== */
  var Red = {
    ws: null, id: null, activo: false, remotos: {}, onEstado: null, onSalio: null,
    conectar: function (url, hola, fallo) {
      var self = this, ok = false;
      try { this.ws = new global.WebSocket(url); } catch (e) { fallo(e); return; }
      this.ws.onopen = function () { ok = true; self.activo = true; self.enviar({ t: 'hola', nombre: hola.nombre, nave: hola.nave, color: hola.color }); };
      this.ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'bienvenida') self.id = m.id; else if (m.t === 'estado' && self.onEstado) self.onEstado(m.j || []); else if (m.t === 'salio' && self.onSalio) self.onSalio(m.id);
      };
      this.ws.onerror = function () { if (!ok) fallo(new Error('No se pudo conectar con el servidor')); };
      this.ws.onclose = function () { self.activo = false; if (!ok) fallo(new Error('No se pudo conectar con el servidor')); };
    },
    enviar: function (o) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (e) { } } },
    cerrar: function () { this.activo = false; this.id = null; if (this.ws) { try { this.ws.close(); } catch (e) { } this.ws = null; } }
  };

  E.Red = Red;
})(window);
