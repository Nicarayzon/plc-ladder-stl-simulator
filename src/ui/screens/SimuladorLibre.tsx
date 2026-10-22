import { useEffect, useState } from 'react';
import { useProjects, type Proyecto } from '../../store/projects';
import { Workbench } from '../workbench/Workbench';
import { useWorkbenchSim } from '../workbench/useWorkbenchSim';
import { useSenalesVentana, type SenalesVentana } from '../workbench/SenalesVentana';
import { ContextMenu, downloadText, pickFile, toast, useSplit, type MenuItem } from '../common/ui';
import { askText } from '../common/ask';
import { Icon } from '../common/Icon';
import { exportAwlSource, importAwlSource } from '../../core/awlsource';
import { emptyProgram, migrarHw, type Programa } from '../../core/program';
import { normBlockName } from '../../core/compiler';
import { emptyWbState, migrarVat, nextVat } from '../workbench/types';
import { filasTZ } from '../workbench/vat';
import { useSettings } from '../../store/settings';
import * as ops from '../workbench/programOps';

const BLOCK_DESC: Record<string, string> = { OB1: 'programa cíclico', OB100: 'arranque' };

export function SimuladorLibre() {
  const { proyectos, actual, crear, setActual } = useProjects();
  const [block, setBlock] = useState('OB1');
  useEffect(() => {
    if (!proyectos.length) crear('Proyecto 1', emptyProgram(), emptyWbState());
    else if (!actual || !proyectos.some((p) => p.id === actual)) setActual(proyectos[0].id);
  }, [proyectos.length, actual]); // eslint-disable-line react-hooks/exhaustive-deps
  const proj = proyectos.find((p) => p.id === actual);
  const [w, startW] = useSplit('libre-explorer', 210, 150, 380);
  const [open, setOpen] = useState(true);
  const senales = useSenalesVentana();
  /** Tabla de variables que hay que abrir en su ventana (clic en el explorador) */
  const [vatPedida, setVatPedida] = useState<{ proj: string; nombre: string; n: number } | null>(null);
  const abrirVat = (id: string, nombre: string) => { setActual(id); setVatPedida({ proj: id, nombre, n: Date.now() }); };
  return (
    <div className="libre">
      {open && (
        <>
          <Explorer width={w} block={block} onOpen={(id, b) => { setActual(id); setBlock(b); }} onOpenVat={abrirVat} onCollapse={() => setOpen(false)} />
          <div className="splitter-x" onMouseDown={(e) => startW(e, 'x')} />
        </>
      )}
      <div className="libre-main">
        {proj && <ProjectWorkbench key={proj.id} proj={proj} block={block} onBlock={setBlock} explorerHidden={!open} onShowExplorer={() => setOpen(true)} senales={senales}
          vatPedida={vatPedida?.proj === proj.id ? vatPedida : null} onVatAtendida={() => setVatPedida(null)} />}
      </div>
    </div>
  );
}

function newProjectProgram(): Programa {
  return { nemotecnia: useSettings.getState().nemotecnia, simbolos: [], bloques: [] };
}

function Explorer({ width, block, onOpen, onOpenVat, onCollapse }: { width: number; block: string; onOpen: (id: string, block: string) => void; onOpenVat: (id: string, vat: string) => void; onCollapse: () => void }) {
  const { proyectos, actual, crear, actualizar, borrar } = useProjects();
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const nombreLibre = (base: string) => {
    const usados = new Set(proyectos.map((p) => p.nombre));
    if (!usados.has(base)) return base;
    for (let i = 2; ; i++) if (!usados.has(`${base} (${i})`)) return `${base} (${i})`;
  };
  const validarNombre = (actualNombre?: string) => (v: string) =>
    proyectos.some((p) => p.nombre.trim().toLowerCase() === v.trim().toLowerCase() && p.nombre !== actualNombre) ? 'Ya hay un proyecto con ese nombre' : null;

  const nuevoProyecto = async () => {
    const nombre = await askText({ title: 'Nuevo proyecto', label: 'Nombre del proyecto (la carpeta):', value: nombreLibre(`Proyecto ${proyectos.length + 1}`), ok: 'Crear', validate: validarNombre() });
    if (!nombre) return;
    const id = crear(nombre, newProjectProgram(), emptyWbState());
    onOpen(id, 'OB1');
  };

  const crearBloque = (p: Proyecto, nombre: string) => {
    actualizar(p.id, { programa: ops.addBlock(p.programa, nombre) });
    onOpen(p.id, nombre);
  };

  /** Tabla de variables nueva (VAT_1, VAT_2…): empieza con los T y Z del programa */
  const crearVat = (p: Proyecto) => {
    const nombre = nextVat(p.wb);
    actualizar(p.id, { wb: { ...p.wb, vats: [...(p.wb.vats ?? []), { nombre, filas: filasTZ(p.programa) }] } });
    onOpenVat(p.id, nombre);
  };

  /** «Insertar nuevo objeto» */
  const insertarObjeto = (p: Proyecto): MenuItem => {
    const nombres = p.programa.bloques.map((b) => normBlockName(b.nombre));
    return { label: 'Insertar nuevo objeto', items: [
      ...(nombres.includes('OB1') ? [] : [{ label: 'Bloque de organización (OB1)', onClick: () => crearBloque(p, 'OB1') }]),
      { label: `Función (${ops.nextFc(p.programa)})`, onClick: () => crearBloque(p, ops.nextFc(p.programa)) },
      { label: 'Bloque de organización (OB100)', disabled: nombres.includes('OB100'), onClick: () => crearBloque(p, 'OB100') },
      { sep: true, label: '' },
      { label: 'Tabla de variables', onClick: () => crearVat(p) },
    ] };
  };

  const menuProyecto = (p: Proyecto): MenuItem[] => {
    const nombres = p.programa.bloques.map((b) => normBlockName(b.nombre));
    return [
      { label: 'Crear OB1 (programa cíclico)', disabled: nombres.includes('OB1'), onClick: () => crearBloque(p, 'OB1') },
      { label: `Crear ${ops.nextFc(p.programa)} (función)`, onClick: () => crearBloque(p, ops.nextFc(p.programa)) },
      { label: 'Crear OB100 (arranque)', disabled: nombres.includes('OB100'), onClick: () => crearBloque(p, 'OB100') },
      { label: `Crear tabla de variables (${nextVat(p.wb)})`, onClick: () => crearVat(p) },
      { sep: true, label: '' },
      { label: 'Renombrar…', onClick: async () => { const n = await askText({ title: 'Renombrar proyecto', label: 'Nombre del proyecto:', value: p.nombre, validate: validarNombre(p.nombre) }); if (n) actualizar(p.id, { nombre: n }); } },
      { label: 'Duplicar', onClick: () => { const id = crear(nombreLibre(`${p.nombre} (copia)`), structuredClone(p.programa), structuredClone(p.wb)); onOpen(id, 'OB1'); } },
      { label: 'Exportar proyecto (.json)', onClick: () => downloadText(`${p.nombre}.json`, JSON.stringify({ formato: 'automatizacion-proyecto-v1', nombre: p.nombre, programa: p.programa, wb: p.wb }, null, 2), 'application/json') },
      { label: 'Exportar fuente AWL (.awl)', onClick: () => downloadText(`${p.nombre}.awl`, exportAwlSource(p.programa)) },
      { sep: true, label: '' },
      { label: 'Borrar proyecto', onClick: () => { if (confirm(`¿Borrar el proyecto «${p.nombre}» con todos sus bloques? No se puede deshacer.`)) borrar(p.id); } },
    ];
  };

  const menuBloque = (p: Proyecto, b: string): MenuItem[] => [
    { label: `Abrir ${b}`, onClick: () => onOpen(p.id, b) },
    insertarObjeto(p),
    { sep: true, label: '' },
    ...(b.startsWith('FC') ? [{ label: `Renombrar ${b}…`, onClick: async () => {
      const nombres = p.programa.bloques.map((x) => normBlockName(x.nombre));
      const to = (await askText({ title: `Renombrar ${b}`, label: 'Nuevo nombre (FC n):', value: b, validate: (v) => {
        const t = v.toUpperCase().replace(/\s+/g, '');
        return !/^FC\d+$/.test(t) ? 'Escribe FC seguido de un número (FC2, FC10…)' : nombres.includes(t) && t !== b ? `Ya existe ${t}` : null;
      } }))?.toUpperCase().replace(/\s+/g, '');
      if (to && to !== b) { actualizar(p.id, { programa: ops.renameBlock(p.programa, b, to) }); onOpen(p.id, to); }
    } }] : []),
    { label: `Borrar ${b}`, onClick: () => { if (confirm(`¿Borrar el bloque ${b} de «${p.nombre}»?`)) actualizar(p.id, { programa: ops.removeBlock(p.programa, b) }); } },
  ];

  const menuVat = (p: Proyecto, v: string): MenuItem[] => [
    { label: `Abrir ${v}`, onClick: () => onOpenVat(p.id, v) },
    insertarObjeto(p),
    { sep: true, label: '' },
    { label: `Renombrar ${v}…`, onClick: async () => {
      const vats = p.wb.vats ?? [];
      const to = (await askText({ title: `Renombrar ${v}`, label: 'Nombre de la tabla de variables:', value: v, validate: (x) => {
        const t = x.trim();
        return !t ? 'Escribe un nombre' : t.length > 24 ? 'Como mucho 24 caracteres' : vats.some((o) => o.nombre !== v && o.nombre.toUpperCase() === t.toUpperCase()) ? `Ya existe ${t}` : null;
      } }))?.trim();
      if (!to || to === v) return;
      actualizar(p.id, { wb: { ...p.wb, vats: vats.map((o) => (o.nombre === v ? { ...o, nombre: to } : o)) } });
      onOpenVat(p.id, to);
    } },
    { label: `Borrar ${v}`, onClick: () => { if (confirm(`¿Borrar la tabla de variables ${v} de «${p.nombre}»?`)) actualizar(p.id, { wb: { ...p.wb, vats: (p.wb.vats ?? []).filter((o) => o.nombre !== v) } }); } },
  ];

  const menuGeneral: MenuItem[] = [
    { label: 'Nuevo proyecto…', onClick: nuevoProyecto },
    { sep: true, label: '' },
    { label: 'Importar proyecto (.json)…', onClick: async () => {
      const txt = await pickFile('.json,application/json');
      if (!txt) return;
      try {
        const d = JSON.parse(txt);
        if (!d.programa?.bloques) throw new Error('no es un proyecto de Automatizacion');
        const id = crear(nombreLibre(d.nombre ?? 'Importado'), migrarHw(d.programa), migrarVat(d.wb ?? emptyWbState()));
        onOpen(id, 'OB1');
        toast('Proyecto importado');
      } catch (e) { toast(`No se pudo importar: ${(e as Error).message}`); }
    } },
    { label: 'Importar fuente AWL (.awl)…', onClick: async () => {
      const txt = await pickFile('.awl,.AWL,.txt');
      if (!txt) return;
      try { const id = crear(nombreLibre('Fuente AWL importada'), importAwlSource(txt), emptyWbState()); onOpen(id, 'OB1'); toast('Fuente importada'); } catch (e) { toast(`No se pudo importar: ${(e as Error).message}`); }
    } },
  ];

  return (
    <aside className="explorer" style={{ width }} aria-label="Proyectos">
      <div className="explorer-head">
        <span>Proyectos</span>
        <span className="spacer" />
        <button className="btn small" onClick={nuevoProyecto} title="Crear un proyecto nuevo (carpeta)"><Icon name="plus" size={13} />Nuevo</button>
        <button className="btn small ghost icon" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, items: menuGeneral })} aria-label="Más opciones"><Icon name="dots" size={14} /></button>
        <button className="btn small ghost icon" onClick={onCollapse} title="Ocultar el explorador" aria-label="Ocultar el explorador"><Icon name="left" size={14} /></button>
      </div>
      <div className="explorer-list">
        {proyectos.map((p) => {
          const isCur = p.id === actual;
          const expanded = isCur && !closed.has(p.id);
          const bloques = p.programa.bloques.map((b) => normBlockName(b.nombre));
          return (
            <div key={p.id}>
              <div className={`ex-folder ${isCur ? 'cur' : ''}`} role="button" tabIndex={0}
                onClick={() => { if (!isCur) onOpen(p.id, bloques[0] ?? 'OB1'); else setClosed((c) => { const n = new Set(c); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id, bloques[0] ?? 'OB1'); }}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuProyecto(p) }); }}
                title={p.nombre}>
                <Icon name={expanded ? 'down' : 'right'} size={12} />
                <Icon name="folder" size={14} />
                <span className="ex-name">{p.nombre}</span>
                <button className="btn small ghost icon ex-add" title="Crear un bloque en este proyecto" aria-label="Crear bloque"
                  onClick={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, items: menuProyecto(p).slice(0, 4) }); }}><Icon name="plus" size={12} /></button>
              </div>
              {expanded && (
                <div className="ex-blocks">
                  {bloques.map((b) => (
                    <div key={b} className={`ex-block ${isCur && b === block ? 'cur' : ''}`} role="button" tabIndex={0}
                      onClick={() => onOpen(p.id, b)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id, b); }}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuBloque(p, b) }); }}>
                      <span className="ex-bicon">{b.startsWith('OB') ? 'OB' : 'FC'}</span>
                      <span className="mono">{b}</span>
                      {BLOCK_DESC[b] && <span className="faint ex-desc">{BLOCK_DESC[b]}</span>}
                    </div>
                  ))}
                  {(p.wb.vats ?? []).map((v) => (
                    <div key={`vat:${v.nombre}`} className="ex-block" role="button" tabIndex={0} title={`Tabla de variables ${v.nombre}: se abre en su ventana`}
                      onClick={() => onOpenVat(p.id, v.nombre)} onKeyDown={(e) => { if (e.key === 'Enter') onOpenVat(p.id, v.nombre); }}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuVat(p, v.nombre) }); }}>
                      <span className="ex-bicon">VAT</span>
                      <span className="mono">{v.nombre}</span>
                      <span className="faint ex-desc">tabla de variables</span>
                    </div>
                  ))}
                  {!bloques.includes('OB1') && (
                    <button className="btn small ex-create" onClick={() => crearBloque(p, 'OB1')}><Icon name="plus" size={12} />Crear OB1</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="explorer-foot faint">Clic derecho en una carpeta o un bloque para más opciones.</div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </aside>
  );
}

function ProjectWorkbench({ proj, block, onBlock, explorerHidden, onShowExplorer, senales, vatPedida, onVatAtendida }: { proj: Proyecto; block: string; onBlock: (b: string) => void; explorerHidden: boolean; onShowExplorer: () => void; senales: SenalesVentana; vatPedida: { nombre: string; n: number } | null; onVatAtendida: () => void }) {
  const { actualizar } = useProjects();
  const id = proj.id;
  const sim = useWorkbenchSim(id, proj.programa, proj.wb);
  sim.defaultTipo = 'INT';
  return (
    <Workbench sim={sim} programa={proj.programa} onChange={(p) => actualizar(id, { programa: p })}
      wbState={proj.wb} onWbState={(wb) => actualizar(id, { wb })} ioVariant="switches" layoutKey="libre" hardware senales={{ ...senales, nombre: proj.nombre }}
      block={block} onBlock={onBlock} vatVentanas proyecto={proj.nombre} vatPedida={vatPedida} onVatAtendida={onVatAtendida}
      title={(
        <span className="row" style={{ gap: 6 }}>
          {explorerHidden && <button className="btn small icon" onClick={onShowExplorer} title="Mostrar el explorador de proyectos" aria-label="Mostrar proyectos"><Icon name="folder" size={14} /></button>}
          <Icon name="folder" size={14} />
          <span title={proj.nombre}>{proj.nombre}</span>
        </span>
      )} />
  );
}
