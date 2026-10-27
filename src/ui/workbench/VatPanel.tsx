import { useId, useMemo, useState } from 'react';
import type { SimController } from '../../sim/SimController';
import { FORMATOS, type Formato, fmtValue, parseUserValue } from '../../core/format';
import { makeReader, readRaw, type Reader } from '../../sim/readers';
import { useSimTick } from './useSim';
import { Icon } from '../common/Icon';
import { Desplegable, toast } from '../common/ui';
import { normAddr } from './symbols';
import { operandosDe } from './vat';
import type { VatFila } from './types';
import { T } from '../../i18n';

export type VatRow = VatFila;

function defaultFmt(r: Reader): Formato {
  if (r.size === 0) return 'BOOL';
  if (r.kind === 'timerS5') return 'S5TIME';
  if (r.kind === 'counterBcd') return 'BCD';
  return 'DEC';
}

const OPCIONES_FMT = FORMATOS.map((f) => ({ value: f, label: f }));

/** «T n» y «Z n» con su valor (S5TIME y C#): el formato es fijo */
const tzValor = (r: Reader) => r.kind === 'timerS5' || r.kind === 'counterBcd';

/** `valorTZ`: «T 1» y «Z 1» enseñan el valor (tablas de variables del simulador libre).
 *  Sin él, el bit (pestaña «Variables» de Probar y los ejercicios). */
export function VatPanel({ sim, rows, onRows, symbols, symByAddr, valorTZ = false }: { sim: SimController; rows: VatRow[]; onRows: (r: VatRow[]) => void; symbols: Map<string, string>; symByAddr: Map<string, string>; valorTZ?: boolean }) {
  const [nuevo, setNuevo] = useState('');
  const [edit, setEdit] = useState<Record<number, string>>({});
  const listaId = useId();
  const readers = useMemo(() => rows.map((r) => {
    try { return makeReader(r.text, symbols, valorTZ); } catch (e) { return e as Error; }
  }), [rows, symbols, valorTZ]);
  /** Sugerencias al escribir: los operandos del programa que aún no están en la tabla */
  const sugerencias = useMemo(() => {
    const hay = new Set(rows.map((r) => normAddr(r.text)));
    return sim.usage ? operandosDe(sim.usage).filter((t) => !hay.has(normAddr(t))) : [];
  }, [sim.usage, rows]);
  useSimTick(sim, 10, () => [sim.rev, ...readers.map((r) => (r instanceof Error ? 0 : readRaw(sim.cpu, r)))]);

  const add = () => {
    const t = nuevo.trim();
    if (!t) return;
    try {
      const r = makeReader(t, symbols, valorTZ);
      onRows([...rows, { text: t, fmt: defaultFmt(r) }]);
      setNuevo('');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const apply = (i: number, mode: 'mod' | 'force') => {
    const r = readers[i];
    if (r instanceof Error) return;
    const txt = edit[i];
    if (txt === undefined || txt.trim() === '') { toast(T.vatPanel.escribeValor); return; }
    try {
      const raw = parseUserValue(txt, r.size, rows[i].fmt);
      if (mode === 'mod') sim.modify(rows[i].text, raw, valorTZ);
      else sim.force(rows[i].text, raw, txt);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div>
      <table className="tbl vat">
        <thead>
          <tr><th>{T.vatPanel.operando}</th><th>{T.vatPanel.formato}</th><th className="num">{T.vatPanel.valor}</th><th>{T.vatPanel.nuevoValor}</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = readers[i];
            const err = r instanceof Error;
            const raw = err ? NaN : readRaw(sim.cpu, r);
            const sym = !err ? (row.text.startsWith('"') ? r.op.text : symByAddr.get(normAddr(row.text))) : undefined;
            const forced = !err && sim.forces.has(r.op.text);
            return (
              <tr key={i}>
                <td>
                  <div className="mono">{row.text}</div>
                  {sym && <div className="faint" style={{ fontSize: 11 }}>{sym}</div>}
                  {err && <div className="err-text" style={{ fontSize: 11 }}>{(r as Error).message}</div>}
                </td>
                <td>
                  <Desplegable style={{ height: 24, padding: '0 6px' }} value={row.fmt} options={OPCIONES_FMT} disabled={err || r.size === 0 || tzValor(r)} aria-label={T.vatPanel.formato}
                    onChange={(fmt) => onRows(rows.map((x, j) => (j === i ? { ...x, fmt } : x)))} />
                </td>
                <td className={`num val ${forced ? 'forced' : ''}`} title={forced ? T.vatPanel.forzado : undefined}>
                  {err || Number.isNaN(raw) ? '—' : fmtValue(raw, r.size, row.fmt)}{forced && ' F'}
                </td>
                <td style={{ width: 110 }}>
                  <input className="input mono" value={edit[i] ?? ''} placeholder={r instanceof Error ? '' : r.size === 0 ? '0 / 1' : r.kind === 'counterBcd' ? 'C#10' : row.fmt === 'S5TIME' ? '5S' : ''}
                    onChange={(e) => setEdit({ ...edit, [i]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && apply(i, 'mod')} aria-label={T.vatPanel.nuevoValor} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" disabled={err} onClick={() => apply(i, 'mod')} title={T.vatPanel.modificarTitulo}>{T.vatPanel.modificar}</button>{' '}
                  {forced
                    ? <button className="btn small active" onClick={() => sim.unforce((r as Reader).op.text)} title={T.vatPanel.quitarForzado}>{T.vatPanel.desforzar}</button>
                    : <button className="btn small" disabled={err || !(r as Reader).op || (r as Reader).kind.startsWith('timer') || (r as Reader).kind.startsWith('counter')} onClick={() => apply(i, 'force')} title={T.vatPanel.forzarTitulo}>{T.vatPanel.forzar}</button>}
                  {' '}
                  <button className="btn small ghost icon" onClick={() => onRows(rows.filter((_, j) => j !== i))} aria-label={T.vatPanel.quitarFila}><Icon name="x" size={13} /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <form className="row" style={{ padding: 10 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input mono grow" placeholder={valorTZ ? T.vatPanel.ejemploTZ : T.vatPanel.ejemplo} value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label={T.vatPanel.operandoNuevo}
          list={sugerencias.length ? listaId : undefined} />
        {sugerencias.length > 0 && <datalist id={listaId}>{sugerencias.map((t) => <option key={t} value={t} />)}</datalist>}
        <button className="btn small" type="submit"><Icon name="plus" size={13} />{T.vatPanel.anadir}</button>
      </form>
      {sim.forces.size > 0 && (
        <div className="panel-sec" style={{ borderTop: '1px solid var(--border)' }}>
          <h4>{T.vatPanel.forzadosPermanentes} <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => sim.unforceAll()}>{T.vatPanel.quitarTodos}</button></h4>
          {[...sim.forces.entries()].map(([k, f]) => (
            <div key={k} className="row mono" style={{ fontSize: 12 }}><span className="warn-text">F</span>{f.text} = {f.display}<span className="spacer" /><button className="btn small ghost" onClick={() => sim.unforce(k)}>{T.vatPanel.quitar}</button></div>
          ))}
        </div>
      )}
    </div>
  );
}
