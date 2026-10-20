import { BANCO, TIPO_LABEL } from '../../content/banco';
import { pendientes, useProgress } from '../../store/progress';
import { useProjects, type Proyecto } from '../../store/projects';
import { migrarHw } from '../../core/program';
import { useSettings } from '../../store/settings';
import { go } from '../router';
import { downloadText, pickFile, toast } from '../common/ui';
import { Icon } from '../common/Icon';
import { PREGUNTAS } from './Teoria';

export function ProgresoScreen() {
  const st = useProgress();
  const pend = new Set(pendientes(st.items));
  const ej = BANCO.filter((e) => e.tipo !== 'teoria');
  const exportAll = () => {
    const data = { formato: 'automatizacion-copia-v1', fecha: new Date().toISOString(), progreso: { items: st.items, examenes: st.examenes, borradores: st.borradores }, proyectos: useProjects.getState().proyectos, ajustes: { ...useSettings.getState(), set: undefined } };
    downloadText(`automatizacion-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  };
  const importAll = async () => {
    const txt = await pickFile('.json,application/json');
    if (!txt) return;
    try {
      const d = JSON.parse(txt);
      if (d.progreso) st.importar(d.progreso);
      if (Array.isArray(d.proyectos)) {
        const cur = useProjects.getState().proyectos;
        const ids = new Set(cur.map((p) => p.id));
        useProjects.setState({ proyectos: [...cur, ...d.proyectos.filter((p: Proyecto) => !ids.has(p.id)).map((p: Proyecto) => (p.programa ? { ...p, programa: migrarHw(p.programa) } : p))] });
      }
      toast('Copia importada');
    } catch (e) { toast(`No se pudo importar: ${(e as Error).message}`); }
  };
  const theoryOk = PREGUNTAS.filter((q) => st.items[`M01:${q.id}`]?.estado === 'superado').length;
  return (
    <div className="page"><div className="page-narrow">
      <h1>Progreso</h1>
      <p className="lead">Tu progreso se guarda en este ordenador. Los ejercicios fallados vuelven a «repaso» al cabo de 1, 3 y 7 días.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={exportAll}><Icon name="download" size={14} />Exportar copia (JSON)</button>
        <button className="btn" onClick={importAll}><Icon name="upload" size={14} />Importar copia</button>
        <span className="spacer" />
        <button className="btn danger" onClick={() => { if (confirm('¿Borrar todo el progreso? Los programas del simulador libre se conservan.')) st.reiniciar(); }}>Borrar progreso</button>
      </div>
      <div className="card card-pad" style={{ marginBottom: 14 }}>Teoría: <b>{theoryOk}</b> de {PREGUNTAS.length} preguntas acertadas.</div>
      <table className="tbl card">
        <thead><tr><th>Ejercicio</th><th>Tipo</th><th>Estado</th><th className="num">Mejor nota</th><th className="num">Intentos</th><th>Último</th><th>Repaso</th></tr></thead>
        <tbody>
          {ej.map((e) => {
            const it = st.items[e.id];
            return (
              <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => go(`ejercicio/${e.id}`)}>
                <td><b className="mono">{e.id}</b> {e.titulo}</td>
                <td>{TIPO_LABEL[e.tipo]}</td>
                <td>{!it || it.estado === 'sin_ver' ? <span className="faint">sin ver</span> : it.estado === 'superado' ? <span className="badge ok">superado</span> : <span className="badge warn">intentado</span>}</td>
                <td className="num">{it?.intentos ? `${Math.round(it.mejorNota * 100)} %` : '—'}</td>
                <td className="num">{it?.intentos ?? 0}</td>
                <td>{it?.fecha ? new Date(it.fecha).toLocaleDateString('es-ES') : '—'}</td>
                <td>{pend.has(e.id) ? <span className="badge err">hoy</span> : it?.proximo ? new Date(it.proximo).toLocaleDateString('es-ES') : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div></div>
  );
}
