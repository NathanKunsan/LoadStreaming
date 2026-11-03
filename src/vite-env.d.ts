/// <reference types="vite/client" />

import { electronAPI } from '../electron/preload';

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: any;
    }
  }
}
