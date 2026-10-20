// Explicaciones automáticas de cada fila de la traza
import type { TraceRow } from './cpu';
import { cleanLine, splitMnemonic } from './compiler';
import { s16, s32 } from './num';

const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*(.*)$/;

/** Operando de la fila tal como lo escribió el alumno, compactado («E 0.2» → «E0.2»). */
export function rowOperand(src: string): string {
  let line = cleanLine(src);
  const m = LABEL_RE.exec(line);
  if (m) line = m[2];
  if (!line) return '';
  const [, rest] = splitMnemonic(line);
  return compact(rest);
}

export const compact = (op: string) => op.replace(/^([A-Za-z]+)\s+(\d)/, '$1$2');

const b = (v: number) => String(v);
const neg = (mn: string) => mn.endsWith('N') || mn.endsWith('N(');

function logicSentence(r: TraceRow, op: string): string {
  const mn = r.mn;
  const v = r.opVal ?? r.sta;
  const isNeg = neg(mn);
  const x = isNeg ? v ^ 1 : v;
  const xs = isNeg ? `NOT ${op} = ¬${v} = ${x}` : `${op} = ${v}`;
  const base = mn[0];
  const sym = base === 'U' ? '∧' : base === 'O' ? '∨' : '⊕';
  if (r.or_antes && base === 'U') return `El bit OR está a 1 (un grupo anterior dio 1): el resultado se queda en 1.`;
  if (!r.er_antes) {
    if (r.or_antes) return `Primera consulta (/ER = 0) con OR = 1: RLO := (${xs}) ∨ 1 = 1.`;
    return `Primera consulta (/ER = 0): RLO := ${xs}.`;
  }
  const inner = base === 'U' ? r.rlo_antes & x : base === 'O' ? r.rlo_antes | x : r.rlo_antes ^ x;
  if (r.or_antes) return `RLO := (${r.rlo_antes} ${sym} ${x}) ∨ OR(1) = 1. Después OR = 0.`;
  void inner;
  return `RLO := RLO ${sym} ${isNeg ? `¬${op}` : op} = ${r.rlo_antes} ${sym} ${x} = ${r.rlo}.`;
}

const CMP_TXT: Record<string, string> = { '==': '=', '<>': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤' };

function acuVal(v: number, typ: string): string {
  if (typ === 'I') return String(s16(v));
  if (typ === 'D') return String(s32(v));
  return String(v);
}

export function explainRow(r: TraceRow): string {
  const mn = r.mn;
  const op = rowOperand(r.instr);
  const T = (n: number) => (n ? 'sí' : 'no');
  switch (mn) {
    case 'U': case 'UN': case 'O': case 'ON': case 'X': case 'XN':
      return logicSentence(r, op);
    case 'O0':
      if (!r.er_antes) return 'O sin operando con /ER = 0: no hay grupo Y que cerrar; la siguiente instrucción será primera consulta.';
      return `Cierra el grupo Y: OR := RLO = ${r.rlo_antes}; la siguiente instrucción será primera consulta.`;
    case 'U(': case 'UN(': case 'O(': case 'ON(': case 'X(': case 'XN(':
      return `Abre paréntesis: guarda RLO = ${r.rlo_antes}, OR = ${r.or_antes} y /ER = ${r.er_antes} en la pila; dentro empieza una cadena nueva.`;
    case ')': {
      const n = r.nest;
      if (!n) return 'Cierra el paréntesis.';
      const k = n.kind;
      const sym = k[0] === 'U' ? '∧' : k[0] === 'O' ? '∨' : '⊕';
      const innerTxt = neg(k) ? `¬(${r.rlo_antes})` : `(${r.rlo_antes})`;
      if (!n.fc) return `Se cierra el paréntesis: como antes no había cadena (/ER = 0), RLO := ${innerTxt} = ${r.rlo}.`;
      return `Se recupera el RLO de antes del paréntesis (${n.rlo}) y se combina: ${n.rlo} ${sym} ${innerTxt} = ${r.rlo}.`;
    }
    case '=':
      return `${op} := RLO = ${r.sta}. Cierra la cadena (/ER = 0).`;
    case 'S':
      if (/^Z/i.test(op)) return r.rlo_antes ? `S ${op} con RLO = 1: si es un flanco, carga en el contador el valor BCD de ACU1.` : `RLO = 0: S ${op} no hace nada.`;
      return r.rlo_antes ? `Como RLO = 1, pone ${op} a 1.` : `RLO = 0: S no hace nada (${op} = ${r.sta}).`;
    case 'R':
      return r.rlo_antes ? `Como RLO = 1, pone ${op} a 0.` : `RLO = 0: R no hace nada.`;
    case 'NOT': return `Invierte el RLO: ${r.rlo_antes} → ${r.rlo}.`;
    case 'SET': return 'RLO := 1 y cierra la cadena (/ER = 0).';
    case 'CLR': return 'RLO := 0 y cierra la cadena (/ER = 0).';
    case 'SAVE': return `Guarda el RLO en RB: RB := ${r.br}.`;
    case 'FP':
      return `Flanco positivo: RLO de entrada = ${r.sta} y la marca ${op} valía ${r.opVal ?? '?'} → RLO := ${r.rlo}; la marca guarda ${r.sta}.`;
    case 'FN':
      return `Flanco negativo: RLO de entrada = ${r.sta} y la marca ${op} valía ${r.opVal ?? '?'} → RLO := ${r.rlo}; la marca guarda ${r.sta}.`;
    case 'L':
      return `ACU2 := ACU1 (${r.acu1_antes}); ACU1 := ${op} = ${r.acu1}. No toca el RLO.`;
    case 'LC':
      return `ACU2 := ACU1; ACU1 := valor de ${op} en BCD = W#16#${(r.acu1 & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}.`;
    case 'T':
      return `${op} := ACU1 = ${r.acu1}. La transferencia no depende del RLO.`;
    case 'SI': case 'SV': case 'SE': case 'SS': case 'SA': {
      const nm: Record<string, string> = { SI: 'impulso', SV: 'impulso prolongado', SE: 'retardo a la conexión', SS: 'retardo a la conexión con memoria', SA: 'retardo a la desconexión' };
      return `${mn} ${op} (${nm[mn]}) con RLO = ${r.rlo}: ${mn === 'SA' ? (r.rlo ? 'mientras S = 1 la salida vale 1 y no cuenta' : 'en el flanco de bajada carga el tiempo y empieza a contar') : r.rlo ? 'si es un flanco de subida, carga el tiempo de ACU1 y arranca' : mn === 'SI' || mn === 'SE' ? 'con S = 0 se para y Q = 0' : 'S = 0 no lo para'}.`;
    }
    case 'FR': return `Habilitación (FR) ${op}: con un flanco de subida rearma el flanco de arranque.`;
    case 'ZV': return r.rlo ? `ZV ${op}: si hay flanco de subida, cuenta +1.` : `ZV ${op} con RLO = 0: no cuenta.`;
    case 'ZR': return r.rlo ? `ZR ${op}: si hay flanco de subida, cuenta −1.` : `ZR ${op} con RLO = 0: no cuenta.`;
  }
  if (/^(==|<>|>=|<=|>|<)[IDR]$/.test(mn)) {
    const typ = mn[mn.length - 1];
    const rel = mn.slice(0, -1);
    return `Compara ACU2 (${acuVal(r.acu2, typ)}) ${CMP_TXT[rel]} ACU1 (${acuVal(r.acu1, typ)}): ${T(r.rlo)} → RLO := ${r.rlo}. La comparación sustituye al RLO anterior${r.er_antes ? ' (¡ojo! había una cadena abierta: usa U( … ) para combinarla)' : ''}.`;
  }
  if (mn === '+I' || mn === '-I' || mn === '*I' || mn === '/I') {
    const a = s16(r.acu2);
    const bb = s16(r.acu1_antes);
    const exact = mn === '+I' ? a + bb : mn === '-I' ? a - bb : mn === '*I' ? a * bb : bb === 0 ? NaN : Math.trunc(a / bb);
    const sym = mn[0] === '*' ? '×' : mn[0] === '/' ? '÷' : mn[0] === '-' ? '−' : '+';
    if (mn === '/I' && bb === 0) return `División entre 0: ACU1 no cambia; A1A0 = 11 y OV = OS = 1.`;
    if (r.ov) return `${a} ${sym} ${bb} = ${exact} no cabe en INT → queda ${mn === '*I' ? r.acu1 : r.acu1_int}; OV = OS = 1.`;
    if (mn === '/I') return `${a} ÷ ${bb}: cociente ${r.acu1_int} en ACU1-L y resto ${s16(r.acu1 >>> 16)} en ACU1-H.`;
    return `ACU1 := ACU2 ${sym} ACU1 = ${a} ${sym} ${bb} = ${mn === '*I' ? r.acu1 : r.acu1_int}.`;
  }
  if (['+D', '-D', '*D', '/D', 'MOD'].includes(mn)) return `Operación de 32 bits: ACU1 := ${r.acu1}${r.ov ? ' (desbordamiento: OV = OS = 1)' : ''}.`;
  if (['+R', '-R', '*R', '/R', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ABS'].includes(mn)) return `Operación en coma flotante (REAL)${r.ov ? ': resultado no válido o fuera de rango, OV = OS = 1' : ''}.`;
  if (mn.startsWith('SP') || mn === 'LOOP') {
    if (mn === 'SPA') return `Salta siempre a ${op}.`;
    if (mn === 'SPB' || mn === 'SPBB') return r.jumped ? `Salta a ${op} porque RLO = 1 (y deja RLO = 1, /ER = 0).` : `No salta porque RLO = 0, pero ${mn} deja RLO = 1 y /ER = 0.`;
    if (mn === 'SPBN' || mn === 'SPBNB') return r.jumped ? `Salta a ${op} porque RLO = 0 (y deja RLO = 1, /ER = 0).` : `No salta porque RLO = 1; ${mn} deja RLO = 1 y /ER = 0.`;
    if (mn === 'LOOP') return r.jumped ? `ACU1-L := ACU1-L − 1 = ${r.acu1_int & 0xFFFF}; como no es 0, vuelve a ${op}.` : 'ACU1-L llega a 0: sale del bucle.';
    return r.jumped ? `Se cumple la condición: salta a ${op}.` : 'No se cumple la condición: sigue con la instrucción siguiente.';
  }
  if (mn === 'BEB') return r.rlo_antes ? 'RLO = 1: termina el bloque.' : 'RLO = 0: no termina el bloque; deja RLO = 1 y /ER = 0.';
  if (mn === 'BE' || mn === 'BEA') return 'Fin del bloque.';
  if (mn === 'UC' || mn === 'CALL') return `Llama a ${op}; al volver, /ER = 0 y OR = 0.`;
  if (mn === 'CC') return r.rlo_antes ? `RLO = 1: llama a ${op}.` : `RLO = 0: no llama a ${op}.`;
  if (['ITB', 'BTI', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-', 'BTD', 'DTB', 'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD'].includes(mn))
    return `Conversión ${mn}: ACU1 := ${r.acu1}${r.ov ? ' (fuera de rango: OV = OS = 1, ACU1 no cambia)' : ''}.`;
  if (['UW', 'OW', 'XOW', 'UD', 'OD', 'XOD'].includes(mn)) return `Lógica de palabras: ACU1 := W#16#${(r.acu1 >>> 0).toString(16).toUpperCase()}; A1 = ${r.cc1} (resultado ${r.cc1 ? '≠' : '='} 0).`;
  if (['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD', 'RLDA', 'RRDA'].includes(mn)) return `Desplazamiento/rotación: ACU1 := ${r.acu1}; A1 = último bit que salió (${r.cc1}).`;
  if (mn === 'TAK') return 'Intercambia ACU1 y ACU2.';
  if (mn === 'INC' || mn === 'DEC') return `${mn} solo actúa sobre el byte bajo de ACU1 (sin acarreo): ACU1-LL := ${r.acu1 & 0xFF}.`;
  if (mn === '+') return `Suma la constante a ACU1 sin tocar los bits de estado: ACU1 := ${r.acu1}.`;
  if (mn === 'AUF') return `Abre ${op}.`;
  if (mn === 'NOP' || mn === 'BLD') return 'No hace nada.';
  return '';
}
