/* Escena: mundo infinito (vuelo, cámara, HUD) — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var ACENTOS = E.ACENTOS;
  var CALIDAD = E.CALIDAD;
  var PI = E.PI;
  var TAU = E.TAU;
  var clamp = E.clamp;
  var mulberry32 = E.mulberry32;
  var hash3 = E.hash3;
  var el = E.el;
  var esc = E.esc;
  var fmtDist = E.fmtDist;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;
  var planetaTex = E.planetaTex;
  var redimensionar = E.redimensionar;
  var mostrarCapas = E.mostrarCapas;
  var fbm = E.fbm;
  var COLOR_ATM = E.COLOR_ATM;
  var medidas = E.medidas;
  var naveDe = E.naveDe;
  var obtenerModelo = E.obtenerModelo;
  var crearModeloNuevo = E.crearModeloNuevo;
  var actualizarModelo = E.actualizarModelo;
  var Red = E.Red;
  function irA(a, b) { return E.irA(a, b); }

  /* ===================== ESCENA: MUNDO ===================== */
  escenas.mundo = (function () {
    var SOL_DIR = null, sc, cam, cielo, solSp, polvo, polvoPos, polvoN = 0, SG, geoAnillo, matAnillo, matAtm = {}, geosRoca = [], matsRoca = [];
    var pivote = null, inclinar = null, escalarN = null, modelo = null, nSel = null, med = null;
    var P = { x: 0, y: 0, z: 0 }, Q, V, qCam, qa, v1, v2, v3, fwd, vObj, AX, AY, AZ, dummy, mInv;
    var celdas = {}, listaPl = [], listaRo = [], camposVis = [], ucx = 1e9, ucy = 1e9, ucz = 1e9;
    var rYaw = 0, rPitch = 0, rRoll = 0, acelerador = 0.3, turboE = 1, turboBloq = false, turboOn = false, vel = 0, shake = 0, pausado = false, modo = 'solo', tMundo = 0, tHud = 0, fps = 60, tRed = 0, tToast = 0, planCercano = null;
    var teclas = {}, stick = { id: null, x0: 0, y0: 0, ax: 0, ay: 0 }, botT = false, botF = false, palId = null;
    var hud = {}, radarG, radarS = 132, beaconG, remotos = {}, construido = false, DPRH = 1;

    /* ---------- construcción (una vez) ---------- */
    function construir() {
      SOL_DIR = new THREE.Vector3(0.62, 0.34, -0.71).normalize();
      Q = new THREE.Quaternion(); V = new THREE.Vector3(); qCam = new THREE.Quaternion(); qa = new THREE.Quaternion(); mInv = new THREE.Quaternion();
      v1 = new THREE.Vector3(); v2 = new THREE.Vector3(); v3 = new THREE.Vector3(); fwd = new THREE.Vector3(); vObj = new THREE.Vector3();
      AX = new THREE.Vector3(1, 0, 0); AY = new THREE.Vector3(0, 1, 0); AZ = new THREE.Vector3(0, 0, 1); dummy = new THREE.Object3D();
      sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(72, 1, 1, 160000);
      var sol = new THREE.DirectionalLight(0xfff1e0, 2.6); sol.position.copy(SOL_DIR); sc.add(sol);
      var contra = new THREE.DirectionalLight(0x5fb8ff, 0.55); contra.position.copy(SOL_DIR).multiplyScalar(-1); sc.add(contra);
      sc.add(new THREE.HemisphereLight(0x7088c0, 0x140e1c, 0.4));
      cielo = new THREE.Mesh(new THREE.SphereGeometry(100000, 40, 20), new THREE.MeshBasicMaterial({ map: E.skyTex, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false }));
      cielo.renderOrder = -10; cielo.frustumCulled = false; sc.add(cielo);
      solSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.glowTex, color: 0xffe8c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
      solSp.scale.set(14000, 14000, 1); solSp.renderOrder = -9; solSp.frustumCulled = false; sc.add(solSp);
      var seg = jug.calidad === 'alta' ? 56 : (jug.calidad === 'media' ? 40 : 28); SG = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
      geoAnillo = new THREE.RingGeometry(1.35, 2.3, 96, 1);
      (function () { var p = geoAnillo.attributes.position, uv = geoAnillo.attributes.uv, i, w = new THREE.Vector3(); for (i = 0; i < p.count; i++) { w.set(p.getX(i), p.getY(i), 0); uv.setXY(i, (w.length() - 1.35) / 0.95, 0.5); } })();
      matAnillo = new THREE.MeshBasicMaterial({ map: E.anillosTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
      (function () {
        var v, i, g, p, x, y, z, f;
        for (v = 0; v < 3; v++) {
          g = new THREE.IcosahedronGeometry(1, 1); p = g.attributes.position;
          for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); f = 0.7 + 0.65 * fbm(x * 1.5 + v * 7.3 + 5, y * 1.5 + 5, z * 1.5 + 5, 99 + v, 3); p.setXYZ(i, x * f, y * f * 0.88, z * f); }
          g.computeVertexNormals(); geosRoca.push(g);
        }
        [0x8c8378, 0x6d655c, 0x9a7e68].forEach(function (c) { matsRoca.push(new THREE.MeshStandardMaterial({ color: c, roughness: 0.96, metalness: 0.05, flatShading: true })); });
      })();
      construirHUD(); construido = true;
    }

    /* ---------- HUD (DOM) ---------- */
    function construirHUD() {
      var L = DOMcapas.hud; L.innerHTML = '';
      beaconG = el('canvas', '', L); beaconG.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
      var hi = el('div', 'jn-hi', L); hud.nom = el('div', 'n', hi); hud.vel = el('div', 'v', hi, '0 <small>m/s</small>');
      hud.mv = el('div', 'jn-mini', hi, '<i></i>'); hud.mt = el('div', 'jn-mini t', hi, '<i></i>'); hud.estado = el('div', '', hi, ''); hud.estado.style.cssText = 'margin-top:6px;opacity:.8';
      hud.hd = el('div', 'jn-hd', L);
      hud.pausa = el('div', 'jn-ico jn-pausa', L, '❚❚'); hud.pausa.onclick = function () { pausar(true); };
      var rc = el('canvas', 'jn-radar', L); rc.style.width = radarS + 'px'; rc.style.height = radarS + 'px'; hud.radar = rc;
      var ac = el('div', 'jn-acel', L), pal = el('div', 'jn-pal', ac, '<u>ACEL</u><i></i>'); hud.pal = pal; hud.palI = pal.querySelector('i');
      var bots = el('div', 'jn-bots', ac); hud.bT = el('div', 'jn-bot', bots, 'TURBO'); hud.bF = el('div', 'jn-bot f', bots, 'FRENO');
      function pulsar(e, b, f) { e.addEventListener('pointerdown', function (ev) { f(true); b.classList.add('on'); try { b.setPointerCapture(ev.pointerId); } catch (x) { } ev.preventDefault(); }); ['pointerup', 'pointercancel'].forEach(function (n) { e.addEventListener(n, function () { f(false); b.classList.remove('on'); }); }); }
      pulsar(hud.bT, hud.bT, function (v) { botT = v; }); pulsar(hud.bF, hud.bF, function (v) { botF = v; });
      function setPal(ev) { var r = pal.getBoundingClientRect(); acelerador = clamp(1 - (ev.clientY - r.top - 4) / (r.height - 8), 0, 1); }
      pal.addEventListener('pointerdown', function (ev) { palId = ev.pointerId; try { pal.setPointerCapture(ev.pointerId); } catch (x) { } setPal(ev); ev.preventDefault(); });
      pal.addEventListener('pointermove', function (ev) { if (palId === ev.pointerId) setPal(ev); });
      ['pointerup', 'pointercancel'].forEach(function (n) { pal.addEventListener(n, function () { palId = null; }); });
      hud.palanca = el('div', 'jn-palanca', L, '<i></i>'); hud.palI2 = hud.palanca.querySelector('i');
      hud.toast = el('div', 'jn-toast', L, '');
      hud.menu = el('div', 'jn-pmenu', L, '<h3>PAUSA</h3>');
      var bc = el('button', 'jn-btn jn-grande', hud.menu, 'CONTINUAR'); bc.onclick = function () { pausar(false); };
      var bh = el('button', 'jn-btn', hud.menu, 'VOLVER AL HANGAR'); bh.onclick = function () { irA('lobby'); };
    }
    function toast(txt, ms) { hud.toast.textContent = txt; hud.toast.style.opacity = 1; tToast = ms || 1.1; }
    function pausar(p) { pausado = p; if (p) hud.menu.classList.add('on'); else hud.menu.classList.remove('on'); }

    /* ---------- generación del universo por celdas ---------- */
    var SIL = ['ka', 'ro', 've', 'lu', 'mi', 'tor', 'zen', 'ar', 'ix', 'on', 'da', 'sel', 'vor', 'nem', 'ul', 'cor', 'phe', 'tis', 'ba', 'rin', 'qua', 'dre', 'sha', 'lom'], ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    function nombrePlaneta(r) { var n = 2 + (r() < 0.4 ? 1 : 0), s = '', i; for (i = 0; i < n; i++) s += SIL[(r() * SIL.length) | 0]; return s.charAt(0).toUpperCase() + s.slice(1) + ' ' + ROM[(r() * ROM.length) | 0]; }
    function tipoPlaneta(r) { var u = r(); return u < 0.22 ? 'arido' : u < 0.42 ? 'rocoso' : u < 0.56 ? 'hielo' : u < 0.68 ? 'gaseoso' : u < 0.78 ? 'gaseoso2' : u < 0.86 ? 'lava' : 'tormenta'; }
    function generar(ix, iy, iz) {
      var C = CONFIG.celda, r = mulberry32(hash3(ix, iy, iz, CONFIG.semilla)), cel = { key: ix + ',' + iy + ',' + iz, ix: ix, iy: iy, iz: iz, planeta: null, campo: null };
      if (r() < 0.38) {
        var tp = tipoPlaneta(r), gas = tp === 'gaseoso' || tp === 'gaseoso2', rad = gas ? 1500 + r() * 1700 : 500 + r() * 1400;
        cel.planeta = { x: (ix + 0.2 + 0.6 * r()) * C, y: (iy + 0.2 + 0.6 * r()) * C, z: (iz + 0.2 + 0.6 * r()) * C, r: rad, tipo: tp, nombre: nombrePlaneta(r), anillos: gas ? r() < 0.4 : r() < 0.07, incl: 0.1 + r() * 0.5, tinte: [0.85 + r() * 0.3, 0.85 + r() * 0.3, 0.85 + r() * 0.3], giro: (r() - 0.5) * 0.04, g: null, k: 0 };
      }
      if (r() < 0.5) {
        var a = 700 + r() * 900, cx = (ix + 0.15 + 0.7 * r()) * C, cy = (iy + 0.15 + 0.7 * r()) * C, cz = (iz + 0.15 + 0.7 * r()) * C, ok = true;
        if (cel.planeta) { var pl = cel.planeta, dd = Math.sqrt((cx - pl.x) * (cx - pl.x) + (cy - pl.y) * (cy - pl.y) + (cz - pl.z) * (cz - pl.z)); if (dd < pl.r * 1.5 + a + 500) ok = false; }
        if (ok) {
          var n = 28 + ((r() * 32) | 0), rocas = [], i, b = a * (0.35 + 0.4 * r()), c3 = a * (0.6 + 0.4 * r());
          for (i = 0; i < n; i++) {
            var th = r() * TAU, ph = Math.acos(2 * r() - 1), rr = Math.pow(r(), 0.6);
            rocas.push({ lx: a * rr * Math.sin(ph) * Math.cos(th), ly: b * rr * Math.cos(ph), lz: c3 * rr * Math.sin(ph) * Math.sin(th), s: 8 + Math.pow(r(), 3) * 95, sx: 0.8 + r() * 0.5, sy: 0.6 + r() * 0.5, sz: 0.8 + r() * 0.5, e: [r() * TAU, r() * TAU, r() * TAU], v: (r() * 3) | 0 });
          }
          cel.campo = { x: cx, y: cy, z: cz, a: a, rocas: rocas, mat: (r() * 3) | 0, g: null };
        }
      }
      return cel;
    }
    function celda(ix, iy, iz) { var k = ix + ',' + iy + ',' + iz, c = celdas[k]; if (!c) { c = generar(ix, iy, iz); celdas[k] = c; } return c; }
    function crearPlaneta(pl) {
      var g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ map: planetaTex[pl.tipo], roughness: 0.95, metalness: 0, color: new THREE.Color(pl.tinte[0], pl.tinte[1], pl.tinte[2]) });
      var cuerpo = new THREE.Mesh(SG, mat); cuerpo.userData.propio = false; cuerpo.rotation.z = pl.incl * 0.3; g.add(cuerpo);
      var atm = new THREE.Mesh(SG, atmosfera(pl.tipo)); atm.scale.setScalar(1.07); g.add(atm);
      if (pl.anillos) { var an = new THREE.Mesh(geoAnillo, matAnillo); an.rotation.x = -PI / 2 + pl.incl; g.add(an); }
      g.userData.cuerpo = cuerpo; g.userData.mat = mat; g.scale.setScalar(pl.r * 0.6); pl.g = g; pl.k = 0; sc.add(g);
    }
    function atmosfera(tipo) {
      if (matAtm[tipo]) return matAtm[tipo]; var c = COLOR_ATM[tipo];
      matAtm[tipo] = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(c[0], c[1], c[2]) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0); gl_FragColor = vec4(color * f * 1.3, f); }'
      });
      return matAtm[tipo];
    }
    function quitarPlaneta(pl) { if (pl.g) { sc.remove(pl.g); if (pl.g.userData.mat) pl.g.userData.mat.dispose(); pl.g = null; } }
    function crearCampo(cp) {
      var g = new THREE.Group(), grupos = [[], [], []], i, j, k;
      for (i = 0; i < cp.rocas.length; i++) grupos[cp.rocas[i].v].push(cp.rocas[i]);
      for (k = 0; k < 3; k++) {
        if (!grupos[k].length) continue;
        var im = new THREE.InstancedMesh(geosRoca[k], matsRoca[cp.mat], grupos[k].length);
        for (j = 0; j < grupos[k].length; j++) { var ro = grupos[k][j]; dummy.position.set(ro.lx, ro.ly, ro.lz); dummy.rotation.set(ro.e[0], ro.e[1], ro.e[2]); dummy.scale.set(ro.s * ro.sx, ro.s * ro.sy, ro.s * ro.sz); dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); }
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; g.add(im);
      }
      cp.g = g; sc.add(g);
    }
    function quitarCampo(cp) { if (cp.g) { cp.g.children.forEach(function (m) { if (m.dispose) m.dispose(); }); sc.remove(cp.g); cp.g = null; } }
    function actualizarCeldas(forzar) {
      var C = CONFIG.celda, cx = Math.floor(P.x / C), cy = Math.floor(P.y / C), cz = Math.floor(P.z / C);
      if (!forzar && cx === ucx && cy === ucy && cz === ucz) return;
      ucx = cx; ucy = cy; ucz = cz;
      var Rp = CALIDAD[jug.calidad].radioPlanetas, dx, dy, dz, keep = {}, k, c;
      listaPl = []; listaRo = []; camposVis = [];
      for (dx = -Rp; dx <= Rp; dx++) for (dy = -Rp; dy <= Rp; dy++) for (dz = -Rp; dz <= Rp; dz++) {
        c = celda(cx + dx, cy + dy, cz + dz); keep[c.key] = 1;
        var d = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        if (c.planeta) { listaPl.push(c.planeta); if (!c.planeta.g) crearPlaneta(c.planeta); }
        if (c.campo) {
          if (d <= 1) { if (!c.campo.g) crearCampo(c.campo); camposVis.push(c.campo); } else if (c.campo.g && d > 2) quitarCampo(c.campo);
        }
      }
      for (k in celdas) if (!keep[k]) { c = celdas[k]; if (c.planeta) quitarPlaneta(c.planeta); if (c.campo) quitarCampo(c.campo); delete celdas[k]; }
      camposVis.forEach(function (cp) { cp.rocas.forEach(function (ro) { listaRo.push({ x: cp.x + ro.lx, y: cp.y + ro.ly, z: cp.z + ro.lz, r: ro.s * 0.9 }); }); });
    }
    function posicionInicial() {
      var best = null, bd = 1e30, dx, dy, dz;
      for (dx = -2; dx <= 2; dx++) for (dy = -2; dy <= 2; dy++) for (dz = -2; dz <= 2; dz++) { var c = celda(dx, dy, dz); if (c.planeta) { var d = Math.sqrt(c.planeta.x * c.planeta.x + c.planeta.y * c.planeta.y + c.planeta.z * c.planeta.z); if (d < bd) { bd = d; best = c.planeta; } } }
      if (!best) { P.x = P.y = P.z = 0; Q.set(0, 0, 0, 1); return; }
      v1.set(0.35, 0.12, 0.93).normalize();
      P.x = best.x + v1.x * (best.r * 2.7 + 1500); P.y = best.y + v1.y * (best.r * 2.7 + 1500); P.z = best.z + v1.z * (best.r * 2.7 + 1500);
      v2.set(best.x - P.x, best.y - P.y, best.z - P.z).normalize();
      var m = new THREE.Matrix4(); m.lookAt(new THREE.Vector3(0, 0, 0), v2, AY); Q.setFromRotationMatrix(m);
    }

    /* ---------- polvo de velocidad ---------- */
    function crearPolvo() {
      if (polvo) { sc.remove(polvo); polvo.geometry.dispose(); polvo.material.dispose(); }
      polvoN = CALIDAD[jug.calidad].polvo; polvoPos = new Float32Array(polvoN * 3);
      for (var i = 0; i < polvoN * 3; i++) polvoPos[i] = (Math.random() - 0.5) * 700;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(polvoPos, 3));
      polvo = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd4ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      polvo.frustumCulled = false; sc.add(polvo);
    }
    function moverPolvo(dt, rapidez) {
      var i, R = 350, dx = -V.x * dt, dy = -V.y * dt, dz = -V.z * dt, p = polvoPos;
      for (i = 0; i < polvoN * 3; i += 3) {
        p[i] += dx; p[i + 1] += dy; p[i + 2] += dz;
        if (p[i] > R) p[i] -= 2 * R; else if (p[i] < -R) p[i] += 2 * R;
        if (p[i + 1] > R) p[i + 1] -= 2 * R; else if (p[i + 1] < -R) p[i + 1] += 2 * R;
        if (p[i + 2] > R) p[i + 2] -= 2 * R; else if (p[i + 2] < -R) p[i + 2] += 2 * R;
      }
      polvo.geometry.attributes.position.needsUpdate = true;
      polvo.material.opacity = clamp(rapidez * 1.4, 0, 0.85);
    }

    /* ---------- entrada ---------- */
    function entrada() {
      var yaw = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0) + stick.ax;
      var pit = (teclas.ArrowUp ? 1 : 0) - (teclas.ArrowDown ? 1 : 0) - stick.ay;
      if (jug.invertirY) pit = -pit;
      return { yaw: clamp(yaw, -1, 1), pit: clamp(pit, -1, 1), roll: (teclas.KeyE ? 1 : 0) - (teclas.KeyQ ? 1 : 0), acel: (teclas.KeyW ? 1 : 0) - (teclas.KeyS ? 1 : 0), turbo: !!(teclas.ShiftLeft || teclas.ShiftRight || botT), freno: !!(teclas.Space || botF) };
    }
    function palancaVisual(on) {
      hud.palanca.style.display = on ? 'block' : 'none';
      if (on) { hud.palanca.style.left = stick.x0 + 'px'; hud.palanca.style.top = stick.y0 + 'px'; hud.palI2.style.transform = 'translate(' + (stick.ax * 40) + 'px,' + (stick.ay * 40) + 'px)'; }
    }

    /* ---------- física y cámara ---------- */
    function fisica(dt) {
      var e = entrada(), ag = nSel.agil;
      var tY = e.yaw * (0.5 + 0.75 * ag), tP = e.pit * (0.45 + 0.7 * ag), tR = e.roll * (1.1 + 1.2 * ag), k = 1 - Math.exp(-dt * (3.5 + 5 * ag));
      rYaw += (tY - rYaw) * k; rPitch += (tP - rPitch) * k; rRoll += (tR - rRoll) * k;
      qa.setFromAxisAngle(AY, -rYaw * dt); Q.multiply(qa);      // giro a la derecha = rotación negativa sobre Y local
      qa.setFromAxisAngle(AX, rPitch * dt); Q.multiply(qa);     // cabeceo positivo = nariz arriba
      qa.setFromAxisAngle(AZ, -rRoll * dt); Q.multiply(qa);     // alabeo a la derecha = rotación negativa sobre Z local
      Q.normalize();
      acelerador = clamp(acelerador + e.acel * 0.7 * dt, 0, 1);
      if (e.freno) acelerador = Math.max(0, acelerador - 1.6 * dt);
      var quiere = e.turbo && !turboBloq && turboE > 0.02 && acelerador > 0.05;
      turboOn = quiere;
      if (quiere) { turboE = Math.max(0, turboE - 0.22 * dt); if (turboE <= 0.02) { turboBloq = true; toast('TURBO AGOTADO', 1); } } else { turboE = Math.min(1, turboE + 0.12 * dt); if (turboBloq && turboE > 0.3) turboBloq = false; }
      fwd.set(0, 0, -1).applyQuaternion(Q);
      var vo = nSel.vmax * acelerador * (turboOn ? 2.6 : 1);
      vObj.copy(fwd).multiplyScalar(vo);
      var kv = 1 - Math.exp(-dt * (e.freno ? 3.5 : (1.0 + ag * 1.2)));
      V.lerp(vObj, kv);
      P.x += V.x * dt; P.y += V.y * dt; P.z += V.z * dt;
      vel = V.length();
      colisiones();
      inclinar.rotation.z += (-rYaw * 0.45 - inclinar.rotation.z) * Math.min(1, dt * 5);
      inclinar.rotation.x += (rPitch * 0.12 - inclinar.rotation.x) * Math.min(1, dt * 4);
    }
    function colisiones() {
      var R = Math.max(med.radio * 0.5, 3), i, o, dx, dy, dz, d, rr;
      for (i = 0; i < listaPl.length; i++) { o = listaPl[i]; dx = P.x - o.x; dy = P.y - o.y; dz = P.z - o.z; rr = o.r + R; if (dx * dx + dy * dy + dz * dz < rr * rr) impacto(o, dx, dy, dz, rr); }
      for (i = 0; i < listaRo.length; i++) { o = listaRo[i]; dx = P.x - o.x; if (dx > 400 || dx < -400) continue; dy = P.y - o.y; dz = P.z - o.z; rr = o.r + R; if (dx * dx + dy * dy + dz * dz < rr * rr) impacto(o, dx, dy, dz, rr); }
    }
    function impacto(o, dx, dy, dz, rr) {
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, nx = dx / d, ny = dy / d, nz = dz / d;
      P.x = o.x + nx * (rr + 0.05); P.y = o.y + ny * (rr + 0.05); P.z = o.z + nz * (rr + 0.05);
      var vn = V.x * nx + V.y * ny + V.z * nz;
      if (vn < 0) { V.x -= nx * vn * 1.35; V.y -= ny * vn * 1.35; V.z -= nz * vn * 1.35; V.multiplyScalar(0.7); shake = Math.min(1, shake + Math.abs(vn) / 120); if (tToast <= 0.2) toast('IMPACTO', 0.8); acelerador *= 0.6; }
    }
    function camara(dt, t) {
      qCam.slerp(Q, 1 - Math.exp(-dt * 5.5));
      var L = med.largo, dist = L * 1.15 + 9, alt = L * 0.26 + 2.6, ef = clamp(vel / (nSel.vmax * 2.6), 0, 1);
      v1.set(0, alt, dist * (1 + ef * 0.12)).applyQuaternion(qCam);
      v2.set(0, alt * 0.4, -L * 2.2).applyQuaternion(qCam);
      cam.position.copy(v1); cam.up.set(0, 1, 0).applyQuaternion(qCam);
      if (shake > 0.001) { cam.position.x += (Math.random() - 0.5) * shake * L * 0.12; cam.position.y += (Math.random() - 0.5) * shake * L * 0.12; shake *= Math.exp(-dt * 5); }
      cam.lookAt(v2);
      var fov = 70 + ef * 16 + (turboOn ? 6 : 0); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld(true);
      cielo.position.copy(cam.position); solSp.position.copy(cam.position).addScaledVector(SOL_DIR, 80000);
    }

    /* ---------- HUD por fotograma ---------- */
    function dibujarRadar() {
      var g = radarG, S = radarS, c = S / 2, R = c - 4, rango = 16000, i, o;
      g.clearRect(0, 0, S, S);
      g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, R * 0.5, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 4); g.lineTo(c, S - 4); g.moveTo(4, c); g.lineTo(S - 4, c); g.stroke();
      mInv.copy(Q).invert();
      function punto(x, y, z, r, col, minR) {
        v3.set(x - P.x, y - P.y, z - P.z).applyQuaternion(mInv);
        var px = v3.x / rango * R, py = -(-v3.z) / rango * R, d = Math.sqrt(px * px + py * py), rad = clamp(r / rango * R, minR, 9), alpha = 1;
        if (d > R) { px *= R / d; py *= R / d; alpha = 0.45; }
        g.globalAlpha = alpha; g.fillStyle = col; g.beginPath(); g.arc(c + px, c - (-py), rad, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      for (i = 0; i < listaPl.length; i++) { o = listaPl[i]; punto(o.x, o.y, o.z, o.r, '#ffb766', 3); }
      for (i = 0; i < camposVis.length; i++) { o = camposVis[i]; punto(o.x, o.y, o.z, o.a * 0.4, 'rgba(180,180,180,0.7)', 2); }
      for (var id in remotos) { o = remotos[id]; punto(o.rp.x, o.rp.y, o.rp.z, 0, '#5dff8a', 3); }
      g.fillStyle = '#7fe3ff'; g.beginPath(); g.moveTo(c, c - 7); g.lineTo(c - 5, c + 5); g.lineTo(c + 5, c + 5); g.closePath(); g.fill();
    }
    function dibujarBalizas() {
      var g = beaconG.getContext('2d'), w = beaconG.width, h = beaconG.height, i, o, cand = [];
      g.clearRect(0, 0, w, h); g.font = (12 * DPRH) + 'px system-ui,sans-serif'; g.textAlign = 'center';
      for (i = 0; i < listaPl.length; i++) { o = listaPl[i]; var dx = o.x - P.x, dy = o.y - P.y, dz = o.z - P.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); cand.push({ o: o, d: d, s: d - o.r }); }
      cand.sort(function (a, b) { return a.s - b.s; });
      planCercano = cand.length ? cand[0] : null;
      for (i = 0; i < Math.min(3, cand.length); i++) {
        var c = cand[i]; o = c.o; v3.set(o.x - P.x, o.y - P.y, o.z - P.z).project(cam);
        var delante = v3.z < 1, sx = v3.x, sy = v3.y;
        if (!delante) { sx = -sx; sy = -sy; }
        var fuera = !delante || Math.abs(sx) > 0.92 || Math.abs(sy) > 0.86, m = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86, 1e-6);
        if (fuera) { sx /= m; sy /= m; }
        var X = (sx * 0.5 + 0.5) * w, Y = (-sy * 0.5 + 0.5) * h, col = i === 0 ? 'rgba(255,200,120,0.95)' : 'rgba(180,215,255,0.8)';
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5 * DPRH;
        if (fuera) { var ang = Math.atan2(-sy, sx); g.save(); g.translate(X, Y); g.rotate(ang); g.beginPath(); g.moveTo(9 * DPRH, 0); g.lineTo(-6 * DPRH, -6 * DPRH); g.lineTo(-6 * DPRH, 6 * DPRH); g.closePath(); g.fill(); g.restore(); }
        else { var q = 8 * DPRH; g.beginPath(); g.moveTo(X, Y - q); g.lineTo(X + q, Y); g.lineTo(X, Y + q); g.lineTo(X - q, Y); g.closePath(); g.stroke(); }
        var ty = Y + (fuera ? (Y < h / 2 ? 22 : -12) : 24) * DPRH; g.fillText(o.nombre + ' · ' + fmtDist(Math.max(0, c.s)), clamp(X, 80 * DPRH, w - 80 * DPRH), clamp(ty, 16 * DPRH, h - 8 * DPRH));
      }
    }
    function actualizarTextos(dt) {
      hud.vel.innerHTML = Math.round(vel) + ' <small>m/s' + (turboOn ? ' · TURBO' : '') + '</small>';
      hud.mv.firstChild.style.width = Math.round(clamp(vel / (nSel.vmax * 2.6), 0, 1) * 100) + '%'; hud.mt.firstChild.style.width = Math.round(turboE * 100) + '%';
      hud.palI.style.height = Math.round(acelerador * 100) + '%';
      var C = 1000; hud.hd.innerHTML = 'X ' + (P.x / C).toFixed(1) + ' · Y ' + (P.y / C).toFixed(1) + ' · Z ' + (P.z / C).toFixed(1) + ' km<br>' + Math.round(fps) + ' FPS' + (Red.activo ? ' · en línea (' + Object.keys(remotos).length + ')' : '');
      hud.estado.textContent = planCercano ? 'Planeta cercano: ' + planCercano.o.nombre + ' (' + fmtDist(Math.max(0, planCercano.s)) + ')' : '';
    }

    /* ---------- jugadores remotos ---------- */
    function crearRemoto(j) {
      var nm = crearModeloNuevo(j.s, j.c != null ? j.c : ACENTOS[0]); if (!nm) return null;
      var w = new THREE.Group(); w.scale.setScalar(nm.n.m); w.add(nm.m.group); var wrap = new THREE.Group(); wrap.add(w); sc.add(wrap);
      return { id: j.id, nombre: j.n, wrap: wrap, m: nm.m, p: { x: j.p[0], y: j.p[1], z: j.p[2] }, rp: { x: j.p[0], y: j.p[1], z: j.p[2] }, q: new THREE.Quaternion(j.q[0], j.q[1], j.q[2], j.q[3]), v: { x: j.v[0], y: j.v[1], z: j.v[2] }, t: tMundo };
    }
    function recibirEstado(lista) {
      lista.forEach(function (j) {
        if (j.id === Red.id) return; var r = remotos[j.id];
        if (!r) { r = crearRemoto(j); if (!r) return; remotos[j.id] = r; }
        r.p = { x: j.p[0], y: j.p[1], z: j.p[2] }; r.v = { x: j.v[0], y: j.v[1], z: j.v[2] }; r.q.set(j.q[0], j.q[1], j.q[2], j.q[3]); r.t = tMundo;
      });
    }
    function quitarRemoto(id) { var r = remotos[id]; if (r) { sc.remove(r.wrap); delete remotos[id]; } }
    function limpiarRemotos() { for (var id in remotos) quitarRemoto(id); }
    function actualizarRemotos(dt, t) {
      for (var id in remotos) {
        var r = remotos[id], e = Math.min(0.6, tMundo - r.t), tx = r.p.x + r.v.x * e, ty = r.p.y + r.v.y * e, tz = r.p.z + r.v.z * e, k = Math.min(1, dt * 8);
        r.rp.x += (tx - r.rp.x) * k; r.rp.y += (ty - r.rp.y) * k; r.rp.z += (tz - r.rp.z) * k;
        r.wrap.position.set(r.rp.x - P.x, r.rp.y - P.y, r.rp.z - P.z); r.wrap.quaternion.slerp(r.q, k);
        actualizarModelo(r.m, t, 0.6);
      }
    }

    /* ---------- escena: ciclo de vida ---------- */
    function redimensionar4(w, h) {
      if (!cam) return; cam.aspect = w / h; cam.updateProjectionMatrix();
      DPRH = Math.min(global.devicePixelRatio || 1, 1.5); if (beaconG) { beaconG.width = Math.round(w * DPRH); beaconG.height = Math.round(h * DPRH); }
    }
    return {
      construir: construir, redimensionar: redimensionar4,
      entrar: function (d) {
        modo = (d && d.modo) || 'solo'; nSel = naveDe(jug.nave); modelo = obtenerModelo(jug.nave); med = medidas[jug.nave];
        if (!modelo) { irA('lobby'); return; }
        mostrarCapas(['hud']); pausar(false);
        pivote = new THREE.Group(); inclinar = new THREE.Group(); escalarN = new THREE.Group(); escalarN.scale.setScalar(nSel.m); escalarN.add(modelo.group); inclinar.add(escalarN); pivote.add(inclinar); sc.add(pivote);
        try { if (modelo.setAccent) modelo.setAccent(jug.acento); } catch (e) { }
        hud.nom.textContent = nSel.nombre.toUpperCase() + ' · ' + esc(jug.nombre);
        radarG = hud.radar.getContext('2d'); var dpr = Math.min(global.devicePixelRatio || 1, 2); hud.radar.width = radarS * dpr; hud.radar.height = radarS * dpr; radarG.setTransform(dpr, 0, 0, dpr, 0, 0);
        crearPolvo(); redimensionar4(E.ancho, E.alto);
        posicionInicial(); actualizarCeldas(true);
        V.set(0, 0, 0); qCam.copy(Q); rYaw = rPitch = rRoll = 0; acelerador = 0.3; turboE = 1; turboBloq = false; shake = 0; tMundo = 0; tHud = 0; tRed = 0; teclas = {}; botT = botF = false; stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false);
        if (modo === 'red') {
          toast('CONECTANDO…', 3);
          Red.onEstado = recibirEstado; Red.onSalio = quitarRemoto;
          Red.conectar(CONFIG.servidor, { nombre: jug.nombre, nave: jug.nave, color: jug.acento }, function (e) { toast('SIN SERVIDOR · SOLO', 2.5); modo = 'solo'; });
        } else toast('BIENVENIDO, ' + jug.nombre.toUpperCase(), 2.2);
      },
      salir: function () {
        if (pivote) { sc.remove(pivote); pivote = null; } Red.cerrar(); limpiarRemotos(); palancaVisual(false); pausar(false);
        var k; for (k in celdas) { var c = celdas[k]; if (c.planeta) quitarPlaneta(c.planeta); if (c.campo) quitarCampo(c.campo); } celdas = {}; ucx = 1e9;
        if (polvo) { sc.remove(polvo); polvo.geometry.dispose(); polvo.material.dispose(); polvo = null; }
      },
      tecla: function (e, abajo) {
        teclas[e.code] = abajo;
        if (abajo && (e.code === 'Escape' || e.code === 'KeyP')) pausar(!pausado);
        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      },
      puntero: function (tipo, e) {
        if (pausado) return;
        if (tipo === 'abajo' && stick.id === null) { stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.ax = stick.ay = 0; palancaVisual(true); }
        else if (tipo === 'mueve' && stick.id === e.pointerId) {
          var R = 60, dx = e.clientX - stick.x0, dy = e.clientY - stick.y0, d = Math.sqrt(dx * dx + dy * dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          var ax = dx / R, ay = dy / R; stick.ax = Math.abs(ax) < 0.08 ? 0 : ax; stick.ay = Math.abs(ay) < 0.08 ? 0 : ay; palancaVisual(true);
          hud.palI2.style.transform = 'translate(' + (dx * 0.7) + 'px,' + (dy * 0.7) + 'px)';
        }
        else if (tipo === 'arriba' && stick.id === e.pointerId) { stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false); }
      },
      actualizar: function (dt, t) {
        if (!sc || !pivote) return;
        fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
        if (!pausado) {
          tMundo += dt; fisica(dt);
          actualizarCeldas(false);
          if (modo === 'red' && Red.activo) { tRed += dt; if (tRed > 0.1) { tRed = 0; Red.enviar({ t: 'e', p: [P.x, P.y, P.z], q: [Q.x, Q.y, Q.z, Q.w], v: [V.x, V.y, V.z] }); } }
        }
        // origen flotante: la nave siempre en (0,0,0); el resto se coloca relativo a ella
        pivote.quaternion.copy(Q); pivote.position.set(0, 0, 0);
        var i, o;
        for (i = 0; i < listaPl.length; i++) {
          o = listaPl[i]; if (!o.g) continue; o.k = Math.min(1, o.k + dt * 0.7); var ek = o.k * o.k * (3 - 2 * o.k);
          o.g.position.set(o.x - P.x, o.y - P.y, o.z - P.z); o.g.scale.setScalar(o.r * (0.6 + 0.4 * ek)); o.g.userData.cuerpo.rotation.y += o.giro * dt;
        }
        for (i = 0; i < camposVis.length; i++) { o = camposVis[i]; if (o.g) o.g.position.set(o.x - P.x, o.y - P.y, o.z - P.z); }
        actualizarModelo(modelo, t, clamp(vel / nSel.vmax, 0, 1));
        moverPolvo(pausado ? 0 : dt, clamp(vel / (nSel.vmax * 2.0), 0, 1)); polvo.position.set(0, 0, 0);
        camara(pausado ? 0.0001 : dt, t); actualizarRemotos(dt, t);
        E.renderer.render(sc, cam);
        tHud += dt; if (tHud > 0.1) { tHud = 0; actualizarTextos(dt); }
        dibujarRadar(); dibujarBalizas();
        if (tToast > 0) { tToast -= dt; if (tToast <= 0) hud.toast.style.opacity = 0; }
      }
    };
  })();


})(window);
