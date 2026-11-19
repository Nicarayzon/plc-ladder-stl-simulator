// Modelo de programa de la app: bloques (OB1, OB100, FCn) con segmentos KOP o AWL y tabla de símbolos.
import { type CBlock, type CompileIssue, type CompiledProgram, type Lang, type Origin, type SourceLine, PARAM_RE, compileLines, normBlockName, splitLines, cleanLine } from './compiler';
import { parseOperand } from './operands';
import { CompileError } from './errors';
import { compileKopSegment, newKopCtx, type KopLine } from '../kop/compile';
import { kopIsBlank, type SegmentoKOP } from '../kop/model';
import { validateSegment } from '../kop/validate';
import { esLibId, libPorBloque, type LibDef, type LibId } from './biblioteca';
import { T } from '../i18n';

export type Segmento =
  | { lang: 'KOP'; kop: SegmentoKOP }
  | { lang: 'AWL'; id: string; titulo?: string; comentario?: string; awl: string };

export interface Bloque {
  nombre: string;
  comentario?: string;
  segmentos: Segmento[];
  /** Bloque copiado de la biblioteca (FC 82 = RSET…): protegido y sin segmentos, la CPU lo ejecuta directamente */
  biblioteca?: LibId;
}

export interface Simbolo {
  nombre: string;
  dir: string;
  tipo: string;
  comentario?: string;
}

/** Marca de ciclo de la CPU (Hardware → propiedades de la CPU → Ciclo/marca de ciclo). */
export interface MarcaCiclo { activa: boolean; byte: number }

/** Una estación del hardware del proyecto. Por ahora, solo la CPU. */
export interface HwEstacion { id: string; tipo: 'CPU'; nombre: string; marcaCiclo: MarcaCiclo }

export interface Programa {
  nemotecnia: Lang;
  bloques: Bloque[];
  simbolos: Simbolo[];
  /** Hardware guardado en el proyecto («Guardar y compilar» de la configuración del hardware) */
  hw?: { estaciones: HwEstacion[] };
  /**
   * Hardware cargado en la CPU («Cargar en módulo»). Es el que usa la CPU: si el guardado es distinto, la CPU sigue
   * con este hasta que se cargue. Sin él, la CPU no tiene marca de ciclo.
   */
  hwCargado?: { estaciones: HwEstacion[] };
}

const marcaDe = (hw: Programa['hw']): number | null => {
  const cpu = hw?.estaciones.find((e) => e.tipo === 'CPU');
  return cpu && cpu.marcaCiclo.activa ? cpu.marcaCiclo.byte : null;
};

/** Byte de la marca de ciclo que usa la CPU (la del hardware cargado), o null. */
export function clockByteOf(p: Programa): number | null {
  return marcaDe(p.hwCargado);
}

/** Byte de la marca de ciclo del hardware guardado en el proyecto (puede no estar cargado aún), o null. */
export function clockByteGuardado(p: Programa): number | null {
  return marcaDe(p.hw);
}

/** ¿El hardware guardado es distinto del cargado en la CPU? (hay que «Cargar en módulo») */
export function hwSinCargar(p: Programa): boolean {
  if (!p.hw) return false;
  return JSON.stringify(p.hw) !== JSON.stringify(p.hwCargado ?? null);
}

/**
 * Proyectos de la 0.27.0 y anteriores: el hardware se aplicaba al guardarlo, sin «Cargar en módulo». Para que su
 * marca de ciclo siga funcionando, el guardado pasa a ser también el cargado.
 */
export function migrarHwCargado(p: Programa): Programa {
  if (!p.hw || p.hwCargado !== undefined) return p;
  return { ...p, hwCargado: structuredClone(p.hw) };
}

/**
 * Hardware guardado por versiones anteriores a la 0.18.0, con otro tipo y otro nombre de estación. La única
 * estación del catálogo era la CPU, así que todas pasan a `tipo: 'CPU'` y el nombre automático («… 300(n)»)
 * a `CPU(n)`. La marca de ciclo y los nombres que puso el alumno se conservan.
 */
export function migrarHw(p: Programa): Programa {
  if ((p.hw?.estaciones ?? []).every((e) => (e.tipo as string) === 'CPU')) return p;
  const estaciones = p.hw!.estaciones.map((e) => ((e.tipo as string) === 'CPU' ? e : { ...e, tipo: 'CPU' as const, nombre: e.nombre.replace(/^\S+ 300\((\d+)\)$/, 'CPU($1)') }));
  return { ...p, hw: { estaciones } };
}

export const segId = (s: Segmento): string => (s.lang === 'KOP' ? s.kop.id : s.id);
export const segTitulo = (s: Segmento): string | undefined => (s.lang === 'KOP' ? s.kop.titulo : s.titulo);

export interface ProgramIssue extends CompileIssue {
  block: string;
  seg?: string;
  segIndex?: number;
  severity: 'error' | 'aviso';
  /** Mensaje completo para mostrar */
  full: string;
}

export interface ProgramCompile {
  cp: CompiledProgram | null;
  errors: ProgramIssue[];
  warnings: ProgramIssue[];
  /** Líneas AWL generadas por cada segmento KOP (para «AWL generado» y para el mapa de origen) */
  kopLines: Map<string, KopLine[]>;
  symbols: Map<string, string>;
}

export function symbolMap(p: Programa): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of p.simbolos) if (s.nombre.trim()) m.set(s.nombre.trim(), s.dir.trim());
  return m;
}

function where(p: Programa, block: string, segIdx: number | undefined, line: number | undefined): string {
  if (segIdx === undefined) return `${block}`;
  const b = p.bloques.find((x) => normBlockName(x.nombre) === block);
  const s = b?.segmentos[segIdx];
  const t = s ? segTitulo(s) : undefined;
  return T.motor.donde(block, segIdx + 1, t, line);
}

/** Comprueba la tabla de símbolos. */
export function checkSymbols(p: Programa): ProgramIssue[] {
  const out: ProgramIssue[] = [];
  const seen = new Set<string>();
  p.simbolos.forEach((s, i) => {
    const name = s.nombre.trim();
    const mk = (msg: string): ProgramIssue => ({ block: 'Símbolos', line: i + 1, msg, severity: 'error', full: T.motor.simbolosFila(i + 1, msg) });
    if (!name && !s.dir.trim()) return;
    if (!name) { out.push(mk(T.motor.faltaNombre)); return; }
    if (seen.has(name)) out.push(mk(T.motor.simboloRepetido(name)));
    seen.add(name);
    try {
      const op = parseOperand(s.dir, null, 'de');
      if (!op || !['bit', 'mem', 'timer', 'counter', 'block'].includes(op.kind)) out.push(mk(T.motor.dirNoValida(name, s.dir)));
    } catch (e) {
      out.push(mk(T.motor.dirNoValida(name, (e as Error).message)));
    }
  });
  return out;
}

export function compileProgram(p: Programa): ProgramCompile {
  const symbols = symbolMap(p);
  const errors: ProgramIssue[] = [...checkSymbols(p)];
  const warnings: ProgramIssue[] = [];
  const kopLines = new Map<string, KopLine[]>();
  const blocks = new Map<string, CBlock>();
  const names = new Set<string>();

  // nombre → bloque de biblioteca que es (o null): para comprobar los parámetros de los CALL
  const interfaces = new Map<string, LibId | null>();
  for (const b of p.bloques) interfaces.set(normBlockName(b.nombre), esLibId(b.biblioteca) ? b.biblioteca : null);

  for (const b of p.bloques) {
    const name = normBlockName(b.nombre);
    if (!/^(OB|FC)\d+$/.test(name)) {
      errors.push({ block: name, line: 0, msg: T.motor.nombreBloque(b.nombre), severity: 'error', full: T.motor.nombreBloqueFull(b.nombre) });
      continue;
    }
    if (names.has(name)) {
      errors.push({ block: name, line: 0, msg: T.motor.bloqueRepetido(name), severity: 'error', full: T.motor.bloqueRepetidoFull(name) });
      continue;
    }
    names.add(name);
    if (esLibId(b.biblioteca)) {
      // bloque de biblioteca: sin código, la CPU lo ejecuta directamente
      blocks.set(name, { name, instrs: [], labels: new Map(), lib: b.biblioteca });
      continue;
    }
    const lines: SourceLine[] = [];
    const ctx = newKopCtx(name);
    const invalidKop = new Set<string>();
    b.segmentos.forEach((s, si) => {
      const id = segId(s);
      if (s.lang === 'AWL') {
        splitLines(s.awl).forEach((text, li) => {
          const origin: Origin = { block: name, seg: id, line: li + 1 };
          lines.push({ text, line: li + 1, origin, lang: p.nemotecnia });
          // las metas que empiezan por _ están reservadas para el compilador KOP
          const m = /^\s*(_[A-Za-z0-9_]{0,3})\s*:(?!=)/.exec(cleanLine(text));
          if (m) errors.push({ block: name, seg: id, segIndex: si, line: li + 1, origin, msg: T.motor.metaGuion(m[1].toUpperCase()), severity: 'error', full: `${where(p, name, si, li + 1)}: ${T.motor.metaGuion(m[1].toUpperCase())}` });
        });
      } else {
        if (kopIsBlank(s.kop)) {
          // segmento KOP recién añadido y sin rellenar: no hace nada (no bloquea el programa)
          warnings.push({ block: name, seg: id, segIndex: si, line: 0, origin: { block: name, seg: id }, msg: T.motor.kopVacio, severity: 'aviso', full: `${where(p, name, si, undefined)}: ${T.motor.kopVacioFull}` });
          return;
        }
        const issues = validateSegment(s.kop, symbols);
        for (const is of issues) {
          if (is.severity !== 'error') continue;
          invalidKop.add(id);
          errors.push({ block: name, seg: id, segIndex: si, line: 0, origin: { block: name, seg: id, elem: is.id }, msg: is.msg, severity: 'error', full: `${where(p, name, si, undefined)}: ${is.msg}` });
        }
        try {
          const kl = compileKopSegment(s.kop, ctx);
          kopLines.set(id, kl);
          lines.push(...kl);
        } catch (e) {
          errors.push({ block: name, seg: id, segIndex: si, line: 0, msg: (e as Error).message, severity: 'error', full: `${where(p, name, si, undefined)}: ${(e as Error).message}` });
        }
      }
    });
    const segIndex = new Map(b.segmentos.map((s, i) => [segId(s), i]));
    const res = compileLines(lines, { symbols, lang: p.nemotecnia, collect: true, name, bloques: interfaces });
    for (const e of res.errors) {
      if (e.origin?.seg && invalidKop.has(e.origin.seg)) continue;
      const si = e.origin?.seg !== undefined ? segIndex.get(e.origin.seg) : undefined;
      const isKop = si !== undefined && b.segmentos[si].lang === 'KOP';
      const line = isKop ? undefined : e.origin?.line;
      errors.push({ ...e, block: name, seg: e.origin?.seg, segIndex: si, severity: 'error', full: `${where(p, name, si, line)}: ${e.msg}` });
    }
    blocks.set(name, res.block);
  }
  if (!blocks.has('OB1')) errors.push({ block: 'OB1', line: 0, msg: T.motor.faltaOb1, severity: 'error', full: T.motor.faltaOb1Full });
  return { cp: errors.length ? null : { blocks }, errors, warnings, kopLines, symbols };
}

/** Compila y lanza CompileError si hay errores (para pruebas). */
export function compileProgramStrict(p: Programa): CompiledProgram {
  const r = compileProgram(p);
  if (!r.cp) throw new CompileError(r.errors.map((e) => e.full).join('\n'));
  return r.cp;
}

let segCounter = 0;
export function newSegId(): string {
  segCounter += 1;
  return `s${Date.now().toString(36)}${segCounter.toString(36)}`;
}

/** Parte un texto AWL en segmentos por las líneas «// Segmento n: título» (o comentarios sin sangría). */
export function awlTextToSegments(text: string, idPrefix?: string): Segmento[] {
  const lines = splitLines(text.replace(/\s+$/, ''));
  const segs: { titulo?: string; lines: string[] }[] = [];
  let cur: { titulo?: string; lines: string[] } | null = null;
  for (const l of lines) {
    const m = /^\/\/\s*(.*)$/.exec(l);
    if (m && (cur === null || cur.lines.some((x) => x.trim() && !x.trim().startsWith('//')))) {
      let titulo = m[1].trim();
      const sm = /^(?:Segmento|Network|NETWORK)\s*\d*\s*[:.-]?\s*(.*)$/i.exec(titulo);
      if (sm) titulo = sm[1].trim();
      cur = { titulo: titulo || undefined, lines: [] };
      segs.push(cur);
      continue;
    }
    if (!cur) {
      cur = { lines: [] };
      segs.push(cur);
    }
    cur.lines.push(l);
  }
  if (!segs.length) segs.push({ lines: [] });
  return segs.map((s, i) => ({ lang: 'AWL', id: idPrefix ? `${idPrefix}.s${i + 1}` : newSegId(), titulo: s.titulo, awl: s.lines.join('\n') }));
}

export function programFromAwl(blocks: string | Record<string, string>, idPrefix = 'p'): Programa {
  const dict = typeof blocks === 'string' ? { OB1: blocks } : blocks;
  return {
    nemotecnia: 'de',
    simbolos: [],
    bloques: Object.entries(dict).map(([k, v]) => ({ nombre: normBlockName(k), segmentos: awlTextToSegments(v, `${idPrefix}.${normBlockName(k)}`) })),
  };
}

export function emptyProgram(): Programa {
  return { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'AWL', id: newSegId(), titulo: '', awl: '' }] }] };
}

/** Bloques de biblioteca a los que llama el programa con parámetros (CALL FC 82 + S_BIT/N) y que no tiene. */
export function bibliotecaQueFalta(p: Programa): LibDef[] {
  const tiene = new Set(p.bloques.map((b) => normBlockName(b.nombre)));
  const faltan = new Map<string, LibDef>();
  for (const b of p.bloques) {
    for (const s of b.segmentos) {
      if (s.lang !== 'AWL') continue;
      const lines = splitLines(s.awl).map(cleanLine);
      lines.forEach((l, i) => {
        const m = /^(?:[A-Za-z_][A-Za-z0-9_]{0,3}\s*:(?!=)\s*)?CALL\s+FC\s*(\d+)$/i.exec(l);
        if (!m) return;
        const next = lines.slice(i + 1).find((x) => x);
        const d = libPorBloque(`FC${m[1]}`);
        if (d && next && PARAM_RE.test(next) && !tiene.has(d.bloque)) faltan.set(d.bloque, d);
      });
    }
  }
  return [...faltan.values()];
}

/** El programa con los bloques de biblioteca que usa y le faltan (para «Probar» un ejemplo de la teoría). */
export function conBibliotecaUsada(p: Programa): Programa {
  const faltan = bibliotecaQueFalta(p);
  if (!faltan.length) return p;
  return { ...p, bloques: [...p.bloques, ...faltan.map((d): Bloque => ({ nombre: d.bloque, segmentos: [], biblioteca: d.id }))] };
}
