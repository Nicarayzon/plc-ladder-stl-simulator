import type { Simbolo } from '../../core/program';
import { Icon } from '../common/Icon';

const TIPOS = ['BOOL', 'BYTE', 'WORD', 'INT', 'DWORD', 'DINT', 'REAL', 'S5TIME', 'TIMER', 'COUNTER'];

function guessTipo(dir: string): string {
  const d = dir.trim().toUpperCase();
  if (/^[EAM]\s*\d+\.\d$|^DB\d+\.DBX/.test(d)) return 'BOOL';
  if (/^T\s*\d+$/.test(d)) return 'TIMER';
  if (/^Z\s*\d+$/.test(d)) return 'COUNTER';
  if (/^(EB|AB|MB|DBB)/.test(d)) return 'BYTE';
  if (/^(EW|AW|MW|PEW|PAW|DBW)/.test(d)) return 'INT';
  if (/^(ED|AD|MD|DBD)/.test(d)) return 'DINT';
  return 'BOOL';
}

export function SymbolsPanel({ simbolos, onChange, errors, readOnly }: { simbolos: Simbolo[]; onChange: (s: Simbolo[]) => void; errors: string[]; readOnly?: boolean }) {
  const upd = (i: number, p: Partial<Simbolo>) => onChange(simbolos.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div>
      <table className="tbl">
        <thead><tr><th>Símbolo</th><th>Dirección</th><th>Tipo</th><th>Comentario</th><th /></tr></thead>
        <tbody>
          {simbolos.map((s, i) => (
            <tr key={i}>
              <td><input className="input" style={{ height: 24, width: '100%' }} value={s.nombre} disabled={readOnly} onChange={(e) => upd(i, { nombre: e.target.value })} aria-label="Símbolo" /></td>
              <td><input className="input mono" style={{ height: 24, width: 86 }} value={s.dir} disabled={readOnly}
                onChange={(e) => upd(i, { dir: e.target.value, tipo: s.tipo && s.tipo !== guessTipo(s.dir) ? s.tipo : guessTipo(e.target.value) })} aria-label="Dirección" /></td>
              <td>
                <select className="input" style={{ height: 24, padding: '0 4px' }} value={s.tipo} disabled={readOnly} onChange={(e) => upd(i, { tipo: e.target.value })} aria-label="Tipo">
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </td>
              <td><input className="input" style={{ height: 24, width: '100%' }} value={s.comentario ?? ''} disabled={readOnly} onChange={(e) => upd(i, { comentario: e.target.value })} aria-label="Comentario" /></td>
              <td>{!readOnly && <button className="btn small ghost icon" onClick={() => onChange(simbolos.filter((_, j) => j !== i))} aria-label="Quitar símbolo"><Icon name="x" size={13} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <div style={{ padding: 10 }}><button className="btn small" onClick={() => onChange([...simbolos, { nombre: '', dir: '', tipo: 'BOOL' }])}><Icon name="plus" size={13} />Añadir símbolo</button></div>}
      {errors.length > 0 && <div className="panel-sec err-text" style={{ fontSize: 12 }}>{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      <div className="panel-sec faint" style={{ fontSize: 11.5 }}>En el código se escribe el símbolo entre comillas: <span className="mono">U "Nombre"</span>. Son opcionales: puedes programar directamente con direcciones (<span className="mono">U E 124.0</span>).</div>
    </div>
  );
}
