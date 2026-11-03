import React, { useEffect } from 'react';
import { Download, Music, Folder, RefreshCw, X, Video } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface RadialMenuProps {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  onAction: (actionKey: string) => void;
  actionsConfig?: {
    north?: string;
    east?: string;
    south?: string;
    west?: string;
  };
}

export const RadialMenu: React.FC<RadialMenuProps> = ({
  language,
  isOpen,
  onClose,
  onAction,
  actionsConfig
}) => {
  if (!isOpen) return null;

  const t = translations[language];

  const north = actionsConfig?.north || 'actDownloadVideo';
  const east = actionsConfig?.east || 'actDownloadAudio';
  const south = actionsConfig?.south || 'actOpenFolder';
  const west = actionsConfig?.west || 'actOpenConvert';

  const getActionLabel = (act: string) => {
    switch (act) {
      case 'actDownloadVideo': return t.actDownloadVideo;
      case 'actDownloadVideo4K': return t.actDownloadVideo4K || (language === 'th' ? 'โหลดวิดีโอ (4K)' : 'Download (4K)');
      case 'actDownloadVideo1080p': return t.actDownloadVideo1080p || (language === 'th' ? 'โหลดวิดีโอ (1080p)' : 'Download (1080p)');
      case 'actDownloadVideo720p': return t.actDownloadVideo720p || (language === 'th' ? 'โหลดวิดีโอ (720p)' : 'Download (720p)');
      case 'actDownloadAudio': return t.actDownloadAudio;
      case 'actOpenFolder': return t.actOpenFolder;
      case 'actOpenConvert': return t.actOpenConvert;
      case 'actToggleApp': return t.actToggleApp;
      default: return act;
    }
  };

  const getActionIcon = (act: string) => {
    switch (act) {
      case 'actDownloadVideo':
      case 'actDownloadVideo4K':
      case 'actDownloadVideo1080p':
      case 'actDownloadVideo720p':
        return <Video className="w-5 h-5" />;
      case 'actDownloadAudio': return <Music className="w-5 h-5" />;
      case 'actOpenFolder': return <Folder className="w-5 h-5" />;
      case 'actOpenConvert': return <RefreshCw className="w-5 h-5" />;
      default: return <Download className="w-5 h-5" />;
    }
  };

  // Close on Escape or arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' || e.key === '1') { onAction(north); onClose(); }
      if (e.key === 'ArrowRight' || e.key === '2') { onAction(east); onClose(); }
      if (e.key === 'ArrowDown' || e.key === '3') { onAction(south); onClose(); }
      if (e.key === 'ArrowLeft' || e.key === '4') { onAction(west); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [north, east, south, west, onAction, onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-80 h-80 flex items-center justify-center select-none"
      >
        {/* Center Close Circle */}
        <button
          type="button"
          onClick={onClose}
          className="absolute z-30 w-16 h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] shadow-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400 transition-colors cursor-pointer"
          title="Esc"
        >
          <X className="w-6 h-6" />
          <span className="text-[9px] font-mono opacity-60">ESC</span>
        </button>

        {/* North Slice */}
        <button
          type="button"
          onClick={() => { onAction(north); onClose(); }}
          className="absolute top-0 w-48 h-24 -mt-2 rounded-t-full bg-[var(--color-surface)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black transition-all flex flex-col items-center justify-start pt-3 shadow-lg cursor-pointer group"
        >
          <div className="text-[var(--color-accent)] group-hover:text-black transition-colors">
            {getActionIcon(north)}
          </div>
          <span className="text-[11px] font-bold mt-1 text-center px-2 line-clamp-1">
            {getActionLabel(north)}
          </span>
          <span className="text-[9px] font-mono opacity-50">▲ [1]</span>
        </button>

        {/* East Slice */}
        <button
          type="button"
          onClick={() => { onAction(east); onClose(); }}
          className="absolute right-0 w-24 h-48 -mr-2 rounded-r-full bg-[var(--color-surface)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black transition-all flex flex-col items-center justify-center pr-2 shadow-lg cursor-pointer group"
        >
          <div className="text-[var(--color-accent)] group-hover:text-black transition-colors">
            {getActionIcon(east)}
          </div>
          <span className="text-[10px] font-bold mt-1 text-center px-1 line-clamp-2">
            {getActionLabel(east)}
          </span>
          <span className="text-[9px] font-mono opacity-50">► [2]</span>
        </button>

        {/* South Slice */}
        <button
          type="button"
          onClick={() => { onAction(south); onClose(); }}
          className="absolute bottom-0 w-48 h-24 -mb-2 rounded-b-full bg-[var(--color-surface)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black transition-all flex flex-col items-center justify-end pb-3 shadow-lg cursor-pointer group"
        >
          <span className="text-[9px] font-mono opacity-50">▼ [3]</span>
          <span className="text-[11px] font-bold mb-1 text-center px-2 line-clamp-1">
            {getActionLabel(south)}
          </span>
          <div className="text-[var(--color-accent)] group-hover:text-black transition-colors">
            {getActionIcon(south)}
          </div>
        </button>

        {/* West Slice */}
        <button
          type="button"
          onClick={() => { onAction(west); onClose(); }}
          className="absolute left-0 w-24 h-48 -ml-2 rounded-l-full bg-[var(--color-surface)] border-2 border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black transition-all flex flex-col items-center justify-center pl-2 shadow-lg cursor-pointer group"
        >
          <div className="text-[var(--color-accent)] group-hover:text-black transition-colors">
            {getActionIcon(west)}
          </div>
          <span className="text-[10px] font-bold mt-1 text-center px-1 line-clamp-2">
            {getActionLabel(west)}
          </span>
          <span className="text-[9px] font-mono opacity-50">◄ [4]</span>
        </button>
      </div>
    </div>
  );
};
