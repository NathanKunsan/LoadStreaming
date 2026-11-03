import React from 'react';
import { Link2, ArrowDownCircle } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface DropZoneOverlayProps {
  language: Language;
  isDragging: boolean;
  dropType?: 'url' | 'file';
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  language,
  isDragging,
  dropType = 'url'
}) => {
  if (!isDragging) return null;

  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-8 pointer-events-none animate-in fade-in duration-200">
      <div className="w-full h-full max-w-2xl max-h-96 border-4 border-dashed border-[var(--color-accent)] rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-4 bg-[var(--color-surface)]/70 shadow-2xl animate-pulse">
        <div className="p-4 rounded-full bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)]">
          {dropType === 'file' ? (
            <ArrowDownCircle className="w-12 h-12 text-[var(--color-accent)] animate-bounce" />
          ) : (
            <Link2 className="w-12 h-12 text-[var(--color-accent)] animate-bounce" />
          )}
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-wide text-[var(--color-text-main)]">
            {dropType === 'file' ? t.dropFileTitle : t.dropZoneTitle}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">
            {t.dropZoneSub}
          </p>
        </div>

        <div className="px-3 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-accent)] font-semibold tracking-wider uppercase">
          LoadStreaming Drop Target
        </div>
      </div>
    </div>
  );
};
