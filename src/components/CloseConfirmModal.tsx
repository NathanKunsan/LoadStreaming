import React from 'react';
import { Layers, Power, X, AlertTriangle } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface CloseConfirmModalProps {
  language: Language;
  isOpen: boolean;
  activeTasksCount: number;
  onMinimizeToTray: () => void;
  onQuitApp: () => void;
  onCancel: () => void;
}

export const CloseConfirmModal: React.FC<CloseConfirmModalProps> = ({
  language,
  isOpen,
  activeTasksCount,
  onMinimizeToTray,
  onQuitApp,
  onCancel
}) => {
  if (!isOpen) return null;

  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="pencil-box max-w-md w-full p-5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-4 shadow-2xl border-2 border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm tracking-wide">
              {t.closeConfirmTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="space-y-3 text-xs leading-relaxed">
          <p className="text-[var(--color-text-main)] font-medium">
            {t.closeConfirmMessage}
          </p>

          {activeTasksCount > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/50 rounded flex items-start space-x-2.5 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {language === 'th' ? `มีรายการกำลังทำงานอยู่ ${activeTasksCount} รายการ` : `${activeTasksCount} active tasks are currently running`}
                </p>
                <p className="text-[11px] opacity-90">
                  {t.closeConfirmActiveWarning}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto pencil-button-secondary px-3.5 py-1.5 text-xs font-semibold cursor-pointer order-3 sm:order-1"
          >
            {t.cancelModalBtn}
          </button>

          <button
            type="button"
            onClick={onQuitApp}
            className="w-full sm:w-auto pencil-button-secondary px-3.5 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 flex items-center justify-center space-x-1.5 cursor-pointer order-2"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{t.quitAppBtn}</span>
          </button>

          <button
            type="button"
            onClick={onMinimizeToTray}
            className="w-full sm:w-auto pencil-button px-4 py-1.5 text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer order-1 sm:order-3"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.minimizeToTrayBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
