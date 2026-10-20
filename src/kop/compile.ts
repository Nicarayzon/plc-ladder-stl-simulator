// Compilación KOP → AWL con mapa de origen
import type { Origin, SourceLine } from '../core/compiler';
import {
  BOX_DEFS, type Elem, type Rama, type Salida, type SegmentoKOP, TEMP_TO_AWL, isSolitaria, preservesRlo,
} from './model';

export interface KopCtx {
  block: string;
  /** Siguiente bit temporal (L 20.0, L 20.1…) */
  tmp: number;
  /** Siguiente meta interna (_001, _002…) */
  lbl: number;
}

export const newKopCtx = (block: string): KopCtx => ({ block, tmp: 0, lbl: 0 });

export interface KopLine extends SourceLine {
  mn: string;
  op: string;
  label?: string;
}

export function fmtAwl(label: string | undefined, mn: string, op: string): string {
  const lab = label ? `${label}:`.padEnd(6) : '      ';
  return op ? `${lab}${mn.padEnd(6)}${op}` : `${lab}${mn}`;
}

const items = (e: Elem | undefined): Elem[] => (!e ? [] : e.k === 'SER' ? e.items : [e]);
const nonEmpty = (e: Elem | undefined): boolean => items(e).length > 0;

export function compileKopSegment(seg: SegmentoKOP, ctx: KopCtx): KopLine[] {
  const out: KopLine[] = [];
  let pendingLabel: string | undefined;

  const emit = (mn: string, op: string, elem: string, role: Origin['role'] = 'aux') => {
    const label = pendingLabel;
    pendingLabel = undefined;
    out.push({ mn, op, label, text: fmtAwl(label, mn, op), line: out.length + 1, origin: { block: ctx.block, seg: seg.id, elem, role }, lang: 'de' } as KopLine);
  };
  const setLabel = (l: string) => {
    pendingLabel = l;
  };

  function serie(list: Elem[], primero: boolean, ownerId: string) {
    if (!list.length && primero) {
      emit('SET', '', ownerId, 'aux');
      return;
    }
    list.forEach((e, i) => {
      const ini = primero && i === 0;
      switch (e.k) {
        case 'NA': emit('U', e.op, e.id, 'key'); break;
        case 'NC': emit('UN', e.op, e.id, 'key'); break;
        case 'NOT': emit('NOT', '', e.id, 'key'); break;
        case 'P': emit('FP', e.mem, e.id, 'key'); break;
        case 'N': emit('FN', e.mem, e.id, 'key'); break;
        case 'POS':
        case 'NEG':
          emit('U(', '', e.id);
          emit('U', e.op, e.id, 'pin');
          emit(e.k === 'POS' ? 'FP' : 'FN', e.mem, e.id, 'key');
          emit(')', '', e.id);
          break;
        case 'CON':
          emit('=', e.op, e.id, 'key');
          emit('U', e.op, e.id, 'aux');
          break;
        case 'CMP':
          if (ini) {
            emit('L', e.in1, e.id);
            emit('L', e.in2, e.id);
            emit(e.fn, '', e.id, 'key');
          } else {
            emit('U(', '', e.id);
            emit('L', e.in1, e.id);
            emit('L', e.in2, e.id);
            emit(e.fn, '', e.id, 'key');
            emit(')', '', e.id);
          }
          break;
        case 'SER':
          serie(e.items, ini, e.id);
          break;
        case 'PAR':
          if (ini) ramasO(e);
          else {
            emit('U(', '', e.id);
            ramasO(e);
            emit(')', '', e.id);
          }
          break;
      }
    });
  }

  function ramasO(par: Extract<Elem, { k: 'PAR' }>) {
    for (const r of par.ramas) {
      if (r.k === 'NA') emit('O', r.op, r.id, 'key');
      else if (r.k === 'NC') emit('ON', r.op, r.id, 'key');
      else if (r.k === 'PAR') ramasO(r);
      else if (r.k === 'CMP') {
        emit('O(', '', r.id);
        emit('L', r.in1, r.id);
        emit('L', r.in2, r.id);
        emit(r.fn, '', r.id, 'key');
        emit(')', '', r.id);
      } else if (r.k === 'SER') {
        emit('O(', '', r.id);
        serie(r.items, true, r.id);
        emit(')', '', r.id);
      } else {
        emit('O(', '', r.id);
        serie([r], true, r.id);
        emit(')', '', r.id);
      }
    }
  }

  const newTmp = () => {
    const n = ctx.tmp++;
    return `L ${20 + Math.floor(n / 8)}.${n % 8}`;
  };
  const newLabel = () => `_${String(++ctx.lbl).padStart(3, '0')}`;

  /** Ramas tras un punto de bifurcación cuyo RLO ya está calculado. */
  function ramas(rs: Rama[], ownerId: string, entradaVacia: boolean) {
    if (!rs.length) return;
    if (rs.length === 1) {
      const r = rs[0];
      if (nonEmpty(r.pre)) serie(items(r.pre), false, r.pre!.id);
      salida(r.salida, entradaVacia && !nonEmpty(r.pre));
      return;
    }
    const needTmp = rs.some((r) => nonEmpty(r.pre) || !preservesRlo(r.salida));
    if (!needTmp) {
      for (const r of rs) salida(r.salida, false);
      return;
    }
    const tmp = newTmp();
    emit('=', tmp, ownerId, 'aux');
    for (const r of rs) {
      emit('U', tmp, ownerId, 'aux');
      if (nonEmpty(r.pre)) serie(items(r.pre), false, r.pre!.id);
      salida(r.salida, false);
    }
  }

  /** Ramas de la salida Q/ENO de un cuadro: cada una vuelve a leer el bit de salida. */
  function ramasQ(rs: Rama[] | undefined, qMn: string, qOp: string, boxId: string) {
    if (!rs?.length) return;
    for (const r of rs) {
      emit(qMn, qOp, boxId, 'q');
      if (nonEmpty(r.pre)) serie(items(r.pre), false, r.pre!.id);
      salida(r.salida, false);
    }
  }

  function pin(e: Elem | undefined, ownerId: string): boolean {
    if (!e) return false;
    serie(items(e), true, e.id ?? ownerId);
    return true;
  }

  function salida(o: Salida, entradaVacia: boolean) {
    switch (o.k) {
      case 'BOB': emit('=', o.op, o.id, 'key'); break;
      case 'S': emit('S', o.op, o.id, 'key'); break;
      case 'R': emit('R', o.op, o.id, 'key'); break;
      case 'SAVE': emit('SAVE', '', o.id, 'key'); break;
      case 'SI': case 'SV': case 'SE': case 'SS': case 'SA':
        emit('L', o.tw, o.id);
        emit(o.k, o.t, o.id, 'key');
        break;
      case 'ZV': case 'ZR': emit(o.k, o.z, o.id, 'key'); break;
      case 'SZ':
        emit('L', o.zw, o.id);
        emit('S', o.z, o.id, 'key');
        break;
      case 'JMP': emit(entradaVacia ? 'SPA' : 'SPB', o.meta.toUpperCase(), o.id, 'key'); break;
      case 'JMPN': emit('SPBN', o.meta.toUpperCase(), o.id, 'key'); break;
      case 'RET': emit('BEB', '', o.id, 'key'); break;
      case 'CALL': emit(entradaVacia ? 'UC' : 'CC', o.bloque, o.id, 'key'); break;
      case 'TEMP':
        emit('L', o.tw, o.id);
        emit(TEMP_TO_AWL[o.tipo], o.t, o.id, 'key');
        if (pin(o.pinR, o.id)) emit('R', o.t, o.id, 'pin');
        if (o.dual) { emit('L', o.t, o.id); emit('T', o.dual, o.id); }
        if (o.dez) { emit('LC', o.t, o.id); emit('T', o.dez, o.id); }
        ramasQ(o.q, 'U', o.t, o.id);
        break;
      case 'CONT':
        emit(o.tipo === 'Z_RUECK' ? 'ZR' : 'ZV', o.z, o.id, 'key');
        if (o.tipo === 'ZAEHLER' && pin(o.pinZR, o.id)) emit('ZR', o.z, o.id, 'pin');
        if (pin(o.pinS, o.id)) { emit('L', o.zw ?? 'C#0', o.id); emit('S', o.z, o.id, 'pin'); }
        if (pin(o.pinR, o.id)) emit('R', o.z, o.id, 'pin');
        if (o.dual) { emit('L', o.z, o.id); emit('T', o.dual, o.id); }
        if (o.dez) { emit('LC', o.z, o.id); emit('T', o.dez, o.id); }
        ramasQ(o.q, 'U', o.z, o.id);
        break;
      case 'BIEST':
        emit(o.tipo === 'SR' ? 'S' : 'R', o.op, o.id, 'key');
        pin(o.pin2, o.id);
        emit(o.tipo === 'SR' ? 'R' : 'S', o.op, o.id, 'pin');
        ramasQ(o.q, 'U', o.op, o.id);
        break;
      case 'BOX': {
        const def = BOX_DEFS[o.fn];
        const lbl = newLabel();
        emit('SPBNB', lbl, o.id, 'key');
        if (o.fn === 'MOVE') {
          emit('L', o.p.IN ?? '', o.id);
        } else if (def.ins.includes('N')) {
          emit('L', o.p.N ?? '', o.id);
          emit('L', o.p.IN ?? '', o.id);
          emit(def.awl, '', o.id);
        } else if (def.ins.length === 2) {
          emit('L', o.p.IN1 ?? '', o.id);
          emit('L', o.p.IN2 ?? '', o.id);
          emit(def.awl, '', o.id);
        } else {
          emit('L', o.p.IN ?? '', o.id);
          emit(def.awl, '', o.id);
        }
        emit('T', o.p.OUT ?? '', o.id);
        if (def.end === 'OV') emit('UN', 'OV', o.id);
        else emit('SET', '', o.id);
        emit('SAVE', '', o.id);
        emit('CLR', '', o.id);
        setLabel(lbl);
        if (o.eno?.length) {
          emit('U', 'BIE', o.id, 'q');
          ramas(o.eno, o.id, false);
        } else emit('NOP', '0', o.id); // ENO sin conectar: la cadena queda cerrada (/ER = 0)
        break;
      }
    }
  }

  if (seg.meta) setLabel(seg.meta.toUpperCase());
  const vacia = !nonEmpty(seg.entrada);
  if (!seg.salidas.length) {
    if (!vacia) serie(items(seg.entrada), true, seg.entrada.id);
    if (!out.length || pendingLabel) emit('NOP', '0', seg.id);
    return out;
  }
  const sol = seg.salidas.length === 1 && isSolitaria(seg.salidas[0].salida);
  const s0 = seg.salidas[0].salida.k;
  if (vacia) {
    if (!(sol && (s0 === 'JMP' || s0 === 'CALL') && !nonEmpty(seg.salidas[0].pre))) emit('SET', '', seg.entrada.id);
  } else serie(items(seg.entrada), true, seg.entrada.id);
  ramas(seg.salidas, seg.entrada.id, vacia);
  if (pendingLabel) emit('NOP', '0', seg.id);
  return out;
}

/** Texto AWL del segmento compilado (para «AWL generado» y para convertir el segmento a AWL). */
export function kopToAwlText(seg: SegmentoKOP, block = 'OB1'): string {
  return compileKopSegment(seg, newKopCtx(block)).map((l) => l.text).join('\n');
}
