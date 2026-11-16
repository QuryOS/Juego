/**
 * Ariete: nave de asalto y abordaje para Three.js, sin archivos externos.
 *
 * Casco blindado con espolón cónico y cuchillas, 4 cápsulas de abordaje con taladro giratorio
 * acopladas a los flancos, 4 arpones con cable, rampa ventral de desembarco con interior iluminado,
 * ventanas de tropa, 2 torretas y 3 motores.
 *
 * Uso:
 *   const assault = createAriete(THREE, { accent: 0xff7a2f });
 *   scene.add(assault.group);
 *   assault.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *   assault.setRamp(1);        // 0 cerrada, 1 abierta
 *   assault.setHooks(1);       // 0 arpones recogidos, 1 disparados (22 u de cable)
 *   assault.launchPods(f);     // 0 acopladas, 1 lanzadas hacia delante (los taladros giran al lanzar)
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 4 m. Eslora 23 u (~92 m), anchura 11 u con las cápsulas.
 *
 * Expone: group, update(t, throttle), setRamp, setHooks, launchPods, setAccent(hex),
 *   pods    [{ group, drill }] x4  (cada cápsula es un Group; puedes soltarla con group.attach())
 *   turrets [{ head, gun, muzzles }] x2
 * Compatible con Three.js r128 o superior.
 */
function createAriete(THREE, opts) {
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
  var i;
  add(group, loft([
    { z: -9.5, w: 0.8, t: 0.6, b: 0.5 }, { z: -9, w: 1.2, t: 0.8, b: 0.7 }, { z: -5, w: 2.6, t: 1.2, b: 1.0 }, { z: 0, w: 3.4, t: 1.3, b: 1.2 },
    { z: 7, w: 3.4, t: 1.3, b: 1.2 }, { z: 10, w: 2.6, t: 1.1, b: 1.0 }
  ].map(function (s) { s.n = 3; return s; }), 40, true, true), mats.hull, 0, 0, 0);
  add(group, loft([
    { z: -5.5, w: 0.4, t: 0.2, b: 0.2, y: 1.3 }, { z: -3, w: 1.8, t: 0.55, b: 0.45, y: 1.45 }, { z: 5, w: 1.9, t: 0.55, b: 0.45, y: 1.45 }, { z: 9, w: 1.2, t: 0.35, b: 0.35, y: 1.4 }
  ].map(function (s) { s.n = 3; return s; }), 26, true, true), mats.hull2, 0, 0, 0);
  add(group, loft([
    { z: -4.8, w: 0.4, t: 0.3, b: 0.8 }, { z: -3.8, w: 1.0, t: 0.7, b: 0.8 }, { z: -2, w: 1.0, t: 0.65, b: 0.8 }, { z: -1, w: 0.5, t: 0.3, b: 0.7 }
  ].map(function (s) { s.n = 2.8; s.y = 1.95; return s; }), 22, true, true), mats.hull, 0, 0, 0);
  add(group, roundedBox(1.5, 0.16, 0.7, 0.05, 2), mats.glass, 0, 2.62, -3.95).rotation.x = 0.35;
  greeble(0, 1.97, 0.5, 2.2, 0, 7, 30, mats.trim, 'y', 0.15, 0.5);
  greeble(0, 1.97, 0.5, 2.0, 0, 6, 20, mats.hull, 'y', 0.2, 0.55);

  // espolón curvo con collares, cuchillas y chevrones
  add(group, lathe([[-14.2, 0], [-13.4, 0.3], [-11.8, 0.8], [-9.8, 1.35], [-7.6, 1.75]], 32, 1.05, 0.95), mats.plate, 0, 0, 0);
  [[-11.8, 0.82], [-9.8, 1.38], [-8.4, 1.66]].forEach(function (rg) { add(group, new THREE.TorusGeometry(rg[1], 0.09, 8, 28), mats.accent, 0, 0, rg[0]); });
  for (var bl = 0; bl < 4; bl++) {
    var blade = new THREE.Group();
    blade.rotation.z = bl * P / 2 + P / 4;
    group.add(blade);
    add(blade, roundedBox(0.14, 1.0, 3.4, 0.05, 2), mats.dark, 0, 1.4, -8.6);
  }

  /* ---------- Ventanas y luces ---------- */
  var wins = [];
  [-1, 1].forEach(function (s) {
    for (var k = 0; k < 8; k++) wins.push({ x: s * 3.39, y: 0.35, z: -1.5 + k * 1.0, sx: 0.06, sy: 0.3, sz: 0.5 });
    add(group, roundedBox(0.2, 0.28, 9, 0.08, 2), mats.accent, s * 3.42, -0.45, 3);
    light(group, s * 1.1, 1.8, 8.2, s > 0 ? mats.green : mats.red, 0.1, 1.3);
  });
  group.add(boxField(UB, mats.window, wins));
  add(group, new THREE.CylinderGeometry(0.04, 0.05, 2.0, 6), mats.trim, 0.6, 3.0, -0.8);
  light(group, 0.6, 4.1, -0.8, mats.red, 0.1, 1.6);

  /* ---------- Cápsulas de abordaje ---------- */
  var pods = [];
  var PODS = [[3.55, 1.0], [3.55, -1.0], [-3.55, 1.0], [-3.55, -1.0]];
  function buildPod(x, y) {
    var pg = new THREE.Group();
    pg.position.set(x, y, 1.5);
    group.add(pg);
    add(pg, lathe([[-1.65, 0.5], [-1.4, 0.62], [1.4, 0.62], [1.9, 0.45], [2.1, 0]], 20, 1, 1), mats.hull, 0, 0, 0);
    for (var r = 0; r < 3; r++) add(pg, new THREE.TorusGeometry(0.635, 0.05, 8, 20), r === 1 ? mats.accent : mats.trim, 0, 0, -0.9 + r * 1.0);
    for (var w = 0; w < 4; w++) add(pg, new THREE.BoxGeometry(0.06, 0.16, 0.26), mats.window, x > 0 ? -0.0 : 0, 0.6, -0.5 + w * 0.5).rotation.x = 0;
    var drill = new THREE.Group();
    drill.position.set(0, 0, -1.6);
    pg.add(drill);
    var cone = new THREE.ConeGeometry(0.62, 1.7, 20); cone.rotateX(-P / 2); cone.translate(0, 0, -0.85);
    add(drill, cone, mats.plate, 0, 0, 0);
    for (var q = 0; q < 3; q++) {
      var bb = new THREE.Group();
      bb.rotation.z = q * TAU / 3;
      drill.add(bb);
      var rib = add(bb, new THREE.BoxGeometry(0.07, 0.16, 1.5), mats.dark, 0, 0.36, -0.75);
      rib.rotation.x = -0.34;
    }
    [-1.0, 1.0].forEach(function (zz) {
      add(group, roundedBox(0.9, 0.3, 0.4, 0.1, 2), mats.plate, x > 0 ? 3.1 : -3.1, y, 1.5 + zz);
    });
    pods.push({ group: pg, drill: drill, z0: 1.5 });
  }
  PODS.forEach(function (p) { buildPod(p[0], p[1]); });
  var podLaunch = 0;
  function launchPods(f) {
    podLaunch = Math.max(0, Math.min(1, f));
    pods.forEach(function (p, i) { p.group.position.z = p.z0 - podLaunch * 70 * (1 + i * 0.03); });
  }
  anim.push(function (t) {
    pods.forEach(function (p, i) { p.drill.rotation.z = t * (podLaunch > 0 ? 26 : 2) * (i % 2 ? 1 : -1); });
  });

  /* ---------- Arpones de abordaje ---------- */
  var hooks = [], HOOK_LEN = 22;
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (d) {
    var s = d[0], y = d[1] * 0.9;
    var hg = new THREE.Group();
    hg.position.set(s * 2.2, d[1] * 0.6, -4.6);
    hg.rotation.y = -s * 0.32;
    group.add(hg);
    var tube = new THREE.CylinderGeometry(0.22, 0.26, 2.2, 12); tube.rotateX(P / 2); tube.translate(0, 0, -1.0);
    add(hg, tube, mats.dark, 0, 0, 0);
    add(hg, new THREE.TorusGeometry(0.25, 0.05, 8, 14), mats.accent, 0, 0, -1.9);
    var cable = new THREE.CylinderGeometry(0.03, 0.03, 1, 6); cable.rotateX(P / 2); cable.translate(0, 0, -0.5);
    var cab = add(hg, cable, mats.plate, 0, 0, -2.0);
    var hd = new THREE.ConeGeometry(0.2, 0.8, 10); hd.rotateX(-P / 2);
    var head = add(hg, hd, mats.accent, 0, 0, -2.4);
    cab.scale.z = 0.001;
    hooks.push({ cab: cab, head: head });
  });
  function setHooks(f) {
    f = Math.max(0, Math.min(1, f));
    hooks.forEach(function (h) {
      h.cab.scale.z = Math.max(0.001, f * HOOK_LEN);
      h.head.position.z = -2.4 - f * HOOK_LEN;
    });
  }

  /* ---------- Rampa ventral ---------- */
  add(group, new THREE.BoxGeometry(2.0, 0.04, 3.2), mats.window, 0, -1.22, 3.7);
  var ramp = new THREE.Group();
  ramp.position.set(0, -1.3, 2.0);
  group.add(ramp);
  add(ramp, roundedBox(2.3, 0.14, 3.6, 0.05, 2), mats.plate, 0, 0, 1.8);
  for (var g = 0; g < 4; g++) add(ramp, new THREE.BoxGeometry(2.0, 0.02, 0.1), mats.accent, 0, -0.08, 0.6 + g * 0.8);
  var rampOpen = 0;
  function setRamp(f) { rampOpen = Math.max(0, Math.min(1, f)); ramp.rotation.x = rampOpen * 0.7; }

  /* ---------- Defensa y motores ---------- */
  var turrets = [];
  [-1, 1].forEach(function (s) { turrets.push(turret(group, s * 1.3, 1.85, 5.5, 0.8, 2, 1.4)); });
  add(group, roundedBox(5.0, 2.2, 1.6, 0.5, 3), mats.plate, 0, 0, 10.0);
  nacelle(group, 0, 0, 11.4, 0.95, 1.6);
  engine(group, 0, 0, 11.4, 0.92, 3.6);
  [-2.0, 2.0].forEach(function (x) { nacelle(group, x, 0.2, 11.2, 0.62, 1.4); engine(group, x, 0.2, 11.2, 0.6, 3.0); });

  return {
    group: group,
    pods: pods,
    turrets: turrets,
    launchPods: launchPods,
    setHooks: setHooks,
    setRamp: setRamp,
    setAccent: setAccent,
    update: function (t, th) { engineUpdate(t, th); }
  };
}
