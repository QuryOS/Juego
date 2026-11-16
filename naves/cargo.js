/**
 * Mastodonte: nave de cargamento procedural para Three.js (sin archivos externos).
 * Formas redondeadas y suaves: cajas con bordes curvos, cápsulas, elipsoides y toberas de revolución.
 *
 * Uso:
 *   const cargo = createCargoShip(THREE, { accent: 0xffa31a });
 *   scene.add(cargo.group);
 *   // en tu bucle de juego (throttle de 0 a 1):
 *   cargo.update(clock.getElapsedTime(), throttle);
 *
 * Convenciones: la nariz apunta a -Z, arriba es +Y, derecha es +X.
 * Escala: 1 unidad = 5 m. Eslora ~14 unidades (70 m), 24 contenedores en 6 filas.
 * Expone cargo.setAccent(hex) y cargo.containers (meshes de los contenedores).
 * Compatible con Three.js r128 o superior.
 */
function createCargoShip(THREE, opts) {
  opts = opts || {};
  var P = Math.PI;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d9e2,
    accent: opts.accent != null ? opts.accent : 0xffa31a,
    dark: opts.dark != null ? opts.dark : 0x1b2230,
    glow: opts.glow != null ? opts.glow : 0x7ac8ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.35, roughness: 0.38 }),
    spine: new THREE.MeshStandardMaterial({ color: 0x8993a3, metalness: 0.6, roughness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.25, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.06,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9, side: THREE.DoubleSide
    })
  };

  // Paleta de contenedores; el primero comparte material con el acento de la nave.
  var crateMats = [
    mats.accent,
    new THREE.MeshStandardMaterial({ color: 0x41536f, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0xc9d1dc, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x5d7f68, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x9a4a42, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x6d7a8d, metalness: 0.3, roughness: 0.5 })
  ];

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

  var seed = 11;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /* ---------- Geometrías suaves ---------- */

  // Caja con esquinas y aristas redondeadas, con normales suaves.
  function roundedBox(w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    var v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      inner.set(
        Math.max(-hx, Math.min(hx, v.x)),
        Math.max(-hy, Math.min(hy, v.y)),
        Math.max(-hz, Math.min(hz, v.z))
      );
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

  // Cápsula (cilindro con extremos semiesféricos) con su eje a lo largo de Z.
  function capsule(r, len, seg) {
    var pts = [], n = 12, i, a;
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

  // Tobera en campana: estrecha en z = 0 y ancha hacia +Z.
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 40);
  bellGeo.rotateX(P / 2);

  /* ---------- Cabina ---------- */
  var cockpit = add(group, new THREE.SphereGeometry(1, 56, 36), mats.hull, 0, 0, -5.4);
  cockpit.scale.set(0.95, 0.8, 1.5);

  // Visera: franja del elipsoide que mira hacia -Z
  var visor = add(group, new THREE.SphereGeometry(1, 48, 16, 3 * P / 2 - 0.85, 1.7, P * 0.3, P * 0.2), mats.glass, 0, 0, -5.4);
  visor.scale.set(0.965, 0.81, 1.52);

  // Collar de acento entre cabina y columna
  add(group, new THREE.TorusGeometry(0.52, 0.07, 16, 48), mats.accent, 0, 0, -3.95);

  // Antena y radar
  add(group, new THREE.CylinderGeometry(0.015, 0.025, 0.9, 12), mats.dark, 0, 1.15, -5.4);
  add(group, new THREE.SphereGeometry(0.04, 12, 10), mats.accent, 0, 1.62, -5.4);
  var dishPivot = new THREE.Group();
  dishPivot.position.set(0, 0.72, -4.7);
  var dish = add(dishPivot, new THREE.SphereGeometry(0.26, 28, 12, 0, P * 2, 0, P / 2), mats.hull, 0, 0.05, 0);
  dish.rotation.x = P;
  dish.material = mats.hull.clone();
  dish.material.side = THREE.DoubleSide;
  add(dishPivot, new THREE.CylinderGeometry(0.02, 0.03, 0.12, 10), mats.dark, 0, -0.04, 0);
  group.add(dishPivot);

  /* ---------- Columna central ---------- */
  add(group, capsule(0.45, 9.2, 40), mats.spine, 0, 0, 0.3);

  /* ---------- Contenedores en cruz ---------- */
  var crateGeo = roundedBox(0.9, 0.9, 1.3, 0.14, 14);
  var containers = [];
  var rowZ = [];
  var sides = [[0, 1], [0, -1], [1, 0], [-1, 0]];   // arriba, abajo, derecha, izquierda
  for (var row = 0; row < 6; row++) {
    var z = -3.2 + row * 1.45;
    rowZ.push(z);
    // Abrazadera entre filas
    add(group, new THREE.TorusGeometry(0.47, 0.04, 12, 40), mats.accent, 0, 0, z + 0.725);
    for (var s = 0; s < sides.length; s++) {
      if (rnd() > 0.9) continue;   // algún hueco para dejar ver la columna
      var mat = crateMats[Math.floor(rnd() * crateMats.length)];
      var c = add(group, crateGeo, mat, sides[s][0] * 0.97, sides[s][1] * 0.97, z);
      c.scale.set(1, 1, 0.94 + rnd() * 0.08);
      containers.push(c);
    }
  }
  add(group, new THREE.TorusGeometry(0.47, 0.04, 12, 40), mats.accent, 0, 0, rowZ[0] - 0.725);

  /* ---------- Tanques en las diagonales ---------- */
  var tankGeo = capsule(0.32, 2.4, 32);
  var ringGeo = new THREE.TorusGeometry(0.335, 0.04, 12, 32);
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) {
    var tx = d[0] * 1.15, ty = d[1] * 1.15;
    add(group, tankGeo, mats.hull, tx, ty, 3.4);
    [2.5, 4.3].forEach(function (zz) {
      add(group, ringGeo, mats.accent, tx, ty, zz);
      var len = Math.sqrt(tx * tx + ty * ty);
      var strut = add(group, new THREE.CylinderGeometry(0.05, 0.05, len, 12), mats.spine, tx / 2, ty / 2, zz);
      strut.rotation.z = Math.atan2(-tx, ty);
    });
  });

  /* ---------- Bloque de motores ---------- */
  add(group, roundedBox(1.7, 1.3, 1.5, 0.4, 20), mats.hull, 0, 0, 5.9);
  add(group, roundedBox(1.74, 0.1, 1.1, 0.04, 8), mats.accent, 0, 0.55, 5.9);

  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.6, 14);
  flameLight.position.set(0, 0, 8.4);
  group.add(flameLight);

  function buildEngine(x, y, scale, flameLen) {
    var bell = add(group, bellGeo, mats.dark, x, y, 6.55);
    bell.scale.set(scale, scale, scale);
    add(group, new THREE.CircleGeometry(0.2 * scale, 28), glowMat(0xffffff, 0.95), x, y, 6.6);
    var baseZ = 6.55 + 0.75 * scale;
    function cone(r, len, color, opacity) {
      var g = new THREE.ConeGeometry(r, len, 24, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, opacity), x, y, baseZ);
    }
    engines.push({
      outer: cone(0.5 * scale, flameLen, colors.glow, 0.4),
      inner: cone(0.28 * scale, flameLen * 0.62, 0xffffff, 0.85),
      phase: engines.length * 1.9,
      len: flameLen
    });
  }
  buildEngine(-0.45, 0, 0.82, 2.4);
  buildEngine(0.45, 0, 0.82, 2.4);

  /* ---------- Luces ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.06, 12, 10), m, 0.93 * s, 0.1, -5.6);
    navLights.push({ mat: m, on: c, fast: false });
  });
  var beacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  add(group, new THREE.SphereGeometry(0.07, 12, 10), beacon, 0, 0.7, 5.9);
  navLights.push({ mat: beacon, on: 0xff4d4d, fast: true });

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.5 : throttle));
    var width = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var len = 0.3 + th * 1.1;
      var flick = 1 + 0.07 * Math.sin(t * 34 + e.phase) + 0.04 * Math.sin(t * 19 + e.phase * 2);
      e.outer.scale.set(width, width, len * flick);
      e.inner.scale.set(width, width, len * (2 - flick));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.4 + th * 2.0 + 0.1 * Math.sin(t * 27);
    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.fast ? Math.sin(t * 6) > 0.7 : Math.sin(t * 3) > 0.5;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
    dishPivot.rotation.y = t * 0.6;
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return { group: group, update: update, setAccent: setAccent, containers: containers, materials: mats };
}
