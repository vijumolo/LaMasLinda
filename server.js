/* Servidor local para la app de resultados y diplomas.
   Uso:  node server.js  (o doble clic en iniciar.bat) */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const START_PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    rel = rel.replace(/\\/g, '/');

    const file = path.resolve(ROOT, rel);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      return send(res, 403, 'Acceso denegado');
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, 'No encontrado');
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const isDoc = ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json' || ext === '.webmanifest';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': isDoc ? 'no-store' : 'public, max-age=3600'
    });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    send(res, 500, 'Error del servidor');
  }
});

function lanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function openBrowser(url) {
  try {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch (e) { /* el usuario puede abrir la URL manualmente */ }
}

function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error('No se pudo iniciar el servidor:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '0.0.0.0', () => {
    const local = 'http://localhost:' + port + '/';
    const lan = lanAddress();
    console.log('');
    console.log('  La Carrera más Linda · Resultados y Diplomas');
    console.log('  --------------------------------------------------');
    console.log('  En este equipo:  ' + local);
    if (lan) console.log('  En tu celular:   http://' + lan + ':' + port + '/   (misma red WiFi)');
    console.log('  --------------------------------------------------');
    console.log('  Deja esta ventana abierta. Ctrl+C para detener.');
    console.log('');
    if (process.env.NO_OPEN !== '1') openBrowser(local);
  });
}

listen(START_PORT, 20);
