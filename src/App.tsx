import { useEffect, useState, type ReactNode } from 'react';
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
import { T } from './i18n';
import { BienvenidaIdioma } from './ui/common/idioma';

type Grupo = keyof typeof T.app.grupos;
interface NavDef { id: keyof typeof T.app.nav; icon: string; group?: Grupo }

const GRUPOS_PRACTICA = new Set<string>(['practicar', 'evaluar']);

const NAV: NavDef[] = [
  { id: 'inicio', icon: 'home' },
  { id: 'aprender', icon: 'book' },
  { id: 'ejemplos', icon: 'list' },
  { id: 'predice', icon: 'target', group: 'practicar' },
  { id: 'traza', icon: 'table', group: 'practicar' },
  { id: 'traduce', icon: 'swap', group: 'practicar' },
  { id: 'programa', icon: 'code', group: 'practicar' },
  { id: 'cronograma', icon: 'wave', group: 'practicar' },
  { id: 'teoria', icon: 'help', group: 'practicar' },
  { id: 'examen', icon: 'graduation', group: 'evaluar' },
  { id: 'progreso', icon: 'chart', group: 'evaluar' },
  { id: 'simulador', icon: 'cpu', group: 'simulador' },
  { id: 'ajustes', icon: 'settings', group: 'aplicacion' },
  { id: 'ayuda', icon: 'info', group: 'aplicacion' },
];

const MINI_KEY = 'automatizacion-barra-mini';

/** Barra de la izquierda plegada (solo iconos), como el explorador de proyectos: se recuerda */
function useBarraMini(): [boolean, (v: boolean) => void] {
  const [mini, setMini] = useState(() => { try { return localStorage.getItem(MINI_KEY) === '1'; } catch { return false; } });
  const poner = (v: boolean) => {
    setMini(v);
    try { localStorage.setItem(MINI_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ }
  };
  return [mini, poner];
}

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
const RUTAS_PRACTICA = new Set<string>(NAV.filter((n) => GRUPOS_PRACTICA.has(n.group ?? '')).map((n) => n.id));

function Desactivado() {
  return (
    <div className="page"><div className="page-narrow">
      <h1>{T.app.desactivadaTitulo}</h1>
      <p className="lead">{T.app.desactivadaTexto}</p>
      <button className="btn primary" onClick={() => go('simulador')}>{T.app.irAlSimulador}</button>
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
  let lastGroup: Grupo | undefined;
  const bloqueada = !PRACTICA_ACTIVA && (RUTAS_PRACTICA.has(top) || (top === 'ejercicio' && !!route[1] && !route[1].startsWith('E')));
  const render = bloqueada ? () => <Desactivado /> : screens[top];
  const [mini, setMini] = useBarraMini();
  return (
    <div className={`shell${mini ? ' mini' : ''}`}>
      <nav className="sidebar" aria-label={T.app.navegacion}>
        <div className="brand" title={mini ? `Automatizacion v${APP_VERSION}` : undefined}>
          <img src={iconUrl} alt="" />
          {!mini && <div className="grow"><b>Automatizacion</b><span>{T.app.subtitulo(APP_VERSION)}</span></div>}
          {!mini && <button className="btn small ghost icon" onClick={() => setMini(true)} title={T.app.ocultarBarraTitulo} aria-label={T.app.ocultarBarra}><Icon name="left" size={14} /></button>}
        </div>
        {mini && <button className="btn small ghost icon barra-mostrar" onClick={() => setMini(false)} title={T.app.mostrarBarra} aria-label={T.app.mostrarBarra}><Icon name="right" size={14} /></button>}
        {NAV_VISIBLE.map((n) => {
          const head = n.group && n.group !== lastGroup ? <div className="nav-group" key={`g${n.group}`}>{T.app.grupos[n.group]}</div> : null;
          lastGroup = n.group;
          const label = T.app.nav[n.id];
          return (
            <div key={n.id}>
              {head}
              <button className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={active === n.id ? 'page' : undefined}
                title={mini ? label : undefined} aria-label={mini ? label : undefined}>
                <Icon name={n.icon} />{!mini && label}
                {n.id === 'progreso' && pend > 0 && <span className="badge err" title={T.app.paraRepasar}>{pend}</span>}
              </button>
            </div>
          );
        })}
      </nav>
      <main className="main">
        {render ? render(route) : <div className="page"><div className="page-narrow"><h1>{T.app.nav[NAV.find((n) => n.id === top)?.id ?? 'inicio']}</h1><p className="lead">{T.app.enConstruccion}</p></div></div>}
      </main>
      <BienvenidaIdioma />
    </div>
  );
}
