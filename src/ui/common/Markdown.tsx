// Markdown de la teoría y de los ejercicios (tablas, <details>, bloques awl con «Probar»)
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { AwlHighlight } from './AwlHighlight';
import { Icon } from './Icon';
import { T } from '../../i18n';

export function Markdown({ text, onTry, className }: { text: string; onTry?: (code: string) => void; className?: string }) {
  const components: Components = {
    code(props) {
      const { className: cls, children } = props;
      const lang = /language-(\w+)/.exec(cls ?? '')?.[1];
      const code = String(children ?? '');
      const isBlock = !!lang || code.includes('\n');
      if (!isBlock) return <code>{children}</code>;
      if (lang === 'awl') {
        return (
          <div className="code-block">
            <AwlHighlight code={code} />
            {onTry && <button className="btn small try" onClick={() => onTry(code)} title={T.markdown.probarTitulo}><Icon name="play" size={11} />{T.markdown.probar}</button>}
          </div>
        );
      }
      return <code className={cls}>{children}</code>;
    },
    pre(props) {
      const child = (props.children as { props?: { className?: string } })?.props;
      if (child?.className?.includes('language-awl')) return <>{props.children}</>;
      return <pre>{props.children}</pre>;
    },
    a(props) {
      const href = props.href ?? '';
      if (href.startsWith('#')) {
        return <a href={href} onClick={(e) => { e.preventDefault(); document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth' }); }}>{props.children}</a>;
      }
      return <a href={href} target="_blank" rel="noreferrer">{props.children}</a>;
    },
  };
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSlug]} components={components}>{text}</ReactMarkdown>
    </div>
  );
}
