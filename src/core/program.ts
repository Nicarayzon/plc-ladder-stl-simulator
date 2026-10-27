// Modelo de programa de la app: bloques (OB1, OB100, FCn) con segmentos KOP o AWL y tabla de símbolos.
import { type CBlock, type CompileIssue, type CompiledProgram, type Lang, type Origin, type SourceLine, compileLines, normBlockName, splitLines, cleanLine } from './compiler';
import { parseOperand } from './operands';
import { CompileError } from './errors';
import { compileKopSegment, newKopCtx, type KopLine } from '../kop/compile';
import { kopIsBlank, type SegmentoKOP } from '../kop/model';
import { validateSegment } from '../kop/validate';
import { T } from '../i18n';

export type Segmento =
  | { lang: 'KOP'; kop: SegmentoKOP }
  | { lang: 'AWL'; id: string; titulo?: string; comentario?: string; awl: string };

export interface Bloque {
  nombre: string;
  comentario?: string;
  segmentos: Segmento[];
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
  /** Hardware configurado (opcional; sin estaciones = CPU sin marca de ciclo) */
  hw?: { estaciones: HwEstacion[] };
}

/** Byte de la marca de ciclo activa en el proyecto, o null. */
export function clockByteOf(p: Programa): number | null {
  const cpu = p.hw?.estaciones.find((e) => e.tipo === 'CPU');
  return cpu && cpu.marcaCiclo.activa ? cpu.marcaCiclo.byte : null;
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
    const res = compileLines(lines, { symbols, lang: p.nemotecnia, collect: true, name });
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
