import React, { useState } from 'react';
import { Trash2, FolderOpen, History, Video, Music } from 'lucide-react';
import { HistoryItem } from '../../electron/types';
import { translations, Language } from '../locales/translations';
import { ConfirmModal } from './ConfirmModal';

interface HistorySectionProps {
  language: Language;
  history: HistoryItem[];
  onClearHistory: () => void;
  onOpenFileLocation: (filePath: string) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  language,
  history,
  onClearHistory,
  onOpenFileLocation
}) => {
  const t = translations[language];
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (history.length === 0) {
    return (
      <div className="pencil-box p-8 flex flex-col items-center justify-center text-center text-[var(--color-text-muted)] space-y-2">
        <History className="w-10 h-10 opacity-30" />
        <p className="text-sm font-semibold">{t.noHistory}</p>
      </div>
    );
  }

  const handleConfirmClear = () => {
    onClearHistory();
    setIsConfirmOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Header with Clear Button */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[var(--color-text-muted)] font-semibold">
          {history.length} {language === 'th' ? 'รายการ' : 'items'}
        </span>
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="px-2.5 py-1 text-xs rounded border border-red-500/40 text-red-400 hover:bg-red-500/20 flex items-center space-x-1 cursor-pointer transition-colors"
          title={t.clearHistory}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.clearHistory}</span>
        </button>
      </div>

      {/* History Items List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className="pencil-box p-3 bg-[var(--color-surface)] text-[var(--color-text-main)] flex items-center justify-between gap-3"
          >
            {/* Thumbnail & Title */}
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-16 h-10 shrink-0 bg-black/40 rounded overflow-hidden border border-[var(--color-border)] relative">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                    {item.mediaType === 'video' ? <Video className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 px-0.5 text-[9px] bg-black/80 text-white font-bold">
                  {item.mediaType === 'video' ? (item.resolution || 'MP4') : 'MP3'}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold truncate text-[var(--color-text-main)]" title={item.title}>
                  {item.title}
                </h4>
                <div className="flex items-center space-x-2 text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  <span>{item.fileSizeStr}</span>
                  <span>•</span>
                  <span>{new Date(item.completedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Action Button: Reveal in Explorer */}
            <button
              type="button"
              onClick={() => onOpenFileLocation(item.filePath)}
              className="pencil-button px-2.5 py-1 text-xs flex items-center space-x-1 cursor-pointer shrink-0"
              title={t.openFolderBtn}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t.openFolderBtn}</span>
            </button>
          </div>
        ))}
      </div>

      {/* In-App Confirmation Modal (Replaces Windows popup) */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title={t.clearHistory}
        message={t.confirmClearHistory}
        confirmText={t.confirmBtn}
        cancelText={t.cancelModalBtn}
        onConfirm={handleConfirmClear}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
