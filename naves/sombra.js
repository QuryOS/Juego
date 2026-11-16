/**
 * Sombra: bombardero furtivo para Three.js, sin archivos externos.
 *
 * Ala volante de perfil bajo con cuerpo central fundido, cabina rasante, entradas de aire
 * hundidas, dos toberas planas con tapa térmica y dos bodegas internas con 4 misiles cada una.
 *
 * Uso:
 *   const bomber = createSombra(THREE, { accent: 0x2f7bff });
 *   scene.add(bomber.group);
 *   bomber.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *   bomber.setBays(1);                                 // 0 = bodegas cerradas, 1 = abiertas y misiles bajados
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 4 m. Eslora 15 u (60 m), envergadura 20 u (80 m).
 *
 * Expone: group, update(t, throttle), setBays(0..1), setAccent(hex),
 *   missiles [Group x8]  (cada misil es un Group; al abrir las bodegas cuelgan bajo el ala,
 *                         tómalos con group.attach() para lanzarlos desde tu lógica de juego).
 * Compatible con Three.js r128 o superior.
 */
function createSombra(THREE, opts) {
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

  /* ---------- Ala volante con cuerpo central fundido ---------- */
  var WING = [[0, -9], [0.9, -7.2], [3.5, -2.2], [9.5, 3.2], [10.2, 5.2], [8.8, 4.3], [7.6, 5.5], [6.4, 4.5], [5.2, 5.8], [3.8, 4.9], [2.6, 6.2], [1.4, 5.4]];
  add(group, plan(WING, 0.22, 0.1), mats.hull, 0, -0.05, 0);
  add(group, loft([
    { z: -9, w: 0.03, t: 0.03, b: 0.03 }, { z: -8.2, w: 0.5, t: 0.2, b: 0.12 }, { z: -6.6, w: 1.0, t: 0.42, b: 0.22 },
    { z: -4.5, w: 1.7, t: 0.66, b: 0.3 }, { z: -2, w: 2.5, t: 0.82, b: 0.32 }, { z: 0.5, w: 3.0, t: 0.86, b: 0.32 },
    { z: 3, w: 2.7, t: 0.76, b: 0.28 }, { z: 5, w: 1.9, t: 0.58, b: 0.24 }, { z: 6.3, w: 1.1, t: 0.36, b: 0.18 }
  ].map(function (s) { s.n = 2.7; s.y = 0.05; return s; }), 36, true, true), mats.hull, 0, 0, 0);
  // cabina rasante con marco
  add(group, loft([
    { z: -6.6, w: 0.02, t: 0.02, b: 0.02 }, { z: -6.0, w: 0.34, t: 0.3, b: 0.05 }, { z: -4.7, w: 0.58, t: 0.42, b: 0.05 },
    { z: -3.3, w: 0.52, t: 0.34, b: 0.05 }, { z: -2.5, w: 0.2, t: 0.12, b: 0.05 }
  ].map(function (s) { s.n = 2.2; s.y = 0.58; return s; }), 20, true, true), mats.glass, 0, 0, 0);
  add(group, new THREE.BoxGeometry(0.05, 0.05, 3.3), mats.trim, 0, 1.0, -4.5);
  // espina dorsal
  add(group, loft([
    { z: -2.6, w: 0.05, t: 0.02, b: 0.02 }, { z: -1.5, w: 0.5, t: 0.15, b: 0.1 }, { z: 3, w: 0.5, t: 0.15, b: 0.1 }, { z: 5.6, w: 0.1, t: 0.05, b: 0.05 }
  ].map(function (s) { s.n = 2.4; s.y = 0.8; return s; }), 16, true, true), mats.hull2, 0, 0, 0);
  // entradas de aire dorsales
  [-1, 1].forEach(function (s) {
    add(group, loft([
      { z: -2.8, w: 0.05, t: 0.02, b: 0.02 }, { z: -2.3, w: 0.45, t: 0.14, b: 0.1 }, { z: -0.6, w: 0.5, t: 0.12, b: 0.1 }, { z: 0.4, w: 0.2, t: 0.05, b: 0.05 }
    ].map(function (q) { q.n = 2.4; q.y = 0.82; q.x = s * 1.5; return q; }), 16, true, true), mats.dark, 0, 0, 0);
    add(group, new THREE.BoxGeometry(0.9, 0.04, 0.05), mats.accent, s * 1.5, 0.92, -2.3);
  });
  // tapa térmica y toberas
  add(group, roundedBox(2.4, 0.08, 1.4, 0.03, 2), mats.dark, 0, 0.62, 5.3);
  [-1, 1].forEach(function (s) {
    nacelle(group, s * 0.85, 0.1, 6.1, 0.42, 1.2);
    engine(group, s * 0.85, 0.1, 6.1, 0.4, 1.8);
    light(group, s * 10.1, 0, 5.1, s > 0 ? mats.green : mats.red, 0.09, 1.4);
  });
  add(group, new THREE.SphereGeometry(0.2, 12, 10), mats.dark, 0, -0.35, -6.4);         // sensor ventral

  /* ---------- Detalle de superficie ---------- */
  function edgeX(z) { return 3.5 + 6 * (z + 2.2) / 5.4; }
  var lines = [], patches = [], k, z;
  for (k = 0; k < 8; k++) {
    z = -1.4 + k * 0.62;
    var len = edgeX(z) - 3.3 - 0.35;
    [-1, 1].forEach(function (s) { lines.push({ x: s * (3.3 + len / 2), y: 0.152, z: z, sx: len, sy: 0.012, sz: 0.025 }); });
  }
  group.add(boxField(UB, mats.dark, lines));
  for (k = 0; k < 10; k++) {
    z = -0.6 + rnd() * 3.6;
    var px = 3.5 + rnd() * Math.max(0.5, edgeX(z) - 4.8);
    [-1, 1].forEach(function (s) { patches.push({ x: s * px, y: 0.158, z: z, sx: 0.6 + rnd() * 0.7, sy: 0.012, sz: 0.4 + rnd() * 0.4 }); });
  }
  group.add(boxField(UB, mats.hull2, patches));
  [-1, 1].forEach(function (s) {
    var a = add(group, new THREE.BoxGeometry(0.1, 0.03, 6.8), mats.accent, s * 5.76, 0.16, 1.3);
    a.rotation.y = s * 0.838;
    add(group, new THREE.BoxGeometry(0.06, 0.03, 3.4), mats.trim, s * 1.2, 0.9, 2.5);
  });

  /* ---------- Bodegas de armas con misiles ---------- */
  function missile(parent, x, y, z) {
    var m = new THREE.Group();
    m.position.set(x, y, z);
    parent.add(m);
    add(m, capsule(0.12, 1.4, 12), mats.plate, 0, 0, 0);
    add(m, new THREE.CylinderGeometry(0.125, 0.125, 0.16, 12).rotateX(P / 2), mats.accent, 0, 0, -0.35);
    add(m, new THREE.CylinderGeometry(0.1, 0.1, 0.4, 12).rotateX(P / 2), mats.dark, 0, 0, 0.85);
    for (var f = 0; f < 4; f++) {
      var fin = add(m, new THREE.BoxGeometry(0.02, 0.36, 0.34), mats.dark, 0, 0, 0.72);
      fin.rotation.z = f * P / 2;
    }
    return m;
  }
  var bays = [], missiles = [];
  [-1, 1].forEach(function (s) {
    add(group, roundedBox(1.7, 0.44, 4.6, 0.14, 4), mats.hull2, s * 3.7, -0.36, 1.4);
    var door = new THREE.Group();
    door.position.set(s * 4.55, -0.6, 1.4);
    group.add(door);
    add(door, roundedBox(1.55, 0.05, 4.5, 0.02, 1), mats.dark, -s * 0.78, 0, 0);
    add(door, new THREE.BoxGeometry(1.4, 0.02, 0.04), mats.accent, -s * 0.78, -0.03, 0);
    var rack = { side: s, door: door, ms: [] };
    [-1.1, 1.1].forEach(function (zz) {
      [-0.4, 0.4].forEach(function (dx) {
        var m = missile(group, s * 3.7 + dx, -0.42, 1.4 + zz);
        rack.ms.push(m); missiles.push(m);
      });
    });
    bays.push(rack);
  });
  var bayOpen = 0;
  function setBays(f) {
    bayOpen = Math.max(0, Math.min(1, f));
    bays.forEach(function (b) {
      b.door.rotation.z = b.side * bayOpen * 1.35;
      b.ms.forEach(function (m) { m.position.y = -0.42 - bayOpen * 0.62; });
    });
  }
  setBays(opts.bays || 0);

  return {
    group: group,
    missiles: missiles,
    setBays: setBays,
    setAccent: setAccent,
    update: function (t, th) { engineUpdate(t, th); }
  };
}
