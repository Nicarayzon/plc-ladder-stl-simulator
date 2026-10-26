// Lectura de la referencia y de los ejemplos en Markdown: secciones por número y ejemplos por código.

export interface Bloque {
  titulo: string;
  cuerpo: string;
}

/** Líneas del documento con la marca de si están dentro de un bloque de código ``` */
function lineas(md: string): { texto: string; enCodigo: boolean }[] {
  let dentro = false;
  return md.split('\n').map((texto) => {
    const valla = /^\s*```/.test(texto);
    const enCodigo = dentro || valla;
    if (valla) dentro = !dentro;
    return { texto, enCodigo };
  });
}

/** Desde la cabecera que cumple `cabecera` hasta la siguiente cabecera o la siguiente línea «---» */
function extraer(md: string, cabecera: RegExp, que: string): Bloque {
  const ls = lineas(md);
  const i = ls.findIndex((l) => !l.enCodigo && cabecera.test(l.texto));
  if (i < 0) throw new Error(`No encuentro ${que}`);
  let j = i + 1;
  while (j < ls.length && (ls[j].enCodigo || !(/^#{1,3} /.test(ls[j].texto) || ls[j].texto.trim() === '---'))) j++;
  return {
    titulo: ls[i].texto.match(cabecera)![1].trim(),
    cuerpo: ls.slice(i + 1, j).map((l) => l.texto).join('\n').trim(),
  };
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** «6.6» → apartado «### 6.6 …»; «9» → capítulo «## 9. …» */
export function seccion(md: string, ref: string): Bloque {
  const cabecera = ref.includes('.')
    ? new RegExp(`^### ${escapar(ref)}\\s+(.+)$`)
    : new RegExp(`^## ${escapar(ref)}\\.\\s+(.+)$`);
  return extraer(md, cabecera, `la sección ${ref}`);
}

export interface Pregunta {
  pregunta: string;
  /** Markdown */
  respuesta: string;
}

/** Preguntas frecuentes de una página: «## id» y, debajo, una «### ¿Pregunta?» con su respuesta cada una */
export function preguntasDe(md: string, idPagina: string): Pregunta[] {
  const ls = lineas(md);
  const i = ls.findIndex((l) => !l.enCodigo && l.texto.trim() === `## ${idPagina}`);
  if (i < 0) return [];
  const out: Pregunta[] = [];
  let actual: { pregunta: string; lineas: string[] } | null = null;
  const cerrar = () => { if (actual) out.push({ pregunta: actual.pregunta, respuesta: actual.lineas.join('\n').trim() }); };
  for (let j = i + 1; j < ls.length; j++) {
    const { texto, enCodigo } = ls[j];
    if (!enCodigo && /^#{1,2} /.test(texto)) break;
    const m = enCodigo ? null : /^### (.+)$/.exec(texto);
    if (m) { cerrar(); actual = { pregunta: m[1].trim(), lineas: [] }; }
    else actual?.lineas.push(texto);
  }
  cerrar();
  return out;
}

/** «E12» → «### E12 — …» */
export function ejemplo(md: string, codigo: string): Bloque {
  return extraer(md, new RegExp(`^### ${escapar(codigo)} — (.+)$`), `el ejemplo ${codigo}`);
}
