import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="pencil-box max-w-sm w-full p-5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onCancel}
            className="pencil-button-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 text-xs font-bold rounded border border-red-500 bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-xs transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
