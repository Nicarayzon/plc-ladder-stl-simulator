// Generador de programas AWL aleatorios (con semilla) para las pruebas diferenciales contra 04.
import { Rng } from '../../../src/core/rng';

const IN_BITS: string[] = [];
for (let b = 0; b < 2; b++) for (let i = 0; i < 8; i++) IN_BITS.push(`E ${b}.${i}`);
const M_BITS: string[] = [];
for (let b = 0; b < 8; b++) for (let i = 0; i < 8; i++) M_BITS.push(`M ${b}.${i}`);
const EDGE_BITS: string[] = [];
for (let b = 8; b < 10; b++) for (let i = 0; i < 8; i++) EDGE_BITS.push(`M ${b}.${i}`);
const OUT_BITS: string[] = [];
for (let b = 4; b < 6; b++) for (let i = 0; i < 8; i++) OUT_BITS.push(`A ${b}.${i}`);
const STATUS = ['OV', 'OS', 'BIE', '==0', '<>0', '>0', '<0', '>=0', '<=0', 'UO'];
const TIMERS = ['T 0', 'T 1', 'T 2', 'T 3'];
const COUNTERS = ['Z 0', 'Z 1', 'Z 2', 'Z 3'];
const WORDS_R = ['MW 10', 'MW 12', 'MW 14', 'MW 16', 'MW 18', 'MW 20', 'MW 30', 'MW 38', 'EW 0', 'EB 1', 'PEW 256', 'MB 40', 'MB 41', 'AW 6'];
const WORDS_W = ['MW 10', 'MW 12', 'MW 14', 'MW 16', 'MW 18', 'MW 20', 'MW 30', 'MW 38', 'MB 40', 'MB 41', 'AW 6', 'PAW 8', 'AB 5'];
const DWORDS_R = ['MD 48', 'MD 52', 'MD 56', 'MD 60', 'MD 12'];
const DWORDS_W = ['MD 48', 'MD 52', 'MD 56', 'MD 60'];

export interface GenCase {
  blocks: Record<string, string>;
  steps: { poner?: Record<string, number>; ciclos?: number }[];
  trace: number[];
}

export function genCase(seed: number): GenCase {
  const r = new Rng(seed);
  let labelN = 0;

  const intConst = () => r.pick(['0', '1', '-1', '7', '255', '999', '1000', '32767', '-32768', '30000', '10000', '-5', '3', '100',
    String(r.int(-32768, 32767)), String(r.int(-20, 20))]);
  const dintConst = () => r.pick(['L#0', 'L#1', 'L#-1', 'L#100000', 'L#2147483647', 'L#-2147483648', 'L#65536', 'L#-7',
    `L#${r.int(-2147483648, 2147483647)}`, `L#${r.int(-100000, 100000)}`]);
  const realConst = () => r.pick(['1.5', '-2.5', '0.0', '3.0e38', '1.0e-30', '2.5', '3.5', '27648.0', '100.0', '-0.5', '1.0e10', '0.1',
    (r.int(-100000, 100000) / r.int(1, 1000)).toFixed(3)]);
  const hex = (n: number) => r.int(0, 16 ** n - 1).toString(16).toUpperCase().padStart(n, '0');
  const anyConst = () => {
    switch (r.int(0, 7)) {
      case 0: return dintConst();
      case 1: return realConst();
      case 2: return `W#16#${hex(4)}`;
      case 3: return `DW#16#${hex(8)}`;
      case 4: return `C#${r.int(0, 999)}`;
      case 5: return `S5T#${r.int(1, 200) * 10}MS`;
      case 6: return `B#16#${hex(2)}`;
      default: return intConst();
    }
  };
  const bitOperand = () => {
    const k = r.int(0, 9);
    if (k < 3) return r.pick(IN_BITS);
    if (k < 6) return r.pick(M_BITS);
    if (k < 7) return r.pick(OUT_BITS);
    if (k < 8) return r.pick(TIMERS);
    if (k < 9) return r.pick(COUNTERS);
    return r.pick(STATUS);
  };
  const loadSrc = () => {
    const k = r.int(0, 9);
    if (k < 4) return anyConst();
    if (k < 6) return r.pick(WORDS_R);
    if (k < 7) return r.pick(DWORDS_R);
    if (k < 8) return r.pick(['T 0', 'T 1', 'Z 0', 'Z 1', 'STW']);
    if (k < 9) return intConst();
    return r.pick(['DBNO', 'DBLG', 'DINO', 'DB1.DBW 0', 'DB2.DBD 4']);
  };

  function chain(depth = 0): string[] {
    const out: string[] = [];
    const n = r.int(1, 4);
    for (let i = 0; i < n; i++) {
      const k = r.int(0, 12);
      if (k < 7 || (i === 0 && k < 9)) {
        out.push(`${r.pick(['U', 'UN', 'O', 'ON', 'X', 'XN'])} ${bitOperand()}`);
      } else if (k === 7 && i > 0) out.push('O');
      else if (k === 8 && depth < 3) {
        out.push(`${r.pick(['U(', 'UN(', 'O(', 'ON(', 'X(', 'XN('])}`, ...chain(depth + 1), ')');
      } else if (k === 9 && i > 0) out.push('NOT');
      else if (k === 10) {
        const t = r.pick(['I', 'D', 'R']);
        const a = t === 'I' ? r.pick([...WORDS_R, intConst()]) : t === 'D' ? r.pick([...DWORDS_R, dintConst()]) : r.pick([...DWORDS_R, realConst()]);
        const b = t === 'I' ? intConst() : t === 'D' ? dintConst() : realConst();
        out.push(`L ${a}`, `L ${b}`, `${r.pick(['==', '<>', '>', '<', '>=', '<='])}${t}`);
      } else if (k === 11 && i > 0) out.push(`${r.pick(['FP', 'FN'])} ${r.pick(EDGE_BITS)}`);
      else out.push(`${r.pick(['U', 'UN', 'O', 'ON'])} ${r.pick(IN_BITS)}`);
    }
    return out;
  }

  const wordOps = (): string[] => {
    const out: string[] = [];
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const k = r.int(0, 11);
      if (k < 3) out.push(`L ${loadSrc()}`, r.pick(['+I', '-I', '*I', '/I', '+D', '-D', '*D', '/D', 'MOD', '+R', '-R', '*R', '/R']));
      else if (k === 3) out.push(r.pick(['ITB', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-', 'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD', 'ABS', 'SQR', 'SQRT', 'DTB']));
      else if (k === 4) out.push(r.chance(0.3) ? 'BTI' : r.pick(['BTD', 'ITB']));
      else if (k === 5) out.push(r.chance(0.5) ? `${r.pick(['UW', 'OW', 'XOW'])} W#16#${hex(4)}` : `${r.pick(['UD', 'OD', 'XOD'])} DW#16#${hex(8)}`);
      else if (k === 6) out.push(r.chance(0.5) ? r.pick(['UW', 'OW', 'XOW', 'UD', 'OD', 'XOD']) : `L ${loadSrc()}`);
      else if (k === 7) out.push(r.chance(0.6) ? `${r.pick(['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD'])} ${r.int(0, 40)}` : r.pick(['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD', 'RLDA', 'RRDA']));
      else if (k === 8) out.push(r.pick([`INC ${r.int(0, 255)}`, `DEC ${r.int(0, 255)}`, `+ ${intConst()}`, `+ ${dintConst()}`]));
      else if (k === 9) out.push(r.pick(['TAK', 'PUSH', 'POP']));
      else if (k === 10) out.push(`L ${loadSrc()}`, `${r.pick(['==', '<>', '>', '<', '>=', '<='])}${r.pick(['I', 'D', 'R'])}`);
      else out.push(`LC ${r.pick([...TIMERS, ...COUNTERS])}`);
    }
    return out;
  };

  function statement(fwdLabels: string[]): string[] {
    const k = r.int(0, 21);
    if (k < 5) return [...chain(), `${r.pick(['=', '=', 'S', 'R'])} ${r.pick([...M_BITS, ...OUT_BITS])}`];
    if (k < 8) return [`L ${loadSrc()}`, ...wordOps(), `T ${r.chance(0.7) ? r.pick(WORDS_W) : r.pick(DWORDS_W)}`];
    if (k === 8) {
      const t = r.pick(TIMERS);
      const tv = r.chance(0.92) ? `S5T#${r.int(1, 40) * 10}MS` : r.chance(0.5) ? `S5T#${r.int(1, 30) / 10}S` : r.pick(WORDS_R);
      return [...chain(), `L ${tv}`, `${r.pick(['SI', 'SV', 'SE', 'SS', 'SA'])} ${t}`];
    }
    if (k === 9) return [...chain(), `${r.pick(['R', 'FR'])} ${r.pick(TIMERS)}`];
    if (k === 10) {
      const z = r.pick(COUNTERS);
      const c = r.int(0, 3);
      if (c === 0) return [...chain(), `L C#${r.int(0, 999)}`, `S ${z}`];
      if (c === 1) return [...chain(), `${r.pick(['ZV', 'ZR'])} ${z}`];
      if (c === 2) return [...chain(), `R ${z}`];
      return [...chain(), `FR ${z}`];
    }
    if (k === 11) {
      const lbl = `J${String(++labelN).padStart(3, '0')}`;
      fwdLabels.push(lbl);
      const j = r.pick(['SPB', 'SPBN', 'SPBB', 'SPBNB', 'SPA', 'SPBI', 'SPBIN', 'SPO', 'SPS', 'SPZ', 'SPN', 'SPP', 'SPM', 'SPPZ', 'SPMZ', 'SPU']);
      return [...(r.chance(0.6) ? chain() : wordOps()), `${j} ${lbl}`];
    }
    if (k === 12) {
      const lbl = `W${String(++labelN).padStart(3, '0')}`;
      return [`L ${r.int(1, 6)}`, `${lbl}: T MW 90`, `L MW 10`, `+ ${r.int(-3, 3)}`, `T MW 10`, `L MW 90`, `LOOP ${lbl}`];
    }
    if (k === 13) {
      const lbl = `X${String(++labelN).padStart(3, '0')}`;
      const n = r.int(1, 3);
      const out = [`L ${r.int(0, 5)}`, `SPL ${lbl}`];
      const cases: string[] = [];
      for (let i = 0; i < n; i++) {
        const c = `C${String(++labelN).padStart(3, '0')}`;
        out.push(`SPA ${c}`);
        cases.push(c);
      }
      const end = `E${String(++labelN).padStart(3, '0')}`;
      out.push(`${lbl}: L 99`, 'T MW 20', `SPA ${end}`);
      cases.forEach((c, i) => out.push(`${c}: L ${i + 10}`, 'T MW 20', `SPA ${end}`));
      out.push(`${end}: NOP 0`);
      return out;
    }
    if (k === 14) {
      const byte = r.int(10, 40) & ~1;
      if (r.chance(0.5)) return [`L P#${byte}.${r.chance(0.9) ? 0 : 1}`, 'T MD 100', `L ${loadSrc()}`, `T MW [MD 100]`, 'L MW [MD 100]', `T ${r.pick(WORDS_W)}`];
      if (r.chance(0.5)) return [`L P#${r.int(0, 7)}.${r.int(0, 7)}`, 'T MD 100', `U M [MD 100]`, `= A [MD 100]`];
      return [`LAR1 P#${byte}.0`, `L ${loadSrc()}`, `T MW [AR1, P#2.0]`, `+AR1 P#${r.int(0, 4)}.0`, `L MW [AR1, P#0.0]`, `T ${r.pick(WORDS_W)}`, 'TAR1 MD 52'];
    }
    if (k === 15) return ['MCRA', ...chain(), 'MCR(', ...chain(), `= ${r.pick(OUT_BITS)}`, `L ${loadSrc()}`, `T ${r.pick(WORDS_W)}`, ')MCR', 'MCRD'];
    if (k === 16) return r.chance(0.5)
      ? [`AUF DB ${r.int(1, 2)}`, `L ${loadSrc()}`, `T DBW ${r.int(0, 10) * 2}`, `L DBW ${r.int(0, 10) * 2}`, `T ${r.pick(WORDS_W)}`, ...chain(), `= DBX ${r.int(0, 20)}.${r.int(0, 7)}`]
      : [`L ${loadSrc()}`, `T DB${r.int(1, 2)}.DBW ${r.int(0, 10) * 2}`, `U DB1.DBX ${r.int(0, 20)}.${r.int(0, 7)}`, `= ${r.pick(M_BITS)}`];
    if (k === 17) return r.chance(0.5) ? ['UC FC 1'] : [...chain(), 'CC FC 2'];
    if (k === 18) return [...chain(), r.pick(['SAVE', 'NOT', 'SET', 'CLR']), `= ${r.pick(M_BITS)}`];
    if (k === 19) return r.chance(0.5) ? ['L STW', `T ${r.pick(WORDS_W)}`] : [`L ${r.pick(['W#16#0000', 'W#16#01FF', `W#16#${hex(3)}`])}`, 'T STW', `U ${r.pick(STATUS)}`, `= ${r.pick(M_BITS)}`];
    if (k === 20) return [...chain(), `${r.pick(['FP', 'FN'])} ${r.pick(EDGE_BITS)}`, `= ${r.pick(OUT_BITS)}`];
    return [`L ${loadSrc()}`, `L ${loadSrc()}`, ...wordOps(), `T ${r.pick(DWORDS_W)}`];
  }

  function body(n: number, allowCalls: boolean): string {
    const lines: string[] = [];
    let pending: string[] = [];
    const fwd: string[] = [];
    for (let i = 0; i < n; i++) {
      // metas de saltos anteriores que se pueden colocar delante de esta sentencia (siempre hacia delante)
      const before = fwd.slice();
      let st = statement(fwd);
      if (!allowCalls && st.some((l) => l.startsWith('UC') || l.startsWith('CC'))) st = [`L ${loadSrc()}`, `T ${r.pick(WORDS_W)}`];
      const place = before.filter(() => r.chance(0.5));
      for (const p of place) fwd.splice(fwd.indexOf(p), 1);
      pending = pending.concat(place);
      if (pending.length) {
        lines.push(...pending.slice(0, -1).map((p) => `${p}:`));
        st = [`${pending[pending.length - 1]}: ${st[0]}`, ...st.slice(1)];
        pending = [];
      }
      lines.push(...st);
    }
    for (const p of fwd) lines.push(`${p}:`);
    if (allowCalls === false && r.chance(0.3)) lines.splice(r.int(0, lines.length), 0, ...chain(), 'BEB');
    return lines.map((l) => (l.includes(':') && /^[A-Z]\d{3}:/.test(l) ? l : `      ${l}`)).join('\n');
  }

  const blocks: Record<string, string> = {
    OB1: body(r.int(4, 14), true),
    FC1: body(r.int(1, 4), false),
    FC2: body(r.int(1, 3), false),
  };
  if (r.chance(0.3)) blocks.OB100 = body(r.int(1, 3), false);

  const steps: GenCase['steps'] = [];
  const nSteps = 20;
  for (let i = 0; i < nSteps; i++) {
    const poner: Record<string, number> = {};
    if (i === 0 || r.chance(0.7)) poner.EB0 = r.int(0, 255);
    if (i === 0 || r.chance(0.4)) poner.EB1 = r.int(0, 255);
    if (r.chance(0.2)) poner.PEW256 = r.int(0, 27648);
    steps.push({ poner, ciclos: r.chance(0.8) ? 1 : r.int(2, 60) });
  }
  return { blocks, steps, trace: [1, 2, nSteps] };
}
