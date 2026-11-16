/**
 * Halcón: fragata de combate (nave de guerra MEDIANA) para Three.js, sin archivos externos.
 *
 * Casco en cuña con quilla suave, torre de mando con radar giratorio, 3 torretas dobles en
 * cubierta, 2 baterías de misiles con celdas, 6 torretas antiaéreas, alas cortas con cañones,
 * hangar lateral iluminado y bloque de 5 motores.
 *
 * Uso:
 *   const frigate = createHalcon(THREE, { accent: 0x2f7bff });
 *   scene.add(frigate.group);
 *   frigate.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 4 m. Eslora 15 u (60 m), envergadura 7 u (28 m).
 *
 * Expone:
 *   frigate.muzzles    [Object3D x8]  6 bocas de las 3 torretas dobles principales y 2 de los cañones de ala
 *   frigate.turrets    [{ head, gun }]  3 torretas principales (head.rotation.y gira, gun.rotation.x eleva)
 *   frigate.pdTurrets  [{ head, gun }]  6 torretas antiaéreas; sus bocas están en frigate.pdMuzzles
 *   frigate.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createHalcon(THREE, opts) {
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
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.8
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
  var seed = 31;
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
    mesh.frustumCulled = false;   // las instancias están lejos del origen del mesh
    return mesh;
  }

  /* ---------- Casco ---------- */
  var HULL = [[0, -8], [0.5, -7.5], [1.3, -5.6], [1.85, -2.2], [2.15, 1], [2.2, 4.8], [1.9, 7]];
  function halfW(z) {
    for (var i = 1; i < HULL.length; i++) {
      if (z <= HULL[i][1]) {
        var a = HULL[i - 1], b = HULL[i];
        return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
      }
    }
    return HULL[HULL.length - 1][0];
  }
  function slope(z) { return (halfW(z + 0.1) - halfW(z - 0.1)) / 0.2; }

  add(group, plan(HULL, 1.1, 0.06), mats.hull, 0, 0, 0);
  add(group, plan([[0, -6.2], [0.9, -5.4], [1.5, -2], [1.7, 4.5], [1.4, 6.6]], 0.5, 0.04), mats.plate, 0, 0.8, 0);
  add(group, plan([[0, -7.7], [0.45, -7.2], [1.1, -5.8], [0, -6.3]], 0.04, 0), mats.accent, 0, 0.6, 0);

  // Vientre suave
  var belly = add(group, capsule(0.8, 8.5, 32), mats.plate, 0, -0.5, -0.5);
  belly.scale.set(1.25, 0.45, 1);

  /* ---------- Torre de mando ---------- */
  add(group, roundedBox(1.4, 0.8, 2.4, 0.3, 10), mats.hull, 0, 1.45, 2.2);
  add(group, roundedBox(0.9, 0.5, 1.4, 0.2, 8), mats.hull, 0, 2.0, 2.4);
  add(group, new THREE.BoxGeometry(1.25, 0.16, 0.03), mats.glass, 0, 1.55, 0.99);
  add(group, new THREE.BoxGeometry(0.03, 0.12, 0.9), mats.glass, 0.46, 2.05, 2.4);
  add(group, new THREE.BoxGeometry(0.03, 0.12, 0.9), mats.glass, -0.46, 2.05, 2.4);
  [1, -1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.04, 0.12, 2.0), mats.accent, 0.71 * s, 1.35, 2.2);
  });
  add(group, new THREE.SphereGeometry(0.3, 24, 14), mats.glass, 0, 2.3, 2.9).scale.set(1, 0.8, 1);
  add(group, new THREE.CylinderGeometry(0.03, 0.04, 0.7, 10), mats.dark, 0, 2.55, 2.4);
  var radar = new THREE.Group();
  radar.position.set(0, 2.92, 2.4);
  add(radar, roundedBox(1.3, 0.06, 0.18, 0.03, 4), mats.plate, 0, 0, 0);
  add(radar, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), mats.dark, 0, -0.04, 0);
  group.add(radar);
  [[0.5, 2.3, 3.2], [-0.5, 2.3, 3.2]].forEach(function (p) {
    add(group, new THREE.CylinderGeometry(0.012, 0.02, 0.9, 6), mats.dark, p[0], p[1] + 0.3, p[2]);
  });

  /* ---------- Torretas dobles ---------- */
  var hemi = new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, P / 2);
  var headGeo = roundedBox(0.5, 0.22, 0.6, 0.08, 8);
  var turrets = [], muzzles = [], pdTurrets = [], pdMuzzles = [];

  function turret(x, y, z, sc, nBarrels, len, yawBase, isPD) {
    var base = new THREE.Group();
    base.position.set(x, y, z);
    base.scale.setScalar(sc);
    base.rotation.y = yawBase || 0;
    add(base, hemi, mats.hull, 0, 0, 0).scale.set(0.5, 0.28, 0.55);
    var ringG = new THREE.TorusGeometry(0.5, 0.035, 8, 32);
    ringG.rotateX(P / 2);
    add(base, ringG, mats.accent, 0, 0.02, 0);
    var head = new THREE.Group();
    head.position.y = 0.2;
    base.add(head);
    add(head, headGeo, mats.hull, 0, 0.02, 0);
    add(head, roundedBox(0.3, 0.03, 0.3, 0.012, 4), mats.accent, 0, 0.145, 0.02);
    var gun = new THREE.Group();
    gun.position.set(0, 0.04, -0.28);
    head.add(gun);
    for (var i = 0; i < nBarrels; i++) {
      var bx = (i - (nBarrels - 1) / 2) * 0.28;
      var sleeve = add(gun, new THREE.CylinderGeometry(0.075, 0.08, 0.5, 14), mats.plate, bx, 0, -0.1);
      sleeve.rotation.x = P / 2;
      var barrel = add(gun, new THREE.CylinderGeometry(0.042, 0.05, len, 12), mats.dark, bx, 0, -0.3 - len / 2);
      barrel.rotation.x = P / 2;
      add(gun, new THREE.TorusGeometry(0.058, 0.02, 8, 16), mats.plate, bx, 0, -0.3 - len);
      var m = new THREE.Object3D();
      m.position.set(bx, 0, -0.32 - len);
      gun.add(m);
      (isPD ? pdMuzzles : muzzles).push(m);
    }
    group.add(base);
    (isPD ? pdTurrets : turrets).push({ head: head, gun: gun, phase: (turrets.length + pdTurrets.length) * 1.9 });
  }
  turret(0, 1.05, -4.0, 1.15, 2, 1.5);
  turret(0, 1.05, -1.6, 1.0, 2, 1.3);
  turret(0, 1.05, 5.2, 0.85, 2, 1.1, P);

  /* ---------- Baterías de misiles ---------- */
  var cells = [];
  [1, -1].forEach(function (s) {
    var cx = 1.1 * s;
    add(group, roundedBox(0.8, 0.22, 3.0, 0.08, 8), mats.hull, cx, 1.15, -0.2);
    add(group, new THREE.BoxGeometry(0.8, 0.02, 0.06), mats.accent, cx, 1.27, -1.62);
    for (var c = 0; c < 3; c++) {
      for (var r = 0; r < 7; r++) {
        cells.push({ x: cx + (c - 1) * 0.24, y: 1.265, z: -1.4 + r * 0.4 });
      }
    }
  });
  group.add(boxField(new THREE.BoxGeometry(0.18, 0.02, 0.28), mats.dark, cells));

  /* ---------- Torretas antiaéreas ---------- */
  [-3.0, 1.5, 5.5].forEach(function (z) {
    [1, -1].forEach(function (s) {
      turret(s * (halfW(z) - 0.1), 0.58, z, 0.3, 2, 0.7, -s * P / 2, true);
    });
  });

  /* ---------- Alas cortas y cañones ---------- */
  add(group, plan([[0, 0], [3.4, 2.2], [3.5, 3.6], [2.6, 3.8], [0, 3.8]], 0.14, 0.03), mats.hull, 0, -0.05, 0);
  add(group, plan([[0, 1.2], [3.0, 2.5], [3.1, 3.4], [0, 3.6]], 0.02, 0), mats.accent, 0, 0.04, 0);
  var cannonBody = capsule(0.1, 1.2, 14);
  var cannonBarrel = new THREE.CylinderGeometry(0.035, 0.04, 1.0, 10);
  cannonBarrel.rotateX(P / 2);
  [1, -1].forEach(function (s) {
    var x = 3.4 * s;
    add(group, cannonBody, mats.dark, x, -0.05, 3.2);
    add(group, cannonBarrel, mats.plate, x, -0.05, 1.9);
    add(group, new THREE.TorusGeometry(0.055, 0.016, 8, 16), mats.accent, x, -0.05, 1.4);
    var m = new THREE.Object3D();
    m.position.set(x, -0.05, 1.35);
    group.add(m);
    muzzles.push(m);
  });

  /* ---------- Hangar lateral ---------- */
  [1, -1].forEach(function (s) {
    var hx = (halfW(3.6) + 0.01) * s;
    add(group, new THREE.BoxGeometry(0.06, 0.62, 1.7), mats.dark, hx, -0.05, 3.6);
    add(group, new THREE.BoxGeometry(0.04, 0.45, 1.4), mats.lamp, hx + 0.02 * s, -0.05, 3.6);
  });

  /* ---------- Ventanas y planchas ---------- */
  var wins = [];
  for (var z = -4.8; z < 6.2; z += 0.4) {
    if (z > 3.0 && z < 4.2) continue;
    [0.2, -0.05].forEach(function (wy) {
      [1, -1].forEach(function (s) {
        if (rnd() > 0.85) return;
        var sl = slope(z);
        wins.push({
          x: (halfW(z) + 0.02) * s, y: wy, z: z,
          ry: s > 0 ? Math.atan2(1, -sl) : Math.atan2(-1, -sl)
        });
      });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.16, 0.07, 0.04), mats.window, wins));

  var plates = [];
  var zones = [-4.0, -1.6, 5.2];
  for (var pl = 0; pl < 46; pl++) {
    var px = (rnd() * 2 - 1) * 1.25, pz = -5 + rnd() * 11;
    if (Math.abs(px) < 0.9 && pz > 0.9 && pz < 3.5) continue;
    if (Math.abs(px) > 0.65 && Math.abs(px) < 1.55 && pz > -1.8 && pz < 1.4) continue;
    var skip = false;
    for (var q = 0; q < zones.length; q++) if (Math.abs(px) < 0.7 && Math.abs(pz - zones[q]) < 0.8) skip = true;
    if (skip || Math.abs(px) > halfW(pz) - 0.5) continue;
    plates.push({ x: px, y: 1.07 + 0.02, z: pz, sx: 0.2 + rnd() * 0.35, sy: 0.04 + rnd() * 0.05, sz: 0.2 + rnd() * 0.4 });
  }
  group.add(boxField(roundedBox(1, 1, 1, 0.12, 4), mats.hull, plates));

  // Radiadores
  [1, -1].forEach(function (s) {
    add(group, roundedBox(0.06, 0.9, 2.0, 0.02, 4), mats.hull, 0.9 * s, 1.5, 5.6);
    add(group, new THREE.BoxGeometry(0.075, 0.04, 2.02), mats.accent, 0.9 * s, 1.85, 5.6);
  });

  /* ---------- Motores ---------- */
  add(group, roundedBox(3.8, 1.1, 0.8, 0.3, 12), mats.hull, 0, 0, 7.1);
  add(group, new THREE.BoxGeometry(3.4, 0.05, 0.5), mats.accent, 0, 0.56, 7.1);

  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 32);
  bellGeo.rotateX(P / 2);
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.4, 12);
  flameLight.position.set(0, 0, 9.5);
  group.add(flameLight);

  function buildEngine(x, y, s, flameLen) {
    add(group, bellGeo, mats.dark, x, y, 7.5).scale.set(s, s, s);
    add(group, new THREE.CircleGeometry(0.2 * s, 24), glowMat(0xffffff, 0.95), x, y, 7.55);
    var baseZ = 7.5 + 0.75 * s;
    function cone(r, len, color, op) {
      var g = new THREE.ConeGeometry(r, len, 20, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, op), x, y, baseZ);
    }
    engines.push({
      outer: cone(0.5 * s, flameLen, colors.glow, 0.4),
      inner: cone(0.28 * s, flameLen * 0.62, 0xffffff, 0.85),
      phase: engines.length * 1.5, len: flameLen
    });
  }
  buildEngine(0, 0, 0.9, 2.2);
  buildEngine(-1.05, 0, 0.9, 2.2);
  buildEngine(1.05, 0, 0.9, 2.2);
  buildEngine(-1.75, 0, 0.38, 1.2);
  buildEngine(1.75, 0, 0.38, 1.2);

  /* ---------- Luces ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.07, 10, 8), m, 3.55 * s, 0.05, 3.75);
    navLights.push({ mat: m, on: c, fast: false });
  });
  var strobe = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.06, 10, 8), strobe, 0, 3.0, 2.4);
  navLights.push({ mat: strobe, on: 0xffffff, fast: true });

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.5 : throttle));
    var w = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var len = (0.3 + th * 1.1) * e.len / 2.2;
      var f = 1 + 0.07 * Math.sin(t * 35 + e.phase) + 0.04 * Math.sin(t * 22 + e.phase * 2);
      e.outer.scale.set(w, w, len * f);
      e.inner.scale.set(w, w, len * (2 - f));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.4 + th * 1.8 + 0.1 * Math.sin(t * 28);
    var all = turrets.concat(pdTurrets);
    for (var k = 0; k < all.length; k++) {
      var tr = all[k];
      tr.head.rotation.y = Math.sin(t * 0.5 + tr.phase) * 0.55;
      tr.gun.rotation.x = -0.1 + Math.sin(t * 0.7 + tr.phase) * 0.08;
    }
    radar.rotation.y = t * 1.2;
    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.fast ? Math.sin(t * 7) > 0.8 : Math.sin(t * 3) > 0.5;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return {
    group: group, update: update, setAccent: setAccent, muzzles: muzzles, turrets: turrets,
    pdTurrets: pdTurrets, pdMuzzles: pdMuzzles, materials: mats
  };
}
