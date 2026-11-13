import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';
import './styles/workbench.css';
import './styles/kop.css';
import './styles/temas.css';
import './styles/acabado.css';
import { aplicarTema, instalarPaletas } from './ui/temas/paletas';
import { useSettings } from './store/settings';
import { aplicarZoomAwl } from './ui/workbench/zoomAwl';

// las paletas de Temas ▸ Básicos y el tema guardado, antes del primer pintado para que no parpadee
instalarPaletas();
aplicarTema(document, useSettings.getState().theme);
// el zoom del AWL (Ajustes) es una variable CSS en <html>: se pone al arrancar y cada vez que cambia
aplicarZoomAwl(document, useSettings.getState().awlZoom);
useSettings.subscribe((s, antes) => { if (s.awlZoom !== antes.awlZoom) aplicarZoomAwl(document, s.awlZoom); });

createRoot(document.getElementById('root')!).render(<App />);
