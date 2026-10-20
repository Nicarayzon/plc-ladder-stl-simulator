import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/theme.css';
import './styles/workbench.css';
import './styles/kop.css';

createRoot(document.getElementById('root')!).render(<App />);
