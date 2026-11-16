/**
 * Martillo: cañonera pesada para Three.js, sin archivos externos.
 *
 * Casco blindado y ancho con cuna de cañón principal en proa (con retroceso y fogonazo),
 * 2 torretas dobles dorsales, 2 torretas laterales, sponsons con celdas de misiles, puente
 * acorazado y 4 motores.
 *
 * Uso:
 *   const gunship = createMartillo(THREE, { accent: 0x2f7bff });
 *   scene.add(gunship.group);
 *   gunship.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *   gunship.fire();                                     // retroceso + fogonazo del cañón principal
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 4 m. Eslora 29 u (~116 m con el cañón), anchura 10 u.
 *
 * Expone: group, update(t, throttle), fire(), setAccent(hex),
 *   cannon  Group    el cañón (retrocede en Z local al disparar)
 *   muzzle  Object3D punto de salida del proyectil (usa muzzle.getWorldPosition)
 *   turrets [{ head, gun, muzzles }] x4  (head.rotation.y gira, gun.rotation.x eleva)
 * Compatible con Three.js r128 o superior.
 */
function createMartillo(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xc2cad6,
    accent: opts.accent != null ? opts.accent : 0x2f7bff,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    glow: opts.glow != null ? opts.glow : 0x62d6ff
  };
  var group = new THREE.Group();
  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.45, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x7d899a, metalness: 0.6, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1d33, metalness: 0.9, roughness: 0.05, emissive: 0x0a3a5c, emissiveIntensity: 0.8 }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    red: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    green: new THREE.MeshBasicMaterial({ color: 0x35ff7a })
  };
  function glowMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  function add(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  var seed = opts.seed || 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  /* ---------- Geometrías ---------- */
  function plan(pts, depth, bevel) {
    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (var j = pts.length - 1; j >= 1; j--) s.lineTo(-pts[j][0], pts[j][1]);
    s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: !!bevel, bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 4, curveSegments: 12 });
    g.rotateX(P / 2);
    g.translate(0, depth / 2, 0);
    return g;
  }
  function roundedBox(w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    var v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      inner.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      n.set(v.x - inner.x, v.y - inner.y, v.z - inner.z);
      if (n.lengthSq() > 1e-12) {
        n.normalize();
        v.set(inner.x + n.x * r, inner.y + n.y * r, inner.z + n.z * r);
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  function capsule(r, len, seg) {
    var pts = [], n = 10, i, a;
    for (i = 0; i <= n; i++) { a = -P / 2 + (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a))); }
    for (i = 0; i <= n; i++) { a = (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a))); }
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(P / 2);
    return g;
  }
  /* Casco de revolución suave: rz = [[z, radio], ...] con la nariz en z negativo; sx/sy lo ovalan. */
  function lathe(rz, seg, sx, sy) {
    var ctrl = [], i;
    for (i = 0; i < rz.length; i++) ctrl.push(new THREE.Vector2(rz[i][1], -rz[i][0]));
    var curve = new THREE.SplineCurve(ctrl), raw = curve.getPoints(rz.length * 8), pts = [];
    for (i = raw.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(Math.max(0, raw[i].x), raw[i].y));   // y creciente = normales hacia fuera
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(-P / 2);
    g.scale(sx || 1, sy || 1, 1);
    return g;
  }
  function boxField(geo, mat, list) {
    var mesh = new THREE.InstancedMesh(geo, mat, list.length);
    var o = new THREE.Object3D();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      o.position.set(e.x, e.y, e.z);
      o.rotation.y = e.ry || 0;
      o.scale.set(e.sx || 1, e.sy || 1, e.sz || 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------- Motores, luces y torretas ---------- */
  var flames = [], blinkers = [], anim = [];
  function engine(parent, x, y, z, r, len) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    var bell = new THREE.CylinderGeometry(r, r * 0.7, r * 1.2, 20, 1, true);
    bell.rotateX(P / 2);
    add(g, bell, mats.dark, 0, 0, r * 0.2);
    add(g, new THREE.TorusGeometry(r * 0.98, r * 0.07, 8, 24), mats.plate, 0, 0, r * 0.8);
    var o = new THREE.ConeGeometry(r * 0.85, len, 20, 1, true); o.translate(0, len / 2, 0); o.rotateX(P / 2);
    var c = new THREE.ConeGeometry(r * 0.5, len * 0.6, 16, 1, true); c.translate(0, len * 0.3, 0); c.rotateX(P / 2);
    var outer = add(g, o, glowMat(colors.glow, 0.45), 0, 0, r * 0.6);
    var core = add(g, c, glowMat(0xffffff, 0.8), 0, 0, r * 0.6);
    flames.push({ outer: outer, core: core, ph: rnd() * TAU });
    return g;
  }
  function light(parent, x, y, z, mat, size, period) {
    var m = add(parent, new THREE.SphereGeometry(size || 0.07, 8, 6), mat, x, y, z);
    blinkers.push({ m: m, per: period || 1.2, ph: rnd() * TAU });
    return m;
  }
  function turret(parent, x, y, z, s, barrels, len) {
    add(parent, new THREE.CylinderGeometry(0.55 * s, 0.7 * s, 0.25 * s, 20), mats.plate, x, y + 0.12 * s, z);
    var head = new THREE.Group();
    head.position.set(x, y + 0.25 * s, z);
    parent.add(head);
    add(head, roundedBox(0.9 * s, 0.4 * s, 1.0 * s, 0.12 * s, 3), mats.hull, 0, 0.2 * s, 0);
    var gun = new THREE.Group();
    gun.position.set(0, 0.25 * s, -0.3 * s);
    head.add(gun);
    var muzzles = [];
    for (var i = 0; i < barrels; i++) {
      var bx = (i - (barrels - 1) / 2) * 0.38 * s;
      var bg = new THREE.CylinderGeometry(0.07 * s, 0.09 * s, len * s, 10);
      bg.rotateX(P / 2); bg.translate(0, 0, -len * s / 2);
      add(gun, bg, mats.dark, bx, 0, 0);
      add(gun, new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.12 * s, 10).rotateX(P / 2), mats.plate, bx, 0, -len * s);
      var mz = new THREE.Object3D();
      mz.position.set(bx, 0, -len * s - 0.08 * s);
      gun.add(mz);
      muzzles.push(mz);
    }
    return { head: head, gun: gun, muzzles: muzzles };
  }
  function engineUpdate(t, th) {
    th = th == null ? 0.5 : th;
    var i, f, fl;
    for (i = 0; i < flames.length; i++) {
      f = flames[i];
      fl = 1 + Math.sin(t * 40 + f.ph) * 0.06 + Math.sin(t * 23 + f.ph * 2) * 0.05;
      f.outer.scale.set(0.8 + th * 0.3, 0.8 + th * 0.3, (0.25 + th * 1.1) * fl);
      f.core.scale.set(0.8 + th * 0.2, 0.8 + th * 0.2, (0.2 + th * 1.0) * fl);
    }
    for (i = 0; i < blinkers.length; i++) blinkers[i].m.visible = Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
    for (i = 0; i < anim.length; i++) anim[i](t, th);
  }
  function setAccent(hex) { colors.accent = hex; mats.accent.color.setHex(hex); }

  mats.hull2 = new THREE.MeshStandardMaterial({ color: 0x9aa5b6, metalness: 0.55, roughness: 0.38 });
  mats.trim = new THREE.MeshStandardMaterial({ color: 0x3a4456, metalness: 0.8, roughness: 0.35 });
  var UB = new THREE.BoxGeometry(1, 1, 1);
  for (var mk in mats) if (mats[mk].isMeshStandardMaterial) mats[mk].side = THREE.DoubleSide;   // nada se ve transparente por dentro

  /* Casco "loft": cada sección { z, w (semiancho), t (alto superior), b (alto inferior), n (cuadratura), x, y }
     se une con la siguiente en una superficie lisa. capA/capB cierran las puntas planas. */
  function loft(secs, seg, capA, capB) {
    var pos = [], idx = [], ns = secs.length, i, j, s, a, c, sn, ex, h, base;
    function ring(sec) {
      var n = sec.n || 2.4, yc = sec.y || 0, xc = sec.x || 0, out = [];
      ex = 2 / n;
      for (var k = 0; k < seg; k++) {
        a = k / seg * TAU; c = Math.cos(a); sn = Math.sin(a);
        h = sn >= 0 ? sec.t : sec.b;
        out.push([xc + sec.w * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex), yc + h * (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), ex), sec.z]);
      }
      return out;
    }
    for (i = 0; i < ns; i++) { var r = ring(secs[i]); for (j = 0; j < seg; j++) pos.push(r[j][0], r[j][1], r[j][2]); }
    for (i = 0; i < ns - 1; i++) for (j = 0; j < seg; j++) {
      var A = i * seg + j, B = i * seg + (j + 1) % seg, C = (i + 1) * seg + j, D = (i + 1) * seg + (j + 1) % seg;
      idx.push(A, B, C, B, D, C);
    }
    function cap(sec, front) {
      var r2 = ring(sec), b0 = pos.length / 3, cx = sec.x || 0, cy = sec.y || 0;
      for (var k = 0; k < seg; k++) pos.push(r2[k][0], r2[k][1], r2[k][2]);
      pos.push(cx, cy, sec.z);
      for (var q = 0; q < seg; q++) {
        if (front) idx.push(b0 + seg, b0 + (q + 1) % seg, b0 + q);
        else idx.push(b0 + seg, b0 + q, b0 + (q + 1) % seg);
      }
    }
    if (capA) cap(secs[0], true);
    if (capB) cap(secs[ns - 1], false);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  /* Detalle aleatorio: cajitas sobre un plano. axis 'y' = superficie horizontal, 'x' = lateral. */
  function greeble(cx, cy, cz, w, h, d, n, mat, axis, smin, smax) {
    var l = [], k, sx, sy, sz;
    smin = smin || 0.15; smax = smax || 0.6;
    for (k = 0; k < n; k++) {
      sx = smin + rnd() * (smax - smin); sz = smin + rnd() * (smax - smin); sy = 0.05 + rnd() * 0.16;
      if (axis === 'x') l.push({ x: cx + sy / 2 * (cx < 0 ? -1 : 1), y: cy + (rnd() - 0.5) * h, z: cz + (rnd() - 0.5) * d, sx: sy, sy: sx, sz: sz });
      else l.push({ x: cx + (rnd() - 0.5) * w, y: cy + sy / 2, z: cz + (rnd() - 0.5) * d, sx: sx, sy: sy, sz: sz });
    }
    var m = boxField(UB, mat, l);
    group.add(m);
    return m;
  }
  /* Motor con carcasa de revolución (anillos) alrededor de la tobera. */
  function nacelle(parent, x, y, z, r, len) {
    var g = lathe([[-len, r * 0.55], [-len * 0.7, r * 0.9], [-len * 0.2, r * 1.0], [0, r * 0.95]], 20, 1, 1);
    // lathe deja la nariz en z negativo: la carcasa queda detrás de z
    var m = add(parent, g, mats.hull2, x, y, z);
    for (var k = 0; k < 3; k++) add(parent, new THREE.TorusGeometry(r * 0.97, r * 0.05, 8, 24), mats.trim, x, y, z - len * (0.15 + k * 0.28));
    return m;
  }

  /* ---------- Casco blindado (superficie lisa) ---------- */
  var i;
  add(group, loft([
    { z: -12, w: 0.1, t: 0.1, b: 0.1 }, { z: -10.5, w: 1.2, t: 0.6, b: 0.5 }, { z: -7, w: 2.6, t: 1.1, b: 0.9 }, { z: -2, w: 3.6, t: 1.4, b: 1.1 },
    { z: 4, w: 3.8, t: 1.5, b: 1.2 }, { z: 9, w: 3.3, t: 1.4, b: 1.1 }, { z: 11.5, w: 2.8, t: 1.2, b: 1.0 }
  ].map(function (s) { s.n = 3.2; return s; }), 40, true, true), mats.hull, 0, 0, 0);
  // blindaje dorsal escalonado
  add(group, loft([
    { z: -7.5, w: 0.3, t: 0.2, b: 0.2, y: 1.1 }, { z: -5, w: 1.8, t: 0.6, b: 0.5, y: 1.4 }, { z: -1, w: 2.4, t: 0.7, b: 0.5, y: 1.55 }, { z: 6, w: 2.4, t: 0.7, b: 0.5, y: 1.55 }, { z: 9.5, w: 1.6, t: 0.4, b: 0.4, y: 1.5 }
  ].map(function (s) { s.n = 3; return s; }), 28, true, true), mats.hull2, 0, 0, 0);
  // cuna del cañón
  add(group, loft([
    { z: -9.2, w: 0.5, t: 0.5, b: 0.5 }, { z: -7.5, w: 0.95, t: 0.8, b: 0.7 }, { z: -1, w: 1.0, t: 0.8, b: 0.7 }, { z: 0.5, w: 0.6, t: 0.5, b: 0.5 }
  ].map(function (s) { s.n = 2.6; s.y = 0.3; return s; }), 24, true, true), mats.plate, 0, 0, 0);
  // sponsons
  [-1, 1].forEach(function (s) {
    add(group, loft([
      { z: -3.5, w: 0.2, t: 0.3, b: 0.3 }, { z: -1.5, w: 0.85, t: 0.8, b: 0.75 }, { z: 4.5, w: 0.9, t: 0.85, b: 0.8 }, { z: 6.5, w: 0.4, t: 0.5, b: 0.5 }
    ].map(function (q) { q.n = 2.8; q.x = s * 3.7; return q; }), 24, true, true), mats.hull2, 0, 0, 0);
    add(group, new THREE.BoxGeometry(0.06, 0.18, 6), mats.accent, s * 4.62, 0.25, 1.2);
    add(group, new THREE.BoxGeometry(0.06, 0.12, 4), mats.trim, s * 4.6, -0.3, 1.2);
    var cells = [];
    for (var a = 0; a < 3; a++) for (var b = 0; b < 4; b++) cells.push({ x: s * 3.7 + (a - 1) * 0.42, y: 0.8, z: -0.8 + b * 1.15, sx: 0.32, sy: 0.07, sz: 0.85 });
    group.add(boxField(UB, mats.dark, cells));
    add(group, roundedBox(0.8, 0.6, 3, 0.2, 3), mats.hull2, s * 1.7, -1.15, -2);       // faldones ventrales
    light(group, s * 3.7, 0.66, 6.0, s > 0 ? mats.green : mats.red, 0.1, 1.3);
    // aletas radiadoras
    var fin = add(group, roundedBox(0.1, 2.0, 2.4, 0.04, 2), mats.hull2, s * 2.3, 2.15, 9.4);
    fin.rotation.z = -s * 0.28;
    add(group, new THREE.BoxGeometry(0.12, 0.05, 2.5), mats.accent, s * 2.52, 3.1, 9.4).rotation.z = -s * 0.28;
  });
  greeble(0, 2.2, 1.8, 2.4, 0, 10, 36, mats.trim, 'y', 0.15, 0.5);
  greeble(0, 2.2, 1.8, 2.2, 0, 9, 22, mats.hull, 'y', 0.2, 0.6);
  greeble(0, 1.08, -6.2, 1.6, 0, 3.0, 14, mats.hull2, 'y', 0.12, 0.4);

  /* ---------- Cañón principal con retroceso ---------- */
  var cannon = new THREE.Group();
  cannon.position.set(0, 0.4, -5.5);
  group.add(cannon);
  var CAN_REST = -5.5;
  var bar = new THREE.CylinderGeometry(0.38, 0.38, 11, 20); bar.rotateX(P / 2); bar.translate(0, 0, -5.5);
  add(cannon, bar, mats.dark, 0, 0, 0);
  var slv = new THREE.CylinderGeometry(0.6, 0.62, 5, 20); slv.rotateX(P / 2); slv.translate(0, 0, -2.5);
  add(cannon, slv, mats.plate, 0, 0, 0);
  for (i = 0; i < 6; i++) add(cannon, new THREE.TorusGeometry(0.5, 0.09, 8, 24), mats.accent, 0, 0, -6 - i * 0.85);
  for (i = 0; i < 3; i++) add(cannon, new THREE.CylinderGeometry(0.52, 0.52, 0.3, 20).rotateX(P / 2), mats.hull2, 0, 0, -6.5 - i * 1.9);
  add(cannon, loft([
    { z: -10.5, w: 0.5, t: 0.4, b: 0.4 }, { z: -11.1, w: 0.62, t: 0.5, b: 0.5 }, { z: -11.7, w: 0.5, t: 0.4, b: 0.4 }
  ].map(function (s) { s.n = 2.2; return s; }), 16, true, true), mats.plate, 0, 0, 0);   // freno de boca
  [-1, 1].forEach(function (s) { add(cannon, new THREE.BoxGeometry(0.06, 0.55, 0.9), mats.dark, s * 0.6, 0, -11.1); });
  var muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -12.0);
  cannon.add(muzzle);
  var flash = add(cannon, new THREE.SphereGeometry(0.9, 14, 10), glowMat(0xffd080, 0.9), 0, 0, -12.3);
  var flash2 = add(cannon, new THREE.ConeGeometry(0.5, 3.2, 14, 1, true).rotateX(-P / 2), glowMat(0xffffff, 0.8), 0, 0, -13.6);
  flash.visible = flash2.visible = false;
  var fireT = null, pending = false;
  function fire() { pending = true; }
  anim.push(function (t) {
    if (pending) { fireT = t; pending = false; }
    var k = fireT == null ? 99 : t - fireT;
    cannon.position.z = CAN_REST + (k < 1.2 ? 1.3 * Math.exp(-k * 5) * Math.min(1, k * 40) : 0);
    var on = k < 0.12;
    flash.visible = flash2.visible = on;
    if (on) { flash.scale.setScalar(1 - k * 5); flash2.scale.set(1 - k * 5, 1 - k * 5, 1 + k * 4); }
  });

  /* ---------- Torretas y puente ---------- */
  var turrets = [];
  [0.5, 5.2].forEach(function (z) { turrets.push(turret(group, 0, 2.2, z, 1.3, 2, 2.2)); });
  [-1, 1].forEach(function (s) { var tu = turret(group, s * 3.7, 0.72, 5.0, 0.7, 2, 1.2); tu.head.rotation.y = -s * 0.6; turrets.push(tu); });
  add(group, loft([
    { z: 7.2, w: 0.3, t: 0.2, b: 0.3 }, { z: 8.0, w: 1.0, t: 0.6, b: 0.4 }, { z: 10, w: 1.1, t: 0.55, b: 0.4 }, { z: 11, w: 0.7, t: 0.3, b: 0.3 }
  ].map(function (s) { s.n = 2.8; s.y = 2.3; s.b = 0.8; return s; }), 24, true, true), mats.hull, 0, 0, 0);
  add(group, roundedBox(1.7, 0.2, 0.7, 0.06, 2), mats.glass, 0, 2.5, 7.95).rotation.x = -0.4;
  add(group, new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), mats.trim, 0.5, 3.45, 10.2);
  light(group, 0, 2.95, 10.4, mats.red, 0.1, 1.7);

  /* ---------- Motores ---------- */
  add(group, roundedBox(5.4, 2.4, 1.8, 0.5, 3), mats.plate, 0, 0, 11.3);
  [[-1.3, 0.7], [1.3, 0.7], [-1.3, -0.7], [1.3, -0.7]].forEach(function (p) {
    nacelle(group, p[0], p[1], 12.4, 0.66, 1.4);
    engine(group, p[0], p[1], 12.4, 0.62, 3.2);
  });

  return {
    group: group,
    cannon: cannon,
    muzzle: muzzle,
    turrets: turrets,
    fire: fire,
    setAccent: setAccent,
    update: function (t, th) { engineUpdate(t, th); }
  };
}
