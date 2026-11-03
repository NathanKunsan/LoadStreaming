import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DesktopClipboardToast } from './components/DesktopClipboardToast';
import { DesktopRadialMenu } from './components/DesktopRadialMenu';
import './index.css';

const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

let RootComponent: React.ComponentType = App;
if (hash === 'toast') {
  RootComponent = DesktopClipboardToast;
} else if (hash === 'radial') {
  RootComponent = DesktopRadialMenu;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
