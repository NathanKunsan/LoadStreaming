import React, { useState, useEffect, useMemo } from 'react';
import { 
  Video, Music, Folder, Download, Search, AlertCircle, CheckCircle2, 
  Film, Pencil, Check, Scissors, Gauge, Subtitles 
} from 'lucide-react';
import { translations, Language } from '../locales/translations';
import { VideoInfo, MediaType, PlaylistInfo, TimeRange } from '../../electron/types';
import { VideoTrimmer } from './VideoTrimmer';
import { SmartTagsSection } from './SmartTagsSection';
import { NeoDropdown, NeoDropdownOption } from './NeoDropdown';

interface UrlInputSectionProps {
  language: Language;
  outputDir: string;
  externalUrl?: string;
  onBrowseFolder: () => void;
  onPlaylistDetected?: (playlistInfo: PlaylistInfo) => void;
  onStartDownload: (jobData: {
    url: string;
    title: string;
    thumbnail: string;
    mediaType: MediaType;
    resolution?: string;
    outputDir: string;
    timeRange?: TimeRange;
    speedLimit?: string;
    subFolder?: string;
    downloadSubtitle?: boolean;
    subLang?: string;
  }) => void;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  language,
  outputDir,
  externalUrl,
  onBrowseFolder,
  onPlaylistDetected,
  onStartDownload
}) => {
  const t = translations[language];

  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [selectedResolution, setSelectedResolution] = useState<string>('1080p');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Time Range & Speed Limiter State
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [speedLimit, setSpeedLimit] = useState<string>('unlimited');

  // Smart Tags & Subtitle State (v1.4.0)
  const [tags, setTags] = useState<string[]>([]);
  const [selectedSubFolder, setSelectedSubFolder] = useState<string>('');
  const [downloadSubtitle, setDownloadSubtitle] = useState<boolean>(false);
  const [subLang, setSubLang] = useState<string>('all');

  // Dynamic Output Directory according to media type
  const dynamicOutputDir = useMemo(() => {
    let base = (outputDir || '').trim().replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
    if (!base.toLowerCase().endsWith('loadstreaming')) {
      base = `${base}\\LoadStreaming`;
    }
    const sub = mediaType === 'video' ? 'Video' : 'Audio';
    return `${base}\\${sub}`.replace(/[/\\]+/g, '\\');
  }, [outputDir, mediaType]);

  // Handle external URL passed from Drag & Drop or Clipboard
  useEffect(() => {
    if (externalUrl && externalUrl !== url) {
      setUrl(externalUrl);
      fetchInfoForUrl(externalUrl);
    }
  }, [externalUrl]);

  // Validate and fetch video or playlist info
  const fetchInfoForUrl = async (targetUrl: string) => {
    if (!targetUrl.trim() || isFetching) return;

    setErrorMessage(null);
    setIsFetching(true);

    try {
      const valRes = await window.electronAPI.validateUrl(targetUrl.trim());
      if (!valRes.valid) {
        if (valRes.error === 'SHORTS_NOT_SUPPORTED') {
          setErrorMessage(t.errorShorts);
        } else {
          setErrorMessage(t.errorInvalidUrl);
        }
        setIsFetching(false);
        return;
      }

      const mediaRes = await window.electronAPI.getMediaInfo(targetUrl.trim());
      if (mediaRes.isPlaylist && mediaRes.playlistInfo) {
        if (onPlaylistDetected) {
          onPlaylistDetected(mediaRes.playlistInfo);
        }
        setIsFetching(false);
        return;
      }

      if (mediaRes.videoInfo) {
        const info = mediaRes.videoInfo;
        setVideoInfo(info);
        setCustomTitle(info.title);
        setIsEditingTitle(false);

        if (info.duration > 0) {
          const m = Math.floor(info.duration / 60);
          const s = info.duration % 60;
          setEndTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }

        if (info.resolutions && info.resolutions.length > 0) {
          const def = info.resolutions.find(r => r.height === 1080) || info.resolutions[0];
          setSelectedResolution(def.label);
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('SHORTS')) {
        setErrorMessage(t.errorShorts);
      } else if (err.message && err.message.includes('INVALID_URL')) {
        setErrorMessage(t.errorInvalidUrl);
      } else {
        setErrorMessage(t.errorFetchFailed);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetchInfo = () => fetchInfoForUrl(url);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setErrorMessage(null);
    if (videoInfo && videoInfo.url !== e.target.value.trim()) {
      setVideoInfo(null);
      setCustomTitle('');
      setIsEditingTitle(false);
      setTags([]);
      setSelectedSubFolder('');
      setDownloadSubtitle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!videoInfo) {
      handleFetchInfo();
      return;
    }

    let timeRange: TimeRange | undefined = undefined;
    if (isTrimming && startTime.trim() && endTime.trim()) {
      timeRange = {
        start: startTime.trim(),
        end: endTime.trim()
      };
    }

    setIsSubmitting(true);
    try {
      const finalTitle = customTitle.trim() || videoInfo.title;
      onStartDownload({
        url: videoInfo.url,
        title: finalTitle,
        thumbnail: videoInfo.thumbnail,
        mediaType,
        resolution: mediaType === 'video' ? selectedResolution : undefined,
        outputDir: dynamicOutputDir,
        timeRange,
        speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
        subFolder: selectedSubFolder.trim() || undefined,
        downloadSubtitle,
        subLang: downloadSubtitle ? subLang : undefined
      });

      // Clear input after starting
      setUrl('');
      setVideoInfo(null);
      setCustomTitle('');
      setIsEditingTitle(false);
      setIsTrimming(false);
      setStartTime('00:00');
      setEndTime('');
      setTimeError(null);
      setErrorMessage(null);
      setTags([]);
      setSelectedSubFolder('');
      setDownloadSubtitle(false);
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  };

  const resolutionOptions: NeoDropdownOption<string>[] = useMemo(() => {
    if (videoInfo?.resolutions && videoInfo.resolutions.length > 0) {
      return videoInfo.resolutions.map(r => {
        let tag = '';
        if (r.height >= 2160) tag = ' (4K)';
        else if (r.height >= 1440) tag = ' (2K)';
        else if (r.height >= 1080) tag = ' (FHD)';
        else if (r.height >= 720) tag = ' (HD)';
        return { value: r.label, label: `${r.label}${tag}` };
      });
    }
    return [
      { value: '2160p', label: '2160p (4K)' },
      { value: '1440p', label: '1440p (2K)' },
      { value: '1080p', label: '1080p (FHD)' },
      { value: '720p', label: '720p (HD)' },
      { value: '480p', label: '480p' },
      { value: '360p', label: '360p' }
    ];
  }, [videoInfo]);

  const speedOptions: NeoDropdownOption<string>[] = [
    { value: 'unlimited', label: t.speedUnlimited },
    { value: '1M', label: '1 MB/s' },
    { value: '2M', label: '2 MB/s' },
    { value: '5M', label: '5 MB/s' },
    { value: '10M', label: '10 MB/s' },
  ];

  const subLangOptions: NeoDropdownOption<string>[] = [
    { value: 'all', label: t.subLangAll },
    { value: 'th', label: t.subLangTh },
    { value: 'en', label: t.subLangEn },
    { value: 'auto', label: t.subLangAuto },
  ];

  return (
    <div className="pencil-box p-4 bg-[var(--color-surface)] text-[var(--color-text-main)] mb-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL Input Bar */}
        <div>
          <label className="block text-xs font-bold mb-1.5 opacity-90">
            {t.urlLabel}
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={handleUrlChange}
                placeholder={t.urlPlaceholder}
                className="w-full h-10 px-3 pr-10 text-sm bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-md outline-none focus:ring-1 focus:ring-[var(--color-accent)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchInfo}
              disabled={isFetching || !url.trim()}
              className="pencil-button px-4 h-10 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs uppercase tracking-wider"
            >
              <Search className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? t.fetching : t.fetchInfo}</span>
            </button>
          </div>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-red-900/20 border-2 border-red-500 rounded-md text-red-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Metadata Preview Card with Editable Title */}
        {videoInfo && (
          <div className="p-3 border-2 border-[var(--color-border)] rounded-md bg-[var(--color-bg)] flex flex-col md:flex-row gap-3 items-center">
            <div className="w-full md:w-44 h-26 shrink-0 bg-black/40 rounded overflow-hidden relative border border-[var(--color-border)]">
              {videoInfo.thumbnail ? (
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                  <Film className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex-1 w-full min-w-0 space-y-1.5">
              {/* Title with Pencil edit control */}
              <div className="flex items-center gap-2">
                {!isEditingTitle ? (
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <h3
                      className="font-bold text-sm line-clamp-2 text-[var(--color-text-main)] break-words flex-1 cursor-pointer select-text"
                      title={t.editTitleTooltip}
                      onClick={() => setIsEditingTitle(true)}
                    >
                      {customTitle || videoInfo.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(true)}
                      className="p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer shrink-0"
                      title={t.editTitleTooltip}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setIsEditingTitle(false);
                        }
                      }}
                      placeholder={videoInfo.title}
                      autoFocus
                      className="flex-1 h-8 px-2.5 text-xs font-bold bg-[var(--color-surface)] border-2 border-[var(--color-accent)] rounded outline-none text-[var(--color-text-main)]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(false)}
                      className="p-1.5 rounded border border-[var(--color-accent)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-accent)] transition-colors cursor-pointer shrink-0"
                      title={t.saveTitleTooltip}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-[var(--color-text-muted)]">
                {videoInfo.channel} {videoInfo.duration > 0 && `• ${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')}`}
              </p>
              <div className="flex items-center space-x-1 text-xs text-green-500 font-semibold pt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'พร้อมดาวน์โหลด' : 'Ready to download'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Controls Grid using NeoDropdown (Zero native select) */}
        <div className={`grid grid-cols-1 ${mediaType === 'video' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 pt-1`}>
          {/* Media Type Selector */}
          <div>
            <label className="block text-xs font-bold mb-1 opacity-90">
              {t.mediaTypeLabel}
            </label>
            <div className="grid grid-cols-2 gap-2 h-9">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`flex items-center justify-center space-x-1.5 text-xs font-bold rounded border-2 transition-colors cursor-pointer ${
                  mediaType === 'video'
                    ? 'border-[var(--color-border)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{t.videoType}</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('audio')}
                className={`flex items-center justify-center space-x-1.5 text-xs font-bold rounded border-2 transition-colors cursor-pointer ${
                  mediaType === 'audio'
                    ? 'border-[var(--color-border)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>{t.audioType}</span>
              </button>
            </div>
          </div>

          {/* Quality Selector (Shown ONLY when Video is selected) */}
          {mediaType === 'video' && (
            <div>
              <label className="block text-xs font-bold mb-1 opacity-90">
                {t.qualityLabel}
              </label>
              <NeoDropdown
                value={selectedResolution}
                onChange={(val) => setSelectedResolution(val)}
                options={resolutionOptions}
                disabled={!videoInfo}
                size="sm"
              />
            </div>
          )}

          {/* Speed Limiter */}
          <div>
            <label className="block text-xs font-bold mb-1 opacity-90 flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>{t.speedLimitLabel}</span>
            </label>
            <NeoDropdown
              value={speedLimit}
              onChange={(val) => setSpeedLimit(val)}
              options={speedOptions}
              size="sm"
            />
          </div>
        </div>

        {/* Output Folder Selector */}
        <div>
          <label className="block text-xs font-bold mb-1 opacity-90">
            {t.outputFolderLabel}
          </label>
          <div className="flex space-x-1.5 h-9 min-w-0">
            <input
              type="text"
              readOnly
              value={dynamicOutputDir}
              title={dynamicOutputDir}
              className="flex-1 min-w-0 px-2 text-xs bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)] truncate cursor-default"
            />
            <button
              type="button"
              onClick={onBrowseFolder}
              className="pencil-button-secondary px-2.5 flex items-center space-x-1 text-xs font-semibold cursor-pointer shrink-0"
              title={t.browseFolder}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{t.browseFolder}</span>
            </button>
          </div>
        </div>

        {/* Smart Tags & Folder Routing (v1.4.0) */}
        {videoInfo && (
          <SmartTagsSection
            language={language}
            videoTitle={videoInfo.title}
            channelTitle={videoInfo.channel}
            tags={tags}
            selectedSubFolder={selectedSubFolder}
            onTagsChange={setTags}
            onSelectSubFolder={setSelectedSubFolder}
          />
        )}

        {/* Subtitle Download Option (v1.4.0) */}
        {videoInfo && (
          <div className="pt-2 border-t border-[var(--color-border)]/50 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={downloadSubtitle}
                onChange={(e) => setDownloadSubtitle(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-accent)] cursor-pointer"
              />
              <span className="flex items-center space-x-1">
                <Subtitles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>{t.downloadSubtitleLabel}</span>
              </span>
            </label>

            {downloadSubtitle && (
              <div className="flex items-center space-x-2 text-xs min-w-[260px]">
                <span className="text-[var(--color-text-muted)] font-semibold shrink-0">{t.subLangLabel}:</span>
                <div className="flex-1 min-w-[160px]">
                  <NeoDropdown
                    value={subLang}
                    onChange={(val) => setSubLang(val)}
                    options={subLangOptions}
                    size="sm"
                    align="right"
                    openUpward={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Time-Range Trimming Section (Single Clip) */}
        {videoInfo && (
          <div className="pt-2 border-t border-[var(--color-border)]/50">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const nextState = !isTrimming;
                  setIsTrimming(nextState);
                  setTimeError(null);
                  if (nextState && !endTime && videoInfo.duration > 0) {
                    const m = Math.floor(videoInfo.duration / 60);
                    const s = videoInfo.duration % 60;
                    setEndTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                  }
                }}
                className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded border transition-colors cursor-pointer ${
                  isTrimming
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] shadow-xs'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{t.trimTimeToggle}</span>
              </button>

              {isTrimming && (
                <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                  {startTime} - {endTime || '--'}
                </span>
              )}
            </div>

            {isTrimming && (
              <div className="mt-2.5 space-y-2">
                <VideoTrimmer
                  language={language}
                  videoUrl={videoInfo.url}
                  thumbnail={videoInfo.thumbnail}
                  duration={videoInfo.duration}
                  startTime={startTime}
                  endTime={endTime}
                  onChange={(newStart, newEnd) => {
                    setStartTime(newStart);
                    setEndTime(newEnd);
                    setTimeError(null);
                  }}
                  onReset={() => {
                    setStartTime('00:00');
                    if (videoInfo.duration > 0) {
                      const h = Math.floor(videoInfo.duration / 3600);
                      const m = Math.floor((videoInfo.duration % 3600) / 60);
                      const s = videoInfo.duration % 60;
                      if (h > 0) {
                        setEndTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                      } else {
                        setEndTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                      }
                    } else {
                      setEndTime('');
                    }
                    setTimeError(null);
                  }}
                />

                {timeError && (
                  <p className="text-[11px] text-red-400 font-semibold flex items-center space-x-1 pt-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{timeError}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Button: Add to Queue */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={!videoInfo || isFetching || isSubmitting}
            className="pencil-button w-full md:w-auto px-6 h-10 flex items-center justify-center space-x-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.addDownload}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
