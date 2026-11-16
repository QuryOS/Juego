/**
 * Nodriza: portanaves espacial (la más grande de las naves de combate de apoyo) para Three.js,
 * sin archivos externos.
 *
 * Casco largo con quilla, cubierta de vuelo con luces de guía y 8 cazas estacionados, isla de mando
 * con radar giratorio, hangares laterales iluminados, 10 torretas de defensa, celdas de misiles en proa,
 * 6 motores y 8 drones: se lanzan uno a uno por la catapulta (el siguiente rueda a posición), orbitan la nave
 * y después regresan a aterrizar y recargan, en un ciclo de 120 s.
 *
 * Uso:
 *   const carrier = createNodriza(THREE, { accent: 0x2f7bff });
 *   scene.add(carrier.group);
 *   carrier.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 4 m. Eslora 62 u (~250 m), manga 15 u.
 *
 * Expone: group, update(t, throttle), setAccent(hex),
 *   turrets   [{ head, gun, muzzles }] x10  (head.rotation.y gira, gun.rotation.x eleva)
 *   fighters  [Group x8]  los 8 drones (Group)
 *   drones    [{ mesh, state }] x8  state: 0 aparcado, 1 rodando, 2 acelerando, 3 orbitando, 4 aproximando, 5 aterrizando
 *   parked    número de drones aparcados ahora mismo (8 = todos cargados, 0 = todos fuera)
 *   auto      true = ciclo automático; false = todos aparcados
 * Compatible con Three.js r128 o superior.
 */
function createNodriza(THREE, opts) {
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

  /* ---------- Casco (superficie lisa) ---------- */
  var HS = [[-28, 0.1, 0.1, 0.1], [-26, 2.0, 0.9, 0.9], [-22, 4.2, 1.4, 1.6], [-16, 6.0, 1.7, 1.9], [-8, 7.0, 1.8, 2.1],
            [4, 7.4, 1.8, 2.2], [16, 7.3, 1.8, 2.1], [24, 6.5, 1.65, 1.95], [29, 5.7, 1.5, 1.8]];
  function hullW(z) {
    for (var q = 1; q < HS.length; q++) if (z <= HS[q][0]) return HS[q - 1][1] + (HS[q][1] - HS[q - 1][1]) * (z - HS[q - 1][0]) / (HS[q][0] - HS[q - 1][0]);
    return HS[HS.length - 1][1];
  }
  function hullT(z) {
    for (var q = 1; q < HS.length; q++) if (z <= HS[q][0]) return HS[q - 1][2] + (HS[q][2] - HS[q - 1][2]) * (z - HS[q - 1][0]) / (HS[q][0] - HS[q - 1][0]);
    return HS[HS.length - 1][2];
  }
  function topY(x, z) {   // altura real de la superficie del casco en (x, z)
    var w = hullW(z), u = Math.min(0.999, Math.abs(x) / w);
    return hullT(z) * Math.pow(1 - Math.pow(u, 4.5), 1 / 4.5);
  }
  add(group, loft(HS.map(function (h) { return { z: h[0], w: h[1], t: h[2], b: h[3], n: 4.5 }; }), 44, true, true), mats.hull, 0, 0, 0);
  add(group, loft([
    { z: -18, w: 0.1, t: 0.1, b: 0.1 }, { z: -14, w: 2.2, t: 0.8, b: 1.0 }, { z: -2, w: 3.0, t: 0.9, b: 1.2 },
    { z: 18, w: 2.8, t: 0.9, b: 1.1 }, { z: 26, w: 2.0, t: 0.8, b: 0.9 }
  ].map(function (s) { s.n = 3; s.y = -2.7; return s; }), 28, true, true), mats.plate, 0, 0, 0);
  add(group, roundedBox(10.4, 3.0, 2.4, 0.6, 4), mats.plate, 0, 0, 28.6);               // muro de motores
  add(group, new THREE.SphereGeometry(0.7, 16, 12), mats.dark, 0, 0.2, -27.2);          // sensor de proa
  // placas de blindaje laterales siguiendo el casco
  [-1, 1].forEach(function (s) {
    [[-15, 1.5], [14, 23]].forEach(function (r) {
      var secs = [], steps = 5;
      for (var q = 0; q <= steps; q++) {
        var zz = r[0] + (r[1] - r[0]) * q / steps, edge = q === 0 || q === steps;
        secs.push({ z: zz, w: edge ? 0.15 : 0.32, t: edge ? 0.7 : 1.1, b: edge ? 0.7 : 1.1, n: 3, x: s * (hullW(zz) + 0.12), y: -0.2 });
      }
      add(group, loft(secs, 18, true, true), mats.hull2, 0, 0, 0);
    });
    // lámparas de posición y franja de acento
    add(group, new THREE.BoxGeometry(0.06, 0.18, 13), mats.accent, s * (hullW(-8) + 0.42), 0.55, -8);
    light(group, s * hullW(0) * 0.95, 1.2, 0, s > 0 ? mats.green : mats.red, 0.12, 1.5);
    light(group, s * 5.2, topY(5.2, 26) + 0.05, 26, s > 0 ? mats.green : mats.red, 0.1, 1.5);
  });

  /* ---------- Cubierta de vuelo ---------- */
  var DECK_Y = 2.0;
  add(group, roundedBox(10.2, 0.9, 34, 0.1, 3), mats.dark, 0, DECK_Y - 0.45, 2);
  var dashes = [], edge = [], i;
  for (i = 0; i < 11; i++) dashes.push({ x: 0, y: DECK_Y + 0.05, z: -14 + i * 2.9, sx: 0.3, sy: 0.02, sz: 1.5 });
  group.add(boxField(UB, mats.accent, dashes));
  for (i = 0; i < 18; i++) {
    edge.push({ x: -4.95, y: DECK_Y + 0.05, z: -14.5 + i * 1.95, sx: 0.12, sy: 0.08, sz: 0.12 });
    edge.push({ x: 4.95, y: DECK_Y + 0.05, z: -14.5 + i * 1.95, sx: 0.12, sy: 0.08, sz: 0.12 });
  }
  group.add(boxField(UB, mats.lamp, edge));
  [-1, 1].forEach(function (s) { add(group, new THREE.BoxGeometry(0.15, 0.02, 30), mats.plate, s * 4.4, DECK_Y + 0.04, 2); });
  // catapulta (carril del caza que despega)
  add(group, new THREE.BoxGeometry(0.22, 0.03, 19), mats.trim, 2.6, DECK_Y + 0.045, -6.5);
  var rails = [];
  for (i = 0; i < 12; i++) rails.push({ x: 2.6, y: DECK_Y + 0.07, z: -15 + i * 1.6, sx: 0.5, sy: 0.02, sz: 0.1 });
  group.add(boxField(UB, mats.accent, rails));
  // ascensores de hangar
  [[-3.4, 11], [2.6, 15]].forEach(function (e) {
    add(group, roundedBox(3.6, 0.05, 3.6, 0.02, 1), mats.hull2, e[0], DECK_Y + 0.05, e[1]);
    [[0, -1.8, 3.7, 0.08], [0, 1.8, 3.7, 0.08], [-1.8, 0, 0.08, 3.7], [1.8, 0, 0.08, 3.7]].forEach(function (b) {
      add(group, new THREE.BoxGeometry(b[2], 0.04, b[3]), mats.accent, e[0] + b[0], DECK_Y + 0.075, e[1] + b[1]);
    });
  });
  // celdas de misiles en proa
  var vls = [];
  for (var a = 0; a < 5; a++) for (var b = 0; b < 4; b++) vls.push({ x: -1.8 + a * 0.9, y: topY(-1.8 + a * 0.9, -21.5 + b * 1.0) + 0.03, z: -21.5 + b * 1.0, sx: 0.6, sy: 0.12, sz: 0.6 });
  group.add(boxField(UB, mats.dark, vls));
  greeble(0, 1.6, 22.8, 6, 0, 7, 70, mats.hull2, 'y', 0.2, 0.7);                        // popa de cubierta
  greeble(0, 1.6, 22.8, 6, 0, 7, 40, mats.trim, 'y', 0.12, 0.35);

  /* ---------- Isla de mando ---------- */
  add(group, loft([
    { z: 2.6, w: 0.3, t: 0.9, b: 2.6 }, { z: 3.6, w: 1.0, t: 1.7, b: 2.6 }, { z: 8.4, w: 1.1, t: 1.8, b: 2.6 }, { z: 9.3, w: 0.8, t: 1.3, b: 2.5 }
  ].map(function (s) { s.n = 3.2; s.x = 5.4; s.y = DECK_Y + 1.8; return s; }), 24, true, true), mats.hull, 0, 0, 0);
  add(group, loft([
    { z: 3.0, w: 0.5, t: 0.2, b: 0.2 }, { z: 3.8, w: 1.5, t: 0.5, b: 0.35 }, { z: 7.6, w: 1.7, t: 0.5, b: 0.35 }, { z: 8.6, w: 1.1, t: 0.4, b: 0.3 }
  ].map(function (s) { s.n = 3; s.x = 5.2; s.y = 6.0; return s; }), 24, true, true), mats.hull2, 0, 0, 0);
  add(group, roundedBox(2.5, 0.2, 0.35, 0.05, 2), mats.glass, 5.2, 6.05, 3.55);          // ventanal frontal
  [-1, 1].forEach(function (s) { add(group, roundedBox(0.1, 0.18, 2.6, 0.04, 2), mats.glass, 5.2 + s * 1.62, 6.05, 5.6); });
  add(group, new THREE.BoxGeometry(2.3, 0.18, 0.1), mats.accent, 5.4, 4.5, 2.95);
  var wins = [];
  for (i = 0; i < 8; i++) {
    wins.push({ x: 4.28, y: 3.2 + (i % 2) * 0.8, z: 3.9 + Math.floor(i / 2) * 1.3, sx: 0.05, sy: 0.25, sz: 0.7 });
    wins.push({ x: 6.52, y: 3.2 + (i % 2) * 0.8, z: 3.9 + Math.floor(i / 2) * 1.3, sx: 0.05, sy: 0.25, sz: 0.7 });
  }
  group.add(boxField(UB, mats.window, wins));
  add(group, new THREE.SphereGeometry(0.4, 14, 10), mats.hull2, 4.6, 6.6, 4.6);          // cúpulas de sensores
  add(group, new THREE.SphereGeometry(0.3, 14, 10), mats.hull2, 6.0, 6.55, 7.3);
  add(group, new THREE.CylinderGeometry(0.07, 0.1, 2.4, 8), mats.plate, 5.5, 7.6, 6.6);
  add(group, new THREE.CylinderGeometry(0.03, 0.04, 2.0, 6), mats.trim, 4.7, 7.4, 7.6);
  add(group, new THREE.CylinderGeometry(0.03, 0.04, 1.4, 6), mats.trim, 6.2, 7.0, 4.0);
  var radar = new THREE.Group();
  radar.position.set(5.5, 8.9, 6.6);
  group.add(radar);
  add(radar, roundedBox(2.6, 0.14, 0.35, 0.05, 2), mats.plate, 0, 0, 0);
  add(radar, new THREE.BoxGeometry(0.1, 0.35, 0.1), mats.dark, 0, -0.2, 0);
  anim.push(function (t) { radar.rotation.y = t * 1.3; });
  light(group, 5.5, 9.0, 6.6, mats.red, 0.1, 1.6);

  /* ---------- Hangares laterales iluminados ---------- */
  [-1, 1].forEach(function (s) {
    var hx = s * (hullW(8) + 0.05);
    add(group, roundedBox(0.3, 2.0, 8, 0.1, 2), mats.dark, hx, -0.2, 8);
    add(group, new THREE.BoxGeometry(0.1, 1.4, 7.2), mats.window, hx + s * 0.12, -0.2, 8);
    for (var k = 0; k < 5; k++) add(group, new THREE.BoxGeometry(0.14, 1.5, 0.12), mats.dark, hx + s * 0.14, -0.2, 4.8 + k * 1.6);
    add(group, roundedBox(0.2, 0.2, 8.4, 0.05, 2), mats.accent, hx + s * 0.1, 0.95, 8);
  });

  /* ---------- Cazas ---------- */
  function miniFighter() {
    var f = new THREE.Group();
    add(f, loft([
      { z: -1.5, w: 0.02, t: 0.02, b: 0.02 }, { z: -1.1, w: 0.14, t: 0.12, b: 0.08 }, { z: -0.2, w: 0.27, t: 0.2, b: 0.14 },
      { z: 0.8, w: 0.3, t: 0.2, b: 0.15 }, { z: 1.3, w: 0.22, t: 0.15, b: 0.12 }
    ].map(function (s) { s.n = 2.4; return s; }), 14, true, true), mats.hull, 0, 0, 0);
    add(f, loft([
      { z: -0.95, w: 0.02, t: 0.02, b: 0.02 }, { z: -0.7, w: 0.14, t: 0.16, b: 0.04 }, { z: -0.1, w: 0.14, t: 0.12, b: 0.04 }, { z: 0.1, w: 0.04, t: 0.03, b: 0.03 }
    ].map(function (s) { s.n = 2.2; s.y = 0.12; return s; }), 12, true, true), mats.glass, 0, 0, 0);
    add(f, plan([[0.2, -0.1], [1.45, 0.62], [1.35, 1.05], [0.45, 0.95]], 0.05, 0.02), mats.plate, 0, -0.02, 0.15);
    add(f, new THREE.BoxGeometry(0.04, 0.16, 0.04), mats.dark, 0, -0.14, -0.7);               // tren de aterrizaje
    [-1, 1].forEach(function (s) { add(f, new THREE.BoxGeometry(0.04, 0.16, 0.04), mats.dark, s * 0.24, -0.14, 0.55); });
    [-1, 1].forEach(function (s) {
      var fin = add(f, new THREE.BoxGeometry(0.04, 0.42, 0.45), mats.accent, s * 0.3, 0.3, 0.95);
      fin.rotation.z = -s * 0.3;
      add(f, new THREE.BoxGeometry(0.07, 0.07, 0.5), mats.dark, s * 0.95, -0.06, 0.55);
      var nz = new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10);
      nz.rotateX(P / 2);
      add(f, nz, mats.dark, s * 0.13, 0, 1.3);
    });
    return f;
  }
  /* ---------- Drones: despegue, órbita, regreso y recarga (ciclo de 120 s) ---------- */
  var SLOTS = [[-0.8, -2], [-0.8, -5.5], [-0.8, -9], [-0.8, -12.5], [-3.6, -2], [-3.6, -5.5], [-3.6, -9], [-3.6, -12.5]];
  var CYC = 120, LX = 2.6;
  function lerp(a, b, u) { return a + (b - a) * u; }
  function sm(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  function deckY(z) { return DECK_Y + 0.22 + (z < -15 ? (-15 - z) * 0.06 : 0); }
  var drones = SLOTS.map(function (s, i) {
    var f = miniFighter();
    var glow = add(f, new THREE.SphereGeometry(0.2, 10, 8), glowMat(colors.glow, 0.9), 0, 0, 1.45);
    f.rotation.order = 'YXZ';
    group.add(f);
    var Tl = 6 + 5 * i, te = Tl + 3;
    // orden de regreso: primero la columna izquierda (se libera el camino), luego la derecha; 6 s entre aterrizajes
    var rank = i >= 4 ? i - 4 : i + 4, want = 54 + 6 * rank, span = want - te;
    var nLoop = Math.max(0, Math.round((0.2 * span - (TAU - 1.2)) / TAU));
    return { mesh: f, glow: glow, x0: s[0], z0: s[1], Tl: Tl, te: te, tr: want, om: (TAU - 1.2 + nLoop * TAU) / span, R: 52 + (i % 4) * 7, yo: 3 + ((i * 5) % 7) * 1.6, state: 0 };
  });
  var fighters = drones.map(function (d) { return d.mesh; });
  function orbit(d, c) { var th = d.om * (c - d.te); return [d.R * Math.sin(th), d.yo, -d.R * Math.cos(th)]; }
  // estado: 0 aparcado, 1 rodando por cubierta, 2 acelerando, 3 saliendo/orbitando, 4 aproximación, 5 aterrizando
  function posAt(d, c) {
    var Tl = d.Tl, z, u;
    if (c < Tl - 3) return [d.x0, deckY(d.z0), d.z0, 0];
    if (c < Tl - 1.5) { u = sm((c - Tl + 3) / 1.5); return [lerp(d.x0, LX, u), deckY(d.z0), d.z0, 1]; }
    if (c < Tl) return [LX, deckY(d.z0), d.z0, 1];
    if (c < Tl + 3) { u = (c - Tl) / 3; z = d.z0 + (-28 - d.z0) * u * u; return [LX, deckY(z), z, 2]; }
    if (c < d.tr) {
      var tau = c - d.te, o = orbit(d, c);
      if (tau >= 6) return [o[0], o[1], o[2], 3];
      var w = sm(tau / 6), lz = -28 - 18 * tau - 2 * tau * tau, ly = deckY(-28) + 0.8 * tau;
      return [lerp(LX, o[0], w), lerp(ly, o[1], w), lerp(lz, o[2], w), 3];
    }
    var r = c - d.tr;
    if (r < 7) {
      var o2 = orbit(d, c), w2 = sm(r / 7), qz = -28 - 70 * Math.pow(1 - r / 7, 2);
      return [lerp(o2[0], LX, w2), lerp(o2[1], deckY(qz), w2), lerp(o2[2], qz, w2), 4];
    }
    if (r < 10) { u = (r - 7) / 3; z = -28 + (d.z0 + 28) * (1 - Math.pow(1 - u, 2)); return [LX, deckY(z), z, 5]; }
    if (r < 11.5) { u = sm((r - 10) / 1.5); return [lerp(LX, d.x0, u), deckY(d.z0), d.z0, 1]; }
    return [d.x0, deckY(d.z0), d.z0, 0];
  }
  function placeDrones(c) {
    var parked = 0;
    drones.forEach(function (d) {
      var p = posAt(d, c), p1 = posAt(d, c + 0.05), p0 = posAt(d, c - 0.05), m = d.mesh;
      d.state = p[3];
      m.position.set(p[0], p[1], p[2]);
      var yaw = 0, pitch = 0;
      if (p[3] >= 3) {
        var vx = p1[0] - p0[0], vy = p1[1] - p0[1], vz = p1[2] - p0[2];
        yaw = Math.atan2(-vx, -vz);
        pitch = Math.atan2(vy, Math.sqrt(vx * vx + vz * vz));
      } else if (c >= d.tr + 10 && c < d.tr + 11.5) {
        yaw = P * (1 - sm((c - d.tr - 10) / 1.5));
      }
      m.rotation.y = yaw; m.rotation.x = pitch;
      d.glow.visible = p[3] >= 2 && p[3] <= 4;
      if (p[3] === 0) parked++;
    });
    return parked;
  }

  /* ---------- Defensa y motores ---------- */
  var turrets = [];
  [-1, 1].forEach(function (s) {
    [-10, -3, 12.5, 18, 24].forEach(function (z) {
      var tu = turret(group, s * 5.7, topY(s * 5.7, z) - 0.1, z, 0.6, 2, 0.9);
      tu.head.rotation.y = -s * P / 2;
      turrets.push(tu);
    });
  });
  [-4.25, -2.55, -0.85, 0.85, 2.55, 4.25].forEach(function (x) {
    nacelle(group, x, 0, 30.2, 0.8, 2.4);
    engine(group, x, 0, 30.2, 0.74, 5);
  });
  add(group, roundedBox(10.2, 0.25, 0.5, 0.1, 2), mats.accent, 0, 1.25, 29.4);

  var api = {
    group: group,
    turrets: turrets,
    fighters: fighters,
    drones: drones,
    auto: true,
    parked: 8,
    setAccent: setAccent,
    update: function (t, th) {
      engineUpdate(t, th);
      api.parked = placeDrones(api.auto ? t % CYC : 0);
    }
  };
  api.parked = placeDrones(0);
  return api;
}
