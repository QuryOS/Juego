/**
 * Leviatán: acorazado (nave de guerra GRANDE) para Three.js, sin archivos externos.
 *
 * Casco en tres capas, ciudadela de mando de cuatro niveles con radar y mástil de antenas,
 * 3 torretas pesadas triples, 6 torretas secundarias dobles, 2 baterías de costado con
 * ~90 cañones, lanza espinal con bobinas que pulsan, 2 hangares, generadores de escudo,
 * radiadores, cientos de ventanas y planchas, y 5 motores.
 *
 * Uso:
 *   const dread = createLeviatan(THREE, { accent: 0xe0a82e });
 *   scene.add(dread.group);
 *   dread.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 10 m. Eslora 52 u (520 m), manga 11 u (110 m), alto ~12 u.
 *
 * Expone:
 *   dread.muzzles           [Object3D x9]   bocas de las 3 torretas pesadas (3 cañones cada una)
 *   dread.secondaryMuzzles  [Object3D x12]  bocas de las 6 torretas secundarias
 *   dread.spinalMuzzle      Object3D        boca de la lanza espinal (dispara hacia -Z)
 *   dread.turrets           [{ head, gun }] pesadas (head.rotation.y gira, gun.rotation.x eleva)
 *   dread.secondary         [{ head, gun }] secundarias
 *   dread.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createLeviatan(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0x8e99aa,
    accent: opts.accent != null ? opts.accent : 0xe0a82e,
    dark: opts.dark != null ? opts.dark : 0x141a26,
    glow: opts.glow != null ? opts.glow : 0x6fc4ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.5, roughness: 0.45 }),
    light: new THREE.MeshStandardMaterial({ color: 0xb6bfcc, metalness: 0.45, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x6b7686, metalness: 0.6, roughness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.35, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.8
    }),
    shield: new THREE.MeshStandardMaterial({
      color: 0x0b2a3d, metalness: 0.5, roughness: 0.1,
      emissive: 0x2fb9ff, emissiveIntensity: 0.7
    }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc46b })
  };

  function glowMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }
  function add(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  var seed = 47;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /* ---------- Geometrías ---------- */
  function plan(pts, depth, bevel) {
    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (var j = pts.length - 1; j >= 1; j--) s.lineTo(-pts[j][0], pts[j][1]);
    s.closePath();
    var g = new THREE.ExtrudeGeometry(s, {
      depth: depth, bevelEnabled: !!bevel,
      bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 3
    });
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
    for (i = 0; i <= n; i++) {
      a = -P / 2 + (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a)));
    }
    for (i = 0; i <= n; i++) {
      a = (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a)));
    }
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(P / 2);
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
    mesh.frustumCulled = false;   // las instancias están lejos del origen del mesh
    return mesh;
  }

  function horizontalTorus(R, tube, ts, rs) {
    var g = new THREE.TorusGeometry(R, tube, ts, rs);
    g.rotateX(P / 2);
    return g;
  }

  /* ---------- Casco: tres capas ---------- */
  var HULL = [[0, -24], [1.2, -22.5], [3.5, -17], [5, -8], [5.6, 4], [5.6, 16], [4.6, 22], [3.9, 24.5]];
  var DECK = [[0, -20], [2.4, -14], [3.4, -6], [3.9, 6], [3.9, 16], [3.0, 22.5]];
  function lerpW(tbl, z) {
    if (z <= tbl[0][1]) return tbl[0][0];
    for (var i = 1; i < tbl.length; i++) {
      if (z <= tbl[i][1]) {
        var a = tbl[i - 1], b = tbl[i];
        return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
      }
    }
    return tbl[tbl.length - 1][0];
  }
  function halfW(z) { return lerpW(HULL, z); }
  function deckW(z) { return lerpW(DECK, z); }
  function slope(z) { return (halfW(z + 0.1) - halfW(z - 0.1)) / 0.2; }
  function sideRy(s, z) { return s > 0 ? Math.atan2(1, -slope(z)) : Math.atan2(-1, -slope(z)); }

  add(group, plan(HULL, 2.6, 0.12), mats.hull, 0, 0, 0);
  add(group, plan(DECK, 1.2, 0.08), mats.light, 0, 1.9, 0);
  add(group, plan([[0, -20], [1.8, -12], [2.4, 0], [2.4, 18], [1.6, 23]], 0.6, 0.05), mats.dark, 0, -1.45, 0);
  // Proa blindada con cuña de acento
  add(group, plan([[0, -23.6], [0.9, -22.2], [2.8, -17.2], [0.0, -19.4]], 0.06, 0), mats.accent, 0, 1.36, 0);
  add(group, plan([[0, -19.5], [0.15, -19], [0.15, 20], [0, 21]], 0.05, 0), mats.accent, 0, 2.52, 0);

  /* ---------- Lanza espinal ---------- */
  var lance = add(group, new THREE.CylinderGeometry(0.55, 0.62, 14, 28), mats.dark, 0, 0, -20);
  lance.rotation.x = P / 2;
  var coils = [];
  for (var ci = 0; ci < 5; ci++) {
    var cm = new THREE.MeshBasicMaterial({ color: 0x66ccff });
    add(group, new THREE.TorusGeometry(0.82, 0.12, 12, 40), cm, 0, 0, -26.4 + ci * 1.15);
    coils.push(cm);
  }
  add(group, new THREE.TorusGeometry(0.66, 0.1, 12, 36), mats.accent, 0, 0, -27.05);
  var spinalMuzzle = new THREE.Object3D();
  spinalMuzzle.position.set(0, 0, -27.3);
  group.add(spinalMuzzle);

  /* ---------- Ciudadela de mando ---------- */
  add(group, roundedBox(4.0, 1.6, 7.0, 0.5, 10), mats.light, 0, 3.3, 7.5);
  add(group, roundedBox(3.0, 1.4, 5.0, 0.45, 10), mats.light, 0, 4.8, 7.9);
  add(group, roundedBox(3.4, 0.9, 2.8, 0.35, 10), mats.hull, 0, 5.95, 6.5);
  add(group, new THREE.BoxGeometry(3.2, 0.26, 0.04), mats.glass, 0, 6.0, 5.1);
  [1, -1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.04, 0.22, 2.2), mats.glass, 1.72 * s, 6.0, 6.5);
    add(group, new THREE.BoxGeometry(0.05, 0.12, 6.4), mats.accent, 2.02 * s, 3.8, 7.5);
    add(group, new THREE.BoxGeometry(0.05, 0.1, 4.4), mats.accent, 1.52 * s, 5.35, 7.9);
  });
  add(group, new THREE.SphereGeometry(0.75, 28, 16), mats.glass, 0, 6.45, 8.0).scale.set(1, 0.6, 1);
  add(group, new THREE.CylinderGeometry(0.05, 0.08, 3.2, 12), mats.dark, 0.0, 8.2, 8.6);
  [[1.4, 8.8], [1.0, 9.4], [0.7, 9.9]].forEach(function (c) {
    add(group, new THREE.BoxGeometry(c[0], 0.04, 0.06), mats.dark, 0, c[1], 8.6);
  });
  add(group, new THREE.SphereGeometry(0.08, 12, 10), mats.accent, 0, 9.85, 8.6);
  var radar = new THREE.Group();
  radar.position.set(0, 7.0, 7.4);
  add(radar, roundedBox(2.6, 0.08, 0.26, 0.04, 4), mats.plate, 0, 0, 0);
  add(radar, new THREE.CylinderGeometry(0.08, 0.1, 0.14, 12), mats.dark, 0, -0.08, 0);
  group.add(radar);
  var dishes = [];
  [[1.1, 6.3, 9.6, 0.5], [-1.1, 6.3, 9.6, 0.4]].forEach(function (d) {
    var pv = new THREE.Group();
    pv.position.set(d[0], d[1], d[2]);
    var dm = add(pv, new THREE.SphereGeometry(d[3], 24, 12, 0, TAU, 0, P / 2), mats.hull, 0, 0.05, 0);
    dm.rotation.x = P;
    dm.material = mats.hull.clone();
    dm.material.side = THREE.DoubleSide;
    add(pv, new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), mats.dark, 0, -0.15, 0);
    group.add(pv);
    dishes.push(pv);
  });
  // Bosque de antenas en popa
  for (var an = 0; an < 16; an++) {
    var ax = (rnd() * 2 - 1) * 2.2, az = 12.2 + rnd() * 3.0, ah = 0.8 + rnd() * 1.4;
    add(group, new THREE.CylinderGeometry(0.015, 0.03, ah, 6), mats.dark, ax, 2.5 + ah / 2, az);
  }

  /* ---------- Torretas ---------- */
  var hemi = new THREE.SphereGeometry(1, 32, 14, 0, TAU, 0, P / 2);
  var headGeo = roundedBox(0.5, 0.22, 0.6, 0.08, 8);
  var turrets = [], secondary = [], muzzles = [], secondaryMuzzles = [];

  function turret(x, y, z, sc, nBarrels, len, spacing, yawBase, mArr, tArr) {
    var base = new THREE.Group();
    base.position.set(x, y, z);
    base.scale.setScalar(sc);
    base.rotation.y = yawBase || 0;
    add(base, hemi, mats.hull, 0, 0, 0).scale.set(0.5, 0.28, 0.55);
    add(base, horizontalTorus(0.5, 0.035, 8, 36), mats.accent, 0, 0.02, 0);
    var head = new THREE.Group();
    head.position.y = 0.2;
    base.add(head);
    add(head, headGeo, mats.light, 0, 0.02, 0);
    add(head, roundedBox(0.3, 0.03, 0.34, 0.012, 4), mats.accent, 0, 0.145, 0.02);
    var gun = new THREE.Group();
    gun.position.set(0, 0.04, -0.28);
    head.add(gun);
    for (var i = 0; i < nBarrels; i++) {
      var bx = (i - (nBarrels - 1) / 2) * spacing;
      add(gun, new THREE.CylinderGeometry(0.075, 0.08, 0.5, 14), mats.plate, bx, 0, -0.1).rotation.x = P / 2;
      add(gun, new THREE.CylinderGeometry(0.042, 0.05, len, 12), mats.dark, bx, 0, -0.3 - len / 2).rotation.x = P / 2;
      add(gun, new THREE.TorusGeometry(0.06, 0.02, 8, 16), mats.plate, bx, 0, -0.3 - len);
      var m = new THREE.Object3D();
      m.position.set(bx, 0, -0.32 - len);
      gun.add(m);
      mArr.push(m);
    }
    group.add(base);
    tArr.push({ head: head, gun: gun, phase: (turrets.length + secondary.length) * 1.7 });
  }

  // Pesadas: dos a proa (una sobre pedestal, para fuego por encima) y una a popa
  turret(0, 2.5, -15, 3.0, 3, 1.5, 0.2, 0, muzzles, turrets);
  add(group, roundedBox(3.4, 0.5, 3.6, 0.2, 8), mats.light, 0, 2.75, -8.5);
  add(group, new THREE.TorusGeometry(1.5, 0.05, 8, 40), mats.accent, 0, 3.0, -8.5).rotation.x = P / 2;
  turret(0, 3.0, -8.5, 3.0, 3, 1.5, 0.2, 0, muzzles, turrets);
  turret(0, 2.5, 17.5, 3.0, 3, 1.5, 0.2, P, muzzles, turrets);

  // Secundarias dobles
  [[2.0, -11], [2.7, 0], [2.9, 13]].forEach(function (p) {
    turret(p[0], 2.5, p[1], 1.6, 2, 1.3, 0.28, 0, secondaryMuzzles, secondary);
    turret(-p[0], 2.5, p[1], 1.6, 2, 1.3, 0.28, 0, secondaryMuzzles, secondary);
  });

  /* ---------- Baterías de costado (instanciadas) ---------- */
  var domeR = new THREE.SphereGeometry(0.28, 14, 8, 0, TAU, 0, P / 2); domeR.rotateZ(-P / 2);
  var domeL = new THREE.SphereGeometry(0.28, 14, 8, 0, TAU, 0, P / 2); domeL.rotateZ(P / 2);
  var barR = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8); barR.rotateZ(-P / 2);
  var barL = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8); barL.rotateZ(P / 2);
  var bat = { R: { dome: [], bar: [] }, L: { dome: [], bar: [] } };
  for (var bz = -16; bz <= 21; bz += 1.7) {
    if (bz > 11.5 && bz < 16.2) continue;      // hueco de los hangares
    [0.85, -0.85].forEach(function (by) {
      var hw = halfW(bz);
      bat.R.dome.push({ x: hw, y: by, z: bz });
      bat.R.bar.push({ x: hw + 0.55, y: by, z: bz - 0.09 }, { x: hw + 0.55, y: by, z: bz + 0.09 });
      bat.L.dome.push({ x: -hw, y: by, z: bz });
      bat.L.bar.push({ x: -hw - 0.55, y: by, z: bz - 0.09 }, { x: -hw - 0.55, y: by, z: bz + 0.09 });
    });
  }
  group.add(boxField(domeR, mats.light, bat.R.dome));
  group.add(boxField(domeL, mats.light, bat.L.dome));
  group.add(boxField(barR, mats.dark, bat.R.bar));
  group.add(boxField(barL, mats.dark, bat.L.bar));

  /* ---------- Hangares ---------- */
  [1, -1].forEach(function (s) {
    var hx = (halfW(13.9) + 0.02) * s;
    add(group, roundedBox(0.3, 1.5, 4.2, 0.08, 6), mats.dark, hx, -0.2, 13.9);
    add(group, new THREE.BoxGeometry(0.06, 1.1, 3.8), mats.lamp, hx + 0.12 * s, -0.2, 13.9);
    for (var k = 0; k < 4; k++) {
      add(group, new THREE.BoxGeometry(0.08, 1.15, 0.08), mats.dark, hx + 0.16 * s, -0.2, 12.4 + k * 1.0);
    }
  });

  /* ---------- Ventanas, franja de acento y planchas ---------- */
  var wins = [], stripe = [];
  for (var wz = -17.5; wz < 22; wz += 0.55) {
    [1, -1].forEach(function (s) {
      var hw = halfW(wz) + 0.03;
      var ry = sideRy(s, wz);
      if (!(wz > 11.5 && wz < 16.2)) {
        [0.25, 0, -0.25].forEach(function (wy) {
          if (rnd() > 0.86) return;
          wins.push({ x: hw * s, y: wy, z: wz, ry: ry });
        });
      }
    });
  }
  for (var sz = -17; sz <= 21; sz += 1.5) {
    [1, -1].forEach(function (s) {
      stripe.push({ x: (halfW(sz) + 0.03) * s, y: 1.1, z: sz, ry: sideRy(s, sz) });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.2, 0.08, 0.04), mats.window, wins));
  group.add(boxField(new THREE.BoxGeometry(1.52, 0.1, 0.06), mats.accent, stripe));

  // Ventanas de la ciudadela
  var tw = [];
  for (var tz = 4.4; tz <= 10.6; tz += 0.5) {
    [1, -1].forEach(function (s) {
      [3.05, 3.4].forEach(function (ty) { if (rnd() < 0.85) tw.push({ x: 2.03 * s, y: ty, z: tz, ry: s * P / 2 }); });
      if (tz > 5.6 && tz < 10.2) [4.7, 5.05].forEach(function (ty) { if (rnd() < 0.85) tw.push({ x: 1.53 * s, y: ty, z: tz + 0.4, ry: s * P / 2 }); });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.05, 0.1, 0.22), mats.window, tw));

  // Planchas de cubierta
  var plates = [], noGo = [[0, -15, 2.2], [0, -8.5, 2.2], [0, 17.5, 2.2]];
  for (var pl = 0; pl < 280; pl++) {
    var pz = -19 + rnd() * 41.5, pw = deckW(pz) - 0.35;
    var px = (rnd() * 2 - 1) * pw;
    if (Math.abs(px) < 2.1 && pz > 3.8 && pz < 11.2) continue;          // ciudadela
    if (Math.abs(px) < 0.25) continue;                                    // franja central
    var bad = false;
    for (var ng = 0; ng < noGo.length; ng++) {
      if (Math.abs(px - noGo[ng][0]) < noGo[ng][2] && Math.abs(pz - noGo[ng][1]) < noGo[ng][2]) bad = true;
    }
    if (bad) continue;
    plates.push({ x: px, y: 2.53, z: pz, sx: 0.3 + rnd() * 0.8, sy: 0.05 + rnd() * 0.12, sz: 0.3 + rnd() * 0.9 });
  }
  group.add(boxField(roundedBox(1, 1, 1, 0.14, 4), mats.plate, plates));

  /* ---------- Generadores de escudo y radiadores ---------- */
  [1, -1].forEach(function (s) {
    add(group, horizontalTorus(1.0, 0.1, 10, 36), mats.accent, 2.2 * s, 2.52, 20.5);
    add(group, new THREE.SphereGeometry(0.9, 28, 14, 0, TAU, 0, P / 2), mats.shield, 2.2 * s, 2.52, 20.5);
    add(group, roundedBox(0.1, 1.8, 4.0, 0.04, 4), mats.light, 1.6 * s, 3.4, 22.3);
    add(group, new THREE.BoxGeometry(0.12, 0.06, 4.02), mats.accent, 1.6 * s, 4.3, 22.3);
  });

  /* ---------- Motores ---------- */
  add(group, roundedBox(8.0, 2.4, 2.2, 0.7, 14), mats.light, 0, 0, 24.4);
  add(group, new THREE.BoxGeometry(7.4, 0.1, 1.4), mats.accent, 0, 1.15, 24.4);

  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 40);
  bellGeo.rotateX(P / 2);
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 2.0, 40);
  flameLight.position.set(0, 0, 30);
  group.add(flameLight);

  function buildEngine(x, y, s, flameLen) {
    add(group, bellGeo, mats.dark, x, y, 25.5).scale.set(s, s, s);
    add(group, new THREE.TorusGeometry(0.5 * s, 0.05 * s, 8, 28), mats.accent, x, y, 25.45);
    add(group, new THREE.CircleGeometry(0.2 * s, 24), glowMat(0xffffff, 0.95), x, y, 25.6);
    var baseZ = 25.5 + 0.75 * s;
    function cone(r, len, color, op) {
      var g = new THREE.ConeGeometry(r, len, 24, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, op), x, y, baseZ);
    }
    engines.push({
      outer: cone(0.5 * s, flameLen, colors.glow, 0.4),
      inner: cone(0.28 * s, flameLen * 0.62, 0xffffff, 0.85),
      phase: engines.length * 1.3, len: flameLen
    });
  }
  buildEngine(0, 0, 1.6, 6.0);
  buildEngine(-2.6, 0, 1.6, 6.0);
  buildEngine(2.6, 0, 1.6, 6.0);
  buildEngine(-1.3, 0, 0.9, 3.4);
  buildEngine(1.3, 0, 0.9, 3.4);

  /* ---------- Luces ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.14, 12, 10), m, (halfW(-16) + 0.1) * s, 1.2, -16);
    navLights.push({ mat: m, on: c, fast: false });
  });
  var strobe = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.1, 12, 10), strobe, 0, 9.95, 8.6);
  navLights.push({ mat: strobe, on: 0xffffff, fast: true });

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.5 : throttle));
    var w = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var len = (0.3 + th * 1.1) * e.len / 2.2;
      var f = 1 + 0.06 * Math.sin(t * 30 + e.phase) + 0.04 * Math.sin(t * 19 + e.phase * 2);
      e.outer.scale.set(w, w, len * f);
      e.inner.scale.set(w, w, len * (2 - f));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.8 + th * 2.4 + 0.15 * Math.sin(t * 25);

    var all = turrets.concat(secondary);
    for (var k = 0; k < all.length; k++) {
      var tr = all[k];
      tr.head.rotation.y = Math.sin(t * 0.3 + tr.phase) * 0.5;
      tr.gun.rotation.x = -0.12 + Math.sin(t * 0.45 + tr.phase) * 0.07;
    }
    radar.rotation.y = t * 0.9;
    dishes[0].rotation.y = t * 0.4;
    dishes[1].rotation.y = -t * 0.3;

    for (var c = 0; c < coils.length; c++) {
      var v = 0.5 + 0.5 * Math.sin(t * 4 - c * 0.9);
      coils[c].color.setRGB(0.1 + 0.3 * v, 0.5 + 0.4 * v, 0.85 + 0.15 * v);
    }
    mats.shield.emissiveIntensity = 0.55 + 0.35 * Math.sin(t * 1.6);

    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.fast ? Math.sin(t * 6) > 0.8 : Math.sin(t * 2.5) > 0.5;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return {
    group: group, update: update, setAccent: setAccent,
    muzzles: muzzles, secondaryMuzzles: secondaryMuzzles, spinalMuzzle: spinalMuzzle,
    turrets: turrets, secondary: secondary, materials: mats
  };
}
