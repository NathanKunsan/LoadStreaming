import React, { useState, useEffect } from 'react';
import { Copy, Edit3, X, AlertTriangle } from 'lucide-react';
import { translations, Language } from '../locales/translations';

interface DuplicateModalProps {
  language: Language;
  isOpen: boolean;
  fileName: string;
  suggestedName: string;
  onMakeCopy: () => void;
  onRename: (newName: string) => void;
  onCancel: () => void;
}

export const DuplicateModal: React.FC<DuplicateModalProps> = ({
  language,
  isOpen,
  fileName,
  suggestedName,
  onMakeCopy,
  onRename,
  onCancel
}) => {
  if (!isOpen) return null;

  const t = translations[language];
  const [isEditing, setIsEditing] = useState(false);
  const [renameValue, setRenameValue] = useState(suggestedName);

  useEffect(() => {
    setRenameValue(suggestedName);
    setIsEditing(false);
  }, [suggestedName, isOpen]);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim()) {
      onRename(renameValue.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="pencil-box max-w-md w-full p-5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-4 shadow-2xl border-2 border-[var(--color-accent)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="font-bold text-sm text-[var(--color-text-main)]">
              {t.duplicateTitle}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Message */}
        <div className="space-y-2 text-xs">
          <p className="text-[var(--color-text-muted)]">
            {t.duplicateMessage}
          </p>
          <div className="p-2.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] font-semibold text-[var(--color-text-main)] break-all select-text">
            {fileName}
          </div>

          {isEditing && (
            <form onSubmit={handleRenameSubmit} className="pt-2 space-y-2">
              <label className="block text-[11px] font-bold text-[var(--color-accent)]">
                {language === 'th' ? 'ระบุชื่อไฟล์ใหม่:' : 'Enter new filename:'}
              </label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="w-full h-8 px-2.5 text-xs bg-[var(--color-bg)] border-2 border-[var(--color-accent)] rounded outline-none text-[var(--color-text-main)]"
              />
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="pencil-button-secondary px-3 py-1 text-xs"
                >
                  {t.cancelModalBtn}
                </button>
                <button
                  type="submit"
                  disabled={!renameValue.trim()}
                  className="pencil-button px-4 py-1 text-xs font-bold"
                >
                  {language === 'th' ? 'ตกลง' : 'OK'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 3 Action Buttons (When not editing inline) */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
            {/* 1. Make a Copy */}
            <button
              type="button"
              onClick={onMakeCopy}
              className="pencil-button px-2 py-2 text-xs flex flex-col items-center justify-center space-y-1 text-center cursor-pointer"
              title={language === 'th' ? `บันทึกเป็น ${suggestedName}` : `Save as ${suggestedName}`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="font-bold leading-tight">{t.duplicateMakeCopy}</span>
            </button>

            {/* 2. Rename */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="pencil-button-secondary px-2 py-2 text-xs flex flex-col items-center justify-center space-y-1 text-center cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="font-bold leading-tight">{t.duplicateRename}</span>
            </button>

            {/* 3. Cancel */}
            <button
              type="button"
              onClick={onCancel}
              className="pencil-button-secondary px-2 py-2 text-xs flex flex-col items-center justify-center space-y-1 text-center text-red-400 hover:text-red-300 border-red-500/50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span className="font-bold leading-tight">{t.duplicateCancel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
