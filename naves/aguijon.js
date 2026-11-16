/**
 * Aguijón: caza interceptor ligero (nave de guerra PEQUEÑA) para Three.js, sin archivos externos.
 *
 * Alas delta con punta cortada, colas gemelas inclinadas, tomas de aire laterales,
 * dos cañones en las puntas de las alas, 4 misiles bajo las alas y dos motores.
 *
 * Uso:
 *   const fighter = createAguijon(THREE, { accent: 0xe63946 });
 *   scene.add(fighter.group);
 *   fighter.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X.
 * Escala: 1 unidad = 2 m. Eslora ~6 u (12 m), envergadura ~5,4 u (11 m).
 *
 * Expone:
 *   fighter.muzzles   [Object3D, Object3D]  bocas de los cañones (para disparar desde ahí)
 *   fighter.missiles  [Mesh x4]             misiles; puedes ocultar uno al lanzarlo (mesh.visible = false)
 *   fighter.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createAguijon(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xb9c2cf,
    accent: opts.accent != null ? opts.accent : 0xe63946,
    dark: opts.dark != null ? opts.dark : 0x171d29,
    glow: opts.glow != null ? opts.glow : 0x62d6ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.5, roughness: 0.38 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x7e8a9b, metalness: 0.6, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.8
    })
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

  /* ---------- Geometrías ---------- */
  // Silueta vista desde arriba (nariz en y negativa), extruida y centrada en altura.
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

  /* ---------- Fuselaje: perfil suavizado con spline ---------- */
  var prof = [[0.001, -2.6], [0.34, -2.55], [0.42, -2.3], [0.45, -1.5], [0.5, -0.3],
    [0.46, 0.8], [0.34, 1.8], [0.2, 2.6], [0.08, 3.2], [0.001, 3.45]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var smooth = new THREE.SplineCurve(prof).getPoints(90).map(function (p) {
    return new THREE.Vector2(Math.max(0.001, p.x), p.y);
  });
  var fuselageGeo = new THREE.LatheGeometry(smooth, 40);
  fuselageGeo.rotateX(-P / 2);               // la nariz (y+) pasa a -Z
  add(group, fuselageGeo, mats.hull).scale.set(1, 0.72, 1);

  // Lomo, franja de acento y espina dorsal
  add(group, new THREE.BoxGeometry(0.1, 0.02, 1.9), mats.accent, 0, 0.345, 0.2);
  var spine = add(group, capsule(0.07, 1.4, 12), mats.plate, 0, 0.33, 1.3);
  spine.scale.set(1, 1.2, 1);

  // Cabina
  var canopy = add(group, new THREE.SphereGeometry(1, 32, 20), mats.glass, 0, 0.27, -0.95);
  canopy.scale.set(0.27, 0.2, 0.78);
  add(group, new THREE.BoxGeometry(0.03, 0.03, 1.0), mats.plate, 0, 0.455, -0.95);
  add(group, new THREE.TorusGeometry(0.29, 0.018, 8, 28), mats.plate, 0, 0.27, -0.45).scale.set(1, 0.74, 1);

  // Sonda de la nariz
  add(group, new THREE.CylinderGeometry(0.01, 0.025, 0.7, 8), mats.dark, 0, 0, -3.8).rotation.x = P / 2;

  /* ---------- Alas delta ---------- */
  add(group, plan([[0, -1.3], [2.6, 0.9], [2.72, 1.45], [2.3, 1.58], [0.5, 1.9], [0, 1.9]], 0.07, 0.03), mats.hull, 0, -0.06, 0);
  add(group, plan([[0, -0.9], [2.1, 0.85], [2.25, 1.3], [0.8, 1.55], [0, 1.55]], 0.02, 0), mats.accent, 0, 0.02, 0);
  // Borde de ataque oscuro
  [1, -1].forEach(function (s) {
    var edge = add(group, new THREE.BoxGeometry(0.05, 0.05, 3.4), mats.dark, 1.3 * s, -0.06, -0.2);
    edge.rotation.y = s * 0.87;
  });

  /* ---------- Colas gemelas inclinadas ---------- */
  var finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.45, 0.85);
  finShape.lineTo(0.95, 0.9);
  finShape.lineTo(1.05, 0);
  finShape.lineTo(0, 0);
  var finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.045, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.012, bevelSegments: 1 });
  finGeo.rotateY(-P / 2);
  finGeo.translate(0.022, 0, 0);
  [1, -1].forEach(function (s) {
    var fin = add(group, finGeo, mats.hull, 0.42 * s, 0.1, 1.3);
    fin.rotation.z = -0.38 * s;
    var tip = add(group, new THREE.BoxGeometry(0.05, 0.08, 0.4), mats.accent, 0.42 * s + 0.38 * s * 0.85, 0.88, 2.05);
    tip.rotation.z = -0.38 * s;
  });

  /* ---------- Tomas de aire ---------- */
  [1, -1].forEach(function (s) {
    var x = 0.62 * s;
    var body = add(group, new THREE.CylinderGeometry(0.2, 0.24, 1.5, 24), mats.hull, x, -0.04, 0.45);
    body.rotation.x = P / 2;
    var disc = add(group, new THREE.CircleGeometry(0.17, 24), mats.dark, x, -0.04, -0.305);
    disc.rotation.y = P;
    add(group, new THREE.TorusGeometry(0.19, 0.04, 10, 28), mats.accent, x, -0.04, -0.3);
    add(group, new THREE.BoxGeometry(0.1, 0.02, 0.9), mats.plate, x, 0.2, 0.55);   // rejilla dorsal
  });

  /* ---------- Motores ---------- */
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 28);
  bellGeo.rotateX(P / 2);
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.2, 8);
  flameLight.position.set(0, 0, 3.6);
  group.add(flameLight);

  [1, -1].forEach(function (s, i) {
    var x = 0.3 * s;
    var nac = add(group, new THREE.CylinderGeometry(0.24, 0.26, 1.2, 24), mats.hull, x, 0, 2.0);
    nac.rotation.x = P / 2;
    add(group, new THREE.TorusGeometry(0.255, 0.025, 8, 28), mats.accent, x, 0, 1.55);
    var bs = 0.55;
    add(group, bellGeo, mats.dark, x, 0, 2.55).scale.set(bs, bs, bs);
    add(group, new THREE.CircleGeometry(0.2 * bs, 20), glowMat(0xffffff, 0.95), x, 0, 2.6);
    var baseZ = 2.55 + 0.75 * bs;
    function cone(r, len, color, op) {
      var g = new THREE.ConeGeometry(r, len, 16, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, op), x, 0, baseZ);
    }
    engines.push({ outer: cone(0.5 * bs, 1.6, colors.glow, 0.4), inner: cone(0.28 * bs, 1.0, 0xffffff, 0.85), phase: i * 1.7 });
  });

  /* ---------- Armamento ---------- */
  var muzzles = [];
  var cannonBody = capsule(0.085, 1.3, 14);
  var cannonBarrel = new THREE.CylinderGeometry(0.03, 0.035, 0.9, 10);
  cannonBarrel.rotateX(P / 2);
  [1, -1].forEach(function (s) {
    var x = 2.6 * s;
    add(group, cannonBody, mats.dark, x, -0.03, 0.85);
    add(group, cannonBarrel, mats.plate, x, -0.03, -0.35);
    add(group, new THREE.TorusGeometry(0.05, 0.015, 8, 16), mats.accent, x, -0.03, -0.78);
    var m = new THREE.Object3D();
    m.position.set(x, -0.03, -0.85);
    group.add(m);
    muzzles.push(m);
  });

  var missiles = [];
  var missileGeo = capsule(0.07, 0.75, 14);
  var finGeoM = new THREE.BoxGeometry(0.16, 0.012, 0.14);
  [1.15, 1.7].forEach(function (mx) {
    [1, -1].forEach(function (s) {
      var x = mx * s;
      add(group, new THREE.BoxGeometry(0.05, 0.14, 0.5), mats.plate, x, -0.14, 0.2);
      var mis = new THREE.Group();
      mis.position.set(x, -0.25, 0.1);
      add(mis, missileGeo, mats.hull);
      add(mis, new THREE.TorusGeometry(0.072, 0.012, 8, 20), mats.accent, 0, 0, -0.15);
      add(mis, new THREE.SphereGeometry(0.05, 12, 10), mats.accent, 0, 0, -0.45).scale.set(1, 1, 1.5);
      add(mis, finGeoM, mats.dark, 0, 0, 0.3);
      var fv = add(mis, finGeoM, mats.dark, 0, 0, 0.3);
      fv.rotation.z = P / 2;
      group.add(mis);
      missiles.push(mis);
    });
  });

  /* ---------- Luces ---------- */
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.04, 10, 8), m, 2.74 * s, 0, 1.5);
    navLights.push({ mat: m, on: c });
  });

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.6 : throttle));
    var w = 0.75 + th * 0.35, len = 0.3 + th * 1.1;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var f = 1 + 0.08 * Math.sin(t * 40 + e.phase) + 0.05 * Math.sin(t * 25 + e.phase * 2);
      e.outer.scale.set(w, w, len * f);
      e.inner.scale.set(w, w, len * (2 - f));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.3 + th * 1.6 + 0.1 * Math.sin(t * 33);
    var on = Math.sin(t * 4) > 0.55;
    for (var j = 0; j < navLights.length; j++) navLights[j].mat.color.setHex(on ? navLights[j].on : 0x201010);
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return { group: group, update: update, setAccent: setAccent, muzzles: muzzles, missiles: missiles, materials: mats };
}
