import React, { useEffect, useState } from 'react';
import { CheckCircle2, FolderOpen, X } from 'lucide-react';
import { DownloadJob } from '../../electron/types';
import { Language } from '../locales/translations';

interface ToastNotificationProps {
  language: Language;
  job: DownloadJob | null;
  onClose: () => void;
  onOpenFileLocation: (filePath?: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  language,
  job,
  onClose,
  onOpenFileLocation
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!job) return;
    setIsExiting(false);

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsExiting(true);
      const closeTimer = setTimeout(() => {
        onClose();
      }, 400);
      return () => clearTimeout(closeTimer);
    }, 5000);

    return () => clearTimeout(timer);
  }, [job]);

  if (!job) return null;

  const handleManualClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-sm w-full transition-all duration-400 ease-in-out ${
        isExiting
          ? 'translate-x-32 opacity-0 pointer-events-none'
          : 'translate-x-0 opacity-100'
      }`}
    >
      <div className="pencil-box p-3.5 bg-[var(--color-surface)] text-[var(--color-text-main)] shadow-2xl space-y-2 border-2 border-green-500 overflow-hidden relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <h4 className="font-bold text-xs text-green-400">
              {language === 'th' ? 'ดาวน์โหลดเสร็จสิ้น' : 'Download Completed'}
            </h4>
          </div>
          <button
            onClick={handleManualClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs font-semibold line-clamp-2 text-[var(--color-text-main)]">
          {job.title}
        </p>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              onOpenFileLocation(job.finalFilePath);
              handleManualClose();
            }}
            className="pencil-button px-3 py-1 text-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'เปิดตำแหน่งไฟล์' : 'Open Location'}</span>
          </button>
        </div>

        {/* 5-second countdown indicator bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/20 overflow-hidden">
          <div
            className="h-full bg-green-500 animate-[progress_5s_linear_forwards]"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
};
