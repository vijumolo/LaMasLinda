// Genera el QR estático del sitio (SVG vectorial) en assets/qr-sitio.svg
const fs = require('fs');
const path = require('path');
const qrcode = require('../vendor/qrcode.js');

const URL = process.env.SITE_URL || 'https://la-carrera-mas-linda.vercel.app/';
const qr = qrcode(0, 'M');
qr.addData(URL);
qr.make();

const svg = qr.createSvgTag({ cellSize: 10, margin: 4, scalable: false });
const out = path.join(__dirname, '..', 'assets', 'qr-sitio.svg');
fs.writeFileSync(out, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
console.log('QR generado:', out, '| URL:', URL, '| tamaño:', svg.length, 'bytes');
