/**
 * Titán: crucero espacial procedural para Three.js (sin archivos externos).
 *
 * Uso:
 *   const cruiser = createCruiser(THREE, { accent: 0x2b8cff });
 *   scene.add(cruiser.group);
 *   // en tu bucle de juego (throttle de 0 a 1):
 *   cruiser.update(clock.getElapsedTime(), throttle);
 *
 * Convenciones: la nariz apunta a -Z, arriba es +Y, derecha es +X.
 * Escala: 1 unidad = 6 m. Eslora ~13,5 unidades (81 m), envergadura ~6 unidades.
 * Expone cruiser.turrets (grupos que puedes apuntar tú mismo) y cruiser.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createCruiser(THREE, opts) {
  opts = opts || {};
  var P = Math.PI;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0x9aa5b4,
    accent: opts.accent != null ? opts.accent : 0x2b8cff,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    glow: opts.glow != null ? opts.glow : 0x6fb6ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.55, roughness: 0.42 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x7c8797, metalness: 0.6, roughness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.08,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9
    }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 })
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

  // Generador pseudoaleatorio con semilla: el modelo es idéntico en cada carga.
  var seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Extruye una silueta vista desde arriba (x = ancho, y = largo, con la nariz en y negativa).
  // Resultado centrado en altura: ocupa de y = -depth/2 a +depth/2.
  function plan(pts, depth, bevel) {
    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (var j = pts.length - 1; j >= 1; j--) s.lineTo(-pts[j][0], pts[j][1]);
    s.closePath();
    var g = new THREE.ExtrudeGeometry(s, {
      depth: depth, bevelEnabled: !!bevel,
      bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 1
    });
    g.rotateX(P / 2);
    g.translate(0, depth / 2, 0);
    return g;
  }

  /* ---------- Casco principal ---------- */
  add(group, plan([
    [0, -7], [0.45, -6.3], [1.2, -4.6], [1.7, -2], [1.95, 1], [1.95, 4.5], [1.6, 6.5]
  ], 0.9, 0.03), mats.hull, 0, 0, 0);

  // Cubierta superior
  add(group, plan([
    [0, -4.8], [0.8, -3.6], [1.15, -1], [1.2, 4.4], [0.95, 5.6]
  ], 0.45, 0.02), mats.plate, 0, 0.675, 0);

  // Quilla
  add(group, new THREE.BoxGeometry(0.8, 0.22, 7.4), mats.dark, 0, -0.5, -0.4);

  // Franja de acento en el lomo
  add(group, new THREE.BoxGeometry(0.22, 0.04, 6.4), mats.accent, 0, 0.92, -1.3);
  add(group, new THREE.BoxGeometry(1.9, 0.03, 0.5), mats.accent, 0, 0.465, -4.4);

  // Planchas y detalles en el casco expuesto
  var greebleGeo = new THREE.BoxGeometry(1, 1, 1);
  for (var gi = 0; gi < 46; gi++) {
    var gs = rnd() > 0.5 ? 1 : -1;
    var gx = gs * (1.25 + rnd() * 0.55);
    var gz = -2.6 + rnd() * 8.2;
    var sx = 0.12 + rnd() * 0.26, sy = 0.05 + rnd() * 0.09, sz = 0.14 + rnd() * 0.4;
    add(group, greebleGeo, rnd() > 0.25 ? mats.plate : mats.dark, gx, 0.45 + sy / 2, gz).scale.set(sx, sy, sz);
  }

  /* ---------- Torre de mando ---------- */
  add(group, new THREE.BoxGeometry(0.7, 0.9, 1.2), mats.hull, 0, 1.4, 3.2);
  add(group, new THREE.BoxGeometry(1.6, 0.3, 0.8), mats.hull, 0, 2.05, 3.0);
  add(group, new THREE.BoxGeometry(1.64, 0.06, 0.84), mats.accent, 0, 2.23, 3.0);
  add(group, new THREE.BoxGeometry(1.5, 0.14, 0.02), mats.glass, 0, 2.06, 2.59);
  add(group, new THREE.BoxGeometry(0.05, 0.4, 0.9), mats.glass, 0.82, 2.06, 3.0);
  add(group, new THREE.BoxGeometry(0.05, 0.4, 0.9), mats.glass, -0.82, 2.06, 3.0);
  [1, -1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.04, 0.5, 1.0), mats.accent, 0.62 * s, 1.3, 4.1);
  });
  add(group, new THREE.CylinderGeometry(0.02, 0.03, 0.9, 6), mats.dark, 0.35, 2.7, 3.2);
  add(group, new THREE.CylinderGeometry(0.015, 0.02, 0.6, 6), mats.dark, -0.4, 2.55, 3.4);
  var dish = add(group, new THREE.SphereGeometry(0.22, 14, 8, 0, P * 2, 0, P / 2), mats.hull, 0, 2.25, 3.55);
  dish.rotation.x = -0.5;

  /* ---------- Vainas de hangar laterales ---------- */
  var podNose = new THREE.CylinderGeometry(0.15, 0.636, 1.2, 4);
  podNose.rotateY(P / 4);
  podNose.rotateX(-P / 2);

  var windows = [];   // posiciones de ventanas: [x, y, z]
  [1, -1].forEach(function (s) {
    var px = 2.55 * s;
    add(group, new THREE.BoxGeometry(0.9, 0.8, 6.5), mats.hull, px, -0.05, 1.2);
    var nose = add(group, podNose, mats.hull, px, -0.05, -2.65);
    nose.scale.y = 0.89;
    add(group, new THREE.BoxGeometry(0.5, 0.03, 4.2), mats.accent, px, 0.365, 1.2);
    add(group, new THREE.BoxGeometry(0.6, 0.22, 0.04), mats.dark, px, 0.1, 4.47);

    // Pilones que unen la vaina con el casco
    [0.0, 3.0].forEach(function (z) {
      add(group, new THREE.BoxGeometry(0.6, 0.2, 0.8), mats.plate, 2.0 * s, -0.1, z);
    });

    // Compuerta de hangar iluminada
    add(group, new THREE.BoxGeometry(0.03, 0.34, 1.8), new THREE.MeshBasicMaterial({ color: 0xffc46b }), (2.55 + 0.46) * s, -0.2, 2.9);
    add(group, new THREE.BoxGeometry(0.04, 0.42, 1.9), mats.dark, (2.55 + 0.455) * s, -0.2, 2.9);

    // Ventanas en la cara exterior
    for (var row = 0; row < 2; row++) {
      for (var k = 0; k < 20; k++) {
        var wz = -1.6 + k * 0.26;
        if (wz > 1.8 && wz < 4.0 && row === 0) continue;   // zona de la compuerta
        if (rnd() > 0.82) continue;
        windows.push([(2.55 + 0.46) * s, 0.18 - row * 0.2, wz]);
      }
    }
  });

  // Ventanas en los flancos de la torre y el casco
  for (var wk = 0; wk < 14; wk++) {
    var z = 2.8 + (wk % 7) * 0.1;
    windows.push([0.36, 1.2 + Math.floor(wk / 7) * 0.2, z + 0.55]);
    windows.push([-0.36, 1.2 + Math.floor(wk / 7) * 0.2, z + 0.55]);
  }

  var winGeo = new THREE.BoxGeometry(0.03, 0.06, 0.12);
  var winMesh = new THREE.InstancedMesh(winGeo, mats.window, windows.length);
  var dummy = new THREE.Object3D();
  for (var wi = 0; wi < windows.length; wi++) {
    dummy.position.set(windows[wi][0], windows[wi][1], windows[wi][2]);
    dummy.updateMatrix();
    winMesh.setMatrixAt(wi, dummy.matrix);
  }
  winMesh.instanceMatrix.needsUpdate = true;
  winMesh.frustumCulled = false;   // las instancias están lejos del origen del mesh
  group.add(winMesh);

  /* ---------- Torretas ---------- */
  var turrets = [];
  var barrelGeo = new THREE.CylinderGeometry(0.028, 0.034, 0.62, 8);
  barrelGeo.rotateX(P / 2);
  barrelGeo.translate(0, 0, -0.38);

  function buildTurret(x, y, z, scale, phase) {
    var base = new THREE.Group();
    base.position.set(x, y, z);
    base.scale.setScalar(scale);
    add(base, new THREE.CylinderGeometry(0.22, 0.26, 0.12, 14), mats.dark, 0, 0.06, 0);
    var head = new THREE.Group();
    head.position.y = 0.14;
    add(head, new THREE.BoxGeometry(0.3, 0.14, 0.36), mats.hull, 0, 0.04, 0);
    add(head, new THREE.BoxGeometry(0.32, 0.03, 0.2), mats.accent, 0, 0.12, 0.02);
    add(head, barrelGeo, mats.dark, 0.08, 0.04, 0);
    add(head, barrelGeo, mats.dark, -0.08, 0.04, 0);
    base.add(head);
    group.add(base);
    turrets.push({ group: head, base: base, phase: phase });
  }
  buildTurret(0.62, 0.9, -2.2, 1.0, 0.0);
  buildTurret(-0.62, 0.9, -2.2, 1.0, 1.3);
  buildTurret(0.7, 0.9, 0.2, 1.2, 2.6);
  buildTurret(-0.7, 0.9, 0.2, 1.2, 3.9);
  buildTurret(0.0, 0.9, 5.0, 1.1, 5.2);
  buildTurret(2.55, 0.35, -0.2, 0.9, 0.7);
  buildTurret(-2.55, 0.35, -0.2, 0.9, 2.1);

  /* ---------- Motores ---------- */
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.6, 14);
  flameLight.position.set(0, 0, 8.2);
  group.add(flameLight);

  function buildEngine(x, y, bodyZ, nozzleZ, radius, flameLen, bodyLen) {
    if (bodyLen) {
      var nac = add(group, new THREE.CylinderGeometry(radius, radius, bodyLen, 24), mats.hull, x, y, bodyZ);
      nac.rotation.x = P / 2;
      add(group, new THREE.TorusGeometry(radius, 0.03, 8, 28), mats.accent, x, y, bodyZ + bodyLen / 2 - 0.12);
    }
    var noz = add(group, new THREE.CylinderGeometry(radius * 0.9, radius * 0.72, 0.36, 24, 1, true), mats.dark, x, y, nozzleZ);
    noz.rotation.x = P / 2;
    var baseZ = nozzleZ + 0.19;
    add(group, new THREE.CircleGeometry(radius * 0.7, 20), glowMat(0xffffff, 0.95), x, y, baseZ);

    function cone(r, len, color, opacity) {
      var g = new THREE.ConeGeometry(r, len, 18, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, opacity), x, y, baseZ);
    }
    engines.push({
      outer: cone(radius * 0.8, flameLen, colors.glow, 0.4),
      inner: cone(radius * 0.45, flameLen * 0.62, 0xffffff, 0.85),
      phase: engines.length * 1.3,
      len: flameLen
    });
  }
  // Bloque trasero que sostiene los cuatro motores principales
  add(group, new THREE.BoxGeometry(3.0, 0.82, 0.3), mats.dark, 0, 0, 6.6);
  [-1.25, -0.45, 0.45, 1.25].forEach(function (x) {
    buildEngine(x, 0, 6.9, 7.2, 0.4, 2.6, 1.0);
  });
  buildEngine(2.55, -0.05, 4.7, 4.65, 0.3, 1.6, 0);
  buildEngine(-2.55, -0.05, 4.7, 4.65, 0.3, 1.6, 0);

  /* ---------- Luces de navegación ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.07, 10, 8), m, 3.04 * s, 0.1, -2.9);
    navLights.push({ mat: m, on: c });
  });
  var beacon = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.06, 10, 8), beacon, 0.35, 3.18, 3.2);
  navLights.push({ mat: beacon, on: 0xffffff, fast: true });

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.5 : throttle));
    var width = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var len = (0.3 + th * 1.0) * (e.len / 2.6) * 1.1;
      var flick = 1 + 0.07 * Math.sin(t * 36 + e.phase) + 0.04 * Math.sin(t * 21 + e.phase * 2);
      e.outer.scale.set(width, width, len * flick);
      e.inner.scale.set(width, width, len * (2 - flick));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.4 + th * 2.0 + 0.1 * Math.sin(t * 29);
    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.fast ? Math.sin(t * 7) > 0.8 : Math.sin(t * 3) > 0.5;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
    for (var k = 0; k < turrets.length; k++) {
      var tr = turrets[k];
      tr.group.rotation.y = Math.sin(t * 0.45 + tr.phase) * 0.6;
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return { group: group, update: update, setAccent: setAccent, turrets: turrets, materials: mats };
}
