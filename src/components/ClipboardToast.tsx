import React from 'react';
import { Link2, Download, Search, X } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface ClipboardToastProps {
  language: Language;
  url: string;
  onDownloadNow: (url: string) => void;
  onInspect: (url: string) => void;
  onDismiss: () => void;
}

export const ClipboardToast: React.FC<ClipboardToastProps> = ({
  language,
  url,
  onDownloadNow,
  onInspect,
  onDismiss
}) => {
  const t = translations[language];

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="pencil-box p-3 bg-[var(--color-surface)] border-2 border-[var(--color-accent)] text-[var(--color-text-main)] shadow-2xl flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[var(--color-accent)] font-bold text-xs">
            <Link2 className="w-4 h-4 shrink-0" />
            <span>{t.clipboardDetectedTitle}</span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
            title={t.clipboardDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[11px] font-mono text-[var(--color-text-muted)] truncate select-all px-1">
          {url}
        </p>

        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[var(--color-border)]/50">
          <button
            type="button"
            onClick={() => onInspect(url)}
            className="pencil-button-secondary px-2.5 py-1 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>{t.clipboardInspect}</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadNow(url)}
            className="pencil-button px-3 py-1 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.clipboardDownloadNow}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
