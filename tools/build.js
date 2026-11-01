// Construye la app: datos, diplomas individuales (PDF + imagen) y assets
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const napi = require('@napi-rs/canvas');
global.DOMMatrix = napi.DOMMatrix;
global.Path2D = napi.Path2D;
global.ImageData = napi.ImageData;
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { parseResults, parseDiplomas, norm, SRC } = require('./extract');

const APP = path.resolve(__dirname, '..');
const DIP_DIR = path.join(APP, 'diplomas');
const IMG_DIR = path.join(APP, 'diplomas', 'img');
const ASSETS = path.join(APP, 'assets');

const IMG_SCALE = 1.5;
const IMG_QUALITY = 80;

// PDF.js usa esta fábrica para crear lienzos internos (evita el paquete "canvas")
const canvasFactory = {
  create(width, height) {
    const canvas = napi.createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(cc, width, height) { cc.canvas.width = width; cc.canvas.height = height; },
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; },
};

const CAT_ORDER = ['21K', '10K', '5K', '1K'];

function parsePos(v) {
  const m = (v || '').match(/(\d+)\s*\.?\s*\/\s*(\d+)/);
  return m ? { pos: Number(m[1]), total: Number(m[2]) } : { pos: null, total: null };
}

function fmtCat(raw) {
  if (!raw) return { id: 'otros', label: 'General', distance: 'Otros' };
  const compact = raw.replace(/\s+/g, ' ').trim();
  const m = compact.match(/^(\d+K)\s+(.*)$/i);
  const distance = m ? m[1].toUpperCase() : 'Otros';
  const label = m ? m[2] : compact;
  return { id: distance.toLowerCase(), distance, label };
}

async function main() {
  console.log('1/6 Leyendo PDFs…');
  const results = await parseResults('FINAL X CATEGORIAS Y GENERO.pdf');
  const diplomas = await parseDiplomas('DIPLOMAS.pdf');
  const pageIndexByDorsal = new Map(diplomas.map((d, i) => [d.dorsal, i]));

  // Ciudades conocidas (para separar ciudad cuando el nombre se desbordó de columna)
  const cityCount = new Map();
  results.rows.forEach((r) => {
    if (r.city) cityCount.set(r.city, (cityCount.get(r.city) || 0) + 1);
  });
  const cities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  // Limpieza de filas de resultados + índice por dorsal
  const resByDorsal = new Map();
  results.rows.forEach((r) => {
    let name = r.name;
    let city = r.city;
    if (!city) {
      const found = cities.find((c) => norm(name).endsWith(' ' + norm(c)));
      if (found) {
        city = name.slice(name.length - found.length).trim();
        name = name.slice(0, name.length - found.length).trim();
      }
    }
    resByDorsal.set(r.chip, { ...r, name, city: city || '' });
  });

  console.log('2/6 Cruzando resultados con diplomas (por dorsal)…');
  const catMap = new Map();
  const athletes = diplomas.map((d) => {
    const r = resByDorsal.get(d.dorsal) || null;
    const cat = fmtCat(d.category || (r && r.category));
    if (!catMap.has(cat.id)) catMap.set(cat.id, { id: cat.id, distance: cat.distance, label: cat.label });
    const pg = parsePos(d.posGender);
    const pc = parsePos(d.posCategory);
    const pgl = parsePos(d.posGlobal);
    const base = 'd-' + String(d.dorsal).padStart(4, '0');
    const speedRaw = r ? r.speed : '';
    const speed = /^[\d.,]+\s*km\/h$/i.test(speedRaw) ? speedRaw : '';
    return {
      id: d.dorsal,
      dorsal: d.dorsal,
      name: d.name,
      nameAlt: r && norm(r.name) !== d.nkey ? r.name : '',
      city: r ? r.city : '',
      gender: r ? r.gender : '',
      category: cat.id,
      catLabel: cat.label,
      distance: cat.distance,
      time: d.time || (r ? r.time : ''),
      pace: r ? r.pace : '',
      speed,
      diff: r ? r.diff : '',
      pos: r ? r.pos : null,
      posGender: pg.pos,
      totalGender: pg.total,
      posCategory: pc.pos,
      totalCategory: pc.total,
      posGlobal: pgl.pos,
      totalGlobal: pgl.total,
      hasResult: !!r,
      // El PDF individual se genera en el navegador desde este documento y esta página
      diplomaPdf: 'assets/diplomas-oficiales.pdf',
      diplomaPage: pageIndexByDorsal.get(d.dorsal) + 1,
      diplomaImg: 'diplomas/img/' + base + '.webp',
    };
  });

  // Filas de resultados sin diploma (se muestran igual)
  const dipDorsales = new Set(diplomas.map((d) => d.dorsal));
  const orphans = results.rows.filter((r) => !dipDorsales.has(r.chip));
  orphans.forEach((r) => {
    const cat = fmtCat(r.category);
    if (!catMap.has(cat.id)) catMap.set(cat.id, { id: cat.id, distance: cat.distance, label: cat.label });
    athletes.push({
      id: r.chip, dorsal: r.chip, name: r.name, nameAlt: '', city: r.city,
      gender: r.gender, category: cat.id, catLabel: cat.label, distance: cat.distance,
      time: r.time, pace: r.pace, speed: r.speed, diff: r.diff, pos: r.pos,
      posGender: null, totalGender: null, posCategory: null, totalCategory: null,
      posGlobal: null, totalGlobal: null, hasResult: true, diplomaPdf: '', diplomaImg: '',
    });
  });

  const categories = [...catMap.values()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a.distance.toUpperCase());
    const ib = CAT_ORDER.indexOf(b.distance.toUpperCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // Orden por defecto: distancia, posición
  athletes.sort((a, b) => {
    const ca = categories.findIndex((c) => c.id === a.category);
    const cb = categories.findIndex((c) => c.id === b.category);
    return ca - cb || (a.pos || 9999) - (b.pos || 9999) || a.name.localeCompare(b.name, 'es');
  });

  console.log('3/6 Preparando carpetas…');
  fs.mkdirSync(DIP_DIR, { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });

  console.log('4/6 Copiando PDF de resultados…');
  fs.copyFileSync(path.join(SRC, 'FINAL X CATEGORIAS Y GENERO.pdf'), path.join(ASSETS, 'resultados-oficiales.pdf'));

  console.log('5/6 Copiando PDF de diplomas y generando imágenes…');
  fs.copyFileSync(path.join(SRC, 'DIPLOMAS.pdf'), path.join(ASSETS, 'diplomas-oficiales.pdf'));

  // Limpieza de PDF individuales de versiones anteriores (pesaban ~1,9 MB c/u)
  fs.readdirSync(DIP_DIR)
    .filter((f) => /^d-\d+\.pdf$/i.test(f))
    .forEach((f) => { try { fs.unlinkSync(path.join(DIP_DIR, f)); } catch (e) {} });

  const srcBytes = fs.readFileSync(path.join(SRC, 'DIPLOMAS.pdf'));
  const FORCE = !!process.env.FORCE_RENDER;

  // Solo se abre el renderizador si falta alguna imagen (o si se fuerza)
  const needRender = FORCE || athletes.some((a) => {
    if (!a.diplomaPdf) return false;
    return !fs.existsSync(path.join(IMG_DIR, 'd-' + String(a.dorsal).padStart(4, '0') + '.webp'));
  });
  const renderDoc = needRender
    ? await pdfjs.getDocument({ data: new Uint8Array(srcBytes), disableFontFace: true, useSystemFonts: false, canvasFactory }).promise
    : null;

  let done = 0;
  for (const a of athletes) {
    if (!a.diplomaPdf) continue;
    const pageIndex = pageIndexByDorsal.get(a.dorsal);
    if (pageIndex === undefined) continue;
    const base = 'd-' + String(a.dorsal).padStart(4, '0');
    const imgOut = path.join(IMG_DIR, base + '.webp');

    // Imagen para visualizar e imprimir en cualquier dispositivo (incluido móvil)
    if (FORCE || !fs.existsSync(imgOut)) {
      const page = await renderDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: IMG_SCALE });
      const canvas = napi.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      fs.writeFileSync(imgOut, canvas.toBuffer('image/webp', IMG_QUALITY));
      done++;
      if (done % 50 === 0) console.log('   ' + done + ' imágenes nuevas');
    }
  }

  console.log('6/6 Escribiendo datos (' + athletes.length + ' deportistas)…');
  const event = {
    name: 'La Carrera más Linda de Boyacá',
    edition: 'Edición Media Maratón 2026',
    city: 'Chiquinquirá, Boyacá',
    date: '2026-10-25',
    dateLabel: '25 de octubre de 2026',
    total: athletes.length,
    resultsPdf: 'assets/resultados-oficiales.pdf',
    categories,
  };
  const json = JSON.stringify({ event, athletes });
  fs.writeFileSync(path.join(APP, 'data.json'), json);
  fs.writeFileSync(path.join(APP, 'data.js'), 'window.EVENT_DATA = ' + json + ';\n');

  const sinResultado = athletes.filter((a) => !a.hasResult).length;
  const sinDiploma = athletes.filter((a) => !a.diplomaPdf).length;
  console.log('\nListo. Deportistas: ' + athletes.length +
    ' | sin resultado: ' + sinResultado + ' | sin diploma: ' + sinDiploma);
  console.log('Categorías: ' + categories.map((c) => c.distance + ' (' + c.id + ')').join(', '));
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
