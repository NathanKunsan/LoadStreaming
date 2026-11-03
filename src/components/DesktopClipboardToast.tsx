import React, { useState, useEffect } from 'react';
import { Link2, Download, Search, X } from 'lucide-react';
import { translations, Language } from '../locales/translations';
import { AppConfig } from '../../electron/types';

export const DesktopClipboardToast: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    theme: 'yellow-black',
    language: 'th',
    outputDir: ''
  });
  const [url, setUrl] = useState<string>('');

  const language: Language = config.language || 'th';
  const t = translations[language];

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      const unsub = window.electronAPI.onShowToast?.((data) => {
        if (data?.url) {
          setUrl(data.url);
        }
      });

      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  const handleDownloadNow = () => {
    if (window.electronAPI && url) {
      window.electronAPI.toastDownloadNow(url);
    }
  };

  const handleInspect = () => {
    if (window.electronAPI && url) {
      window.electronAPI.toastInspect(url);
    }
  };

  const handleDismiss = () => {
    if (window.electronAPI) {
      window.electronAPI.toastDismiss();
    }
  };

  if (!url) return null;

  return (
    <div className={`theme-${config.theme} w-full h-full p-2 select-none flex items-center justify-center bg-transparent`}>
      <div className="pencil-box w-full p-3 bg-[var(--color-surface)] border-2 border-[var(--color-accent)] text-[var(--color-text-main)] shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[var(--color-accent)] font-bold text-xs">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>{t.clipboardDetectedTitle}</span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
            title={t.clipboardDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Detected URL (Clean truncated mono) */}
        <p className="text-[11px] font-mono text-[var(--color-text-muted)] truncate select-all px-1">
          {url}
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[var(--color-border)]/40">
          <button
            type="button"
            onClick={handleInspect}
            className="pencil-button-secondary px-3 h-7 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>{t.clipboardInspect}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadNow}
            className="pencil-button px-3.5 h-7 text-xs font-bold flex items-center space-x-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>{t.clipboardDownloadNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
