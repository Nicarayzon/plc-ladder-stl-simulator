import { Markdown } from '../common/Markdown';
import { version as APP_VERSION } from '../../../package.json';
import { T } from '../../i18n';

export function AyudaScreen() {
  return <div className="page"><div className="page-narrow" style={{ maxWidth: 860 }}><Markdown text={T.ayuda(APP_VERSION)} /></div></div>;
}
