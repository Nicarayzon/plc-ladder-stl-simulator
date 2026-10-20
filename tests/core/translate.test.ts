import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { translateAwl, translateLine } from '../../src/core/translate';
import { compileBlockText } from '../../src/core/compiler';

const sig = (text: string, lang: 'de' | 'en') => compileBlockText(text, null, lang).instrs.map((i) => `${i.mn} ${i.op?.text ?? ''} ${i.target}`);

describe('traducción DE ↔ EN', () => {
  it('líneas sueltas', () => {
    expect(translateLine('      U     E 0.0  // marcha', 'en')).toBe('      A     I 0.0  // marcha');
    expect(translateLine('      SE    T 1', 'en')).toBe('      SD    T 1');
    expect(translateLine('      SV    T 1', 'en')).toBe('      SE    T 1');
    expect(translateLine('M001: U(', 'en')).toBe('M001: A(');
    expect(translateLine('      L     EW 0', 'en')).toBe('      L     IW 0');
    expect(translateLine('      ZV    Z 1', 'en')).toBe('      CU    C 1');
    expect(translateLine('      U     BIE', 'en')).toBe('      A     BR');
    expect(translateLine('      SPB   FIN', 'en')).toBe('      JC    FIN');
    expect(translateLine('      = A 4.0', 'en')).toBe('      = Q 4.0');
    expect(translateLine('      A     I 0.0', 'de')).toBe('      U     E 0.0');
  });
  const items = (banco as any).ejercicios.filter((e: any) => e.awl);
  for (const e of items) {
    it(`${e.id}: DE → EN compila igual y vuelve igual`, () => {
      let ref: string[] | null = null;
      try { ref = sig(e.awl, 'de'); } catch { return; }
      const en = translateAwl(e.awl, 'en');
      expect(sig(en, 'en')).toEqual(ref);
      expect(sig(translateAwl(en, 'de'), 'de')).toEqual(ref);
    });
  }
});
