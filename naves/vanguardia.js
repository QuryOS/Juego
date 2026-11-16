/**
 * Vanguardia: crucero pesado terminado, el mismo que se construye en el dique de Forja.
 * Para Three.js, sin archivos externos.
 *
 * Mismas medidas y mismo sistema de coordenadas que yard.ship de createForja: proa en
 * z = -22,6 y popa en z = +25,3, centrado en el origen. Así puede reemplazarlo sin recolocar nada.
 *
 * Casco ovalado suave con franjas de acento, torre de mando con radar y antenas, 4 torretas
 * pesadas triples y 2 dobles en cubierta, ~60 cañones de costado, 6 tubos lanzatorpedos en la
 * proa, 2 hangares, domo de escudo, aletas de cola, estabilizadores con góndolas y 7 motores.
 *
 * Uso:
 *   const ship = createVanguardia(THREE, { accent: 0xffc21a });
 *   scene.add(ship.group);
 *   ship.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Para sustituir la nave del astillero:
 *   yard.ship.visible = false;
 *   yard.group.add(ship.group);
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 10 m. Eslora 48 u (480 m), manga 12,6 u (126 m con estabilizadores), alto ~7 u.
 *
 * Expone:
 *   ship.muzzles           [Object3D x12]  bocas de las 4 torretas triples
 *   ship.secondaryMuzzles  [Object3D x4]   bocas de las 2 torretas dobles
 *   ship.torpedoTubes      [Object3D x6]   bocas de los tubos de proa (disparan hacia -Z)
 *   ship.turrets / ship.secondary  [{ head, gun }]  cabezas (head.rotation.y) y cañones (gun.rotation.x)
 *   ship.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createVanguardia(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xa4afbf,
    accent: opts.accent != null ? opts.accent : 0xffc21a,
    dark: opts.dark != null ? opts.dark : 0x141a26,
    glow: opts.glow != null ? opts.glow : 0x6fc4ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.5, roughness: 0.4 }),
    light: new THREE.MeshStandardMaterial({ color: 0xc3ccd9, metalness: 0.45, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x6d788a, metalness: 0.6, roughness: 0.5 }),
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
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    run: new THREE.MeshBasicMaterial({ color: 0xbfe6ff })
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
  var seed = 83;
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
      bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 2
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
    mesh.frustumCulled = false;
    return mesh;
  }

  function horizontalTorus(R, tube, ts, rs) {
    var g = new THREE.TorusGeometry(R, tube, ts, rs);
    g.rotateX(P / 2);
    return g;
  }

  /* ---------- Casco oval (mismo perfil que el dique de Forja) ---------- */
  var SX = 1.3, SY = 0.85;
  var RZ = [[-22.6, 0], [-22.2, 0.3], [-21, 0.9], [-18, 1.9], [-12, 2.8], [-6, 3.1], [-2, 3.0], [14, 3.0], [24, 2.4]];
  function hullR(z) {
    if (z <= RZ[0][0]) return 0;
    for (var i = 1; i < RZ.length; i++) {
      if (z <= RZ[i][0]) {
        var a = RZ[i - 1], b = RZ[i];
        return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]);
      }
    }
    return RZ[RZ.length - 1][1];
  }
  // Superficie del casco: x del costado a una altura y, e y del lomo a un desplazamiento x
  function surfX(z, y) {   // x del costado a una altura y
    var r = hullR(z);
    var q = 1 - Math.pow(y / (SY * r), 2);
    return SX * r * Math.sqrt(Math.max(0, q));
  }
  function topY(z, x) {
    var r = hullR(z);
    var q = 1 - Math.pow(x / (SX * r), 2);
    return SY * r * Math.sqrt(Math.max(0, q));
  }
  function slopeX(z, y) { return (surfX(z + 0.1, y) - surfX(z - 0.1, y)) / 0.2; }
  function sideRy(s, z, y) { var sl = slopeX(z, y); return s > 0 ? Math.atan2(1, -sl) : Math.atan2(-1, -sl); }

  var prof = [[0.001, -24.4], [1.4, -24.3], [2.4, -24], [2.9, -20], [3.0, -14], [3.0, -6], [3.0, 2],
    [3.1, 6], [2.8, 12], [1.9, 18], [0.9, 21], [0.3, 22.2], [0.001, 22.6]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var hullPts = new THREE.SplineCurve(prof).getPoints(120).map(function (p) {
    return new THREE.Vector2(Math.max(0.001, p.x), p.y);
  });
  var hullGeo = new THREE.LatheGeometry(hullPts, 72);
  hullGeo.rotateX(-P / 2);               // y+ pasa a -Z: proa hacia -Z
  add(group, hullGeo, mats.hull).scale.set(SX, SY, 1);

  // Costuras de planchas, franja de acento, lomo y quilla
  for (var sz = -19; sz <= 21; sz += 2.6) {
    var seam = add(group, new THREE.TorusGeometry(hullR(sz) + 0.015, 0.035, 6, 56), mats.dark, 0, 0, sz);
    seam.scale.set(SX, SY, 1);
  }
  var stripe = [], ridge = [], keelR = [];
  for (var tz = -19; tz <= 22; tz += 1.0) {
    var tr = hullR(tz), tw = Math.cos(0.22);
    [1, -1].forEach(function (s) {
      stripe.push({ x: s * (tr * SX * tw + 0.02), y: tr * SY * Math.sin(0.22), z: tz });
      stripe.push({ x: s * (tr * SX * Math.cos(-0.22) + 0.02), y: -tr * SY * Math.sin(0.22), z: tz });
    });
    ridge.push({ x: 0, y: tr * SY + 0.02, z: tz });
    keelR.push({ x: 0, y: -tr * SY - 0.02, z: tz });
  }
  group.add(boxField(new THREE.BoxGeometry(0.1, 0.12, 1.05), mats.accent, stripe));
  group.add(boxField(roundedBox(0.34, 0.14, 1.05, 0.05, 3), mats.accent, ridge));
  group.add(boxField(roundedBox(0.5, 0.16, 1.05, 0.06, 3), mats.dark, keelR));

  /* ---------- Torre de mando ---------- */
  var TZ = -15.2;
  var tbase = topY(TZ, 0) + 0.3;
  add(group, roundedBox(3.2, 0.9, 4.4, 0.35, 10), mats.light, 0, tbase, TZ);
  add(group, roundedBox(2.2, 0.8, 3.0, 0.3, 10), mats.light, 0, tbase + 0.8, TZ + 0.2);
  add(group, roundedBox(2.8, 0.7, 2.2, 0.28, 10), mats.hull, 0, tbase + 1.5, TZ - 0.4);
  add(group, new THREE.BoxGeometry(2.6, 0.2, 0.04), mats.glass, 0, tbase + 1.52, TZ - 1.52);
  [1, -1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.04, 0.18, 1.6), mats.glass, 1.42 * s, tbase + 1.52, TZ - 0.4);
    add(group, new THREE.BoxGeometry(0.05, 0.1, 4.0), mats.accent, 1.62 * s, tbase + 0.05, TZ);
  });
  add(group, new THREE.SphereGeometry(0.5, 24, 14), mats.glass, 0, tbase + 2.0, TZ + 0.5).scale.set(1, 0.6, 1);
  add(group, new THREE.CylinderGeometry(0.04, 0.06, 2.4, 10), mats.dark, 0.4, tbase + 3.0, TZ + 0.9);
  [[1.1, 4.0], [0.8, 4.5]].forEach(function (c) {
    add(group, new THREE.BoxGeometry(c[0], 0.03, 0.05), mats.dark, 0.4, tbase + c[1] - 0.1, TZ + 0.9);
  });
  var mastLight = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.08, 10, 8), mastLight, 0.4, tbase + 4.25, TZ + 0.9);
  var radar = new THREE.Group();
  radar.position.set(-0.5, tbase + 2.45, TZ + 0.6);
  add(radar, roundedBox(1.8, 0.06, 0.2, 0.03, 4), mats.plate, 0, 0, 0);
  add(radar, new THREE.CylinderGeometry(0.06, 0.08, 0.3, 10), mats.dark, 0, -0.15, 0);
  group.add(radar);
  var tWin = [];
  for (var wz = TZ - 1.7; wz <= TZ + 1.7; wz += 0.45) {
    [1, -1].forEach(function (s) {
      [tbase - 0.05, tbase + 0.3].forEach(function (y) { if (rnd() < 0.85) tWin.push({ x: 1.61 * s, y: y, z: wz, ry: P / 2 }); });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.05, 0.1, 0.22), mats.window, tWin));

  /* ---------- Torretas ---------- */
  var hemi = new THREE.SphereGeometry(1, 32, 14, 0, TAU, 0, P / 2);
  var headGeo = roundedBox(0.5, 0.22, 0.6, 0.08, 8);
  var turrets = [], secondary = [], muzzles = [], secondaryMuzzles = [];

  function turretAt(x, z, sc, nB, len, spacing, yaw, mArr, tArr, lift) {
    var base = new THREE.Group();
    base.position.set(x, topY(z, x) - 0.03 + (lift || 0), z);
    base.scale.setScalar(sc);
    base.rotation.y = yaw || 0;
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
    for (var i = 0; i < nB; i++) {
      var bx = (i - (nB - 1) / 2) * spacing;
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
  turretAt(0, -10.5, 2.2, 3, 1.5, 0.2, 0, muzzles, turrets, 0);
  turretAt(0, -3.5, 2.2, 3, 1.5, 0.2, 0, muzzles, turrets, 0);
  turretAt(0, 4.5, 2.2, 3, 1.5, 0.2, P, muzzles, turrets, 0);
  turretAt(0, 13.5, 2.2, 3, 1.5, 0.2, P, muzzles, turrets, 0);
  [1, -1].forEach(function (s) {
    turretAt(s * 1.7, -7.0, 1.3, 2, 1.3, 0.28, 0, secondaryMuzzles, secondary, 0);
  });

  /* ---------- Baterías de costado (instanciadas) ---------- */
  var domeR = new THREE.SphereGeometry(0.26, 14, 8, 0, TAU, 0, P / 2); domeR.rotateZ(-P / 2);
  var domeL = new THREE.SphereGeometry(0.26, 14, 8, 0, TAU, 0, P / 2); domeL.rotateZ(P / 2);
  var barR = new THREE.CylinderGeometry(0.04, 0.05, 0.85, 8); barR.rotateZ(-P / 2);
  var barL = new THREE.CylinderGeometry(0.04, 0.05, 0.85, 8); barL.rotateZ(P / 2);
  var bat = { R: { dome: [], bar: [] }, L: { dome: [], bar: [] } };
  for (var bz = -15; bz <= 21; bz += 2.0) {
    if (bz > 8.2 && bz < 12.4) continue;       // hueco del hangar
    [0.55, -0.55].forEach(function (by) {
      var hw = surfX(bz, by);
      bat.R.dome.push({ x: hw, y: by, z: bz });
      bat.R.bar.push({ x: hw + 0.5, y: by, z: bz - 0.08 }, { x: hw + 0.5, y: by, z: bz + 0.08 });
      bat.L.dome.push({ x: -hw, y: by, z: bz });
      bat.L.bar.push({ x: -hw - 0.5, y: by, z: bz - 0.08 }, { x: -hw - 0.5, y: by, z: bz + 0.08 });
    });
  }
  group.add(boxField(domeR, mats.light, bat.R.dome));
  group.add(boxField(domeL, mats.light, bat.L.dome));
  group.add(boxField(barR, mats.dark, bat.R.bar));
  group.add(boxField(barL, mats.dark, bat.L.bar));

  /* ---------- Hangares, ventanas y luces de posición ---------- */
  [1, -1].forEach(function (s) {
    var hx = (surfX(10.3, -0.2) + 0.02) * s;
    add(group, roundedBox(0.3, 1.3, 3.8, 0.08, 6), mats.dark, hx, -0.2, 10.3);
    add(group, new THREE.BoxGeometry(0.06, 0.95, 3.4), mats.lamp, hx + 0.12 * s, -0.2, 10.3);
    for (var k = 0; k < 4; k++) add(group, new THREE.BoxGeometry(0.08, 1.0, 0.08), mats.dark, hx + 0.16 * s, -0.2, 8.8 + k * 1.0);
  });

  var wins = [], runs = [];
  for (var z = -17; z <= 22; z += 0.55) {
    [1, -1].forEach(function (s) {
      var rr = hullR(z);
      if (rr < 0.5) return;
      if (!(z > 8.2 && z < 12.4)) {
        [0.2, 0, -0.2].forEach(function (y) {
          if (rnd() > 0.86) return;
          wins.push({ x: (surfX(z, y) + 0.02) * s, y: y, z: z, ry: sideRy(s, z, y) });
        });
      }
    });
  }
  for (var rz = -17.5; rz <= 22; rz += 3.0) {
    [1, -1].forEach(function (s) {
      var y = -0.95;
      runs.push({ x: (surfX(rz, y) + 0.03) * s, y: y, z: rz, ry: sideRy(s, rz, y) });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.2, 0.08, 0.04), mats.window, wins));
  group.add(boxField(new THREE.BoxGeometry(0.28, 0.06, 0.05), mats.run, runs));

  /* ---------- Proa: tubos lanzatorpedos y sensores ---------- */
  var torpedoTubes = [];
  var tubeGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.9, 16);
  tubeGeo.rotateX(P / 2);
  for (var tb = 0; tb < 6; tb++) {
    var ta = tb * TAU / 6 + P / 6;
    var tzz = -19.5, rr2 = hullR(tzz);
    var tx = Math.cos(ta) * rr2 * SX * 0.82, ty = Math.sin(ta) * rr2 * SY * 0.82;
    add(group, tubeGeo, mats.dark, tx, ty, tzz - 0.35);
    add(group, new THREE.TorusGeometry(0.22, 0.04, 8, 20), mats.accent, tx, ty, tzz - 0.8);
    var m = new THREE.Object3D();
    m.position.set(tx, ty, tzz - 0.85);
    group.add(m);
    torpedoTubes.push(m);
  }
  add(group, new THREE.CylinderGeometry(0.015, 0.03, 1.2, 8), mats.dark, 0, 0, -23.2).rotation.x = P / 2;

  /* ---------- Escudo, radiadores y antenas de popa ---------- */
  var shieldY = topY(8.0, 0);
  add(group, new THREE.SphereGeometry(1.0, 28, 14, 0, TAU, 0, P / 2), mats.shield, 0, shieldY - 0.05, 8.0);
  add(group, horizontalTorus(1.02, 0.1, 10, 40), mats.accent, 0, shieldY - 0.05, 8.0);
  [1, -1].forEach(function (s) {
    add(group, roundedBox(0.1, 1.7, 3.4, 0.04, 4), mats.light, 1.1 * s, topY(18, 1.1 * s) + 0.7, 18);
    add(group, new THREE.BoxGeometry(0.12, 0.06, 3.42), mats.accent, 1.1 * s, topY(18, 1.1 * s) + 1.55, 18);
  });
  for (var an = 0; an < 8; an++) {
    var ax = (rnd() * 2 - 1) * 1.4, az = 15 + rnd() * 6, ah = 0.5 + rnd() * 1.1;
    add(group, new THREE.CylinderGeometry(0.012, 0.025, ah, 6), mats.dark, ax, topY(az, ax) + ah / 2 - 0.05, az);
  }

  /* ---------- Aletas de cola y estabilizadores ---------- */
  var finShape = new THREE.Shape();
  finShape.moveTo(16, 0); finShape.lineTo(19.2, 2.8); finShape.lineTo(23.2, 2.8); finShape.lineTo(24.2, 0); finShape.lineTo(16, 0);
  var finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  finGeo.rotateY(-P / 2);
  finGeo.translate(0.09, 0, 0);
  var finTop = topY(22, 0) - 0.35;
  add(group, finGeo, mats.hull, 0, finTop, 0);
  add(group, new THREE.BoxGeometry(0.2, 0.12, 4.2), mats.accent, 0, finTop + 2.82, 21.2);
  var finBot = add(group, finGeo, mats.hull, 0, -finTop, 0);
  finBot.scale.y = -1;

  add(group, plan([[0, 15.5], [6.3, 21.0], [6.5, 24.0], [0, 24.2]], 0.14, 0.03), mats.hull, 0, -0.15, 0);
  add(group, plan([[0, 17.5], [5.6, 21.4], [5.7, 23.2], [0, 23.4]], 0.02, 0), mats.accent, 0, -0.07, 0);

  /* ---------- Motores ---------- */
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 40);
  bellGeo.rotateX(P / 2);
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 2.0, 40);
  flameLight.position.set(0, 0, 30);
  group.add(flameLight);

  function buildEngine(x, y, z, s, flameLen) {
    add(group, bellGeo, mats.dark, x, y, z).scale.set(s, s, s);
    add(group, new THREE.TorusGeometry(0.5 * s, 0.05 * s, 8, 28), mats.accent, x, y, z - 0.05);
    add(group, new THREE.CircleGeometry(0.2 * s, 24), glowMat(0xffffff, 0.95), x, y, z + 0.05);
    var baseZ = z + 0.75 * s;
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
  add(group, roundedBox(7.4, 2.6, 1.8, 0.55, 14), mats.light, 0, 0, 24.4);
  add(group, new THREE.BoxGeometry(6.6, 0.1, 1.2), mats.accent, 0, 1.28, 24.4);
  [[0, 0, 1.2], [-2.4, 0, 1.2], [2.4, 0, 1.2], [-1.2, 0, 0.7], [1.2, 0, 0.7]].forEach(function (e) {
    buildEngine(e[0], e[1], 25.3, e[2], e[2] * 5);
  });
  // Góndolas en los estabilizadores
  [1, -1].forEach(function (s) {
    var nac = add(group, capsule(0.5, 3.0, 24), mats.hull, 6.0 * s, -0.15, 22.4);
    add(group, new THREE.TorusGeometry(0.52, 0.04, 8, 28), mats.accent, 6.0 * s, -0.15, 22.0);
    buildEngine(6.0 * s, -0.15, 24.2, 0.55, 2.6);
  });

  /* ---------- Luces de navegación ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.12, 12, 10), m, 6.45 * s, -0.1, 23.6);
    navLights.push({ mat: m, on: c, fast: false });
  });
  navLights.push({ mat: mastLight, on: 0xffffff, fast: true });

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
    muzzles: muzzles, secondaryMuzzles: secondaryMuzzles, torpedoTubes: torpedoTubes,
    turrets: turrets, secondary: secondary, materials: mats
  };
}
