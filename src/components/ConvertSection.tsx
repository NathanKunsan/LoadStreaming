import React, { useState, useEffect, useRef } from 'react';
import { 
  FileAudio, 
  FileVideo, 
  FileText,
  Folder, 
  FolderOpen, 
  Play, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  UploadCloud,
  Plus,
  Trash2
} from 'lucide-react';
import { translations, Language } from '../locales/translations';
import { ConversionJob, AudioFormat, VideoFormat, SubtitleFormat, TargetCategory, TargetFormat } from '../../electron/types';

export interface SelectedMediaFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  status: 'waiting' | 'converting' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
}

interface ConvertSectionProps {
  language: Language;
  outputDir: string;
  onBrowseFolder: () => void;
  initialFiles?: { filePath: string; fileName: string; fileSize: number }[] | null;
  initialFile?: { filePath: string; fileName: string; fileSize: number } | null;
}

// 11 Audio Formats
const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'amr'];
// 11 Video Formats
const VIDEO_FORMATS: VideoFormat[] = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'wmv', 'mpeg', 'mpg', 'flv', '3gp', 'm4v'];
// 10 Practical Subtitle & Transcript Formats
const SUBTITLE_FORMATS: SubtitleFormat[] = ['srt', 'vtt', 'txt', 'lrc', 'ass', 'json', 'csv', 'sbv', 'md', 'tsv'];

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'amr'];
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'wmv', 'mpeg', 'mpg', 'flv', '3gp', 'm4v'];
const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'txt', 'lrc', 'ass', 'ssa', 'json', 'csv', 'sbv', 'md', 'tsv'];

const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTENSIONS.includes(ext);
};

const isSubtitleFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return SUBTITLE_EXTENSIONS.includes(ext);
};

export const ConvertSection: React.FC<ConvertSectionProps> = ({
  language,
  outputDir,
  onBrowseFolder,
  initialFiles,
  initialFile
}) => {
  const t = translations[language];

  const [selectedFiles, setSelectedFiles] = useState<SelectedMediaFile[]>([]);
  const [category, setCategory] = useState<TargetCategory>('audio');
  const [targetFormat, setTargetFormat] = useState<TargetFormat>('mp3');
  const [isConverting, setIsConverting] = useState(false);
  const [currentConvertingId, setCurrentConvertingId] = useState<string | null>(null);
  const [completedJobsCount, setCompletedJobsCount] = useState<number>(0);

  const cancelRequestedRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);

  // Helper to add files with deduplication
  const handleAddFiles = (newFiles: { filePath: string; fileName: string; fileSize: number }[]) => {
    setSelectedFiles((prev) => {
      const existingPaths = new Set(prev.map(f => f.filePath));
      const additions: SelectedMediaFile[] = newFiles
        .filter(f => !existingPaths.has(f.filePath))
        .map(f => ({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          filePath: f.filePath,
          fileName: f.fileName,
          fileSize: f.fileSize,
          status: 'waiting',
          progress: 0
        }));

      const updated = [...prev, ...additions];
      const hasSub = updated.some(f => isSubtitleFile(f.fileName));
      const hasAudio = updated.some(f => isAudioFile(f.fileName));

      if (hasSub) {
        setCategory('subtitle');
        if (!SUBTITLE_FORMATS.includes(targetFormat as SubtitleFormat)) {
          setTargetFormat('srt');
        }
      } else if (hasAudio) {
        setCategory('audio');
        if (!AUDIO_FORMATS.includes(targetFormat as AudioFormat)) {
          setTargetFormat('mp3');
        }
      }
      return updated;
    });
  };

  // Sync with initialFiles / initialFile if provided from parent drag & drop
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleAddFiles(initialFiles);
    } else if (initialFile) {
      handleAddFiles([initialFile]);
    }
  }, [initialFiles, initialFile]);

  // Sync category with default format
  const handleCategoryChange = (newCat: TargetCategory) => {
    // If any source file is audio, prevent switching to video
    const hasAudio = selectedFiles.some(f => isAudioFile(f.fileName));
    if (hasAudio && newCat === 'video') {
      return;
    }
    setCategory(newCat);
    if (newCat === 'audio') setTargetFormat('mp3');
    else if (newCat === 'video') setTargetFormat('mp4');
    else if (newCat === 'subtitle') setTargetFormat('srt');
  };

  // Open file dialog with multiple selection support
  const handleSelectLocalFiles = async () => {
    if (!window.electronAPI) return;

    const filters = [
      {
        name: language === 'th' ? 'ไฟล์ที่รองรับทั้งหมด' : 'All Supported Files',
        extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS, ...SUBTITLE_EXTENSIONS]
      },
      {
        name: language === 'th' ? 'ไฟล์คำบรรยายและข้อความ (*.srt, *.vtt, *.txt...)' : 'Subtitle & Transcript Files (*.srt, *.vtt...)',
        extensions: SUBTITLE_EXTENSIONS
      },
      {
        name: language === 'th' ? 'ไฟล์เสียง (*.mp3, *.wav, *.flac...)' : 'Audio Files (*.mp3, *.wav...)',
        extensions: AUDIO_EXTENSIONS
      },
      {
        name: language === 'th' ? 'ไฟล์วิดีโอ (*.mp4, *.mkv...)' : 'Video Files (*.mp4, *.mkv...)',
        extensions: VIDEO_EXTENSIONS
      }
    ];

    const res = await window.electronAPI.selectFiles({
      title: language === 'th' ? 'เลือกไฟล์สำหรับแปลง (เลือกได้หลายไฟล์)' : 'Select Files to Convert',
      filters
    });

    if (res && res.length > 0) {
      handleAddFiles(res);
    }
  };

  // Drag & drop file handler
  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const list = Array.from(e.dataTransfer.files).map(f => ({
        filePath: (f as any).path,
        fileName: f.name,
        fileSize: f.size
      })).filter(f => !!f.filePath);

      if (list.length > 0) {
        handleAddFiles(list);
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    if (isConverting) return;
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClearAll = () => {
    if (isConverting) return;
    setSelectedFiles([]);
    setCompletedJobsCount(0);
  };

  // Start sequential batch conversion
  const handleStartBatchConversion = async () => {
    if (selectedFiles.length === 0 || !window.electronAPI || isConverting) return;

    setIsConverting(true);
    cancelRequestedRef.current = false;

    let targetBase = (outputDir || '').trim().replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
    if (!targetBase.toLowerCase().endsWith('loadstreaming')) {
      targetBase = `${targetBase}\\LoadStreaming`;
    }
    const convertOutputFolder = `${targetBase}\\Converted`.replace(/[/\\]+/g, '\\');

    // Reset waiting/failed items to waiting
    setSelectedFiles(prev => prev.map(f => f.status === 'completed' ? f : { ...f, status: 'waiting', progress: 0 }));

    const snapshot = [...selectedFiles];
    let completedCount = snapshot.filter(f => f.status === 'completed').length;
    setCompletedJobsCount(completedCount);

    for (let i = 0; i < snapshot.length; i++) {
      if (cancelRequestedRef.current) break;

      const file = snapshot[i];
      if (file.status === 'completed') continue;

      setCurrentConvertingId(file.id);
      setSelectedFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'converting', progress: 0 } : f));

      const jobId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      activeJobIdRef.current = jobId;

      const newJob: ConversionJob = {
        id: jobId,
        sourcePath: file.filePath,
        sourceName: file.fileName,
        sourceSizeStr: formatBytes(file.fileSize),
        targetFormat,
        targetCategory: category,
        outputDir: convertOutputFolder,
        status: 'Waiting',
        progress: 0,
        createdAt: Date.now()
      };

      try {
        await new Promise<void>((resolve) => {
          let hasFinished = false;
          const unsub = window.electronAPI.onConversionUpdated((cJob) => {
            if (cJob.id === jobId) {
              setSelectedFiles(prev => prev.map(f => {
                if (f.id === file.id) {
                  return {
                    ...f,
                    progress: cJob.progress,
                    status: cJob.status === 'Completed' ? 'completed' : cJob.status === 'Failed' ? 'failed' : 'converting',
                    outputPath: cJob.outputPath
                  };
                }
                return f;
              }));

              if (cJob.status === 'Completed') {
                completedCount++;
                setCompletedJobsCount(completedCount);
                if (!hasFinished) {
                  hasFinished = true;
                  unsub();
                  resolve();
                }
              } else if (cJob.status === 'Failed' || cJob.status === 'Cancelled') {
                if (!hasFinished) {
                  hasFinished = true;
                  unsub();
                  resolve();
                }
              }
            }
          });

          window.electronAPI.startConversion(newJob);
        });
      } catch (err) {
        console.error('Conversion error for:', file.fileName, err);
      }

      activeJobIdRef.current = null;
    }

    setCurrentConvertingId(null);
    setIsConverting(false);
  };

  const handleCancelAll = async () => {
    cancelRequestedRef.current = true;
    if (activeJobIdRef.current && window.electronAPI) {
      await window.electronAPI.cancelConversion(activeJobIdRef.current);
    }
    setIsConverting(false);
    setCurrentConvertingId(null);
    setSelectedFiles(prev => prev.map(f => f.status === 'converting' ? { ...f, status: 'waiting', progress: 0 } : f));
  };

  const handleOpenFileLocation = (path?: string) => {
    if (path && window.electronAPI) {
      window.electronAPI.openFileLocation(path);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasAudioSource = selectedFiles.some(f => isAudioFile(f.fileName));
  const totalSizeBytes = selectedFiles.reduce((acc, f) => acc + f.fileSize, 0);

  const cleanBase = (outputDir || '').trim().replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
  const convertedTargetDir = (cleanBase.toLowerCase().endsWith('loadstreaming')
    ? `${cleanBase}\\Converted`
    : `${cleanBase}\\LoadStreaming\\Converted`).replace(/[/\\]+/g, '\\');

  const allCompleted = selectedFiles.length > 0 && selectedFiles.every(f => f.status === 'completed');
  const activeConvertingFile = selectedFiles.find(f => f.id === currentConvertingId);
  const overallBatchPercent = selectedFiles.length > 0
    ? Math.round((completedJobsCount / selectedFiles.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="pencil-box p-4 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[var(--color-border)] pb-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold tracking-wide">
              {t.convertTabTitle}
            </h2>
            {selectedFiles.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent)] text-[var(--color-bg)]">
                {selectedFiles.length} {language === 'th' ? 'ไฟล์' : 'files'}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
            {language === 'th' ? 'ระบบประมวลผลแปลงไฟล์ความละเอียดสูง' : 'FFmpeg High-Fidelity Engine'}
          </span>
        </div>

        {/* File Selection Box: Dropzone or Multi-File Card List */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold opacity-90">
              {t.convertSelectFiles}
            </label>
            {selectedFiles.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectLocalFiles}
                  disabled={isConverting}
                  className="pencil-button-secondary px-2 py-0.5 text-[11px] flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.convertAddFilesBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isConverting}
                  className="pencil-button-secondary px-2 py-0.5 text-[11px] text-red-400 flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t.convertClearAllBtn}</span>
                </button>
              </div>
            )}
          </div>

          {selectedFiles.length === 0 ? (
            /* Big Upload Zone */
            <div
              onClick={handleSelectLocalFiles}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDropFiles}
              className="border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-lg p-6 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-colors bg-[var(--color-bg)] text-center"
            >
              <UploadCloud className="w-8 h-8 text-[var(--color-accent)]" />
              <p className="text-xs font-bold text-[var(--color-text-main)]">
                {language === 'th'
                  ? 'คลิกที่นี่ หรือ ลากไฟล์มาวาง เพื่อเลือกไฟล์สื่อ (เลือกได้หลายไฟล์พร้อมกัน)'
                  : 'Click here or drag & drop media files (supports multiple files)'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {language === 'th'
                  ? 'รองรับไฟล์เสียง (MP3, WAV, FLAC...) และไฟล์วิดีโอ (MP4, MKV, MOV...)'
                  : 'Supports all major audio (MP3, WAV, FLAC...) and video formats'}
              </p>
            </div>
          ) : (
            /* Selected Files List */
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDropFiles}
              className="border-2 border-[var(--color-border)] rounded-md bg-[var(--color-bg)] overflow-hidden"
            >
              <div className="max-h-52 overflow-y-auto divide-y divide-[var(--color-border)]/60">
                {selectedFiles.map((file, idx) => {
                  const isAudio = isAudioFile(file.fileName);
                  const isCurrent = file.id === currentConvertingId;

                  return (
                    <div
                      key={file.id}
                      className={`p-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                        isCurrent ? 'bg-[var(--color-surface)] border-l-4 border-l-[var(--color-accent)]' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono shrink-0 w-4">
                          {idx + 1}.
                        </span>
                        <div className="w-7 h-7 rounded bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                          {isAudio ? (
                            <FileAudio className="w-4 h-4 text-[var(--color-accent)]" />
                          ) : (
                            <FileVideo className="w-4 h-4 text-[var(--color-accent)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold truncate text-[var(--color-text-main)] select-text" title={file.fileName}>
                            {file.fileName}
                          </h4>
                          <div className="flex items-center space-x-2 text-[10px] text-[var(--color-text-muted)]">
                            <span className="font-mono">{formatBytes(file.fileSize)}</span>
                            <span>•</span>
                            <span>
                              {isAudio
                                ? (language === 'th' ? 'ไฟล์เสียง' : 'Audio')
                                : (language === 'th' ? 'ไฟล์วิดีโอ' : 'Video')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status / Remove */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {file.status === 'completed' ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="flex items-center text-green-400 space-x-1 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t.convertFileItemDone}</span>
                            </span>
                            {file.outputPath && (
                              <button
                                type="button"
                                onClick={() => handleOpenFileLocation(file.outputPath)}
                                className="pencil-button-secondary p-1 text-[10px] cursor-pointer"
                                title={t.openFolderBtn}
                              >
                                <FolderOpen className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : file.status === 'converting' ? (
                          <span className="flex items-center text-[var(--color-accent)] space-x-1.5 text-[11px] font-bold">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{file.progress}%</span>
                          </span>
                        ) : file.status === 'failed' ? (
                          <span className="flex items-center text-red-400 space-x-1 text-[11px] font-bold">
                            <X className="w-3.5 h-3.5" />
                            <span>{t.convertFileItemFailed}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)] text-[10px]">
                            {t.convertFileItemWaiting}
                          </span>
                        )}

                        {!isConverting && file.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 cursor-pointer"
                            title={language === 'th' ? 'ลบออกจากรายการ' : 'Remove from list'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal info footer */}
              <div className="p-2 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)] px-3">
                <span>
                  {t.convertSelectedCount}: <strong>{selectedFiles.length}</strong> {language === 'th' ? 'ไฟล์' : 'files'} ({formatBytes(totalSizeBytes)})
                </span>
                <span className="text-[10px]">
                  {language === 'th' ? 'ลากไฟล์มาใส่เพิ่มได้ตลอดเวลา' : 'Drag & drop more files here anytime'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Category & Format Selection */}
        <div className="space-y-3 pt-1">
          {/* Category Toggle */}
          <div>
            <label className="block text-xs font-bold mb-1 opacity-90">
              {t.convertTargetCategory}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-lg">
              <button
                type="button"
                onClick={() => handleCategoryChange('audio')}
                className={`py-1.5 text-xs font-bold rounded border-2 transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  category === 'audio'
                    ? 'border-[var(--color-border)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <FileAudio className="w-3.5 h-3.5" />
                <span>{t.convertAudioCategory}</span>
              </button>
              <button
                type="button"
                disabled={hasAudioSource}
                onClick={() => !hasAudioSource && handleCategoryChange('video')}
                title={hasAudioSource ? t.audioCannotConvertToVideo : undefined}
                className={`py-1.5 text-xs font-bold rounded border-2 transition-colors flex items-center justify-center space-x-1.5 ${
                  hasAudioSource
                    ? 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed'
                    : category === 'video'
                    ? 'border-[var(--color-border)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold cursor-pointer'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer'
                }`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                <span>{t.convertVideoCategory}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('subtitle')}
                className={`py-1.5 text-xs font-bold rounded border-2 transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  category === 'subtitle'
                    ? 'border-[var(--color-border)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t.convertSubtitleCategory}</span>
              </button>
            </div>

            {/* Warning if source is audio file */}
            {hasAudioSource && category === 'video' && (
              <p className="text-[11px] text-amber-500 font-medium pt-1">
                * {t.audioCannotConvertToVideo}
              </p>
            )}
          </div>

          {/* Formats Grid */}
          <div>
            <label className="block text-xs font-bold mb-1.5 opacity-90">
              {t.convertTargetFormat} (.{targetFormat.toUpperCase()})
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-1.5">
              {(category === 'audio' ? AUDIO_FORMATS : category === 'video' ? VIDEO_FORMATS : SUBTITLE_FORMATS).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setTargetFormat(fmt)}
                  className={`py-1.5 px-1 text-xs font-mono font-bold rounded border-2 transition-all cursor-pointer text-center uppercase ${
                    targetFormat === fmt
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-text-muted)]'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Destination Folder */}
          <div>
            <label className="block text-xs font-bold mb-1 opacity-90">
              {t.convertOutputDir}
            </label>
            <div className="flex space-x-1.5 h-9">
              <input
                type="text"
                readOnly
                value={convertedTargetDir}
                title={convertedTargetDir}
                className="flex-1 px-2 text-xs bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)] truncate cursor-default"
              />
              <button
                type="button"
                onClick={onBrowseFolder}
                className="pencil-button-secondary px-2.5 flex items-center space-x-1 text-xs font-semibold cursor-pointer shrink-0"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{t.browseFolder}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Button & Active Progress */}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
          <div className="text-xs text-[var(--color-text-muted)] min-w-0 flex-1 mr-2">
            {isConverting ? (
              <span className="flex items-center space-x-2 text-[var(--color-accent)] font-semibold truncate">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate">
                  {t.convertBatchProgress} {completedJobsCount + 1}/{selectedFiles.length} ({activeConvertingFile?.fileName || ''})
                </span>
              </span>
            ) : allCompleted ? (
              <span className="flex items-center space-x-1.5 text-green-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t.convertAllSuccess} ({selectedFiles.length} {language === 'th' ? 'ไฟล์' : 'files'})</span>
              </span>
            ) : (
              <span>
                {selectedFiles.length > 0
                  ? (language === 'th'
                      ? `พร้อมแปลง ${selectedFiles.length} ไฟล์ เป็นรูปแบบ .${targetFormat.toUpperCase()}`
                      : `Ready to convert ${selectedFiles.length} files to .${targetFormat.toUpperCase()}`)
                  : t.convertNoFileSelected}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {isConverting ? (
              <button
                type="button"
                onClick={handleCancelAll}
                className="pencil-button-secondary px-4 h-9 flex items-center space-x-1.5 text-xs text-red-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.cancelBtn}</span>
              </button>
            ) : allCompleted ? (
              <button
                type="button"
                onClick={() => handleOpenFileLocation(convertedTargetDir)}
                className="pencil-button px-5 h-9 flex items-center space-x-2 text-xs font-bold cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{t.openFolderBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatchConversion}
                disabled={selectedFiles.length === 0}
                className="pencil-button px-6 h-9 flex items-center space-x-2 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {selectedFiles.length > 1 ? t.convertStartBatchBtn : t.convertStartBtn}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Batch Conversion Progress Bar */}
        {isConverting && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
              <span>{t.convertBatchProgress} {completedJobsCount}/{selectedFiles.length}</span>
              <span className="font-mono">{overallBatchPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-progress-bg)] overflow-hidden border border-[var(--color-border)]">
              <div
                className="h-full bg-[var(--color-progress-fill)] transition-all duration-200 rounded-full"
                style={{ width: `${overallBatchPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
