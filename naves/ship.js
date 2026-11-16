/**
 * Centinela: nave espacial procedural para Three.js (sin archivos externos).
 *
 * Uso:
 *   const ship = createShip(THREE, { accent: 0xd7263d });
 *   scene.add(ship.group);
 *   // en tu bucle de juego (throttle de 0 a 1):
 *   ship.update(clock.getElapsedTime(), throttle);
 *
 * Convenciones: la nariz apunta a -Z, arriba es +Y, derecha es +X.
 * Escala: 1 unidad = 3 m. Eslora ~5,7 unidades, envergadura ~7,2 unidades.
 * Compatible con Three.js r128 o superior.
 */
function createShip(THREE, opts) {
  opts = opts || {};
  var P = Math.PI;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xc4ccd6,
    accent: opts.accent != null ? opts.accent : 0xff5a1f,
    dark: opts.dark != null ? opts.dark : 0x1a2130,
    glow: opts.glow != null ? opts.glow : 0x4fd8ff
  };

  var group = new THREE.Group();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.5, roughness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.08,
      emissive: 0x0a3a5c, emissiveIntensity: 0.7
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

  /* ---------- Fuselaje: sólido de revolución, aplanado en vertical ---------- */
  var profile = [
    [0.001, 3.4], [0.1, 3.25], [0.26, 2.8], [0.44, 2.1], [0.58, 1.2],
    [0.66, 0.2], [0.66, -0.8], [0.6, -1.6], [0.5, -2.1], [0.46, -2.25], [0.001, -2.25]
  ].reverse().map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var fuselage = add(group, new THREE.LatheGeometry(profile, 32), mats.hull);
  fuselage.rotation.x = -P / 2;      // el eje Y de la malla pasa a ser -Z (nariz hacia -Z)
  fuselage.scale.set(1, 1, 0.62);    // z local = altura mundial

  // Lomo de color y cabina
  add(group, new THREE.BoxGeometry(0.16, 0.07, 2.3), mats.accent, 0, 0.385, 0.7);
  var canopy = add(group, new THREE.SphereGeometry(1, 24, 16), mats.glass, 0, 0.3, -1.0);
  canopy.scale.set(0.3, 0.22, 0.78);

  /* ---------- Alas (se construye una y se refleja) ---------- */
  var wingShape = new THREE.Shape();
  wingShape.moveTo(0.35, -0.5);
  wingShape.lineTo(3.5, 1.0);
  wingShape.lineTo(3.6, 1.8);
  wingShape.lineTo(2.9, 1.8);
  wingShape.lineTo(0.35, 1.9);
  wingShape.lineTo(0.35, -0.5);
  var wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1
  });
  wingGeo.rotateX(P / 2);

  var panelShape = new THREE.Shape();
  panelShape.moveTo(0.9, 0.0);
  panelShape.lineTo(2.8, 0.9);
  panelShape.lineTo(2.85, 1.4);
  panelShape.lineTo(0.9, 1.3);
  panelShape.lineTo(0.9, 0.0);
  var panelGeo = new THREE.ExtrudeGeometry(panelShape, { depth: 0.02, bevelEnabled: false });
  panelGeo.rotateX(P / 2);
  panelGeo.translate(0, 0.045, 0);

  var barrelGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 10);
  barrelGeo.rotateX(P / 2);

  var navLights = [];
  function buildWing(side) {
    var w = new THREE.Group();
    w.position.y = -0.12;
    w.scale.x = side;
    add(w, wingGeo, mats.hull);
    add(w, panelGeo, mats.accent);

    // Aleta vertical en la punta
    var fin = add(w, new THREE.BoxGeometry(0.05, 0.55, 0.7), mats.accent, 3.55, 0.22, 1.4);
    fin.rotation.z = -0.2;

    // Cañón: carcasa y tubo
    add(w, new THREE.BoxGeometry(0.22, 0.16, 0.9), mats.dark, 1.3, 0.0, 0.1);
    add(w, barrelGeo, mats.dark, 1.3, -0.02, -0.55);

    // Luz de navegación: verde a la derecha (+X), roja a la izquierda
    var nav = new THREE.MeshBasicMaterial({ color: side > 0 ? 0x38e07b : 0xff3b3b });
    add(w, new THREE.SphereGeometry(0.06, 10, 8), nav, 3.62, 0.0, 1.45);
    navLights.push({ mat: nav, on: side > 0 ? 0x38e07b : 0xff3b3b });

    group.add(w);
  }
  buildWing(1);
  buildWing(-1);

  /* ---------- Aletas de cola ---------- */
  var finShape = new THREE.Shape();
  finShape.moveTo(0.0, 0.0);
  finShape.lineTo(0.5, 0.9);
  finShape.lineTo(1.0, 0.95);
  finShape.lineTo(1.05, 0.0);
  finShape.lineTo(0.0, 0.0);
  var finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false });
  finGeo.rotateY(-P / 2);
  finGeo.translate(0.025, 0, 0);
  [1, -1].forEach(function (s) {
    var tail = add(group, finGeo, mats.hull, 0.25 * s, 0.2, 1.0);
    tail.rotation.z = -0.3 * s;
    var tip = add(group, new THREE.BoxGeometry(0.056, 0.1, 0.5), mats.accent, 0.525 * s, 1.07, 1.75);
    tip.rotation.z = -0.3 * s;
  });

  /* ---------- Motores ---------- */
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.4, 9);
  flameLight.position.set(0, 0, 3.4);
  group.add(flameLight);

  function buildEngine(x, y, nozzleZ, radius, flameLen, hasNacelle) {
    if (hasNacelle) {
      var nac = add(group, new THREE.CylinderGeometry(radius, radius, 1.6, 24), mats.hull, x, y, 1.65);
      nac.rotation.x = P / 2;
      var ring = add(group, new THREE.TorusGeometry(radius, 0.035, 8, 28), mats.accent, x, y, 2.2);
    }
    var noz = add(group, new THREE.CylinderGeometry(radius * 0.9, radius * 0.72, 0.4, 24, 1, true), mats.dark, x, y, nozzleZ);
    noz.rotation.x = P / 2;
    noz.material = mats.dark.clone();
    noz.material.side = THREE.DoubleSide;
    var baseZ = nozzleZ + 0.21;
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
      phase: engines.length * 1.7
    });
  }
  buildEngine(-0.62, -0.08, 2.65, 0.3, 1.6, true);
  buildEngine(0.62, -0.08, 2.65, 0.3, 1.6, true);
  buildEngine(0, 0.0, 2.45, 0.3, 2.0, false);

  /* ---------- Animación ---------- */
  function update(t, throttle) {
    var th = Math.max(0, Math.min(1, throttle == null ? 0.6 : throttle));
    var len = 0.3 + th * 1.1;
    var width = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var flick = 1 + 0.08 * Math.sin(t * 38 + e.phase) + 0.05 * Math.sin(t * 23 + e.phase * 2);
      e.outer.scale.set(width, width, len * flick);
      e.inner.scale.set(width, width, len * (2 - flick));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.3 + th * 1.8 + 0.1 * Math.sin(t * 31);
    var blink = Math.sin(t * 4) > 0.55;
    for (var j = 0; j < navLights.length; j++) {
      navLights[j].mat.color.setHex(blink ? navLights[j].on : 0x201010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return { group: group, update: update, setAccent: setAccent, materials: mats };
}
