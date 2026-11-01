# La Carrera más Linda de Boyacá · Resultados y Diplomas 2026

Aplicación web **100 % responsiva** para consultar los resultados oficiales de la carrera y ver, descargar e imprimir el diploma de cada deportista.

**Demo en producción:** https://la-carrera-mas-linda.vercel.app

![Evento](https://img.shields.io/badge/Edición-Media%20Maratón%202026-b4126b) ![Deploy](https://img.shields.io/badge/Deploy-Vercel-black)

## Funcionalidades

- Búsqueda por nombre o dorsal (sin distinguir tildes ni mayúsculas).
- Filtros por distancia (21K, 10K, 5K, 1K) y género (Damas / Caballeros).
- Orden por posición general, tiempo, nombre o dorsal.
- Ficha del deportista con tiempo, ritmo, velocidad, ciudad y posiciones.
- Diploma: visualización, **descarga en PDF de 1 página** (generado en el navegador) e **impresión A4 horizontal**.
- **Compartir por WhatsApp** y **QR** del sitio y del diploma de cada deportista (QR descargable en PNG e imprimible).
- Descarga del PDF oficial completo de resultados.
- Enlaces directos para compartir: `/?dorsal=195`.

## Cómo funciona

- Sitio 100 % estático (HTML + CSS + JavaScript, sin backend ni CDN).
- Los datos se extraen de los PDF originales con `pdfjs-dist` y se guardan en `data.js`.
- Cada diploma se muestra como imagen WebP (compatible con móviles) y el PDF individual se recorta en el navegador con `pdf-lib` desde `assets/diplomas-oficiales.pdf`.

## Estructura

```
index.html                 Página principal
styles.css                 Diseño responsivo
app.js                     Búsqueda, filtros, modal, descarga e impresión
print.html                 Vista de impresión del diploma
data.js / data.json        Datos del evento (397 deportistas)
assets/diplomas-oficiales.pdf    PDF oficial con los 397 diplomas
assets/resultados-oficiales.pdf  PDF oficial de resultados
assets/qr-sitio.svg              QR estático del sitio (vectorial)
assets/qr-whatsapp.png           Póster 1080×1350 para estados de WhatsApp
diplomas/img/*.webp        Imagen de cada diploma
vendor/pdf-lib.min.js      Librería para generar el PDF individual
vendor/qrcode.js           Generador de QR en el navegador
tools/                     Scripts de extracción, datos y QR
server.js / iniciar.bat    Servidor local opcional
```

## Desarrollo local

```bash
npm install
npm start          # http://localhost:8080
```

También puede abrirse `index.html` directamente (en ese caso la descarga abre el PDF oficial en la página del diploma).

## Regenerar datos (nueva edición)

1. Copiar los PDF originales (`FINAL X CATEGORIAS Y GENERO.pdf` y `DIPLOMAS.pdf`) a la carpeta superior.
2. Ejecutar:

```bash
npm install
node tools/build.js
```

## Deploy en Vercel

El proyecto ya está publicado en **https://la-carrera-mas-linda.vercel.app** y vinculado a este repositorio: cada `git push` a `main` genera un despliegue de producción automático.

- No requiere build: Vercel sirve el sitio estático tal como está.
- `vercel.json` define cabeceras de caché y seguridad; `.vercelignore` excluye las herramientas locales (`tools/`, `server.js`, `package.json`, etc.).
- Framework preset: **Other** · Build command: *(ninguno)* · Output directory: raíz del repo.
- **Vercel Web Analytics:** el snippet ya está incluido en `index.html`; para empezar a recolectar datos, abre **Project → Analytics → Enable** en el dashboard (o usa `POST /web/insights/toggle`).
- QR del sitio: `node tools/make-qr.js` (acepta `SITE_URL` si cambia el dominio). El póster se genera abriendo `tools/qr-poster.html` y capturándolo en 1080×1350.

Para desplegar manualmente por CLI:

```bash
npx vercel --prod
```

## Datos

- 397 diplomas emitidos; 396 deportistas con fila en el PDF de resultados.
- El dorsal **2876** tiene diploma pero no aparece en el listado oficial; se muestra con las posiciones en “—”.
- Diplomas emitidos por TCT con fines informativos y como constancia de participación.
