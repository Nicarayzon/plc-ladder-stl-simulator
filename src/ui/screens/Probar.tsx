// «Probar»: abre un fragmento AWL en un simulador dentro de una ventana
import { useState } from 'react';
import { Modal, toast } from '../common/ui';
import { Icon } from '../common/Icon';
import { Workbench } from '../workbench/Workbench';
import { useWorkbenchSim } from '../workbench/useWorkbenchSim';
import { emptyWbState, type WbState } from '../workbench/types';
import { programFromAwl, type Programa } from '../../core/program';
import { useProjects } from '../../store/projects';
import { go } from '../router';
import { T } from '../../i18n';

/** `nemotecnia`: la del código que se abre (en la teoría en inglés, la inglesa) */
export function ProbarModal({ code, title, onClose, nemotecnia = 'de' }: { code: string; title: string; onClose: () => void; nemotecnia?: 'de' | 'en' }) {
  const [prog, setProg] = useState<Programa>(() => ({ ...programFromAwl(code.replace(/\n$/, '')), nemotecnia }));
  const [wb, setWb] = useState<WbState>(emptyWbState());
  const sim = useWorkbenchSim(`probar-${title}`, prog, wb);
  const crear = useProjects((s) => s.crear);
  return (
    <Modal title={title} onClose={onClose} width={Math.min(1400, window.innerWidth - 40)}>
      <div style={{ height: Math.min(820, window.innerHeight - 160), margin: '-14px -16px', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Workbench sim={sim} programa={prog} onChange={setProg} wbState={wb} onWbState={setWb}
            extraToolbar={<button className="btn small" onClick={() => { crear(title.slice(0, 40), prog, wb); toast(T.probar.guardado); onClose(); go('simulador'); }}><Icon name="save" size={13} />{T.probar.guardarComo}</button>} />
        </div>
      </div>
    </Modal>
  );
}

export function ProbarButton({ code, title }: { code: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} title={T.probar.abrirTitulo}><Icon name="cpu" size={14} />{T.probar.probarEnSimulador}</button>
      {open && <ProbarModal code={code} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
