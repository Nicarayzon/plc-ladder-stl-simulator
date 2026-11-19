// Ventana «Biblioteca estándar»: un árbol de carpetas con los bloques ya hechos (FC 82 RSET, FC 83 SSET). Un bloque
// se trae al proyecto arrastrándolo a la carpeta «Bloques» del explorador, con Ctrl+C / Ctrl+V o con el botón
// «Copiar al proyecto». Con un bloque seleccionado, F1 abre su ayuda.
import { useState } from 'react';
import { VentanaFlotante } from '../common/VentanaFlotante';
import { Icon } from '../common/Icon';
import { Rico } from '../common/Rico';
import { ContextMenu, toast, type MenuItem } from '../common/ui';
import { AwlHighlight } from '../common/AwlHighlight';
import { useProjects } from '../../store/projects';
import { BIBLIOTECA, conEspacio, esLibId, type LibId } from '../../core/biblioteca';
import { addLibBlock, libEnProyecto } from '../workbench/programOps';
import { T } from '../../i18n';

/** Tipo de los datos que se arrastran de la biblioteca al explorador */
export const LIB_MIME = 'application/x-automatizacion-biblioteca';

/** Bloque copiado con Ctrl+C en la biblioteca, para pegarlo con Ctrl+V en la carpeta «Bloques» */
let portapapeles: LibId | null = null;
export const libCopiado = (): LibId | null => portapapeles;

/** Lee el bloque de biblioteca de un arrastre (o null si lo que se arrastra es otra cosa) */
export function libDeArrastre(e: React.DragEvent): LibId | null {
  const v = e.dataTransfer.getData(LIB_MIME);
  return esLibId(v) ? v : null;
}
export const esArrastreLib = (e: React.DragEvent) => e.dataTransfer.types.includes(LIB_MIME);

/** Copia un bloque de la biblioteca a un proyecto. Si ya hay un bloque tuyo con ese número, pregunta antes. */
export function copiarAlProyecto(projId: string, id: LibId): boolean {
  const { proyectos, actualizar } = useProjects.getState();
  const p = proyectos.find((x) => x.id === projId);
  if (!p) return false;
  const fc = conEspacio(BIBLIOTECA[id].bloque);
  const est = libEnProyecto(p.programa, id);
  if (est === 'igual') {
    toast(T.biblioteca.yaEsta(fc, id, p.nombre));
    return false;
  }
  if (est === 'otro' && !confirm(T.biblioteca.sustituir(fc, p.nombre))) return false;
  actualizar(p.id, { programa: addLibBlock(p.programa, id) });
  toast(T.biblioteca.copiado(fc, id, p.nombre));
  return true;
}

/** Ayuda de un bloque de biblioteca: qué hace, sus parámetros, avisos y un ejemplo (ventana de la biblioteca y bloque abierto) */
export function AyudaLib({ id }: { id: LibId }) {
  const def = BIBLIOTECA[id];
  const A = T.biblioteca.ayuda[id];
  return (
    <div className="lib-ayuda">
      <p><Rico t={A.descripcion} /></p>
      <table className="tbl bib-params">
        <thead><tr><th>{T.biblioteca.parametro}</th><th>{T.biblioteca.declaracion}</th><th>{T.biblioteca.tipo}</th><th>{T.biblioteca.significado}</th></tr></thead>
        <tbody>{def.params.map((p) => <tr key={p.nombre}><td className="mono">{p.nombre}</td><td className="mono">IN</td><td className="mono">{p.tipo}</td><td><Rico t={(A.params as Record<string, string>)[p.nombre]} /></td></tr>)}</tbody>
      </table>
      <ul>{A.notas.map((n, i) => <li key={i}><Rico t={n} /></li>)}</ul>
      <div className="faint" style={{ fontSize: 11.5, margin: '6px 0 2px' }}>{T.biblioteca.ejemplo}</div>
      <AwlHighlight code={A.ejemplo} />
    </div>
  );
}

interface Carpeta { id: string; nombre: string; hijos?: Carpeta[]; libs?: LibId[] }

/** Carpetas de la biblioteca */
const ARBOL: Carpeta = {
  id: 'raiz', nombre: T.biblioteca.raiz, hijos: [
    { id: 'conv', nombre: T.biblioteca.conversion, hijos: [{ id: 'bloques', nombre: T.biblioteca.bloques, libs: ['RSET', 'SSET'] }] },
  ],
};

const buscar = (c: Carpeta, id: string): Carpeta | null => (c.id === id ? c : (c.hijos ?? []).map((h) => buscar(h, id)).find(Boolean) ?? null);
const ruta = (c: Carpeta, id: string): Carpeta[] => {
  if (c.id === id) return [c];
  for (const h of c.hijos ?? []) {
    const r = ruta(h, id);
    if (r.length) return [c, ...r];
  }
  return [];
};

const CLAVE_CARPETA = 'automatizacion-biblioteca-carpeta';
const leerCarpeta = () => { try { const v = localStorage.getItem(CLAVE_CARPETA); return v && buscar(ARBOL, v) ? v : 'raiz'; } catch { return 'raiz'; } };

export function BibliotecaVentana({ proyecto, onCerrar }: { proyecto: { id: string; nombre: string } | null; onCerrar: () => void }) {
  const [carpeta, setCarpetaState] = useState(leerCarpeta);
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(ruta(ARBOL, carpeta).map((c) => c.id)));
  const [sel, setSel] = useState<LibId | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const actual = buscar(ARBOL, carpeta)!;
  const setCarpeta = (id: string) => {
    setCarpetaState(id);
    setSel(null);
    setAbiertas((a) => new Set([...a, ...ruta(ARBOL, id).map((c) => c.id)]));
    try { localStorage.setItem(CLAVE_CARPETA, id); } catch { /* sin almacenamiento */ }
  };
  const copiar = (id: LibId) => {
    portapapeles = id;
    toast(T.biblioteca.copiadoPortapapeles(conEspacio(BIBLIOTECA[id].bloque), id));
  };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'F1') {
      e.preventDefault();
      if (sel) setAyuda((a) => !a);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel) {
      e.preventDefault();
      copiar(sel);
    }
  };

  const nodo = (c: Carpeta, nivel: number) => {
    const abierta = abiertas.has(c.id);
    const tieneHijos = !!c.hijos?.length;
    return (
      <div key={c.id}>
        <div className={`bib-nodo ${carpeta === c.id ? 'cur' : ''}`} style={{ paddingLeft: 6 + nivel * 14 }} role="treeitem" aria-expanded={tieneHijos ? abierta : undefined} tabIndex={0}
          onClick={() => setCarpeta(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') setCarpeta(c.id); }}>
          <span className="bib-flecha" onClick={(e) => { e.stopPropagation(); setAbiertas((a) => { const n = new Set(a); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; }); }}>
            {tieneHijos ? <Icon name={abierta ? 'down' : 'right'} size={11} /> : null}
          </span>
          <Icon name={c.id === 'raiz' ? 'book' : 'folder'} size={14} />
          <span className="grow">{c.nombre}</span>
        </div>
        {abierta && c.hijos?.map((h) => nodo(h, nivel + 1))}
      </div>
    );
  };

  const def = sel ? BIBLIOTECA[sel] : null;
  const A = sel ? T.biblioteca.ayuda[sel] : null;
  return (
    <VentanaFlotante titulo={T.biblioteca.titulo} icono="book" clave="automatizacion-biblioteca-ventana" z={42} minW={560} minH={340} className="bib"
      inicial={() => ({ x: Math.max(240, window.innerWidth - 820), y: 90, w: 760, h: 520 })} onCerrar={onCerrar} onKeyDown={teclas}>
      <div className="bib-cuerpo">
        <div className="bib-ruta faint">{ruta(ARBOL, carpeta).map((c) => c.nombre).join(' › ')}</div>
        <div className="bib-main">
          <div className="bib-arbol" role="tree" aria-label={T.biblioteca.carpetas}>{nodo(ARBOL, 0)}</div>
          <div className="bib-lista" role="grid" aria-label={T.biblioteca.contenido(actual.nombre)}>
            <div className="bib-fila cab" role="row">
              <span>{T.biblioteca.colNombre}</span><span>{T.biblioteca.colSimbolo}</span><span>{T.biblioteca.colLenguaje}</span><span>{T.biblioteca.colComentario}</span>
            </div>
            {(actual.hijos ?? []).map((h) => (
              <div key={h.id} className="bib-fila" role="row" tabIndex={0} onDoubleClick={() => setCarpeta(h.id)} onKeyDown={(e) => { if (e.key === 'Enter') setCarpeta(h.id); }}>
                <span className="row" style={{ gap: 6 }}><Icon name="folder" size={14} />{h.nombre}</span><span /><span /><span className="faint">{T.biblioteca.carpeta}</span>
              </div>
            ))}
            {(actual.libs ?? []).map((id) => {
              const d = BIBLIOTECA[id];
              return (
                <div key={id} className={`bib-fila bloque ${sel === id ? 'sel' : ''}`} role="row" tabIndex={0} draggable aria-selected={sel === id}
                  title={T.biblioteca.arrastraTitulo}
                  onClick={() => setSel(id)} onFocus={() => setSel(id)} onDoubleClick={() => { setSel(id); setAyuda(true); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSel(id);
                    setMenu({ x: e.clientX, y: e.clientY, items: [
                      { label: T.biblioteca.copiar, hint: 'Ctrl+C', onClick: () => copiar(id) },
                      { label: T.biblioteca.copiarAlProyecto, disabled: !proyecto, onClick: () => proyecto && copiarAlProyecto(proyecto.id, id) },
                      { sep: true, label: '' },
                      { label: T.biblioteca.ayudaBoton, onClick: () => setAyuda(true) },
                    ] });
                  }}
                  onDragStart={(e) => { setSel(id); e.dataTransfer.setData(LIB_MIME, id); e.dataTransfer.setData('text/plain', `${conEspacio(d.bloque)} (${id})`); e.dataTransfer.effectAllowed = 'copy'; }}>
                  <span className="row mono" style={{ gap: 6 }}><Icon name="lock" size={12} />{d.bloque}</span>
                  <span className="mono">{id}</span>
                  <span>AWL</span>
                  <span className="faint">{T.biblioteca.ayuda[id].resumen}</span>
                </div>
              );
            })}
            {!actual.hijos?.length && !actual.libs?.length && <div className="faint" style={{ padding: 12 }}>{T.biblioteca.vacia}</div>}
          </div>
        </div>
        {ayuda && def && A && (
          <div className="bib-ayuda" role="region" aria-label={T.biblioteca.ayudaDe(conEspacio(def.bloque))}>
            <div className="row" style={{ marginBottom: 4 }}>
              <b>{conEspacio(def.bloque)} «{def.id}» — {A.titulo}</b>
              <span className="spacer" />
              <button className="btn small ghost icon" onClick={() => setAyuda(false)} title={T.comun.cerrar} aria-label={T.biblioteca.cerrarAyuda}><Icon name="x" size={12} /></button>
            </div>
            <AyudaLib id={def.id} />
          </div>
        )}
        <div className="bib-pie">
          <span className="faint grow" style={{ fontSize: 11.5 }}>
            {def && A ? <Rico t={T.biblioteca.estadoSel(def.bloque, def.id, A.resumen)} /> : <Rico t={T.biblioteca.estado} />}
          </span>
          <button className="btn small" disabled={!sel} onClick={() => setAyuda((a) => !a)} aria-pressed={ayuda}><Icon name="help" size={13} />{T.biblioteca.ayudaBoton}</button>
          <button className="btn small primary" disabled={!sel || !proyecto} onClick={() => sel && proyecto && copiarAlProyecto(proyecto.id, sel)}
            title={proyecto ? T.biblioteca.copiarTitulo(proyecto.nombre) : undefined}>
            <Icon name="copy" size={13} />{T.biblioteca.copiarAlProyecto}
          </button>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </VentanaFlotante>
  );
}
