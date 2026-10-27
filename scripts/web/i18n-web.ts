// Sustituye a src/i18n en docs/vivo.js. Los paneles «Pruébalo» de la web llevan sus propios textos
// (web/teoria/textos.ts) y no enseñan los mensajes del motor, así que no hace falta el diccionario
// de la app, que pesaría decenas de KB. Cualquier texto que se pida sale vacío, salvo los de REALES,
// en el idioma de la página.
type Idioma = 'es' | 'en' | 'de';

const lang = (typeof document !== 'undefined' ? document.documentElement.lang : 'es') as Idioma;
const de = <V>(v: Record<Idioma, V>): V => v[lang] ?? v.es;

const REALES: Record<string, unknown> = {
  locale: de({ es: 'es-ES', en: 'en-GB', de: 'de-DE' }),
  kopEd: { esquema: de({ es: 'Esquema de contactos del segmento', en: 'Ladder diagram of the network', de: 'Kontaktplan des Netzwerks' }) },
};

/** Texto vacío que se puede leer, llamar o meter en una plantilla sin romper nada */
const vacio: unknown = new Proxy(() => '', {
  get: (_t, k) => (k === Symbol.toPrimitive || k === 'toString' || k === 'valueOf' ? () => '' : vacio),
  apply: () => '',
});

const capa = (o: Record<string, unknown>): unknown => new Proxy(o, {
  get: (t, k) => {
    if (typeof k !== 'string' || !(k in t)) return vacio;
    const v = t[k];
    return v && typeof v === 'object' ? capa(v as Record<string, unknown>) : v;
  },
});

export const T: any = capa(REALES);
export const idioma: Idioma = lang;
export const IDIOMAS: { id: Idioma; nombre: string }[] = [];
export const puente = null;
export const CLAVE_IDIOMA_WEB = 'automatizacion-idioma';
export const textosDe = () => T;
export const ponerIdioma = () => {};
