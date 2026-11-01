// Extracción de datos de ambos PDF del evento
const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const SRC = path.resolve(__dirname, '..', '..');

async function loadPdf(file) {
  const data = new Uint8Array(fs.readFileSync(path.join(SRC, file)));
  return pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: false }).promise;
}

function norm(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Agrupa items de texto en líneas (tolerancia vertical)
function toLines(items, tol = 2.5) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < tol);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({
      x: it.transform[4],
      y,
      size: Math.hypot(it.transform[0], it.transform[1]),
      str: it.str,
    });
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

async function parseResults(file) {
  const doc = await loadPdf(file);
  const out = [];
  let category = null;
  let gender = null;
  const categorySet = new Set();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = toLines(tc.items);

    for (const line of lines) {
      const text = line.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      const hasTime = line.items.some((i) => /^\d{1,2}:\d{2}:\d{2}$/.test(i.str.trim()));
      const hasPos = line.items.some((i) => /^\d+\.$/.test(i.str.trim()));

      if (!hasTime && !hasPos && /^\d+K\b/i.test(text) && text.length < 70) {
        category = text;
        categorySet.add(text);
        continue;
      }
      if (/^damas\b/i.test(text) && text.length < 20) { gender = 'Damas'; continue; }
      if (/^(caballeros|hombres)\b/i.test(text) && text.length < 20) { gender = 'Caballeros'; continue; }
      if (/^mixta\b/i.test(text) && text.length < 20) { gender = 'Mixta'; continue; }
      if (!hasTime || !hasPos) continue;

      const posItem = line.items.find((i) => /^\d+\.$/.test(i.str.trim()));
      const chipItem = line.items.find((i) => i.x > posItem.x && i.x < 90 && /^\d{2,6}$/.test(i.str.trim()));
      const timeItem = line.items.find((i) => /^\d{1,2}:\d{2}:\d{2}$/.test(i.str.trim()));
      if (!chipItem || !timeItem) continue;

      const nameParts = line.items.filter((i) => i.x >= 90 && i.x < 250);
      const cityParts = line.items.filter((i) => i.x >= 250 && i.x < 365);
      const diffParts = line.items.filter((i) => i.x >= 400 && i.x < 445);
      const speedParts = line.items.filter((i) => i.x >= 445 && i.x < 505);
      const paceParts = line.items.filter((i) => i.x >= 505);

      const name = nameParts.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const pace = (paceParts.map((i) => i.str).join(' ').match(/\d{1,2}:\d{2},\d{2}/) || [''])[0];

      out.push({
        page: p,
        category,
        gender,
        pos: Number(posItem.str.replace('.', '')),
        chip: chipItem.str.trim(),
        name,
        city: cityParts.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim(),
        time: timeItem.str.trim(),
        diff: diffParts.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim(),
        speed: speedParts.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim(),
        pace,
        nkey: norm(name),
      });
    }
  }
  return { rows: out, categories: [...categorySet] };
}

async function parseDiplomas(file) {
  const doc = await loadPdf(file);
  const out = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // La capa de texto está duplicada: deduplico por contenido + posición redondeada
    const seen = new Set();
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = Math.round(it.transform[4]);
      const y = Math.round(it.transform[5]);
      const key = x + '|' + y + '|' + it.str;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ x: it.transform[4], y: it.transform[5], size: Math.hypot(it.transform[0], it.transform[1]), str: it.str.trim() });
    }

    const inBand = (y0, y1, sizeMin = 0) => items.filter((i) => i.y >= y0 && i.y <= y1 && i.size >= sizeMin);

    // Nombre: texto grande (28pt) en la banda central; excluye "DORSAL No." (20pt)
    const name = inBand(320, 420, 24)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();

    // Dorsal: número junto a la etiqueta "DORSAL No."
    const dorsalLabel = items.find((i) => /dorsal/i.test(i.str));
    let dorsal = '';
    if (dorsalLabel) {
      const cand = items
        .filter((i) => /^\d+$/.test(i.str) && Math.abs(i.y - dorsalLabel.y) < 6 && i.x > dorsalLabel.x)
        .sort((a, b) => a.x - b.x)[0];
      if (cand) dorsal = cand.str;
    }

    // Categoría: texto grande sobre la etiqueta "DE LA CATEGORIA"
    const catLabel = items.find((i) => /de la categoria/i.test(i.str));
    let category = '';
    if (catLabel) {
      const cand = items
        .filter((i) => i.y < catLabel.y && i.y > catLabel.y - 50 && i.size >= 20 && !/^\d+\.\s*\//.test(i.str))
        .sort((a, b) => b.y - a.y)[0];
      if (cand) category = cand.str;
    }

    // Posiciones: valores grandes, asignados a la etiqueta más cercana en X
    const labels = items.filter((i) => /^posicion/i.test(i.str));
    const posValues = items.filter((i) => i.size >= 20 && /^\d+\.\s*\/\s*\d+$/.test(i.str));
    const pos = { gender: null, category: null, global: null };
    for (const v of posValues) {
      let best = null;
      for (const l of labels) {
        const d = Math.abs(v.x - l.x);
        if (!best || d < best.d) best = { l, d };
      }
      if (!best) continue;
      const key = /genero/i.test(best.l.str) ? 'gender'
        : /global/i.test(best.l.str) ? 'global'
        : /categoria/i.test(best.l.str) ? 'category' : null;
      if (key && !pos[key]) pos[key] = v.str;
    }

    // Tiempo: bajo la etiqueta "TIEMPO"
    const timeLabel = items.find((i) => /^tiempo/i.test(i.str));
    const timeItem = items
      .filter((i) => /^\d{1,2}:\d{2}:\d{2}$/.test(i.str) && (!timeLabel || i.y < timeLabel.y))
      .sort((a, b) => b.y - a.y)[0];

    out.push({
      page: p,
      name,
      nkey: norm(name),
      dorsal,
      category,
      posGender: pos.gender,
      posCategory: pos.category,
      posGlobal: pos.global,
      time: timeItem ? timeItem.str : '',
    });
  }
  return out;
}

module.exports = { parseResults, parseDiplomas, norm, loadPdf, toLines, SRC };

if (require.main === module) {
  (async () => {
    const res = await parseResults('FINAL X CATEGORIAS Y GENERO.pdf');
    console.log('RESULTADOS: ' + res.rows.length + ' filas');
    console.log('Categorías (' + res.categories.length + '):');
    res.categories.forEach((c) => console.log('  - ' + c));
    const genders = {};
    const cats = {};
    res.rows.forEach((r) => {
      genders[r.gender] = (genders[r.gender] || 0) + 1;
      cats[r.category] = (cats[r.category] || 0) + 1;
    });
    console.log('Por género:', genders);
    console.log('Por categoría:', cats);
    console.log('Muestra fila:', JSON.stringify(res.rows[0], null, 1));

    const dip = await parseDiplomas('DIPLOMAS.pdf');
    console.log('\nDIPLOMAS: ' + dip.length + ' páginas');
    console.log('Dorsales únicos:', new Set(dip.map((d) => d.dorsal)).size, '| dorsales vacíos:', dip.filter((d) => !d.dorsal).length);
    console.log('Nombres vacíos:', dip.filter((d) => !d.name).length);
    console.log('Categorías diploma:', [...new Set(dip.map((d) => d.category))]);
    console.log('Sin tiempo:', dip.filter((d) => !d.time).length,
      '| sin posiciones:', dip.filter((d) => !d.posGender || !d.posCategory || !d.posGlobal).length);
    console.log('Muestra diploma:', JSON.stringify(dip[0], null, 1));

    // Cruce por nombre
    const resByKey = new Map();
    res.rows.forEach((r) => { if (!resByKey.has(r.nkey)) resByKey.set(r.nkey, []); resByKey.get(r.nkey).push(r); });
    const unmatched = dip.filter((d) => !resByKey.has(d.nkey));
    console.log('\nDiplomas sin fila de resultado por nombre:', unmatched.length);
    unmatched.slice(0, 15).forEach((d) => console.log('  ?', d.dorsal, '|', d.name, '|', d.category));
    const dipKeys = new Set(dip.map((d) => d.nkey));
    const resNoDip = res.rows.filter((r) => !dipKeys.has(r.nkey));
    console.log('Filas de resultado sin diploma:', resNoDip.length);
    resNoDip.slice(0, 15).forEach((r) => console.log('  ?', r.chip, '|', r.name, '|', r.category));
  })().catch((e) => { console.error('ERROR:', e); process.exit(1); });
}
