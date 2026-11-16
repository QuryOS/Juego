# Universo Abierto — juego de naves (Three.js)

## Estructura
```
index.html              solo el cargador (no lo toques casi nunca)
version.json            lo reescribe GitHub en cada publicación (rompe la caché)
.github/workflows/      publicación automática
juego/
  modulos.json          orden en que se cargan los archivos (agrega aquí los nuevos)
  estilos.css           todo el CSS
  config.js             CONFIG (ruta de naves, semilla, servidor) y catálogo de naves
  main.js               arranque, entrada (teclado/táctil), bucle principal
  nucleo/               util.js · pantalla.js (DOM/renderer) · modelos.js
  recursos/             procedural.js (cielo, planetas, anillos)
  escenas/              carga.js · lobby.js · mundo.js
  red/                  red.js (multijugador por WebSocket, opcional)
naves/                  los .js de las naves: se detectan solos
```
Cada archivo es un script normal: comparte datos con los demás por el objeto `window.JN`.
Para agregar un archivo nuevo: créalo en `juego/` y añádelo a `juego/modulos.json`.

## Publicar (una sola vez)
1. Sube todo el contenido de esta carpeta a la raíz de tu repositorio en GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. Cada `push` a `main` publica solo en ~1 minuto. No hay que esperar la caché:
   el cargador pide `version.json` sin caché y carga todo con `?v=<versión>`.

## Naves nuevas
Sube su `.js` a `naves/` y haz push. La publicación genera `naves/naves.json` y el juego la suma al hangar.
Datos opcionales al final del archivo de la nave:
`createMiNave.info = { nombre: 'Mi Nave', clase: 'Caza', m: 3, vmax: 200, agil: 0.9, blind: 0.4, desc: 'Texto' };`

## Probar en local
`python3 -m http.server` en esta carpeta y abrir `http://localhost:8000` (no funciona con doble clic / file://).
