// Deshacer/Rehacer global: el menú de Electron llama a window.__appUndo / __appRedo.
import { undo, redo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';

type W = Window & { __appUndo?: () => void; __appRedo?: () => void; __kopUndo?: () => void; __kopRedo?: () => void };

export function installGlobalUndo() {
  const w = window as W;
  const run = (isRedo: boolean) => {
    const ae = document.activeElement as HTMLElement | null;
    const cm = ae?.closest('.cm-editor') as HTMLElement | null;
    if (cm) {
      const view = EditorView.findFromDOM(cm);
      if (view) (isRedo ? redo : undo)(view);
      return;
    }
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      document.execCommand(isRedo ? 'redo' : 'undo');
      return;
    }
    // tabla de variables con el foco: deshace en la tabla, no en el programa
    const vat = ae?.closest('.vatw');
    if (vat) {
      vat.dispatchEvent(new Event(isRedo ? 'vat-rehacer' : 'vat-deshacer'));
      return;
    }
    (isRedo ? w.__kopRedo : w.__kopUndo)?.();
  };
  w.__appUndo = () => run(false);
  w.__appRedo = () => run(true);
  // en el navegador (sin menú de Electron): ⌘Z fuera de los editores de texto
  const key = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.closest('.cm-editor') || ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA') return;
    e.preventDefault();
    run(e.shiftKey);
  };
  window.addEventListener('keydown', key);
  return () => window.removeEventListener('keydown', key);
}
