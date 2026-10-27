import { useEffect, useLayoutEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, RangeSetBuilder, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, GutterMarker, WidgetType, gutter, keymap, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { linter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { tags as t } from '@lezer/highlight';
import { awlCompletion, awlStream } from './awlLang';
import { T } from '../../i18n';

export interface ObsLine { line: number; cells: string[]; dim: boolean; count: number }
/** Valor en vivo de un operando, mostrado justo detrás del código de la línea */
export interface OperandValue { line: number; pos: number; text: string; cls: 'on' | 'off' | 'num' }
export interface EditorDiag { line: number; msg: string; severity: 'error' | 'warning' }

interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  diagnostics?: EditorDiag[];
  observe?: ObsLine[] | null;
  observeWidth?: number;
  values?: OperandValue[] | null;
  breakpoints?: Set<number>;
  onToggleBreakpoint?: (line: number) => void;
  currentLine?: number | null;
  stopLine?: number | null;
  lang?: 'de' | 'en';
  symbols?: string[];
  minLines?: number;
  autoFocus?: boolean;
  onFocus?: () => void;
}

const hl = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--cm-kw)', fontWeight: '600' },
  { tag: t.variableName, color: 'var(--cm-op)' },
  { tag: t.number, color: 'var(--cm-num)' },
  { tag: t.string, color: 'var(--cm-sym)' },
  { tag: t.comment, color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: t.labelName, color: 'var(--cm-label)', fontWeight: '600' },
  { tag: t.meta, color: 'var(--text-faint)' },
]);

// ───── Observar ─────
class ObsWidget extends WidgetType {
  constructor(readonly cells: string[], readonly dim: boolean, readonly count: number) { super(); }
  override eq(o: ObsWidget) { return o.dim === this.dim && o.count === this.count && o.cells.join('|') === this.cells.join('|'); }
  override toDOM() {
    const el = document.createElement('span');
    el.className = `cm-obs${this.dim ? ' dim' : ''}`;
    for (const c of this.cells) {
      const s = document.createElement('span');
      s.textContent = c;
      el.appendChild(s);
    }
    if (this.count > 1) {
      const s = document.createElement('span');
      s.className = 'cnt';
      s.textContent = `×${this.count}`;
      el.appendChild(s);
    }
    return el;
  }
  override ignoreEvent() { return true; }
}
const setObs = StateEffect.define<ObsLine[] | null>();
const obsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setObs)) {
        if (!e.value) return Decoration.none;
        const b = new RangeSetBuilder<Decoration>();
        const doc = tr.state.doc;
        const sorted = [...e.value].sort((a, c) => a.line - c.line);
        for (const o of sorted) {
          if (o.line < 1 || o.line > doc.lines) continue;
          const ln = doc.line(o.line);
          b.add(ln.to, ln.to, Decoration.widget({ widget: new ObsWidget(o.cells, o.dim, o.count), side: 1 }));
        }
        return b.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ───── valores en vivo de los operandos ─────
class ValWidget extends WidgetType {
  constructor(readonly text: string, readonly cls: string) { super(); }
  override eq(o: ValWidget) { return o.text === this.text && o.cls === this.cls; }
  override toDOM() {
    const el = document.createElement('span');
    el.className = `cm-val ${this.cls}`;
    el.textContent = this.text;
    el.title = T.seg.valorActual;
    return el;
  }
  override ignoreEvent() { return true; }
}
const setVals = StateEffect.define<OperandValue[] | null>();
const valField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setVals)) {
        if (!e.value) return Decoration.none;
        const b = new RangeSetBuilder<Decoration>();
        const doc = tr.state.doc;
        const sorted = [...e.value].sort((a, c) => a.line - c.line);
        for (const v of sorted) {
          if (v.line < 1 || v.line > doc.lines) continue;
          const ln = doc.line(v.line);
          const at = Math.min(ln.to, ln.from + v.pos);
          b.add(at, at, Decoration.widget({ widget: new ValWidget(v.text, v.cls), side: 1 }));
        }
        return b.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ───── línea actual / línea de STOP ─────
const setMarks = StateEffect.define<{ cur: number | null; stop: number | null }>();
const markField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setMarks)) {
        const b = new RangeSetBuilder<Decoration>();
        const doc = tr.state.doc;
        const lines = [[e.value.cur, 'cm-current'], [e.value.stop, 'cm-stopline']] as const;
        const items = lines.filter(([l]) => l && l >= 1 && l <= doc.lines).sort((a, c) => (a[0] as number) - (c[0] as number));
        for (const [l, cls] of items) b.add(doc.line(l as number).from, doc.line(l as number).from, Decoration.line({ class: cls }));
        return b.finish();
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ───── puntos de parada ─────
class BpMarker extends GutterMarker {
  override toDOM() {
    const d = document.createElement('span');
    d.className = 'cm-bp';
    return d;
  }
}
const bpMarker = new BpMarker();
const setBps = StateEffect.define<Set<number>>();
const bpField = StateField.define<Set<number>>({
  create: () => new Set(),
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setBps)) return e.value;
    return v;
  },
});

export function AwlEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const exts: Extension[] = [
      lineNumbers(),
      gutter({
        class: 'cm-bp-gutter',
        markers: (v) => {
          const set = v.state.field(bpField);
          const b = new RangeSetBuilder<GutterMarker>();
          const lines = [...set].filter((l) => l >= 1 && l <= v.state.doc.lines).sort((a, c) => a - c);
          for (const l of lines) b.add(v.state.doc.line(l).from, v.state.doc.line(l).from, bpMarker);
          return b.finish();
        },
        initialSpacer: () => bpMarker,
        domEventHandlers: {
          mousedown(v, line) {
            const ln = v.state.doc.lineAt(line.from).number;
            propsRef.current.onToggleBreakpoint?.(ln);
            return true;
          },
        },
      }),
      history(),
      drawSelection(),
      highlightActiveLine(),
      bracketMatching(),
      awlStream,
      syntaxHighlighting(hl),
      autocompletion({ override: [awlCompletion(() => propsRef.current.lang ?? 'de', () => propsRef.current.symbols ?? [])], icons: false }),
      linter(null),
      keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      obsField,
      valField,
      markField,
      bpField,
      EditorView.lineWrapping,
      EditorState.readOnly.of(!!props.readOnly),
      EditorView.editable.of(!props.readOnly),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) propsRef.current.onChange?.(u.state.doc.toString());
        if (u.focusChanged && u.view.hasFocus) propsRef.current.onFocus?.();
      }),
      EditorView.theme({
        '&': { fontSize: '13px' },
        '.cm-content': { fontFamily: 'var(--mono)', minHeight: `${(props.minLines ?? 3) * 19}px` },
      }),
    ];
    const v = new EditorView({ parent: host.current!, state: EditorState.create({ doc: props.value, extensions: exts }) });
    view.current = v;
    v.dispatch({ effects: [setObs.of(propsRef.current.observe ?? null), setVals.of(propsRef.current.values ?? null)] });
    if (props.autoFocus) v.focus();
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.readOnly]);

  // valor externo
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== props.value) v.dispatch({ changes: { from: 0, to: cur.length, insert: props.value } });
  }, [props.value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const diags: Diagnostic[] = (props.diagnostics ?? [])
      .filter((d) => d.line >= 1 && d.line <= doc.lines)
      .map((d) => {
        const ln = doc.line(d.line);
        return { from: ln.from, to: Math.max(ln.from, ln.to), severity: d.severity, message: d.msg };
      });
    v.dispatch(setDiagnostics(v.state, diags));
  }, [props.diagnostics]);

  // «Observar» y valores en una sola actualización del editor y antes de pintar: así cambian en el
  // mismo fotograma que el resto de paneles, no en uno aparte
  useLayoutEffect(() => {
    view.current?.dispatch({ effects: [setObs.of(props.observe ?? null), setVals.of(props.values ?? null)] });
  }, [props.observe, props.values]);

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of({ cur: props.currentLine ?? null, stop: props.stopLine ?? null }) });
  }, [props.currentLine, props.stopLine]);

  useEffect(() => {
    view.current?.dispatch({ effects: setBps.of(new Set(props.breakpoints ?? [])) });
  }, [props.breakpoints]);

  return <div ref={host} className={`awl-editor${props.observe ? ' observing' : ''}`} style={props.observe ? ({ '--obs-w': `${props.observeWidth ?? 300}px` } as React.CSSProperties) : undefined} />;
}
