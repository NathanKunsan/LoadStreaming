import React, { useState, useEffect, useMemo } from 'react';
import { 
  ListMusic, 
  X, 
  CheckSquare, 
  Square, 
  DownloadCloud, 
  FileVideo, 
  FileAudio,
  Film,
  Music,
  Scissors,
  Clock,
  Folder,
  FolderPlus,
  RotateCcw
} from 'lucide-react';
import { PlaylistInfo, MediaType, PlaylistItem, TimeRange } from '../../electron/types';
import { translations, Language } from '../locales/translations';

interface PlaylistModalProps {
  language: Language;
  isOpen: boolean;
  playlistInfo: PlaylistInfo | null;
  defaultOutputDir: string;
  onClose: () => void;
  onDownloadSelected: (
    items: PlaylistItem[],
    mediaType: MediaType,
    resolution: string,
    folderOptions?: { subFolder?: string; customBaseDir?: string }
  ) => void;
}

function sanitizeFolderPreview(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .trim()
    .replace(/[. ]+$/, '');
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  language,
  isOpen,
  playlistInfo,
  defaultOutputDir,
  onClose,
  onDownloadSelected
}) => {
  const t = translations[language];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [resolution, setResolution] = useState<string>('1080p');

  // Playlist Folder State
  const [usePlaylistFolder, setUsePlaylistFolder] = useState<boolean>(true);
  const [folderName, setFolderName] = useState<string>('');
  const [customBaseDir, setCustomBaseDir] = useState<string>('');

  // Per-item trimming state
  const [trimmedItems, setTrimmedItems] = useState<Record<string, TimeRange>>({});
  const [activeTrimItemId, setActiveTrimItemId] = useState<string | null>(null);
  const [tempStart, setTempStart] = useState<string>('00:00');
  const [tempEnd, setTempEnd] = useState<string>('');

  useEffect(() => {
    if (isOpen && playlistInfo) {
      setSelectedIds(new Set(playlistInfo.items.map(item => item.id)));
      setUsePlaylistFolder(true);
      setFolderName(playlistInfo.title || '');
      setCustomBaseDir('');
      setTrimmedItems({});
      setActiveTrimItemId(null);
      setTempStart('00:00');
      setTempEnd('');
    } else if (!isOpen) {
      setSelectedIds(new Set());
      setFolderName('');
      setCustomBaseDir('');
      setTrimmedItems({});
      setActiveTrimItemId(null);
    }
  }, [isOpen, playlistInfo]);

  const previewTargetDir = useMemo(() => {
    let base = '';
    if (customBaseDir.trim()) {
      base = customBaseDir.trim().replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
    } else {
      let root = (defaultOutputDir || 'C:\\Downloads').trim().replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
      if (!root.toLowerCase().endsWith('loadstreaming')) {
        root = `${root}\\LoadStreaming`;
      }
      base = `${root}\\${mediaType === 'video' ? 'Video' : 'Audio'}`;
    }
    const cleanSub = usePlaylistFolder ? sanitizeFolderPreview(folderName) : '';
    return cleanSub ? `${base}\\${cleanSub}` : base;
  }, [customBaseDir, defaultOutputDir, mediaType, usePlaylistFolder, folderName]);

  if (!isOpen || !playlistInfo) return null;

  const handleBrowseCustomFolder = async () => {
    if (!window.electronAPI?.selectCustomFolder) return;
    const chosen = await window.electronAPI.selectCustomFolder(customBaseDir || defaultOutputDir);
    if (chosen) {
      setCustomBaseDir(chosen);
    }
  };

  const handleCloseClean = () => {
    setSelectedIds(new Set());
    setTrimmedItems({});
    setActiveTrimItemId(null);
    setCustomBaseDir('');
    onClose();
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(playlistInfo.items.map(item => item.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selectedItems = playlistInfo.items
      .filter(item => selectedIds.has(item.id))
      .map(item => {
        if (trimmedItems[item.id]) {
          return {
            ...item,
            timeRange: trimmedItems[item.id]
          };
        }
        return item;
      });

    if (selectedItems.length === 0) return;
    const effectiveSubFolder = usePlaylistFolder && folderName.trim() ? folderName.trim() : undefined;
    onDownloadSelected(selectedItems, mediaType, resolution, {
      subFolder: effectiveSubFolder,
      customBaseDir: customBaseDir.trim() || undefined
    });
    handleCloseClean();
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const selectedCount = selectedIds.size;
  const totalCount = playlistInfo.items.length;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="pencil-box max-w-2xl w-full p-5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-4 shadow-2xl border-2 border-[var(--color-border)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <ListMusic className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm tracking-wide">
              {t.playlistModalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCloseClean}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Playlist Overview Banner */}
        <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded flex items-center space-x-3 shrink-0">
          {playlistInfo.thumbnail && (
            <img
              src={playlistInfo.thumbnail}
              alt={playlistInfo.title}
              className="w-16 h-12 object-cover rounded border border-[var(--color-border)] shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs truncate text-[var(--color-text-main)]" title={playlistInfo.title}>
              {playlistInfo.title}
            </h4>
            <div className="flex items-center space-x-2 text-[11px] text-[var(--color-text-muted)] mt-0.5">
              <span>{playlistInfo.channel}</span>
              <span>•</span>
              <span>{totalCount} {language === 'th' ? 'คลิป' : 'videos'}</span>
            </div>
          </div>
        </div>

        {/* Format & Download Settings Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs shrink-0">
          {/* Media Type Toggle */}
          <div>
            <label className="block text-[11px] font-bold mb-1 opacity-90">
              {t.mediaTypeLabel}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-1.5 px-2 rounded border font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                  mediaType === 'video'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>{t.videoType}</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('audio')}
                className={`py-1.5 px-2 rounded border font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer ${
                  mediaType === 'audio'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>{t.audioType}</span>
              </button>
            </div>
          </div>

          {/* Resolution Selector (if video) */}
          <div>
            <label className="block text-[11px] font-bold mb-1 opacity-90">
              {mediaType === 'video' ? t.qualityLabel : (language === 'th' ? 'คุณภาพเสียง' : 'Audio Quality')}
            </label>
            {mediaType === 'video' ? (
              <div className="grid grid-cols-4 gap-1">
                {['1080p', '720p', '480p', '360p'].map(res => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={`py-1.5 text-center text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                      resolution === res
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-8 flex items-center px-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] text-[var(--color-text-muted)] font-mono">
                {language === 'th' ? '320 กิโลบิตต่อวินาที (คุณภาพสูง)' : '320 kbps (High Quality MP3)'}
              </div>
            )}
          </div>
        </div>

        {/* Playlist Folder Organization Bar */}
        <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center space-x-2 font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={usePlaylistFolder}
                onChange={(e) => setUsePlaylistFolder(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-accent)] cursor-pointer"
              />
              <FolderPlus className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
              <span>{t.playlistSaveToFolderToggle}</span>
            </label>

            <div className="flex items-center space-x-1.5">
              {customBaseDir && (
                <button
                  type="button"
                  onClick={() => setCustomBaseDir('')}
                  className="px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.playlistResetDefaultDirBtn}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleBrowseCustomFolder}
                className="pencil-button-secondary px-2.5 py-1 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{t.playlistCustomDirBtn}</span>
              </button>
            </div>
          </div>

          {usePlaylistFolder && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[var(--color-text-muted)] font-semibold shrink-0">
                {t.playlistFolderNameLabel}:
              </span>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t.playlistFolderNamePlaceholder}
                className="flex-1 h-8 px-2.5 text-xs font-semibold select-text bg-[var(--color-surface)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text-main)]"
              />
              {folderName.trim() !== (playlistInfo.title || '').trim() && playlistInfo.title && (
                <button
                  type="button"
                  onClick={() => setFolderName(playlistInfo.title)}
                  className="p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] cursor-pointer shrink-0"
                  title={playlistInfo.title}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center space-x-1.5 text-[11px] text-[var(--color-text-muted)] font-mono truncate" title={previewTargetDir}>
            <Folder className="w-3 h-3 shrink-0 text-[var(--color-accent)]" />
            <span className="font-sans font-semibold shrink-0">{t.playlistTargetPathLabel}:</span>
            <span className="truncate">{previewTargetDir}</span>
          </div>
        </div>

        {/* Selection Controller Bar */}
        <div className="flex items-center justify-between text-xs px-1 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="pencil-button-secondary px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
            >
              {t.playlistSelectAll}
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="pencil-button-secondary px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
            >
              {t.playlistDeselectAll}
            </button>
          </div>
          <div className="font-bold text-[11px] text-[var(--color-accent)]">
            {t.playlistSelectedCount}: {selectedCount} / {totalCount}
          </div>
        </div>

        {/* Scrollable Clip List */}
        <div className="border border-[var(--color-border)] rounded bg-[var(--color-bg)] overflow-y-auto flex-1 divide-y divide-[var(--color-border)]/50 min-h-[160px]">
          {playlistInfo.items.map((item, idx) => {
            const isChecked = selectedIds.has(item.id);
            const isTrimmed = !!trimmedItems[item.id];
            const isEditingThisTrim = activeTrimItemId === item.id;
            return (
              <div key={item.id} className="flex flex-col">
                <div
                  onClick={() => toggleItem(item.id)}
                  className={`p-2 flex items-center space-x-3 cursor-pointer select-none transition-colors ${
                    isChecked ? 'bg-[var(--color-surface)]/80' : 'hover:bg-[var(--color-surface)]/40 opacity-75'
                  }`}
                >
                  <button
                    type="button"
                    className="shrink-0 text-[var(--color-accent)]"
                    aria-label="Toggle selection"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[var(--color-accent)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                  </button>

                  <span className="text-[11px] text-[var(--color-text-muted)] font-mono w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>

                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-12 h-8 object-cover rounded border border-[var(--color-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-8 rounded bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                      {mediaType === 'video' ? (
                        <FileVideo className="w-4 h-4 text-[var(--color-text-muted)]" />
                      ) : (
                        <FileAudio className="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--color-text-main)] truncate" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {item.channel}
                    </p>
                  </div>

                  {/* Trim Badge & Button */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {isTrimmed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-bold font-mono">
                        {trimmedItems[item.id].start}-{trimmedItems[item.id].end}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditingThisTrim) {
                          setActiveTrimItemId(null);
                        } else {
                          setActiveTrimItemId(item.id);
                          const cur = trimmedItems[item.id];
                          setTempStart(cur ? cur.start : '00:00');
                          setTempEnd(cur ? cur.end : formatDuration(item.duration));
                        }
                      }}
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors ${
                        isTrimmed
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                      }`}
                      title={t.trimItemBtn}
                    >
                      <Scissors className="w-3 h-3" />
                      <span>{isTrimmed ? t.trimmedBadge : t.trimItemBtn}</span>
                    </button>

                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono w-12 text-right">
                      {formatDuration(item.duration)}
                    </span>
                  </div>
                </div>

                {/* Inline Per-Item Trim Editor */}
                {isEditingThisTrim && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 bg-[var(--color-bg)] border-t border-[var(--color-border)]/50 flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="font-bold text-[11px] text-[var(--color-accent)] flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{t.trimItemBtn}:</span>
                    </span>

                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-[var(--color-text-muted)]">{t.startTimeLabel}:</span>
                      <input
                        type="text"
                        value={tempStart}
                        onChange={(e) => setTempStart(e.target.value)}
                        placeholder="00:00"
                        className="w-16 h-6 px-1.5 text-xs font-mono font-bold bg-[var(--color-surface)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)]"
                      />
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-[var(--color-text-muted)]">{t.endTimeLabel}:</span>
                      <input
                        type="text"
                        value={tempEnd}
                        onChange={(e) => setTempEnd(e.target.value)}
                        placeholder="05:00"
                        className="w-16 h-6 px-1.5 text-xs font-mono font-bold bg-[var(--color-surface)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (tempStart.trim() && tempEnd.trim()) {
                          setTrimmedItems(prev => ({
                            ...prev,
                            [item.id]: { start: tempStart.trim(), end: tempEnd.trim() }
                          }));
                        }
                        setActiveTrimItemId(null);
                      }}
                      className="px-2 py-0.5 rounded bg-[var(--color-accent)] text-[var(--color-bg)] text-[11px] font-bold cursor-pointer"
                    >
                      {language === 'th' ? 'บันทึก' : 'Save'}
                    </button>

                    {isTrimmed && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrimmedItems(prev => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                          setActiveTrimItemId(null);
                        }}
                        className="px-2 py-0.5 rounded border border-[var(--color-border)] text-red-400 text-[11px] font-semibold cursor-pointer"
                      >
                        {t.cancelTrimBtn}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTrimItemId(null)}
                      className="px-1.5 py-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-[11px] cursor-pointer"
                    >
                      {t.closeBtn}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-[var(--color-border)] shrink-0">
          <button
            type="button"
            onClick={handleCloseClean}
            className="pencil-button-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
          >
            {t.cancelModalBtn}
          </button>

          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleConfirm}
            className="pencil-button px-5 py-1.5 text-xs font-bold flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>
              {t.playlistStartDownload} ({selectedCount})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
