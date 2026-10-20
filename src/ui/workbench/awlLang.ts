// Modo de CodeMirror para AWL (resaltado) y autocompletado de nemónicos
import { StreamLanguage, type StringStream } from '@codemirror/language';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { DE2EN, MNEMONIC_HELP, MNEMONICS } from '../../core/mnemonics';

interface St { col: 'start' | 'mn' | 'op' }

export const awlStream = StreamLanguage.define<St>({
  name: 'awl',
  startState: () => ({ col: 'start' }),
  token(stream: StringStream, state: St) {
    if (stream.sol()) state.col = 'start';
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (state.col === 'start') {
      if (stream.match(/^[A-Za-z_][A-Za-z0-9_]{0,3}\s*:(?!=)/)) {
        return 'labelName';
      }
      if (stream.match(/^(NETWORK|SEGMENTO|TITLE|BEGIN|END_\w+|ORGANIZATION_BLOCK|FUNCTION)\b.*/i)) return 'meta';
      if (stream.match(/^[^\s;]+/)) {
        state.col = 'mn';
        return 'keyword';
      }
    }
    if (stream.match(/^"[^"]*"?/)) return 'string';
    if (stream.match(/^(S5T|S5TIME|T|TIME|L|DW#16|W#16|B#16|16|2|C|P|D|TOD|B)#[^\s;/]*/i)) return 'number';
    if (stream.match(/^'[^']*'/)) return 'number';
    if (stream.match(/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?(?![\w.])/i)) return 'number';
    if (stream.match(/^[^\s;/]+/)) return state.col === 'mn' ? 'variableName' : 'variableName';
    stream.next();
    return null;
  },
});

const DESCR_EN: Record<string, string> = {};
for (const [de, en] of Object.entries(DE2EN)) if (MNEMONIC_HELP[de]) DESCR_EN[en] = MNEMONIC_HELP[de];

export function awlCompletion(getLang: () => 'de' | 'en', getSymbols: () => string[]) {
  const deList = [...MNEMONICS].filter((m) => m !== 'ENT' && m !== 'LEAVE');
  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    const sym = /"([^"]*)$/.exec(before);
    if (sym) {
      return {
        from: ctx.pos - sym[1].length,
        options: getSymbols().map((s) => ({ label: s, type: 'variable', apply: `${s}"` })),
      };
    }
    const m = /^(\s*(?:[A-Za-z_][A-Za-z0-9_]{0,3}\s*:\s*)?)([A-Za-z=+\-*/<>()]*)$/.exec(before);
    if (!m || (!m[2] && !ctx.explicit)) return null;
    const lang = getLang();
    const list = lang === 'en' ? deList.map((d) => DE2EN[d] ?? d) : deList;
    return {
      from: ctx.pos - m[2].length,
      options: list.map((mn) => ({
        label: mn,
        type: 'keyword',
        detail: lang === 'en' ? DESCR_EN[mn] ?? MNEMONIC_HELP[mn] : MNEMONIC_HELP[mn],
      })),
      validFor: /^[A-Za-z=+\-*/<>()]*$/,
    };
  };
}
