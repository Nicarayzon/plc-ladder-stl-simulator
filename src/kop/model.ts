// Modelo de datos KOP

export type Operando = string; // texto AWL normalizado: "E 0.0", "MW 30", "T 1", "S5T#5S", '"Marcha"'
export type Id = string;

export type FnCmp = `${'==' | '<>' | '>' | '<' | '>=' | '<='}${'I' | 'D' | 'R'}`;

export type Elem =
  | { k: 'NA'; id: Id; op: Operando }
  | { k: 'NC'; id: Id; op: Operando }
  | { k: 'NOT'; id: Id }
  | { k: 'P' | 'N'; id: Id; mem: Operando }
  | { k: 'POS' | 'NEG'; id: Id; op: Operando; mem: Operando }
  | { k: 'CON'; id: Id; op: Operando }
  | { k: 'CMP'; id: Id; fn: FnCmp; in1: Operando; in2: Operando }
  | { k: 'SER'; id: Id; items: Elem[] }
  | { k: 'PAR'; id: Id; ramas: Elem[] };

export type TempTipo = 'S_IMPULS' | 'S_VIMP' | 'S_EVERZ' | 'S_SEVERZ' | 'S_AVERZ';
export type ContTipo = 'Z_VORW' | 'Z_RUECK' | 'ZAEHLER';

export type FnBox = 'MOVE' | 'ADD_I' | 'SUB_I' | 'MUL_I' | 'DIV_I' | 'ADD_DI' | 'SUB_DI' | 'MUL_DI' | 'DIV_DI' | 'MOD_DI'
  | 'ADD_R' | 'SUB_R' | 'MUL_R' | 'DIV_R' | 'ABS' | 'SQR' | 'SQRT' | 'EXP' | 'LN' | 'SIN' | 'COS' | 'TAN' | 'ASIN' | 'ACOS' | 'ATAN'
  | 'BCD_I' | 'I_BCD' | 'BCD_DI' | 'DI_BCD' | 'I_DI' | 'DI_R' | 'ROUND' | 'TRUNC' | 'CEIL' | 'FLOOR'
  | 'INV_I' | 'INV_DI' | 'NEG_I' | 'NEG_DI' | 'NEG_R'
  | 'WAND_W' | 'WOR_W' | 'WXOR_W' | 'WAND_DW' | 'WOR_DW' | 'WXOR_DW'
  | 'SHL_W' | 'SHR_W' | 'SHR_I' | 'SHL_DW' | 'SHR_DW' | 'SHR_DI' | 'ROL_DW' | 'ROR_DW';

export type Cuadro =
  | { k: 'TEMP'; id: Id; tipo: TempTipo; t: Operando; tw: Operando; pinR?: Elem; dual?: Operando; dez?: Operando; q?: Rama[] }
  | { k: 'CONT'; id: Id; tipo: ContTipo; z: Operando; pinZR?: Elem; pinS?: Elem; zw?: Operando; pinR?: Elem; dual?: Operando; dez?: Operando; q?: Rama[] }
  | { k: 'BIEST'; id: Id; tipo: 'SR' | 'RS'; op: Operando; pin2: Elem; q?: Rama[] }
  | { k: 'BOX'; id: Id; fn: FnBox; p: Record<string, Operando>; eno?: Rama[] };

export type Salida =
  | { k: 'BOB' | 'S' | 'R'; id: Id; op: Operando }
  | { k: 'SAVE'; id: Id }
  | { k: 'SI' | 'SV' | 'SE' | 'SS' | 'SA'; id: Id; t: Operando; tw: Operando }
  | { k: 'ZV' | 'ZR'; id: Id; z: Operando }
  | { k: 'SZ'; id: Id; z: Operando; zw: Operando }
  | { k: 'JMP' | 'JMPN'; id: Id; meta: string }
  | { k: 'RET'; id: Id }
  | { k: 'CALL'; id: Id; bloque: string }
  | Cuadro;

/** pre = contactos entre el punto de bifurcación y la salida */
export interface Rama { pre?: Elem; salida: Salida }

export interface SegmentoKOP {
  id: Id;
  titulo?: string;
  comentario?: string;
  /** LABEL al principio del segmento */
  meta?: string;
  /** SER; vacía (items = []) = unida a la barra */
  entrada: Elem;
  /** ≥ 1 (0 solo en un segmento que únicamente tiene meta) */
  salidas: Rama[];
}

export type ElemK = Elem['k'];
export type SalidaK = Salida['k'];
export type SerElem = Extract<Elem, { k: 'SER' }>;
export type ParElem = Extract<Elem, { k: 'PAR' }>;

export const TEMP_TIPOS: TempTipo[] = ['S_IMPULS', 'S_VIMP', 'S_EVERZ', 'S_SEVERZ', 'S_AVERZ'];
export const TEMP_TO_AWL: Record<TempTipo, 'SI' | 'SV' | 'SE' | 'SS' | 'SA'> = {
  S_IMPULS: 'SI', S_VIMP: 'SV', S_EVERZ: 'SE', S_SEVERZ: 'SS', S_AVERZ: 'SA',
};
export const TEMP_EN: Record<TempTipo, string> = { S_IMPULS: 'S_PULSE', S_VIMP: 'S_PEXT', S_EVERZ: 'S_ODT', S_SEVERZ: 'S_ODTS', S_AVERZ: 'S_OFFDT' };
export const CONT_EN: Record<ContTipo, string> = { Z_VORW: 'S_CU', Z_RUECK: 'S_CD', ZAEHLER: 'S_CUD' };

export type BoxEnd = 'OV' | 'SET';
export interface BoxDef { ins: string[]; outs: string[]; awl: string; end: BoxEnd; grupo: string; desc: string }

const ar = (awl: string, end: BoxEnd, grupo: string, desc: string, two = true): BoxDef => ({ ins: two ? ['IN1', 'IN2'] : ['IN'], outs: ['OUT'], awl, end, grupo, desc });

export const BOX_DEFS: Record<FnBox, BoxDef> = {
  MOVE: { ins: ['IN'], outs: ['OUT'], awl: '', end: 'SET', grupo: 'Transferencia', desc: 'Copiar IN en OUT' },
  ADD_I: ar('+I', 'OV', 'Enteros', 'Sumar INT'), SUB_I: ar('-I', 'OV', 'Enteros', 'Restar INT'),
  MUL_I: ar('*I', 'OV', 'Enteros', 'Multiplicar INT'), DIV_I: ar('/I', 'OV', 'Enteros', 'Dividir INT'),
  ADD_DI: ar('+D', 'OV', 'Enteros', 'Sumar DINT'), SUB_DI: ar('-D', 'OV', 'Enteros', 'Restar DINT'),
  MUL_DI: ar('*D', 'OV', 'Enteros', 'Multiplicar DINT'), DIV_DI: ar('/D', 'OV', 'Enteros', 'Dividir DINT'),
  MOD_DI: ar('MOD', 'OV', 'Enteros', 'Resto DINT'),
  ADD_R: ar('+R', 'OV', 'Coma flotante', 'Sumar REAL'), SUB_R: ar('-R', 'OV', 'Coma flotante', 'Restar REAL'),
  MUL_R: ar('*R', 'OV', 'Coma flotante', 'Multiplicar REAL'), DIV_R: ar('/R', 'OV', 'Coma flotante', 'Dividir REAL'),
  ABS: ar('ABS', 'OV', 'Coma flotante', 'Valor absoluto', false), SQR: ar('SQR', 'OV', 'Coma flotante', 'Cuadrado', false),
  SQRT: ar('SQRT', 'OV', 'Coma flotante', 'Raíz cuadrada', false), EXP: ar('EXP', 'OV', 'Coma flotante', 'Exponencial', false),
  LN: ar('LN', 'OV', 'Coma flotante', 'Logaritmo natural', false), SIN: ar('SIN', 'OV', 'Coma flotante', 'Seno', false),
  COS: ar('COS', 'OV', 'Coma flotante', 'Coseno', false), TAN: ar('TAN', 'OV', 'Coma flotante', 'Tangente', false),
  ASIN: ar('ASIN', 'OV', 'Coma flotante', 'Arcoseno', false), ACOS: ar('ACOS', 'OV', 'Coma flotante', 'Arcocoseno', false),
  ATAN: ar('ATAN', 'OV', 'Coma flotante', 'Arcotangente', false),
  I_BCD: ar('ITB', 'OV', 'Conversión', 'INT → BCD', false), DI_BCD: ar('DTB', 'OV', 'Conversión', 'DINT → BCD', false),
  ROUND: ar('RND', 'OV', 'Conversión', 'Redondear REAL → DINT', false), TRUNC: ar('TRUNC', 'OV', 'Conversión', 'Truncar REAL → DINT', false),
  CEIL: ar('RND+', 'OV', 'Conversión', 'Redondear hacia +∞', false), FLOOR: ar('RND-', 'OV', 'Conversión', 'Redondear hacia −∞', false),
  NEG_I: ar('NEGI', 'OV', 'Conversión', 'Complemento a 2 INT', false), NEG_DI: ar('NEGD', 'OV', 'Conversión', 'Complemento a 2 DINT', false),
  BCD_I: ar('BTI', 'SET', 'Conversión', 'BCD → INT', false), BCD_DI: ar('BTD', 'SET', 'Conversión', 'BCD → DINT', false),
  I_DI: ar('ITD', 'SET', 'Conversión', 'INT → DINT', false), DI_R: ar('DTR', 'SET', 'Conversión', 'DINT → REAL', false),
  INV_I: ar('INVI', 'SET', 'Conversión', 'Complemento a 1 INT', false), INV_DI: ar('INVD', 'SET', 'Conversión', 'Complemento a 1 DINT', false),
  NEG_R: ar('NEGR', 'SET', 'Conversión', 'Negar REAL', false),
  WAND_W: ar('UW', 'SET', 'Lógica de palabras', 'Y palabra'), WOR_W: ar('OW', 'SET', 'Lógica de palabras', 'O palabra'),
  WXOR_W: ar('XOW', 'SET', 'Lógica de palabras', 'O-exclusiva palabra'), WAND_DW: ar('UD', 'SET', 'Lógica de palabras', 'Y doble palabra'),
  WOR_DW: ar('OD', 'SET', 'Lógica de palabras', 'O doble palabra'), WXOR_DW: ar('XOD', 'SET', 'Lógica de palabras', 'O-exclusiva doble palabra'),
  SHL_W: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SLW', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar palabra a la izquierda' },
  SHR_W: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SRW', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar palabra a la derecha' },
  SHR_I: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SSI', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar INT con signo' },
  SHL_DW: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SLD', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar doble palabra a la izquierda' },
  SHR_DW: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SRD', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar doble palabra a la derecha' },
  SHR_DI: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'SSD', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Desplazar DINT con signo' },
  ROL_DW: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'RLD', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Rotar a la izquierda' },
  ROR_DW: { ins: ['IN', 'N'], outs: ['OUT'], awl: 'RRD', end: 'SET', grupo: 'Desplazamiento y rotación', desc: 'Rotar a la derecha' },
};

export const isSalidaCuadro = (s: Salida): s is Cuadro => s.k === 'TEMP' || s.k === 'CONT' || s.k === 'BIEST' || s.k === 'BOX';

/** Salidas que dejan el RLO intacto (se pueden encadenar varias sin bit temporal). */
export const preservesRlo = (s: Salida): boolean =>
  ['BOB', 'S', 'R', 'SAVE', 'SI', 'SV', 'SE', 'SS', 'SA', 'ZV', 'ZR', 'SZ'].includes(s.k);

export const isSolitaria = (s: Salida): boolean => s.k === 'JMP' || s.k === 'JMPN' || s.k === 'RET' || s.k === 'CALL';

/** Recorre todos los elementos (contactos y salidas) del segmento. */
export function walkSegment(seg: SegmentoKOP, fnElem: (e: Elem) => void, fnSal: (s: Salida) => void) {
  const elem = (e: Elem | undefined) => {
    if (!e) return;
    fnElem(e);
    if (e.k === 'SER') e.items.forEach(elem);
    else if (e.k === 'PAR') e.ramas.forEach(elem);
  };
  const ramas = (rs: Rama[] | undefined) => rs?.forEach((r) => { elem(r.pre); sal(r.salida); });
  const sal = (s: Salida) => {
    fnSal(s);
    if (s.k === 'TEMP') { elem(s.pinR); ramas(s.q); } else if (s.k === 'CONT') { elem(s.pinZR); elem(s.pinS); elem(s.pinR); ramas(s.q); } else if (s.k === 'BIEST') { elem(s.pin2); ramas(s.q); } else if (s.k === 'BOX') ramas(s.eno);
  };
  elem(seg.entrada);
  ramas(seg.salidas);
}

/**
 * Segmento KOP sin rellenar: ningún operando escrito, sin meta y solo contactos/bobinas simples
 * (el segmento recién añadido). Se trata como un segmento vacío.
 */
export function kopIsBlank(seg: SegmentoKOP): boolean {
  if (seg.meta && seg.meta.trim()) return false;
  let blank = true;
  const SIMPLE = new Set(['SER', 'PAR', 'NA', 'NC', 'BOB', 'S', 'R']);
  walkSegment(seg, (e) => {
    if (!SIMPLE.has(e.k)) blank = false;
    else if ('op' in e && e.op.trim()) blank = false;
  }, (s) => {
    if (!SIMPLE.has(s.k)) blank = false;
    else if ('op' in s && s.op.trim()) blank = false;
  });
  return blank;
}
