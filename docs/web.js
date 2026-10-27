// Web de Automatizacion: descargas de la última release, capturas, demo KOP/AWL y tema.
// La misma para las tres portadas (docs/index.html, docs/en/ y docs/de/): los textos salen del idioma de la página
// (<html lang>) y las rutas, de data-raiz (la portada en español está en la raíz; las otras, una carpeta más abajo).

const REPO = 'Nicarayzon/plc-ladder-stl-simulator';
const API_ULTIMA = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE_CLAVE = 'automatizacion-web-release';
const CACHE_MS = 15 * 60 * 1000;

// Cómo reconocer cada fichero de la release (los nombres llevan la versión)
const FICHEROS = {
  'mac-dmg': /arm64\.dmg$/i,
  'win-exe': /setup.*\.exe$/i,
  'win-zip': /win\.zip$/i,
};

const RAIZ = document.documentElement.dataset.raiz || '';

const TEXTOS = {
  es: {
    locale: 'es-ES',
    sinApi: 'Los botones llevan a la página de la última versión en GitHub.',
    version: (v, f) => `Versión ${v} · publicada el ${f}`,
    disponible: (v) => `Versión ${v} disponible`,
    faltaCaptura: 'Falta la captura',
    encendida: (op) => `${op} encendida`,
    apagada: (op) => `${op} apagada`,
    copiar: 'Copiar', copiado: 'Copiado', copiaMano: 'Cópialo a mano',
  },
  en: {
    locale: 'en-US',
    sinApi: 'The buttons take you to the page of the latest version on GitHub.',
    version: (v, f) => `Version ${v} · released on ${f}`,
    disponible: (v) => `Version ${v} available`,
    faltaCaptura: 'Screenshot missing',
    encendida: (op) => `${op} on`,
    apagada: (op) => `${op} off`,
    copiar: 'Copy', copiado: 'Copied', copiaMano: 'Copy it by hand',
  },
  de: {
    locale: 'de-DE',
    sinApi: 'Die Schaltflächen führen zur Seite der neuesten Version auf GitHub.',
    version: (v, f) => `Version ${v} · veröffentlicht am ${f}`,
    disponible: (v) => `Version ${v} verfügbar`,
    faltaCaptura: 'Bildschirmfoto fehlt',
    encendida: (op) => `${op} an`,
    apagada: (op) => `${op} aus`,
    copiar: 'Kopieren', copiado: 'Kopiert', copiaMano: 'Bitte von Hand kopieren',
  },
};
const T = TEXTOS[document.documentElement.lang] || TEXTOS.es;

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function sistema() {
  const ua = navigator.userAgent;
  const plataforma = navigator.userAgentData?.platform || navigator.platform || ua;
  if (/iphone|ipad|android/i.test(ua) || (/mac/i.test(plataforma) && navigator.maxTouchPoints > 1)) return null;
  if (/mac/i.test(plataforma)) return 'mac';
  // Linux usa la versión de Windows con Wine
  if (/win|linux|x11/i.test(plataforma)) return 'win';
  return null;
}

const mb = (bytes) => `${Math.round(bytes / 1048576).toLocaleString(T.locale)}\u00a0MB`;
const fecha = (iso) => new Date(iso).toLocaleDateString(T.locale, { day: 'numeric', month: 'long', year: 'numeric' });

async function ultimaRelease() {
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CACHE_CLAVE));
    if (guardada && Date.now() - guardada.t < CACHE_MS) return guardada.datos;
  } catch (e) { /* sin almacenamiento: se pide a GitHub */ }
  const r = await fetch(API_ULTIMA, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
  const datos = await r.json();
  try { sessionStorage.setItem(CACHE_CLAVE, JSON.stringify({ t: Date.now(), datos })); } catch (e) { /* da igual */ }
  return datos;
}

async function prepararDescargas() {
  const so = sistema();
  if (so) $(`.descarga[data-so="${so}"]`)?.classList.add('recomendado');

  let rel;
  try {
    rel = await ultimaRelease();
  } catch (e) {
    // Sin API (límite de peticiones, sin conexión…): los botones ya llevan a la página de la última release
    $('[data-rel="version"]').textContent = T.sinApi;
    return;
  }

  for (const [clave, patron] of Object.entries(FICHEROS)) {
    const fichero = rel.assets.find((a) => patron.test(a.name));
    if (!fichero) continue;
    for (const a of $$(`[data-fichero="${clave}"]`)) {
      a.href = fichero.browser_download_url;
      a.title = fichero.name;
      const tam = $('[data-tam]', a);
      if (tam) tam.textContent = mb(fichero.size);
    }
  }

  const version = rel.tag_name.replace(/^v/i, '');
  $('[data-rel="version"]').textContent = T.version(version, fecha(rel.published_at));
  $('[data-rel="pildora-texto"]').textContent = T.disponible(version);
  $('[data-rel="notas"]').href = rel.html_url;
}

// ───────── Capturas: images/<nombre>.png (o .jpg, .jpeg, .webp) ─────────

const EXTENSIONES = ['png', 'jpg', 'jpeg', 'webp'];

function prepararCapturas() {
  for (const fig of $$('[data-captura]')) {
    const marco = $('.captura-marco', fig);
    const img = $('img', fig);
    // Las capturas son de pantalla Retina: a la mitad de sus píxeles se ven a tamaño real.
    // Hasta que carga, vale el ancho del atributo width.
    if (img.getAttribute('width')) marco.style.width = `${img.getAttribute('width')}px`;
    let i = 0;
    const siguiente = () => {
      if (i < EXTENSIONES.length) { img.src = `${RAIZ}images/${fig.dataset.captura}.${EXTENSIONES[i++]}`; return; }
      const aviso = document.createElement('div');
      aviso.className = 'captura-vacia';
      aviso.innerHTML = `<b>${T.faltaCaptura}</b><code>images/${fig.dataset.captura}.png</code>`;
      marco.append(aviso);
      marco.style.width = '';
      fig.classList.add('sin-imagen');
    };
    img.addEventListener('load', () => {
      marco.style.width = `${img.naturalWidth / 2}px`;
      fig.classList.add('con-imagen');
    });
    img.addEventListener('error', siguiente);
    siguiente();
  }

  const visor = $('#visor');
  const imgVisor = $('img', visor);
  document.addEventListener('click', (ev) => {
    const fig = ev.target.closest('.captura.con-imagen');
    if (!fig) return;
    const img = $('img', fig);
    imgVisor.src = img.currentSrc || img.src;
    imgVisor.alt = img.alt;
    visor.showModal();
  });
  visor.addEventListener('click', () => visor.close());
}

// ───────── Demo: U E 124.0 / UN E 124.1 / = A 124.0 ─────────

function prepararDemo() {
  const demo = $('#demo');
  if (!demo) return;
  const entradas = [false, false];
  const fijas = [false, false]; // posición de la palanca; Mayús + tecla la pisa mientras se mantiene

  const pintar = () => {
    const [e0, e1] = entradas;
    const rlo1 = e0;
    const rlo2 = e0 && !e1;
    // corriente tras cada elemento del segmento: barra, contacto NA, contacto NC
    const corriente = [true, rlo1, rlo2];
    for (const el of $$('[data-p]', demo)) el.classList.toggle('on', corriente[el.dataset.p]);

    const valores = { rlo1, sta1: e0, rlo2, sta2: e1, rlo3: rlo2, sta3: rlo2 };
    for (const [k, v] of Object.entries(valores)) {
      const td = $(`[data-v="${k}"]`, demo);
      td.textContent = v ? '1' : '0';
      td.classList.toggle('uno', v);
    }
    $$('.palanca', demo).forEach((b, i) => b.setAttribute('aria-checked', String(entradas[i])));
    $('#piloto').classList.toggle('on', rlo2);
    // el nombre de la salida, como lo rotula la página (A 124.0 o Q 124.0)
    const salida = $('.salida .palanca-etiqueta', demo).textContent.trim();
    $('#piloto-estado').textContent = rlo2 ? T.encendida(salida) : T.apagada(salida);
  };

  $$('.palanca', demo).forEach((b, i) => {
    b.addEventListener('click', () => { fijas[i] = !fijas[i]; entradas[i] = fijas[i]; pintar(); });
  });

  // Teclas 1 y 2 como en la app; con Mayús, pulsador NA mientras se mantiene
  const tecla = (ev) => ({ Digit1: 0, Digit2: 1 })[ev.code];
  document.addEventListener('keydown', (ev) => {
    const i = tecla(ev);
    if (i === undefined || ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.shiftKey) entradas[i] = true;
    else { fijas[i] = !fijas[i]; entradas[i] = fijas[i]; }
    pintar();
  });
  document.addEventListener('keyup', (ev) => {
    const i = tecla(ev);
    if (i === undefined) return;
    entradas[i] = fijas[i];
    pintar();
  });

  pintar();
}

// ───────── Tema y botón «Copiar» ─────────

function prepararTema() {
  $('#cambiar-tema').addEventListener('click', () => {
    const raiz = document.documentElement;
    const oscuro = raiz.dataset.theme ? raiz.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('automatizacion-web-tema', raiz.dataset.theme); } catch (e) { /* da igual */ }
  });
}

function prepararCopiar() {
  for (const b of $$('[data-copiar]')) {
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(document.getElementById(b.dataset.copiar).textContent);
        b.textContent = T.copiado;
      } catch (e) {
        b.textContent = T.copiaMano;
      }
      setTimeout(() => { b.textContent = T.copiar; }, 1800);
    });
  }
}

prepararCapturas();
prepararDemo();
prepararTema();
prepararCopiar();
prepararDescargas();
