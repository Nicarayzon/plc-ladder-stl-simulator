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
import { T } from '../../i18n';

const BLOCK_DESC: Record<string, string> = T.libre.descBloque;

export function SimuladorLibre() {
  const { proyectos, actual, crear, setActual } = useProjects();
  const [block, setBlock] = useState('OB1');
  useEffect(() => {
    if (!proyectos.length) crear(T.libre.proyectoN(1), { ...emptyProgram(), nemotecnia: useSettings.getState().nemotecnia }, emptyWbState());
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
    proyectos.some((p) => p.nombre.trim().toLowerCase() === v.trim().toLowerCase() && p.nombre !== actualNombre) ? T.libre.yaHayProyecto : null;

  const nuevoProyecto = async () => {
    const nombre = await askText({ title: T.libre.nuevoProyectoTitulo, label: T.libre.nombreCarpeta, value: nombreLibre(T.libre.proyectoN(proyectos.length + 1)), ok: T.libre.crear, validate: validarNombre() });
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
    return { label: T.libre.insertarObjeto, items: [
      ...(nombres.includes('OB1') ? [] : [{ label: T.libre.obj.ob1, onClick: () => crearBloque(p, 'OB1') }]),
      { label: T.libre.obj.fc(ops.nextFc(p.programa)), onClick: () => crearBloque(p, ops.nextFc(p.programa)) },
      { label: T.libre.obj.ob100, disabled: nombres.includes('OB100'), onClick: () => crearBloque(p, 'OB100') },
      { sep: true, label: '' },
      { label: T.libre.obj.vat, onClick: () => crearVat(p) },
    ] };
  };

  const menuProyecto = (p: Proyecto): MenuItem[] => {
    const nombres = p.programa.bloques.map((b) => normBlockName(b.nombre));
    return [
      { label: T.libre.crearOb1, disabled: nombres.includes('OB1'), onClick: () => crearBloque(p, 'OB1') },
      { label: T.libre.crearFc(ops.nextFc(p.programa)), onClick: () => crearBloque(p, ops.nextFc(p.programa)) },
      { label: T.libre.crearOb100, disabled: nombres.includes('OB100'), onClick: () => crearBloque(p, 'OB100') },
      { label: T.libre.crearVat(nextVat(p.wb)), onClick: () => crearVat(p) },
      { sep: true, label: '' },
      { label: T.libre.renombrar, onClick: async () => { const n = await askText({ title: T.libre.renombrarProyecto, label: T.libre.nombreProyecto, value: p.nombre, validate: validarNombre(p.nombre) }); if (n) actualizar(p.id, { nombre: n }); } },
      { label: T.libre.duplicar, onClick: () => { const id = crear(nombreLibre(T.libre.copia(p.nombre)), structuredClone(p.programa), structuredClone(p.wb)); onOpen(id, 'OB1'); } },
      { label: T.libre.exportarJson, onClick: () => downloadText(`${p.nombre}.json`, JSON.stringify({ formato: 'automatizacion-proyecto-v1', nombre: p.nombre, programa: p.programa, wb: p.wb }, null, 2), 'application/json') },
      { label: T.libre.exportarAwl, onClick: () => downloadText(`${p.nombre}.awl`, exportAwlSource(p.programa)) },
      { sep: true, label: '' },
      { label: T.libre.borrarProyecto, onClick: () => { if (confirm(T.libre.confirmarBorrarProyecto(p.nombre))) borrar(p.id); } },
    ];
  };

  const menuBloque = (p: Proyecto, b: string): MenuItem[] => [
    { label: T.libre.abrir(b), onClick: () => onOpen(p.id, b) },
    insertarObjeto(p),
    { sep: true, label: '' },
    ...(b.startsWith('FC') ? [{ label: T.libre.renombrarX(b), onClick: async () => {
      const nombres = p.programa.bloques.map((x) => normBlockName(x.nombre));
      const to = (await askText({ title: T.libre.renombrarTitulo(b), label: T.libre.nuevoNombreFc, value: b, validate: (v) => {
        const t = v.toUpperCase().replace(/\s+/g, '');
        return !/^FC\d+$/.test(t) ? T.libre.fcInvalida : nombres.includes(t) && t !== b ? T.libre.yaExiste(t) : null;
      } }))?.toUpperCase().replace(/\s+/g, '');
      if (to && to !== b) { actualizar(p.id, { programa: ops.renameBlock(p.programa, b, to) }); onOpen(p.id, to); }
    } }] : []),
    { label: T.libre.borrarX(b), onClick: () => { if (confirm(T.libre.confirmarBorrarBloque(b, p.nombre))) actualizar(p.id, { programa: ops.removeBlock(p.programa, b) }); } },
  ];

  const menuVat = (p: Proyecto, v: string): MenuItem[] => [
    { label: T.libre.abrir(v), onClick: () => onOpenVat(p.id, v) },
    insertarObjeto(p),
    { sep: true, label: '' },
    { label: T.libre.renombrarX(v), onClick: async () => {
      const vats = p.wb.vats ?? [];
      const to = (await askText({ title: T.libre.renombrarTitulo(v), label: T.libre.nombreVat, value: v, validate: (x) => {
        const t = x.trim();
        return !t ? T.libre.escribeNombre : t.length > 24 ? T.libre.max24 : vats.some((o) => o.nombre !== v && o.nombre.toUpperCase() === t.toUpperCase()) ? T.libre.yaExiste(t) : null;
      } }))?.trim();
      if (!to || to === v) return;
      actualizar(p.id, { wb: { ...p.wb, vats: vats.map((o) => (o.nombre === v ? { ...o, nombre: to } : o)) } });
      onOpenVat(p.id, to);
    } },
    { label: T.libre.borrarX(v), onClick: () => { if (confirm(T.libre.confirmarBorrarVat(v, p.nombre))) actualizar(p.id, { wb: { ...p.wb, vats: (p.wb.vats ?? []).filter((o) => o.nombre !== v) } }); } },
  ];

  const menuGeneral: MenuItem[] = [
    { label: T.libre.nuevoProyectoMenu, onClick: nuevoProyecto },
    { sep: true, label: '' },
    { label: T.libre.importarJson, onClick: async () => {
      const txt = await pickFile('.json,application/json');
      if (!txt) return;
      try {
        const d = JSON.parse(txt);
        if (!d.programa?.bloques) throw new Error(T.libre.noEsProyecto);
        const id = crear(nombreLibre(d.nombre ?? T.libre.importado), migrarHw(d.programa), migrarVat(d.wb ?? emptyWbState()));
        onOpen(id, 'OB1');
        toast(T.libre.proyectoImportado);
      } catch (e) { toast(T.libre.noSePudoImportar((e as Error).message)); }
    } },
    { label: T.libre.importarAwl, onClick: async () => {
      const txt = await pickFile('.awl,.AWL,.txt');
      if (!txt) return;
      try { const id = crear(nombreLibre(T.libre.fuenteImportada), importAwlSource(txt), emptyWbState()); onOpen(id, 'OB1'); toast(T.libre.fuenteImportadaAviso); } catch (e) { toast(T.libre.noSePudoImportar((e as Error).message)); }
    } },
  ];

  return (
    <aside className="explorer" style={{ width }} aria-label={T.libre.proyectos}>
      <div className="explorer-head">
        <span>{T.libre.proyectos}</span>
        <span className="spacer" />
        <button className="btn small" onClick={nuevoProyecto} title={T.libre.nuevoTitulo}><Icon name="plus" size={13} />{T.libre.nuevo}</button>
        <button className="btn small ghost icon" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, items: menuGeneral })} aria-label={T.libre.masOpciones}><Icon name="dots" size={14} /></button>
        <button className="btn small ghost icon" onClick={onCollapse} title={T.libre.ocultarExplorador} aria-label={T.libre.ocultarExplorador}><Icon name="left" size={14} /></button>
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
                <button className="btn small ghost icon ex-add" title={T.libre.crearBloqueTitulo} aria-label={T.libre.crearBloque}
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
                    <div key={`vat:${v.nombre}`} className="ex-block" role="button" tabIndex={0} title={T.libre.vatTitulo(v.nombre)}
                      onClick={() => onOpenVat(p.id, v.nombre)} onKeyDown={(e) => { if (e.key === 'Enter') onOpenVat(p.id, v.nombre); }}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuVat(p, v.nombre) }); }}>
                      <span className="ex-bicon">VAT</span>
                      <span className="mono">{v.nombre}</span>
                      <span className="faint ex-desc">{T.libre.tablaDeVariables}</span>
                    </div>
                  ))}
                  {!bloques.includes('OB1') && (
                    <button className="btn small ex-create" onClick={() => crearBloque(p, 'OB1')}><Icon name="plus" size={12} />{T.libre.crearOb1Boton}</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="explorer-foot faint">{T.libre.pie}</div>
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
          {explorerHidden && <button className="btn small icon" onClick={onShowExplorer} title={T.libre.mostrarExplorador} aria-label={T.libre.mostrarProyectos}><Icon name="folder" size={14} /></button>}
          <Icon name="folder" size={14} />
          <span title={proj.nombre}>{proj.nombre}</span>
        </span>
      )} />
  );
}
