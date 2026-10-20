import { useSettings, type Theme } from '../../store/settings';

export function AjustesScreen() {
  const s = useSettings();
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));
  return (
    <div className="page"><div className="page-narrow" style={{ maxWidth: 760 }}>
      <h1>Ajustes</h1>
      <div className="card card-pad col" style={{ gap: 16 }}>
        <label className="row">Tema
          <select className="input" value={s.theme} onChange={(e) => s.set({ theme: e.target.value as Theme })}>
            <option value="system">Como el sistema</option><option value="dark">Oscuro</option><option value="light">Claro</option>
          </select>
        </label>
        <label className="row">Nemotécnica por defecto
          <select className="input" value={s.nemotecnia} onChange={(e) => s.set({ nemotecnia: e.target.value as 'de' | 'en' })}>
            <option value="de">Alemana: U, O, E, A, M, Z</option><option value="en">Inglesa (IEC): A, O, I, Q, M, C</option>
          </select>
        </label>
        <label className="row">Tiempo de ciclo simulado
          <input className="input" type="number" min={1} max={100} value={s.cycleMs} onChange={(e) => s.set({ cycleMs: num(e.target.value, 1, 100) })} style={{ width: 80 }} /> ms
          <span className="faint">(los temporizadores avanzan en pasos de este tiempo)</span>
        </label>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Remanencia (se conserva al pasar de STOP a RUN)</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <label className="row">Marcas MB0 a MB <input className="input" type="number" min={0} max={2048} value={Math.max(0, s.retentiveMBytes - 1)} onChange={(e) => s.set({ retentiveMBytes: num(e.target.value, -1, 2047) + 1 })} style={{ width: 80 }} /></label>
            <label className="row">Contadores Z0 a Z <input className="input" type="number" min={0} max={255} value={Math.max(0, s.retentiveCounters - 1)} onChange={(e) => s.set({ retentiveCounters: num(e.target.value, -1, 255) + 1 })} style={{ width: 70 }} /></label>
            <label className="row">Temporizadores remanentes <input className="input" type="number" min={0} max={256} value={s.retentiveTimers} onChange={(e) => s.set({ retentiveTimers: num(e.target.value, 0, 256) })} style={{ width: 70 }} /></label>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Por defecto: MB0..MB15 y Z0..Z7. El borrado total (MRES) lo pone todo a 0.</div>
        </div>
        <label className="check"><input type="checkbox" checked={s.randomLocals} onChange={(e) => s.set({ randomLocals: e.target.checked })} />«Modo realista»: los datos locales (L) empiezan con valores aleatorios en cada llamada</label>
        <label className="check"><input type="checkbox" checked={s.simbolica} onChange={(e) => s.set({ simbolica: e.target.checked })} />Representación simbólica en KOP (mostrar el símbolo en lugar de la dirección)</label>
        <label className="check"><input type="checkbox" checked={s.observeExtra} onChange={(e) => s.set({ observeExtra: e.target.checked })} />«Observar» en AWL: mostrar también /ER, OR, A1A0, OV y OS</label>
        <label className="check"><input type="checkbox" checked={s.observeHex} onChange={(e) => s.set({ observeHex: e.target.checked })} />«Observar» en AWL: acumuladores en hexadecimal</label>
        <label className="row">Clic en una entrada
          <select className="input" value={s.entradaClic} onChange={(e) => s.set({ entradaClic: e.target.value as 'NA' | 'INT' })}>
            <option value="NA">Pulsador: 1 mientras se mantiene pulsado (al menos un ciclo)</option>
            <option value="INT">Interruptor: cada clic cambia y se queda</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={s.teclasEntradas} onChange={(e) => s.set({ teclasEntradas: e.target.checked })} />Teclas 1–8 para accionar las entradas (bits 0–7 del primer byte de entradas del programa; E124.0–E124.7 si no usa ninguna)</label>
        <label className="row">Zoom del KOP
          <input type="range" min={0.6} max={1.6} step={0.1} value={s.kopZoom} onChange={(e) => s.set({ kopZoom: +e.target.value })} /> {Math.round(s.kopZoom * 100)} %
        </label>
      </div>
    </div></div>
  );
}
