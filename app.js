/* La Carrera más Linda · Resultados y diplomas 2026 */
(function () {
  'use strict';

  var DATA = window.EVENT_DATA || { event: {}, athletes: [] };
  var EVENT = DATA.event || {};
  var ATHLETES = (DATA.athletes || []).slice();

  var PAGE_SIZE = 60;
  var state = { q: '', cat: 'all', gender: 'all', sort: 'pos', shown: PAGE_SIZE };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function timeToSeconds(t) {
    var m = String(t || '').match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : Infinity;
  }
  function fmtPos(pos, total) {
    if (!pos) return '—';
    return total ? pos + '° de ' + total : pos + '°';
  }

  ATHLETES.forEach(function (a) {
    a._search = norm([a.name, a.nameAlt, a.dorsal, a.city, a.catLabel, a.distance].join(' '));
    a._pos = a.posGlobal || a.pos || null;
  });

  var rowsHost = $('#rows');
  var emptyState = $('#emptyState');
  var countEl = $('#count');
  var loadMoreBtn = $('#loadMore');

  /* ---------- Resumen del hero ---------- */
  (function renderStats() {
    var host = $('#heroStats');
    if (!host) return;
    var nf = new Intl.NumberFormat('es-CO');
    var chips = [
      { value: nf.format(ATHLETES.length), label: 'deportistas' },
      { value: nf.format(ATHLETES.filter(function (a) { return a.hasResult; }).length), label: 'con resultado' },
      { value: nf.format(ATHLETES.filter(function (a) { return !!a.diplomaPdf; }).length), label: 'diplomas' }
    ];
    (EVENT.categories || []).forEach(function (c) {
      var n = ATHLETES.filter(function (a) { return a.category === c.id; }).length;
      if (n) chips.push({ value: nf.format(n), label: c.distance });
    });
    chips.forEach(function (c) {
      var chip = el('span', 'stat-chip');
      chip.appendChild(el('strong', null, c.value));
      chip.appendChild(document.createTextNode(' ' + c.label));
      host.appendChild(chip);
    });
  })();

  /* ---------- Filtros ---------- */
  function renderCategoryPills() {
    var host = $('#catPills');
    host.innerHTML = '';
    var nf = new Intl.NumberFormat('es-CO');
    var items = [{ id: 'all', distance: 'Todas', label: 'Todas las distancias' }]
      .concat(EVENT.categories || []);
    items.forEach(function (c) {
      var n = c.id === 'all' ? ATHLETES.length : ATHLETES.filter(function (a) { return a.category === c.id; }).length;
      var b = el('button', 'pill');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.cat === c.id));
      b.title = c.label || c.distance;
      b.textContent = c.distance + ' · ' + nf.format(n);
      b.addEventListener('click', function () {
        state.cat = c.id;
        state.shown = PAGE_SIZE;
        renderCategoryPills();
        apply();
      });
      host.appendChild(b);
    });
  }

  function renderGenderSeg() {
    var host = $('#genderSeg');
    host.innerHTML = '';
    [['all', 'Todos'], ['Damas', 'Damas'], ['Caballeros', 'Caballeros']].forEach(function (g) {
      var b = el('button', 'seg', g[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.gender === g[0]));
      b.addEventListener('click', function () {
        state.gender = g[0];
        state.shown = PAGE_SIZE;
        renderGenderSeg();
        apply();
      });
      host.appendChild(b);
    });
  }

  /* ---------- Filtrado y orden ---------- */
  function getFiltered() {
    var q = norm(state.q);
    var list = ATHLETES.filter(function (a) {
      if (state.cat !== 'all' && a.category !== state.cat) return false;
      if (state.gender !== 'all' && a.gender !== state.gender) return false;
      if (q && a._search.indexOf(q) === -1) return false;
      return true;
    });

    var sorters = {
      pos: function (x, y) {
        return (x._pos || 99999) - (y._pos || 99999) || x.name.localeCompare(y.name, 'es');
      },
      time: function (x, y) {
        return timeToSeconds(x.time) - timeToSeconds(y.time) || x.name.localeCompare(y.name, 'es');
      },
      name: function (x, y) { return x.name.localeCompare(y.name, 'es'); },
      bib: function (x, y) { return Number(x.dorsal) - Number(y.dorsal); }
    };
    return list.sort(sorters[state.sort] || sorters.pos);
  }

  /* ---------- Fila ---------- */
  function medalClass(pos) {
    if (pos === 1) return 'medal gold';
    if (pos === 2) return 'medal silver';
    if (pos === 3) return 'medal bronze';
    return 'medal';
  }

  function buildRow(a) {
    var row = el('article', 'row');
    row.setAttribute('role', 'row');
    row.tabIndex = 0;
    row.dataset.id = a.id;
    row.setAttribute('aria-label', a.name + ', dorsal ' + a.dorsal + '. Ver diploma');

    var posCell = el('div', 'cell pos');
    posCell.setAttribute('role', 'cell');
    posCell.appendChild(el('span', a._pos ? medalClass(a._pos) : 'medal', a._pos ? String(a._pos) : '—'));

    var who = el('div', 'who');
    who.setAttribute('role', 'cell');
    who.appendChild(el('span', 'bib', '#' + a.dorsal));
    var whoText = el('div', 'who-text');
    whoText.appendChild(el('strong', null, a.name));
    var meta = el('span');
    var parts = [a.distance];
    if (a.gender) parts.push(a.gender);
    if (a.city) parts.push(a.city);
    meta.textContent = parts.join(' · ');
    whoText.appendChild(meta);
    who.appendChild(whoText);

    var time = el('div', 'cell time', a.time || '—');
    time.setAttribute('role', 'cell');
    var pace = el('div', 'cell pace', a.pace ? a.pace + ' /km' : '—');
    pace.setAttribute('role', 'cell');

    var actions = el('div', 'cell-actions');
    actions.setAttribute('role', 'cell');
    var btn = el('button', 'btn-mini');
    btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12h7M9 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    btn.appendChild(document.createTextNode(a.diplomaPdf ? 'Ver diploma' : 'Ver datos'));
    btn.addEventListener('click', function (e) { e.stopPropagation(); openModal(a, row); });
    actions.appendChild(btn);

    row.appendChild(posCell);
    row.appendChild(who);
    row.appendChild(time);
    row.appendChild(pace);
    row.appendChild(actions);

    row.addEventListener('click', function () { openModal(a, row); });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(a, row); }
    });
    return row;
  }

  function render() {
    var list = getFiltered();
    var slice = list.slice(0, state.shown);
    var frag = document.createDocumentFragment();
    slice.forEach(function (a) { frag.appendChild(buildRow(a)); });
    rowsHost.innerHTML = '';
    rowsHost.appendChild(frag);

    var nf = new Intl.NumberFormat('es-CO');
    countEl.textContent = '· ' + nf.format(list.length) + (list.length === 1 ? ' deportista' : ' deportistas');
    if (list.length > slice.length) countEl.textContent += ' (mostrando ' + nf.format(slice.length) + ')';
    emptyState.hidden = list.length !== 0;
    loadMoreBtn.hidden = list.length <= slice.length;
    loadMoreBtn.textContent = 'Cargar más resultados (' + nf.format(list.length - slice.length) + ')';
  }

  function apply() {
    state.q = $('#searchInput').value;
    render();
    syncUrl();
  }

  /* ---------- Modal ---------- */
  var modal = $('#modal');
  var modalImg = $('#diplomaImg');
  var previewLoading = $('#previewLoading');
  var previewMissing = $('#previewMissing');
  var btnDownload = $('#btnDownload');
  var btnPrint = $('#btnPrint');
  var lastFocus = null;
  var current = null;
  var currentFileName = '';
  var pdfBytesPromise = null;

  // ¿Podemos generar el PDF individual en el navegador? (requiere pdf-lib + fetch)
  function canGeneratePdf() {
    return !!(window.PDFLib && window.fetch &&
      (location.protocol === 'http:' || location.protocol === 'https:'));
  }

  function loadDiplomasPdf(src) {
    if (!pdfBytesPromise) {
      pdfBytesPromise = fetch(src, { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      });
      pdfBytesPromise.catch(function () { pdfBytesPromise = null; });
    }
    return pdfBytesPromise;
  }

  function setBusy(btn, busy) {
    var label = document.getElementById('btnDownloadLabel');
    if (busy) {
      if (label) label.textContent = 'Generando PDF…';
      btn.disabled = true;
      btn.classList.add('is-busy');
    } else {
      if (label) label.textContent = 'Descargar diploma';
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  }

  function generateDiplomaPdf(a) {
    if (!a.diplomaPdf || !a.diplomaPage) return false;
    setBusy(btnDownload, true);
    loadDiplomasPdf(a.diplomaPdf)
      .then(function (bytes) { return window.PDFLib.PDFDocument.load(bytes); })
      .then(function (src) {
        return window.PDFLib.PDFDocument.create().then(function (out) {
          return out.copyPages(src, [a.diplomaPage - 1]).then(function (pages) {
            out.addPage(pages[0]);
            return out.save();
          });
        });
      })
      .then(function (bytes) {
        var blob = new Blob([bytes], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = currentFileName || 'Diploma.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        setBusy(btnDownload, false);
      })
      .catch(function () {
        setBusy(btnDownload, false);
        // Sin servidor o sin red: se abre el PDF oficial en la página del deportista
        window.open(a.diplomaPdf + '#page=' + a.diplomaPage, '_blank');
      });
    return true;
  }

  function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  }

  function statItem(label, value, wide) {
    var box = el('div', wide ? 'wide' : null);
    box.appendChild(el('dt', null, label));
    box.appendChild(el('dd', null, value));
    return box;
  }

  function openModal(a, trigger) {
    current = a;
    lastFocus = trigger || document.activeElement;

    $('#modalName').textContent = a.name;
    var metaParts = [a.distance];
    if (a.catLabel) metaParts.push(a.catLabel);
    if (a.gender) metaParts.push(a.gender);
    $('#modalMeta').textContent = metaParts.join(' · ');
    $('#modalBib').hidden = !a.dorsal;
    $('#modalBib').querySelector('strong').textContent = a.dorsal || '';

    var stats = $('#modalStats');
    stats.innerHTML = '';
    stats.appendChild(statItem('Tiempo', a.time || '—'));
    stats.appendChild(statItem('Ritmo', a.pace ? a.pace + ' /km' : '—'));
    stats.appendChild(statItem('Velocidad', a.speed || '—', true));
    stats.appendChild(statItem('Pos. género', fmtPos(a.posGender, a.totalGender)));
    stats.appendChild(statItem('Pos. categoría', fmtPos(a.posCategory, a.totalCategory)));
    stats.appendChild(statItem('Pos. general', fmtPos(a.posGlobal, a.totalGlobal)));
    if (a.city) stats.appendChild(statItem('Ciudad', a.city, true));

    // Imagen del diploma
    previewLoading.hidden = false;
    modalImg.hidden = true;
    previewMissing.hidden = true;
    modalImg.onload = function () {
      previewLoading.hidden = true;
      modalImg.hidden = false;
    };
    modalImg.onerror = function () {
      previewLoading.hidden = true;
      previewMissing.hidden = false;
    };
    if (a.diplomaImg) {
      modalImg.src = a.diplomaImg;
      modalImg.alt = 'Diploma de participación de ' + a.name;
    } else {
      previewLoading.hidden = true;
      previewMissing.hidden = false;
      modalImg.removeAttribute('src');
    }

    // Acciones
    if (a.diplomaPdf) {
      currentFileName = 'Diploma - ' + safeFileName(a.name) + ' - La Carrera mas Linda 2026.pdf';
      var canGen = canGeneratePdf();
      btnDownload.hidden = false;
      btnPrint.hidden = false;
      setBusy(btnDownload, false);
      if (canGen) {
        // El PDF individual se genera en el navegador (1 página, calidad original)
        btnDownload.setAttribute('href', a.diplomaPdf + '#page=' + a.diplomaPage);
        btnDownload.setAttribute('download', currentFileName);
        btnDownload.removeAttribute('target');
        $('#modalNote').textContent = 'El PDF de tu diploma (1 página, calidad original) se genera al instante. También puedes imprimirlo en tamaño horizontal.';
      } else {
        // Sin servidor (archivo abierto con doble clic): se abre el PDF oficial en tu página
        btnDownload.setAttribute('href', a.diplomaPdf + '#page=' + a.diplomaPage);
        btnDownload.removeAttribute('download');
        btnDownload.setAttribute('target', '_blank');
        btnDownload.setAttribute('rel', 'noopener');
        $('#modalNote').textContent = 'Se abrirá el PDF oficial en la página de tu diploma: desde el visor puedes descargarlo o imprimirlo.';
      }
    } else {
      btnDownload.hidden = true;
      btnPrint.hidden = true;
    }

    modal.hidden = false;
    document.body.classList.add('no-scroll');
    setUrlDorsal(a.dorsal);
    window.setTimeout(function () { $('#modalClose').focus(); }, 60);
  }

  function setUrlDorsal(dorsal) {
    if (!history.replaceState) return;
    try {
      var p = new URLSearchParams(location.search);
      if (dorsal) p.set('dorsal', dorsal); else p.delete('dorsal');
      var qs = p.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    } catch (e) { /* file:// en algunos navegadores */ }
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    current = null;
    setUrlDorsal(null);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', closeModal);
  });

  btnPrint.addEventListener('click', function () {
    if (!current || !current.diplomaPdf) return;
    var win = window.open('print.html?dorsal=' + encodeURIComponent(current.dorsal), '_blank');
    if (!win) window.location.href = 'print.html?dorsal=' + encodeURIComponent(current.dorsal);
  });

  btnDownload.addEventListener('click', function (e) {
    if (!current || !current.diplomaPdf) { e.preventDefault(); return; }
    if (!canGeneratePdf()) return; // se abre el PDF oficial en la página del deportista
    e.preventDefault();
    generateDiplomaPdf(current);
  });

  /* ---------- Compartir y QR ---------- */
  var shareModal = $('#shareModal');
  var shareTarget = null;
  var shareLastFocus = null;

  function siteBase() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return location.origin + location.pathname.replace(/[^/]*$/, '');
    }
    return 'https://la-carrera-mas-linda.vercel.app/';
  }

  function shareUrl(a) {
    var base = siteBase();
    if (!a) {
      try {
        var u = new URL(base);
        u.search = ''; u.hash = '';
        return u.toString();
      } catch (e) { return base; }
    }
    return base + '?dorsal=' + encodeURIComponent(a.dorsal);
  }

  function shareMessage(a) {
    if (!a) {
      return 'Resultados y diplomas oficiales de La Carrera más Linda de Boyacá 2026 🏃‍♀️🏅 Consulta tu resultado y descarga tu diploma aquí: ' + shareUrl(null);
    }
    return 'Diploma de ' + a.name + ' — La Carrera más Linda de Boyacá 2026 🏅 Míralo, descárgalo e imprímelo aquí: ' + shareUrl(a);
  }

  function waLink(a) {
    return 'https://wa.me/?text=' + encodeURIComponent(shareMessage(a));
  }

  function buildQrSvg(text) {
    if (!window.qrcode) return '';
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 3 });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = el('div', 'toast');
      t.id = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  function openShare(a, trigger) {
    shareTarget = a || null;
    shareLastFocus = trigger || document.activeElement;

    $('#shareTitle').textContent = a ? 'Comparte este diploma' : 'Comparte la app';
    $('#shareSubtitle').textContent = a
      ? a.name + ' · ' + a.distance + (a.catLabel ? ' · ' + a.catLabel : '')
      : (EVENT.name || 'La Carrera más Linda') + ' · ' + (EVENT.dateLabel || '2026');

    var url = shareUrl(a);
    $('#qrUrl').textContent = url;
    $('#qrBox').innerHTML = buildQrSvg(url);
    $('#shareWa').setAttribute('href', waLink(a));

    shareModal.hidden = false;
    document.body.classList.add('no-scroll');
    window.setTimeout(function () { $('#shareClose').focus(); }, 60);
  }

  function closeShare() {
    if (shareModal.hidden) return;
    shareModal.hidden = true;
    if (modal.hidden) document.body.classList.remove('no-scroll');
    if (shareLastFocus && shareLastFocus.focus) shareLastFocus.focus();
  }

  Array.prototype.forEach.call(shareModal.querySelectorAll('[data-share-close]'), function (b) {
    b.addEventListener('click', closeShare);
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  $('#copyLink').addEventListener('click', function () {
    copyText(shareUrl(shareTarget)).then(function () {
      toast('Enlace copiado');
    }).catch(function () {
      toast('No se pudo copiar; selecciona el enlace manualmente');
    });
  });
  function qrFileName() {
    return 'QR - La Carrera mas Linda 2026' + (shareTarget ? ' - ' + safeFileName(shareTarget.name) : '') + '.png';
  }

  $('#downloadQr').addEventListener('click', function () {
    var svgEl = $('#qrBox').querySelector('svg');
    if (!svgEl) { toast('QR no disponible'); return; }
    var clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    var img = new Image();
    img.onload = function () {
      var size = 1024;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      var pad = Math.round(size * 0.05);
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
      var link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = qrFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('QR descargado');
    };
    img.onerror = function () { toast('No se pudo generar el QR'); };
    img.src = src;
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  $('#printQr').addEventListener('click', function () {
    var svg = $('#qrBox').innerHTML;
    if (!svg) { toast('QR no disponible'); return; }
    var url = $('#qrUrl').textContent;
    var title = shareTarget ? 'Diploma de ' + shareTarget.name : 'La Carrera más Linda de Boyacá 2026';
    var w = window.open('', '_blank');
    if (!w) { toast('Permite las ventanas emergentes para imprimir'); return; }
    w.document.write(
      '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>QR</title>' +
      '<style>@page{size:A4 portrait;margin:18mm}body{font-family:"Segoe UI",system-ui,Arial,sans-serif;text-align:center;color:#2b1026;margin:0}' +
      'h1{color:#6d0b46;font-size:19pt;margin:0 0 3mm}p{margin:2mm 0;font-size:11pt}.qr{width:115mm;margin:8mm auto}.qr svg{width:100%;height:auto}' +
      'p.url{font-weight:700;font-size:12pt}p.small{color:#6b4a63;font-size:10pt}</style></head><body>' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p>Resultados y diplomas · Media Maratón 2026</p>' +
      '<div class="qr">' + svg + '</div>' +
      '<p class="url">' + escapeHtml(url) + '</p>' +
      '<p class="small">Escanea el código con la cámara de tu celular.</p>' +
      '</body></html>'
    );
    w.document.close();
    w.focus();
    window.setTimeout(function () { try { w.print(); } catch (e) {} }, 500);
  });

  $('#openQr').addEventListener('click', function () { openShare(null, this); });
  $('#btnShare').addEventListener('click', function () { openShare(current, this); });
  $('#shareWaTop').setAttribute('href', waLink(null));



  function trapFocus(container, e) {
    var nodes = container.querySelectorAll('a[href], button:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])');
    var list = Array.prototype.filter.call(nodes, function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', function (e) {
    if (!shareModal.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeShare(); return; }
      if (e.key === 'Tab') trapFocus(shareModal, e);
      return;
    }
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') trapFocus(modal, e);
  });

  /* ---------- Eventos generales ---------- */
  var searchTimer = null;
  $('#searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    state.shown = PAGE_SIZE;
    apply();
    $('#searchInput').blur();
  });
  $('#searchInput').addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () { state.shown = PAGE_SIZE; apply(); }, 220);
  });
  $('#sortSelect').addEventListener('change', function (e) {
    state.sort = e.target.value;
    state.shown = PAGE_SIZE;
    apply();
  });
  $('#clearFilters').addEventListener('click', function () {
    state.q = ''; state.cat = 'all'; state.gender = 'all'; state.shown = PAGE_SIZE;
    $('#searchInput').value = '';
    renderCategoryPills(); renderGenderSeg(); apply();
    $('#searchInput').focus();
  });
  loadMoreBtn.addEventListener('click', function () {
    state.shown += PAGE_SIZE;
    render();
  });

  /* ---------- Enlaces compartibles ---------- */
  function syncUrl() {
    if (!history.replaceState) return;
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.gender !== 'all') p.set('gen', state.gender);
    if (state.sort !== 'pos') p.set('sort', state.sort);
    if (current) p.set('dorsal', current.dorsal);
    var qs = p.toString();
    try {
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    } catch (e) { /* file:// en algunos navegadores */ }
  }

  function initFromUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) { state.q = p.get('q'); $('#searchInput').value = state.q; }
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('gen')) state.gender = p.get('gen');
    if (p.get('sort')) { state.sort = p.get('sort'); $('#sortSelect').value = state.sort; }
    renderCategoryPills();
    renderGenderSeg();
    render();
    var dorsal = p.get('dorsal');
    if (dorsal) {
      var a = ATHLETES.filter(function (x) { return String(x.dorsal) === String(dorsal); })[0];
      if (a) window.setTimeout(function () { openModal(a, null); }, 120);
    }
  }

  initFromUrl();
})();

