import { useEffect, type ReactNode } from 'react';
import { useHashRoute, go } from './ui/router';
import { Icon } from './ui/common/Icon';
import { useSettings } from './store/settings';
import { SimuladorLibre } from './ui/screens/SimuladorLibre';
import { InicioScreen } from './ui/screens/Inicio';
import { AprenderScreen } from './ui/screens/Aprender';
import { ListaScreen, EjercicioScreen } from './ui/screens/Lista';
import { TeoriaScreen } from './ui/screens/Teoria';
import { ExamenScreen } from './ui/screens/Examen';
import { ProgresoScreen } from './ui/screens/Progreso';
import { AjustesScreen } from './ui/screens/Ajustes';
import { AyudaScreen } from './ui/screens/Ayuda';
import iconUrl from './assets/icon.png';
import { installGlobalUndo } from './ui/globalUndo';
import { PRACTICA_ACTIVA } from './features';
import { version as APP_VERSION } from '../package.json';
import { pendientes, useProgress } from './store/progress';

interface NavDef { id: string; label: string; icon: string; group?: string }

const GRUPOS_PRACTICA = new Set(['Practicar', 'Evaluar']);

const NAV: NavDef[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'aprender', label: 'Aprender', icon: 'book' },
  { id: 'ejemplos', label: 'Ejemplos', icon: 'list' },
  { id: 'predice', label: 'Predice el resultado', icon: 'target', group: 'Practicar' },
  { id: 'traza', label: 'Traza', icon: 'table', group: 'Practicar' },
  { id: 'traduce', label: 'Traduce KOP ↔ AWL', icon: 'swap', group: 'Practicar' },
  { id: 'programa', label: 'Programa', icon: 'code', group: 'Practicar' },
  { id: 'cronograma', label: 'Cronograma', icon: 'wave', group: 'Practicar' },
  { id: 'teoria', label: 'Teoría', icon: 'help', group: 'Practicar' },
  { id: 'examen', label: 'Examen', icon: 'graduation', group: 'Evaluar' },
  { id: 'progreso', label: 'Progreso', icon: 'chart', group: 'Evaluar' },
  { id: 'simulador', label: 'Simulador libre', icon: 'cpu', group: 'Simulador' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings', group: 'Aplicación' },
  { id: 'ayuda', label: 'Ayuda', icon: 'info', group: 'Aplicación' },
];

function useTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}

const screens: Record<string, (route: string[]) => ReactNode> = {
  inicio: () => <InicioScreen />,
  aprender: (r) => <AprenderScreen cap={r[1]} />,
  ejemplos: () => <ListaScreen tipo="ejemplo" />,
  predice: () => <ListaScreen tipo="predice" />,
  traza: () => <ListaScreen tipo="traza" />,
  traduce: () => <ListaScreen tipo="traduce" />,
  programa: () => <ListaScreen tipo="programa" />,
  cronograma: () => <ListaScreen tipo="cronograma" />,
  teoria: () => <TeoriaScreen />,
  ejercicio: (r) => <EjercicioScreen key={r[1]} id={r[1]} back={r[2]} />,
  examen: () => <ExamenScreen />,
  progreso: () => <ProgresoScreen />,
  ajustes: () => <AjustesScreen />,
  ayuda: () => <AyudaScreen />,
  simulador: () => <SimuladorLibre />,
};

const NAV_VISIBLE = NAV.filter((n) => PRACTICA_ACTIVA || !GRUPOS_PRACTICA.has(n.group ?? ''));
const RUTAS_PRACTICA = new Set(NAV.filter((n) => GRUPOS_PRACTICA.has(n.group ?? '')).map((n) => n.id));

function Desactivado() {
  return (
    <div className="page"><div className="page-narrow">
      <h1>Sección desactivada</h1>
      <p className="lead">Los modos de práctica y evaluación están desactivados en esta versión: el trabajo se centra en el simulador libre.</p>
      <button className="btn primary" onClick={() => go('simulador')}>Ir al simulador libre</button>
    </div></div>
  );
}

export function App() {
  useTheme();
  useEffect(() => installGlobalUndo(), []);
  const route = useHashRoute();
  const top = route[0];
  // sin ruta: directamente al simulador libre
  useEffect(() => { if (!window.location.hash) go('simulador'); }, []);
  const active = top === 'ejercicio' ? (route[2] ?? 'ejemplos') : top;
  const pend = useProgress((st) => (PRACTICA_ACTIVA ? pendientes(st.items).length : 0));
  let lastGroup: string | undefined;
  const bloqueada = !PRACTICA_ACTIVA && (RUTAS_PRACTICA.has(top) || (top === 'ejercicio' && !!route[1] && !route[1].startsWith('E')));
  const render = bloqueada ? () => <Desactivado /> : screens[top];
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <img src={iconUrl} alt="" />
          <div><b>Automatizacion</b><span>PLC · KOP y AWL · v{APP_VERSION}</span></div>
        </div>
        {NAV_VISIBLE.map((n) => {
          const head = n.group && n.group !== lastGroup ? <div className="nav-group" key={`g${n.group}`}>{n.group}</div> : null;
          lastGroup = n.group;
          return (
            <div key={n.id}>
              {head}
              <button className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={active === n.id ? 'page' : undefined}>
                <Icon name={n.icon} />{n.label}
                {n.id === 'progreso' && pend > 0 && <span className="badge err" title="Ejercicios para repasar hoy">{pend}</span>}
              </button>
            </div>
          );
        })}
      </nav>
      <main className="main">
        {render ? render(route) : <div className="page"><div className="page-narrow"><h1>{NAV.find((n) => n.id === top)?.label ?? 'Inicio'}</h1><p className="lead">En construcción.</p></div></div>}
      </main>
    </div>
  );
}
