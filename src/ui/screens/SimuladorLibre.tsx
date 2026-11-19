import { useEffect, useState } from 'react';
import { useProjects, type Proyecto } from '../../store/projects';
import { Workbench } from '../workbench/Workbench';
import { useWorkbenchSim } from '../workbench/useWorkbenchSim';
import { useSenalesVentana, type SenalesVentana } from '../workbench/SenalesVentana';
import { ContextMenu, downloadText, pickFile, toast, useSplit, type MenuItem } from '../common/ui';
import { askText } from '../common/ask';
import { Icon } from '../common/Icon';
import { exportAwlSource, importAwlSource } from '../../core/awlsource';
import { emptyProgram, migrarHw, migrarHwCargado, type Programa } from '../../core/program';
import { normBlockName } from '../../core/compiler';
import { emptyWbState, migrarVat, nextVat } from '../workbench/types';
import { filasTZ } from '../workbench/vat';
import { useSettings } from '../../store/settings';
import * as ops from '../workbench/programOps';
import { BibliotecaVentana, copiarAlProyecto, esArrastreLib, libCopiado, libDeArrastre } from '../biblioteca/Biblioteca';
import { BIBLIOTECA, conEspacio } from '../../core/biblioteca';
import { clockByteOf, hwSinCargar } from '../../core/program';
import type { HwPedido } from '../workbench/HwConfig';
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
  /** Configuración del hardware que hay que abrir (doble clic en «Hardware» del explorador) */
  const [hwPedido, setHwPedido] = useState<(HwPedido & { proj: string }) | null>(null);
  const abrirHw = (id: string) => { setActual(id); setHwPedido({ proj: id, n: Date.now() }); };
  const [biblioteca, setBiblioteca] = useState(false);
  return (
    <div className="libre">
      {open && (
        <>
          <Explorer width={w} block={block} onOpen={(id, b) => { setActual(id); setBlock(b); }} onOpenVat={abrirVat} onOpenHw={abrirHw}
            onBiblioteca={() => setBiblioteca(true)} onCollapse={() => setOpen(false)} />
          <div className="splitter-x" onMouseDown={(e) => startW(e, 'x')} />
        </>
      )}
      <div className="libre-main">
        {proj && <ProjectWorkbench key={proj.id} proj={proj} block={block} onBlock={setBlock} explorerHidden={!open} onShowExplorer={() => setOpen(true)} senales={senales}
          vatPedida={vatPedida?.proj === proj.id ? vatPedida : null} onVatAtendida={() => setVatPedida(null)}
          hwPedido={hwPedido?.proj === proj.id ? hwPedido : null} onHwAtendido={() => setHwPedido(null)} />}
      </div>
      {biblioteca && <BibliotecaVentana proyecto={proj ? { id: proj.id, nombre: proj.nombre } : null} onCerrar={() => setBiblioteca(false)} />}
    </div>
  );
}

const PLEGADAS_KEY = 'automatizacion-explorador-plegadas';
const leerPlegadas = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(PLEGADAS_KEY) ?? '[]') as string[]); } catch { return new Set(); }
};

function newProjectProgram(): Programa {
  return { nemotecnia: useSettings.getState().nemotecnia, simbolos: [], bloques: [] };
}

function Explorer({ width, block, onOpen, onOpenVat, onOpenHw, onBiblioteca, onCollapse }: {
  width: number; block: string; onOpen: (id: string, block: string) => void; onOpenVat: (id: string, vat: string) => void;
  onOpenHw: (id: string) => void; onBiblioteca: () => void; onCollapse: () => void;
}) {
  const { proyectos, actual, crear, actualizar, borrar } = useProjects();
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  /** Carpetas «Equipo» y «Bloques» plegadas (`<proyecto>:equipo`, `<proyecto>:bloques`); se recuerdan */
  const [plegadas, setPlegadas] = useState(leerPlegadas);
  const plegar = (k: string) => setPlegadas((x) => {
    const n = new Set(x);
    if (n.has(k)) n.delete(k); else n.add(k);
    try { localStorage.setItem(PLEGADAS_KEY, JSON.stringify([...n])); } catch { /* sin almacenamiento */ }
    return n;
  });
  /** Proyecto sobre el que se arrastra un bloque de la biblioteca */
  const [soltar, setSoltar] = useState<string | null>(null);
  const dnd = (p: Proyecto) => ({
    onDragOver: (e: React.DragEvent) => { if (!esArrastreLib(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (soltar !== p.id) setSoltar(p.id); },
    onDragLeave: (e: React.DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setSoltar(null); },
    onDrop: (e: React.DragEvent) => {
      const id = libDeArrastre(e);
      setSoltar(null);
      if (!id) return;
      e.preventDefault();
      if (copiarAlProyecto(p.id, id) && p.id !== actual) onOpen(p.id, BIBLIOTECA[id].bloque);
    },
  });
  /** Ctrl+V en la carpeta «Bloques» o en uno de sus bloques: pega el bloque copiado en la biblioteca */
  const pegarTecla = (p: Proyecto) => (e: React.KeyboardEvent) => {
    const id = libCopiado();
    if (id && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); copiarAlProyecto(p.id, id); }
  };
  const pegarItem = (p: Proyecto): MenuItem[] => {
    const id = libCopiado();
    return id ? [{ label: T.biblioteca.pegar(conEspacio(BIBLIOTECA[id].bloque), id), hint: 'Ctrl+V', onClick: () => copiarAlProyecto(p.id, id) }] : [];
  };

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
    ...pegarItem(p),
    { sep: true, label: '' },
    ...(b.startsWith('FC') && !p.programa.bloques.find((x) => normBlockName(x.nombre) === b)?.biblioteca ? [{ label: T.libre.renombrarX(b), onClick: async () => {
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

  /** Carpeta «Bloques»: insertar, pegar y abrir la biblioteca */
  const menuCarpetaBloques = (p: Proyecto): MenuItem[] => [
    insertarObjeto(p),
    ...pegarItem(p),
    { sep: true, label: '' },
    { label: T.biblioteca.abrir, onClick: onBiblioteca },
  ];

  const menuGeneral: MenuItem[] = [
    { label: T.libre.nuevoProyectoMenu, onClick: nuevoProyecto },
    { label: T.biblioteca.abrir, onClick: onBiblioteca },
    { sep: true, label: '' },
    { label: T.libre.importarJson, onClick: async () => {
      const txt = await pickFile('.json,application/json');
      if (!txt) return;
      try {
        const d = JSON.parse(txt);
        if (!d.programa?.bloques) throw new Error(T.libre.noEsProyecto);
        const id = crear(nombreLibre(d.nombre ?? T.libre.importado), migrarHwCargado(migrarHw(d.programa)), migrarVat(d.wb ?? emptyWbState()));
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
        <button className="btn small ghost icon" onClick={onBiblioteca} title={T.biblioteca.abrir} aria-label={T.biblioteca.titulo}><Icon name="book" size={14} /></button>
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
                <Icon name="folder" size={17} stroke={2.1} className="ex-carpeta" />
                <span className="ex-name">{p.nombre}</span>
                <button className="btn small ghost icon ex-add" title={T.libre.crearBloqueTitulo} aria-label={T.libre.crearBloque}
                  onClick={(e) => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, items: menuProyecto(p).slice(0, 4) }); }}><Icon name="plus" size={12} /></button>
              </div>
              {expanded && (
                <div className="ex-blocks">
                  {/* Equipo(1) ▸ Hardware */}
                  <div className="ex-sub" role="button" tabIndex={0} aria-expanded={!plegadas.has(`${p.id}:equipo`)}
                    onClick={() => plegar(`${p.id}:equipo`)} onKeyDown={(e) => { if (e.key === 'Enter') plegar(`${p.id}:equipo`); }}
                    onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [{ label: T.libre.abrirHardware, onClick: () => onOpenHw(p.id) }] }); }}>
                    <Icon name={plegadas.has(`${p.id}:equipo`) ? 'right' : 'down'} size={11} />
                    <Icon name="cpu" size={14} className="ex-sub-icono" />
                    <span className="ex-sub-name">{T.hw.equipo}</span>
                  </div>
                  {!plegadas.has(`${p.id}:equipo`) && (
                    <div className="ex-sub-items">
                      <div className="ex-block ex-hw" role="button" tabIndex={0} title={T.libre.hardwareTitulo}
                        onDoubleClick={() => onOpenHw(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpenHw(p.id); }}
                        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [{ label: T.libre.abrirObjeto, onClick: () => onOpenHw(p.id) }] }); }}>
                        <span className="ex-bicon">HW</span>
                        <span>{T.libre.hardware}</span>
                        <span className="faint ex-desc">{hwSinCargar(p.programa) ? T.libre.hwSinCargar : clockByteOf(p.programa) !== null ? T.libre.hwCiclo(clockByteOf(p.programa)!) : ''}</span>
                      </div>
                    </div>
                  )}
                  {/* Bloques: OB, FC, bloques de biblioteca y tablas de variables. Aquí se sueltan los bloques de la biblioteca */}
                  <div className={`ex-sub ${soltar === p.id ? 'soltar' : ''}`} role="button" tabIndex={0} aria-expanded={!plegadas.has(`${p.id}:bloques`)}
                    title={soltar === p.id ? T.biblioteca.soltar : undefined}
                    onClick={() => plegar(`${p.id}:bloques`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') plegar(`${p.id}:bloques`); else pegarTecla(p)(e); }}
                    onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuCarpetaBloques(p) }); }} {...dnd(p)}>
                    <Icon name={plegadas.has(`${p.id}:bloques`) ? 'right' : 'down'} size={11} />
                    <Icon name="folder" size={14} className="ex-sub-icono" />
                    <span className="ex-sub-name">{T.libre.carpetaBloques}</span>
                  </div>
                  {!plegadas.has(`${p.id}:bloques`) && (
                    <div className={`ex-sub-items ${soltar === p.id ? 'soltar' : ''}`} {...dnd(p)}>
                      {bloques.map((b) => {
                        const lib = p.programa.bloques.find((x) => normBlockName(x.nombre) === b)?.biblioteca;
                        return (
                          <div key={b} className={`ex-block ${isCur && b === block ? 'cur' : ''}`} role="button" tabIndex={0} title={lib ? T.biblioteca.protegido(lib) : undefined}
                            onClick={() => onOpen(p.id, b)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id, b); else pegarTecla(p)(e); }}
                            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: menuBloque(p, b) }); }}>
                            <span className="ex-bicon">{b.startsWith('OB') ? 'OB' : 'FC'}</span>
                            <span className="mono">{b}</span>
                            {lib && <Icon name="lock" size={11} className="ex-lock" />}
                            {lib ? <span className="faint ex-desc mono">{lib}</span> : BLOCK_DESC[b] && <span className="faint ex-desc">{BLOCK_DESC[b]}</span>}
                          </div>
                        );
                      })}
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

function ProjectWorkbench({ proj, block, onBlock, explorerHidden, onShowExplorer, senales, vatPedida, onVatAtendida, hwPedido, onHwAtendido }: {
  proj: Proyecto; block: string; onBlock: (b: string) => void; explorerHidden: boolean; onShowExplorer: () => void; senales: SenalesVentana;
  vatPedida: { nombre: string; n: number } | null; onVatAtendida: () => void; hwPedido: HwPedido | null; onHwAtendido: () => void;
}) {
  const { actualizar } = useProjects();
  const id = proj.id;
  const sim = useWorkbenchSim(id, proj.programa, proj.wb);
  sim.defaultTipo = 'INT';
  return (
    <Workbench sim={sim} programa={proj.programa} onChange={(p) => actualizar(id, { programa: p })}
      wbState={proj.wb} onWbState={(wb) => actualizar(id, { wb })} ioVariant="switches" layoutKey="libre" hardware senales={{ ...senales, nombre: proj.nombre }}
      block={block} onBlock={onBlock} vatVentanas proyecto={proj.nombre} vatPedida={vatPedida} onVatAtendida={onVatAtendida} hwPedido={hwPedido} onHwAtendido={onHwAtendido}
      title={(
        <span className="row" style={{ gap: 6 }}>
          {explorerHidden
            ? <button className="btn small icon abrir-proyectos" onClick={onShowExplorer} title={T.libre.mostrarExplorador} aria-label={T.libre.mostrarProyectos}><Icon name="folder" size={14} /></button>
            : <Icon name="folder" size={14} className="carpeta" />}
          <span title={proj.nombre}>{proj.nombre}</span>
        </span>
      )} />
  );
}
