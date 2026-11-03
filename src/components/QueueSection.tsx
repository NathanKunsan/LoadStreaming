import React from 'react';
import { Pause, Play, X, FolderOpen, AlertTriangle, CheckCircle2, Clock, Video, Music, CheckCheck } from 'lucide-react';
import { DownloadJob } from '../../electron/types';
import { translations, Language } from '../locales/translations';

interface QueueSectionProps {
  language: Language;
  jobs: DownloadJob[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenFileLocation: (filePath?: string) => void;
  onClearFinished?: () => void;
}

export const QueueSection: React.FC<QueueSectionProps> = ({
  language,
  jobs,
  onPause,
  onResume,
  onCancel,
  onOpenFileLocation,
  onClearFinished
}) => {
  const t = translations[language];

  if (jobs.length === 0) {
    return (
      <div className="pencil-box p-8 flex flex-col items-center justify-center text-center text-[var(--color-text-muted)] space-y-2">
        <Clock className="w-10 h-10 opacity-30" />
        <p className="text-sm font-semibold">{t.noJobs}</p>
      </div>
    );
  }

  const hasFinishedJobs = jobs.some(j => j.status === 'Completed' || j.status === 'Cancelled' || j.status === 'Failed');

  const getStatusBadge = (job: DownloadJob) => {
    switch (job.status) {
      case 'Downloading':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{t.statusDownloading}</span>
          </span>
        );
      case 'Waiting':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
            <Clock className="w-3 h-3" />
            <span>{t.statusWaiting}</span>
          </span>
        );
      case 'Paused':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-600/20 text-yellow-500 border border-yellow-600/30">
            <Pause className="w-3 h-3" />
            <span>{t.statusPaused}</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t.statusCompleted}</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-600/20 text-zinc-400 border border-zinc-600/30">
            <X className="w-3 h-3" />
            <span>{t.statusCancelled}</span>
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>{t.statusFailed}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Top action row: Clear finished items */}
      {hasFinishedJobs && onClearFinished && (
        <div className="flex justify-end pr-1">
          <button
            type="button"
            onClick={onClearFinished}
            className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'ล้างรายการที่เสร็จแล้ว' : 'Clear Finished'}</span>
          </button>
        </div>
      )}

      {jobs.map((job) => (
        <div
          key={job.id}
          className="pencil-box p-3.5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-2.5 transition-all"
        >
          {/* Card Header: Thumbnail + Title + Status */}
          <div className="flex items-start space-x-3">
            {/* Thumbnail */}
            <div className="w-20 h-13 shrink-0 bg-black/40 rounded overflow-hidden border border-[var(--color-border)] relative">
              {job.thumbnail ? (
                <img
                  src={job.thumbnail}
                  alt={job.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                  {job.mediaType === 'video' ? <Video className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                </div>
              )}
              {/* Type Badge */}
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 text-[10px] font-bold text-white rounded">
                {job.mediaType === 'video' ? (job.resolution || 'MP4') : 'MP3'}
              </span>
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold truncate text-[var(--color-text-main)]" title={job.title}>
                  {job.title}
                </h4>
                {getStatusBadge(job)}
              </div>

              {/* Progress & Speed Stats */}
              <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mt-1">
                <span>
                  {job.status === 'Completed'
                    ? job.totalSizeStr || 'Done'
                    : `${job.progress.toFixed(1)}% (${job.totalSizeStr})`}
                </span>
                {job.status === 'Downloading' && (
                  <span className="font-mono">
                    {job.downloadSpeedStr} • ETA {job.etaStr}
                  </span>
                )}
                {job.status === 'Paused' && (
                  <span className="text-yellow-500 font-semibold text-[10px]">
                    {language === 'th' ? 'สามารถกดโหลดต่อได้' : 'Ready to resume'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Theme-Synchronized Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[var(--color-progress-bg)] overflow-hidden border border-[var(--color-border)]/40">
            <div
              className="h-full bg-[var(--color-progress-fill)] transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(job.progress, job.status === 'Completed' ? 100 : 0)}%` }}
            ></div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[50%]">
              {job.finalFilePath ? job.finalFilePath : job.outputDir}
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Pause Button */}
              {job.status === 'Downloading' && (
                <button
                  type="button"
                  onClick={() => onPause(job.id)}
                  className="pencil-button-secondary px-2 py-1 text-xs flex items-center space-x-1 cursor-pointer"
                  title={t.pauseBtn}
                >
                  <Pause className="w-3 h-3" />
                  <span>{t.pauseBtn}</span>
                </button>
              )}

              {/* Resume Button */}
              {(job.status === 'Paused' || job.status === 'Failed') && (
                <button
                  type="button"
                  onClick={() => onResume(job.id)}
                  className="pencil-button px-2.5 py-1 text-xs flex items-center space-x-1 cursor-pointer"
                  title={t.resumeBtn}
                >
                  <Play className="w-3 h-3" />
                  <span>{t.resumeBtn}</span>
                </button>
              )}

              {/* Cancel Button */}
              {(job.status === 'Downloading' || job.status === 'Waiting' || job.status === 'Paused') && (
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="px-2 py-1 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 flex items-center space-x-1 cursor-pointer transition-colors"
                  title={t.cancelBtn}
                >
                  <X className="w-3 h-3" />
                  <span>{t.cancelBtn}</span>
                </button>
              )}

              {/* Open Location Button */}
              {job.status === 'Completed' && (
                <button
                  type="button"
                  onClick={() => onOpenFileLocation(job.finalFilePath)}
                  className="pencil-button px-2.5 py-1 text-xs flex items-center space-x-1 cursor-pointer"
                  title={t.openFolderBtn}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>{t.openFolderBtn}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
