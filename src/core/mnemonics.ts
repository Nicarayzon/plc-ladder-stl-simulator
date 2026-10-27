// Conjuntos de nemónicos (alemán) y traducción inglés → alemán, igual que la referencia.
import { T } from '../i18n';

export const BITLOGIC = new Set(['U', 'UN', 'O', 'ON', 'X', 'XN']);
export const NEST_OPEN = new Set(['U(', 'UN(', 'O(', 'ON(', 'X(', 'XN(']);
export const CMP = new Set<string>();
for (const r of ['==', '<>', '>', '<', '>=', '<=']) for (const t of 'IDR') CMP.add(r + t);
export const ARITH = new Set(['+I', '-I', '*I', '/I', '+D', '-D', '*D', '/D', 'MOD', '+R', '-R', '*R', '/R']);
export const FLOATFN = new Set(['ABS', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN']);
export const CONV = new Set(['BTI', 'ITB', 'BTD', 'DTB', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-',
  'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD']);
export const WORDLOG = new Set(['UW', 'OW', 'XOW', 'UD', 'OD', 'XOD']);
export const SHIFTS = new Set(['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD']);
export const TSTART = new Set(['SI', 'SV', 'SE', 'SS', 'SA']);
export const JUMPS = new Set(['SPA', 'SPB', 'SPBN', 'SPBB', 'SPBNB', 'SPBI', 'SPBIN', 'SPO', 'SPS', 'SPZ', 'SPN',
  'SPP', 'SPM', 'SPPZ', 'SPMZ', 'SPU', 'SPL', 'LOOP']);
export const NO_OPERAND = new Set<string>(['NOT', 'SET', 'CLR', 'SAVE', 'TAK', 'PUSH', 'POP', 'RLDA', 'RRDA', 'BE', 'BEA', 'BEB',
  'MCRA', 'MCRD', 'MCR(', ')MCR', ')', ...NEST_OPEN, ...CMP, ...ARITH, ...FLOATFN, ...CONV]);
export const OTHERS = new Set(['=', 'S', 'R', 'FP', 'FN', 'FR', 'ZV', 'ZR', 'L', 'LC', 'T', 'LAR1', 'LAR2', 'TAR1', 'TAR2',
  '+AR1', '+AR2', 'INC', 'DEC', '+', 'AUF', 'UC', 'CC', 'CALL', 'NOP', 'BLD', 'ENT', 'LEAVE']);
export const MNEMONICS = new Set<string>([...BITLOGIC, ...NO_OPERAND, ...WORDLOG, ...SHIFTS, ...TSTART, ...JUMPS, ...OTHERS]);

export const EN2DE: Record<string, string> = {
  A: 'U', AN: 'UN', 'A(': 'U(', 'AN(': 'UN(',
  SP: 'SI', SE: 'SV', SD: 'SE', SF: 'SA', CU: 'ZV', CD: 'ZR',
  JU: 'SPA', JC: 'SPB', JCN: 'SPBN', JCB: 'SPBB', JNB: 'SPBNB', JBI: 'SPBI', JNBI: 'SPBIN',
  JO: 'SPO', JOS: 'SPS', JZ: 'SPZ', JN: 'SPN', JP: 'SPP', JM: 'SPM', JPZ: 'SPPZ',
  JMZ: 'SPMZ', JUO: 'SPU', JL: 'SPL',
  BEC: 'BEB', BEU: 'BEA', OPN: 'AUF', AW: 'UW', AD: 'UD',
};

export const DE2EN: Record<string, string> = Object.fromEntries(Object.entries(EN2DE).map(([en, de]) => [de, en]));

/** Descripción breve de cada nemónico (para autocompletar y ayudas). */
export const MNEMONIC_HELP: Record<string, string> = T.nemonicos;
