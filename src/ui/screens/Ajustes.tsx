import { useSettings, type Settings, type Theme } from '../../store/settings';
import { T } from '../../i18n';
import { Desplegable } from '../common/ui';
import { SelectorIdioma } from '../common/idioma';

const TEMAS: { value: Theme; label: string }[] = (['system', 'dark', 'light'] as const).map((value) => ({ value, label: T.ajustes.temas[value] }));
const NEMOTECNIAS: { value: Settings['nemotecnia']; label: string }[] = (['de', 'en'] as const).map((value) => ({ value, label: T.ajustes.nemotecnias[value] }));
const CLIC_ENTRADA: { value: Settings['entradaClic']; label: string }[] = (['NA', 'INT'] as const).map((value) => ({ value, label: T.ajustes.clicEntradas[value] }));

export function AjustesScreen() {
  const s = useSettings();
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));
  return (
    <div className="page"><div className="page-narrow" style={{ maxWidth: 760 }}>
      <h1>{T.ajustes.titulo}</h1>
      <div className="card card-pad col" style={{ gap: 16 }}>
        <SelectorIdioma />
        <div className="row">{T.ajustes.tema}
          <Desplegable value={s.theme} options={TEMAS} onChange={(theme) => s.set({ theme })} aria-label={T.ajustes.tema} />
        </div>
        <div className="row">{T.ajustes.nemotecnia}
          <Desplegable value={s.nemotecnia} options={NEMOTECNIAS} onChange={(nemotecnia) => s.set({ nemotecnia })} aria-label={T.ajustes.nemotecnia} />
        </div>
        <label className="row">{T.ajustes.ciclo}
          <input className="input" type="number" min={1} max={100} value={s.cycleMs} onChange={(e) => s.set({ cycleMs: num(e.target.value, 1, 100) })} style={{ width: 80 }} /> ms
          <span className="faint">{T.ajustes.cicloNota}</span>
        </label>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{T.ajustes.remanencia}</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <label className="row">{T.ajustes.remMarcas} <input className="input" type="number" min={0} max={2048} value={Math.max(0, s.retentiveMBytes - 1)} onChange={(e) => s.set({ retentiveMBytes: num(e.target.value, -1, 2047) + 1 })} style={{ width: 80 }} /></label>
            <label className="row">{T.ajustes.remContadores} <input className="input" type="number" min={0} max={255} value={Math.max(0, s.retentiveCounters - 1)} onChange={(e) => s.set({ retentiveCounters: num(e.target.value, -1, 255) + 1 })} style={{ width: 70 }} /></label>
            <label className="row">{T.ajustes.remTemporizadores} <input className="input" type="number" min={0} max={256} value={s.retentiveTimers} onChange={(e) => s.set({ retentiveTimers: num(e.target.value, 0, 256) })} style={{ width: 70 }} /></label>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{T.ajustes.remNota}</div>
        </div>
        <label className="check"><input type="checkbox" checked={s.randomLocals} onChange={(e) => s.set({ randomLocals: e.target.checked })} />{T.ajustes.modoRealista}</label>
        <label className="check"><input type="checkbox" checked={s.simbolica} onChange={(e) => s.set({ simbolica: e.target.checked })} />{T.ajustes.simbolica}</label>
        <label className="check"><input type="checkbox" checked={s.observeExtra} onChange={(e) => s.set({ observeExtra: e.target.checked })} />{T.ajustes.observarExtra}</label>
        <label className="check"><input type="checkbox" checked={s.observeHex} onChange={(e) => s.set({ observeHex: e.target.checked })} />{T.ajustes.observarHex}</label>
        <div className="row">{T.ajustes.clicEntrada}
          <Desplegable value={s.entradaClic} options={CLIC_ENTRADA} onChange={(entradaClic) => s.set({ entradaClic })} aria-label={T.ajustes.clicEntrada} />
        </div>
        <label className="check"><input type="checkbox" checked={s.teclasEntradas} onChange={(e) => s.set({ teclasEntradas: e.target.checked })} />{T.ajustes.teclas}</label>
        <label className="row">{T.ajustes.zoomKop}
          <input type="range" min={0.6} max={1.6} step={0.1} value={s.kopZoom} onChange={(e) => s.set({ kopZoom: +e.target.value })} /> {Math.round(s.kopZoom * 100)} %
        </label>
      </div>
    </div></div>
  );
}
