import React, { useEffect, useState, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { UrlInputSection } from './components/UrlInputSection';
import { QueueSection } from './components/QueueSection';
import { HistorySection } from './components/HistorySection';
import { ConvertSection } from './components/ConvertSection';
import { DuplicateModal } from './components/DuplicateModal';
import { DropZoneOverlay } from './components/DropZoneOverlay';
import { UpdateModal } from './components/UpdateModal';
import { ToastNotification } from './components/ToastNotification';
import { CloseConfirmModal } from './components/CloseConfirmModal';
import { PlaylistModal } from './components/PlaylistModal';
import { ClipboardToast } from './components/ClipboardToast';
import { RadialMenu } from './components/RadialMenu';
import { SettingsModal } from './components/SettingsModal';
import { DownloadJob, HistoryItem, AppConfig, UpdateInfo, MediaType, PlaylistInfo, PlaylistItem, TimeRange } from '../electron/types';
import { translations } from './locales/translations';
import { ListFilter, History, Download, Repeat } from 'lucide-react';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    theme: 'yellow-black',
    language: 'th',
    outputDir: 'C:\\Downloads'
  });

  const [mainSection, setMainSection] = useState<'download' | 'convert'>('download');
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [completedToastJob, setCompletedToastJob] = useState<DownloadJob | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dropType, setDropType] = useState<'url' | 'file'>('url');
  const [droppedUrl, setDroppedUrl] = useState<string>('');
  const [droppedMediaFiles, setDroppedMediaFiles] = useState<{
    filePath: string;
    fileName: string;
    fileSize: number;
  }[] | null>(null);

  // Duplicate prompt state
  const [duplicateData, setDuplicateData] = useState<{
    jobData: {
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
    };
    fileName: string;
    suggestedName: string;
  } | null>(null);

  // Playlist, Settings, Radial Menu & Clipboard state (v1.4.0)
  const [activePlaylist, setActivePlaylist] = useState<PlaylistInfo | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRadialOpen, setIsRadialOpen] = useState(false);
  const [detectedClipboardUrl, setDetectedClipboardUrl] = useState<string | null>(null);

  const t = translations[config.language];

  // Load initial configuration, persistent jobs, and history
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      window.electronAPI.getJobs().then((savedJobs) => {
        if (savedJobs && Array.isArray(savedJobs)) {
          setJobs(savedJobs);
        }
      });

      window.electronAPI.getHistory().then((hist) => {
        if (hist) setHistory(hist);
      });

      const unsubJob = window.electronAPI.onJobUpdated((updatedJob) => {
        setJobs((prev) => {
          const index = prev.findIndex((j) => j.id === updatedJob.id);
          if (updatedJob.status === 'Completed' && (index === -1 || prev[index].status !== 'Completed')) {
            setCompletedToastJob(updatedJob);
          }

          if (index !== -1) {
            const next = [...prev];
            next[index] = updatedJob;
            return next;
          } else {
            return [updatedJob, ...prev];
          }
        });
      });

      const unsubHist = window.electronAPI.onHistoryUpdated((newHistory) => {
        setHistory(newHistory);
      });

      const unsubUpdate = window.electronAPI.onUpdateProgress((pct) => {
        setUpdateProgress(pct);
      });

      const unsubClose = window.electronAPI.onRequestClose?.(() => {
        setIsCloseModalOpen(true);
      });

      const unsubClip = window.electronAPI.onClipboardUrlDetected?.((url) => {
        setDetectedClipboardUrl(url);
      });

      const unsubRadial = window.electronAPI.onOpenRadialMenu?.(() => {
        setIsRadialOpen((prev) => !prev);
      });

      return () => {
        unsubJob();
        unsubHist();
        unsubUpdate();
        if (unsubClose) unsubClose();
        if (unsubClip) unsubClip();
        if (unsubRadial) unsubRadial();
      };
    }
  }, []);

  // Global Drag & Drop handling for URLs and files
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
      const types = e.dataTransfer.types;
      if (types.includes('Files')) {
        setDropType('file');
      } else {
        setDropType('url');
      }
    }
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // If files are dropped, switch to convert tab and pass all files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const list = Array.from(e.dataTransfer.files).map(f => ({
        filePath: (f as any).path,
        fileName: f.name,
        fileSize: f.size
      })).filter(f => !!f.filePath);

      if (list.length > 0) {
        setDroppedMediaFiles(list);
      }
      setMainSection('convert');
      return;
    }

    // If text/URL is dropped
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (text && text.trim()) {
      setMainSection('download');
      setDroppedUrl(text.trim());
      setTimeout(() => setDroppedUrl(''), 500);
    }
  }, []);

  // Theme change
  const handleThemeChange = async (theme: AppConfig['theme']) => {
    setConfig((prev) => ({ ...prev, theme }));
    if (window.electronAPI) {
      await window.electronAPI.updateConfig({ theme });
    }
  };

  // Language change
  const handleLanguageChange = async (language: AppConfig['language']) => {
    setConfig((prev) => ({ ...prev, language }));
    if (window.electronAPI) {
      await window.electronAPI.updateConfig({ language });
    }
  };

  // Browse output folder
  const handleBrowseFolder = async () => {
    if (window.electronAPI) {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        setConfig((prev) => ({ ...prev, outputDir: selected }));
      }
    }
  };

  // Update Config from Settings Modal
  const handleSaveConfig = async (updated: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
    if (window.electronAPI) {
      await window.electronAPI.updateConfig(updated);
    }
  };

  // Start download with duplicate file check
  const handleStartDownload = async (data: {
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
  }) => {
    if (!window.electronAPI) return;

    try {
      const dup = await window.electronAPI.checkDuplicate({
        baseDir: data.outputDir,
        mediaType: data.mediaType,
        title: data.title
      });

      if (dup && dup.exists) {
        setDuplicateData({
          jobData: data,
          fileName: dup.fileName,
          suggestedName: dup.suggestedName
        });
        return;
      }
    } catch (e) {
      console.error('Failed to check duplicate:', e);
    }

    setActiveTab('queue');
    await window.electronAPI.startDownload(data);
  };

  // Duplicate resolution actions
  const handleDuplicateMakeCopy = async () => {
    if (duplicateData && window.electronAPI) {
      const updatedJob = { ...duplicateData.jobData, title: duplicateData.suggestedName };
      setDuplicateData(null);
      setActiveTab('queue');
      await window.electronAPI.startDownload(updatedJob);
    }
  };

  const handleDuplicateRename = async (newName: string) => {
    if (duplicateData && window.electronAPI) {
      const updatedJob = { ...duplicateData.jobData, title: newName };
      setDuplicateData(null);
      setActiveTab('queue');
      await window.electronAPI.startDownload(updatedJob);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateData(null);
  };

  // Job actions
  const handlePauseJob = async (id: string) => {
    if (window.electronAPI) await window.electronAPI.pauseDownload(id);
  };

  const handleResumeJob = async (id: string) => {
    if (window.electronAPI) await window.electronAPI.resumeDownload(id);
  };

  const handleCancelJob = async (id: string) => {
    if (window.electronAPI) await window.electronAPI.cancelDownload(id);
  };

  const handleClearFinished = async () => {
    if (window.electronAPI) {
      const remaining = await window.electronAPI.clearFinishedJobs();
      setJobs(remaining);
    }
  };

  const handleOpenFileLocation = async (filePath?: string) => {
    if (filePath && window.electronAPI) {
      await window.electronAPI.openFileLocation(filePath);
    }
  };

  // History
  const handleClearHistory = async () => {
    if (window.electronAPI) {
      const empty = await window.electronAPI.clearHistory();
      setHistory(empty);
    }
  };

  // Updates
  const handleCheckUpdate = async () => {
    if (!window.electronAPI) return;
    setIsCheckingUpdate(true);
    try {
      const res = await window.electronAPI.checkForUpdates();
      setUpdateInfo(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async (downloadUrl: string) => {
    if (window.electronAPI) {
      setUpdateProgress(0);
      await window.electronAPI.downloadAndApplyUpdate(downloadUrl);
    }
  };

  // Playlist download batch queueing
  const handlePlaylistDownloadSelected = async (
    items: PlaylistItem[],
    mediaType: MediaType,
    resolution: string
  ) => {
    if (!window.electronAPI) return;
    setActivePlaylist(null);
    setMainSection('download');
    setActiveTab('queue');

    for (const item of items) {
      try {
        await window.electronAPI.startDownload({
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          mediaType,
          resolution,
          timeRange: item.timeRange,
          outputDir: config.outputDir
        });
      } catch (err) {
        console.error('Failed to queue playlist item:', err);
      }
    }
  };

  // Radial Menu Action Execution
  const handleRadialAction = (actionKey: string) => {
    setIsRadialOpen(false);
    switch (actionKey) {
      case 'actDownloadVideo':
        setMainSection('download');
        break;
      case 'actDownloadAudio':
        setMainSection('download');
        break;
      case 'actOpenFolder':
        if (window.electronAPI) {
          window.electronAPI.openFileLocation(config.outputDir);
        }
        break;
      case 'actOpenConvert':
        setMainSection('convert');
        break;
      case 'actToggleApp':
        window.focus();
        break;
      default:
        break;
    }
  };

  // Clipboard Toast Handlers
  const handleClipboardDownloadNow = (clipUrl: string) => {
    setDetectedClipboardUrl(null);
    setMainSection('download');
    setDroppedUrl(clipUrl);
  };

  const handleClipboardInspect = (clipUrl: string) => {
    setDetectedClipboardUrl(null);
    setMainSection('download');
    setDroppedUrl(clipUrl);
  };

  // Minimize to tray and Quit app handlers
  const handleMinimizeToTray = () => {
    setIsCloseModalOpen(false);
    if (window.electronAPI) {
      window.electronAPI.minimizeToTray();
    }
  };

  const handleQuitApp = () => {
    setIsCloseModalOpen(false);
    if (window.electronAPI) {
      window.electronAPI.quitApp();
    }
  };

  const activeJobCount = jobs.filter(
    (j) => j.status === 'Downloading' || j.status === 'Waiting'
  ).length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`theme-${config.theme} h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text-main)] overflow-hidden antialiased relative select-none`}
    >
      {/* TitleBar with Settings button */}
      <TitleBar
        config={config}
        onThemeChange={handleThemeChange}
        onLanguageChange={handleLanguageChange}
        onCheckUpdate={handleCheckUpdate}
        isCheckingUpdate={isCheckingUpdate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClose={() => setIsCloseModalOpen(true)}
      />

      {/* Main Mode Navigation (Download vs Convert) */}
      <div className="flex items-center space-x-2 border-b-2 border-[var(--color-border)] px-4 md:px-6 pt-3 bg-[var(--color-bg)] shrink-0">
        <button
          type="button"
          onClick={() => setMainSection('download')}
          className={`px-5 py-2 text-xs font-bold rounded-t-md flex items-center space-x-2 transition-all cursor-pointer ${
            mainSection === 'download'
              ? 'bg-[var(--color-surface)] border-2 border-b-0 border-[var(--color-border)] text-[var(--color-accent)] -mb-[2px] pb-2.5 z-10'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">{t.mainTabDownload}</span>
        </button>

        <button
          type="button"
          onClick={() => setMainSection('convert')}
          className={`px-5 py-2 text-xs font-bold rounded-t-md flex items-center space-x-2 transition-all cursor-pointer ${
            mainSection === 'convert'
              ? 'bg-[var(--color-surface)] border-2 border-b-0 border-[var(--color-border)] text-[var(--color-accent)] -mb-[2px] pb-2.5 z-10'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">{t.mainTabConvert}</span>
        </button>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-6xl mx-auto w-full">
        {mainSection === 'download' ? (
          <>
            {/* URL Input & Controls Section */}
            <UrlInputSection
              language={config.language}
              outputDir={config.outputDir}
              externalUrl={droppedUrl}
              onBrowseFolder={handleBrowseFolder}
              onPlaylistDetected={(info) => setActivePlaylist(info)}
              onStartDownload={handleStartDownload}
            />

            {/* Sub Tabs: Queue vs History */}
            <div className="flex items-center space-x-2 border-b-2 border-[var(--color-border)] pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`px-4 py-1.5 text-xs font-bold rounded-t-md flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-[var(--color-surface)] border-2 border-b-0 border-[var(--color-border)] text-[var(--color-text-main)] -mb-[10px] pb-2.5 z-10'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>{t.activeDownloads}</span>
                {activeJobCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-accent)] text-[var(--color-bg)] font-bold">
                    {activeJobCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-4 py-1.5 text-xs font-bold rounded-t-md flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-[var(--color-surface)] border-2 border-b-0 border-[var(--color-border)] text-[var(--color-text-main)] -mb-[10px] pb-2.5 z-10'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t.historyTab}</span>
                {history.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {history.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Panels */}
            <div className="pt-2">
              {activeTab === 'queue' ? (
                <QueueSection
                  language={config.language}
                  jobs={jobs}
                  onPause={handlePauseJob}
                  onResume={handleResumeJob}
                  onCancel={handleCancelJob}
                  onOpenFileLocation={handleOpenFileLocation}
                  onClearFinished={handleClearFinished}
                />
              ) : (
                <HistorySection
                  language={config.language}
                  history={history}
                  onClearHistory={handleClearHistory}
                  onOpenFileLocation={handleOpenFileLocation}
                />
              )}
            </div>
          </>
        ) : (
          /* Media Converter Section */
          <ConvertSection
            language={config.language}
            outputDir={config.outputDir}
            onBrowseFolder={handleBrowseFolder}
            initialFiles={droppedMediaFiles}
          />
        )}
      </main>

      {/* Drag & Drop Animated Overlay */}
      <DropZoneOverlay
        language={config.language}
        isDragging={isDragging}
        dropType={dropType}
      />

      {/* In-App Duplicate File Resolution Modal */}
      {duplicateData && (
        <DuplicateModal
          language={config.language}
          isOpen={true}
          fileName={duplicateData.fileName}
          suggestedName={duplicateData.suggestedName}
          onMakeCopy={handleDuplicateMakeCopy}
          onRename={handleDuplicateRename}
          onCancel={handleDuplicateCancel}
        />
      )}

      {/* In-App Download Complete Toast Notification (Auto-fade 5s) */}
      <ToastNotification
        language={config.language}
        job={completedToastJob}
        onClose={() => setCompletedToastJob(null)}
        onOpenFileLocation={handleOpenFileLocation}
      />

      {/* Update Modal */}
      <UpdateModal
        language={config.language}
        updateInfo={updateInfo}
        updateProgress={updateProgress}
        onClose={() => {
          setUpdateInfo(null);
          setUpdateProgress(null);
        }}
        onInstall={handleInstallUpdate}
      />

      {/* YouTube Playlist Selection Modal */}
      {activePlaylist && (
        <PlaylistModal
          language={config.language}
          isOpen={true}
          playlistInfo={activePlaylist}
          onClose={() => setActivePlaylist(null)}
          onDownloadSelected={handlePlaylistDownloadSelected}
        />
      )}

      {/* Close Confirmation / Minimize to Tray Modal */}
      <CloseConfirmModal
        language={config.language}
        isOpen={isCloseModalOpen}
        activeTasksCount={activeJobCount}
        onMinimizeToTray={handleMinimizeToTray}
        onQuitApp={handleQuitApp}
        onCancel={() => setIsCloseModalOpen(false)}
      />

      {/* Persistent Clipboard Copy Toast (v1.4.0) */}
      {detectedClipboardUrl && (
        <ClipboardToast
          language={config.language}
          url={detectedClipboardUrl}
          onDownloadNow={handleClipboardDownloadNow}
          onInspect={handleClipboardInspect}
          onDismiss={() => setDetectedClipboardUrl(null)}
        />
      )}

      {/* Quick Radial Menu Overlay (v1.4.0) */}
      <RadialMenu
        language={config.language}
        isOpen={isRadialOpen}
        onClose={() => setIsRadialOpen(false)}
        actionsConfig={config.radialActions}
        onAction={handleRadialAction}
      />

      {/* Settings Modal (v1.4.0) */}
      <SettingsModal
        language={config.language}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
};
