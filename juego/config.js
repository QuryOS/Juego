/* Configuración y catálogo de naves — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};


  /* ===================== CONFIGURACIÓN ===================== */
  var CONFIG = {
    titulo: 'UNIVERSO ABIERTO',
    subtitulo: 'Esqueleto del juego de naves',
    rutaModelos: 'naves/',      // carpeta donde están los .js de las naves (con barra final)
    autodescubrir: true,        // detecta solo los .js nuevos de esa carpeta (ver descubrirNaves)
    manifiesto: 'naves.json',   // opcional: lista de archivos ["mi_nave.js", ...] dentro de la carpeta
    urlThree: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    servidor: '',
    semilla: 20260117,
    celda: 12000,
    version: '0.1'
  };
  (function () { var u = global.JUEGO_NAVES_CONFIG; if (u) for (var k in u) if (u.hasOwnProperty(k)) CONFIG[k] = u[k]; })();

  /* ===================== CATÁLOGO DE NAVES ===================== */
  // m = metros por unidad del modelo; vmax en m/s; agil y blind de 0 a 1 (solo para las barras y el manejo).
  var NAVES = [
    { id: 'centinela', nombre: 'Centinela', archivo: 'ship.js', fn: 'createShip', m: 3, clase: 'Caza ligero', vmax: 220, agil: 1.0, blind: 0.30, desc: 'Ágil y versátil. La mejor para aprender a volar.' },
    { id: 'aguijon', nombre: 'Aguijón', archivo: 'aguijon.js', fn: 'createAguijon', m: 2, clase: 'Interceptor', vmax: 300, agil: 1.25, blind: 0.20, desc: 'Pequeño y rapidísimo. Casi no aguanta golpes.' },
    { id: 'halcon', nombre: 'Halcón', archivo: 'halcon.js', fn: 'createHalcon', m: 4, clase: 'Fragata', vmax: 150, agil: 0.60, blind: 0.60, desc: 'Fragata con torretas y misiles. Equilibrada.' },
    { id: 'sombra', nombre: 'Sombra', archivo: 'sombra.js', fn: 'createSombra', m: 4, clase: 'Bombardero furtivo', vmax: 190, agil: 0.80, blind: 0.40, desc: 'Ala volante de perfil bajo con dos bodegas.' },
    { id: 'martillo', nombre: 'Martillo', archivo: 'martillo.js', fn: 'createMartillo', m: 4, clase: 'Cañonera pesada', vmax: 140, agil: 0.55, blind: 0.75, desc: 'Un cañón enorme y mucho blindaje.' },
    { id: 'ariete', nombre: 'Ariete', archivo: 'ariete.js', fn: 'createAriete', m: 4, clase: 'Nave de asalto', vmax: 160, agil: 0.60, blind: 0.70, desc: 'Abordaje y asalto con cápsulas de desembarco.' },
    { id: 'mastodonte', nombre: 'Mastodonte', archivo: 'cargo.js', fn: 'createCargoShip', m: 5, clase: 'Carguero', vmax: 110, agil: 0.45, blind: 0.55, desc: 'Lento y enorme: 24 contenedores de carga.' },
    { id: 'titan', nombre: 'Titán', archivo: 'cruiser.js', fn: 'createCruiser', m: 6, clase: 'Crucero', vmax: 120, agil: 0.45, blind: 0.80, desc: 'Crucero con torretas orientables.' },
    { id: 'vanguardia', nombre: 'Vanguardia', archivo: 'vanguardia.js', fn: 'createVanguardia', m: 10, clase: 'Crucero pesado', vmax: 90, agil: 0.30, blind: 0.90, desc: 'La joya del astillero: 480 m de longitud.' },
    { id: 'nodriza', nombre: 'Nodriza', archivo: 'nodriza.js', fn: 'createNodriza', m: 4, clase: 'Portanaves', vmax: 70, agil: 0.25, blind: 0.90, desc: 'Portanaves de apoyo. Pesadísima.' },
    { id: 'leviatan', nombre: 'Leviatán', archivo: 'leviatan.js', fn: 'createLeviatan', m: 10, clase: 'Acorazado', vmax: 60, agil: 0.20, blind: 1.00, desc: 'El acorazado: 520 m de acero.' }
  ];
  var ACENTOS = [0x2f7bff, 0xd7263d, 0xf08a1e, 0x35c46a, 0xa45cff, 0xe9edf5];
  var CALIDAD = {
    alta:  { dpr: 2,   cielo: 2048, planeta: 512, polvo: 700, radioPlanetas: 3 },
    media: { dpr: 1.5, cielo: 1536, planeta: 384, polvo: 450, radioPlanetas: 3 },
    baja:  { dpr: 1,   cielo: 1024, planeta: 256, polvo: 220, radioPlanetas: 2 }
  };
  var CONSEJOS = [
    'Mantén el TURBO para cruzar distancias largas: se recarga solo cuando lo sueltas.',
    'Las balizas de la pantalla te señalan los planetas más cercanos.',
    'Las naves grandes giran despacio: empieza a girar con tiempo.',
    'Los asteroides son sólidos. Los choques te frenan.',
    'Cada partida usa el mismo universo: los planetas siempre están en el mismo lugar.'
  ];

  E.CONFIG = CONFIG;
  E.NAVES = NAVES;
  E.ACENTOS = ACENTOS;
  E.CALIDAD = CALIDAD;
  E.CONSEJOS = CONSEJOS;
})(window);
