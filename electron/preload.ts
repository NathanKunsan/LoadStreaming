import { contextBridge, ipcRenderer } from 'electron';
import { DownloadJob, AppConfig, VideoInfo, HistoryItem, UpdateInfo, MediaType, ConversionJob, DuplicateCheckResult, PlaylistInfo, FetchMediaResult } from './types';

export const electronAPI = {
  // Window
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: (): Promise<void> => ipcRenderer.invoke('quit-app'),
  onRequestClose: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('request-close', subscription);
    return () => { ipcRenderer.removeListener('request-close', subscription); };
  },

  // Config & Files
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  updateConfig: (partial: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke('update-config', partial),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),
  selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<{ filePath: string; fileName: string; fileSize: number } | null> => ipcRenderer.invoke('select-file', options),
  selectFiles: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<{ filePath: string; fileName: string; fileSize: number }[]> => ipcRenderer.invoke('select-files', options),
  resolveDestinationDir: (data: { baseDir: string; mediaType: MediaType; subFolder?: string }): Promise<string> => ipcRenderer.invoke('resolve-destination-dir', data),
  getClipboardText: (): Promise<string> => ipcRenderer.invoke('get-clipboard-text'),
  registerRadialShortcut: (shortcut: string): Promise<boolean> => ipcRenderer.invoke('register-radial-shortcut', shortcut),

  // Download
  validateUrl: (url: string): Promise<{ valid: boolean; error?: string; isPlaylist?: boolean }> => ipcRenderer.invoke('validate-url', url),
  getVideoInfo: (url: string): Promise<VideoInfo> => ipcRenderer.invoke('get-video-info', url),
  getPlaylistInfo: (url: string): Promise<PlaylistInfo> => ipcRenderer.invoke('get-playlist-info', url),
  getMediaInfo: (url: string): Promise<FetchMediaResult> => ipcRenderer.invoke('get-media-info', url),
  checkDuplicate: (data: { baseDir: string; mediaType: MediaType; title: string }): Promise<DuplicateCheckResult> => ipcRenderer.invoke('check-duplicate', data),
  getJobs: (): Promise<DownloadJob[]> => ipcRenderer.invoke('get-jobs'),
  startDownload: (jobData: any): Promise<DownloadJob> => ipcRenderer.invoke('start-download', jobData),
  pauseDownload: (jobId: string): Promise<void> => ipcRenderer.invoke('pause-download', jobId),
  resumeDownload: (jobId: string): Promise<void> => ipcRenderer.invoke('resume-download', jobId),
  cancelDownload: (jobId: string): Promise<void> => ipcRenderer.invoke('cancel-download', jobId),
  clearFinishedJobs: (): Promise<DownloadJob[]> => ipcRenderer.invoke('clear-finished-jobs'),
  openFileLocation: (filePath: string): Promise<void> => ipcRenderer.invoke('open-file-location', filePath),
  openDirectory: (dirPath: string): Promise<void> => ipcRenderer.invoke('open-directory', dirPath),

  // Conversion
  startConversion: (job: ConversionJob): Promise<ConversionJob> => ipcRenderer.invoke('start-conversion', job),
  cancelConversion: (jobId: string): Promise<void> => ipcRenderer.invoke('cancel-conversion', jobId),

  // History
  getHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke('get-history'),
  clearHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke('clear-history'),

  // Updates
  checkForUpdates: (): Promise<UpdateInfo> => ipcRenderer.invoke('check-for-updates'),
  downloadAndApplyUpdate: (downloadUrl: string): Promise<boolean> => ipcRenderer.invoke('download-and-apply-update', downloadUrl),

  // Desktop Floating Toast & Radial Menu IPC (v1.4.0)
  toastDownloadNow: (url: string): Promise<void> => ipcRenderer.invoke('toast-download-now', url),
  toastInspect: (url: string): Promise<void> => ipcRenderer.invoke('toast-inspect', url),
  toastDismiss: (): Promise<void> => ipcRenderer.invoke('toast-dismiss'),
  executeRadialAction: (actionKey: string): Promise<void> => ipcRenderer.invoke('execute-radial-action', actionKey),
  closeRadialMenu: (): Promise<void> => ipcRenderer.invoke('close-radial-menu'),

  // Listeners
  onJobUpdated: (callback: (job: DownloadJob) => void) => {
    const subscription = (_: any, job: DownloadJob) => callback(job);
    ipcRenderer.on('job-updated', subscription);
    return () => { ipcRenderer.removeListener('job-updated', subscription); };
  },
  onConversionUpdated: (callback: (job: ConversionJob) => void) => {
    const subscription = (_: any, job: ConversionJob) => callback(job);
    ipcRenderer.on('conversion-updated', subscription);
    return () => { ipcRenderer.removeListener('conversion-updated', subscription); };
  },
  onHistoryUpdated: (callback: (history: HistoryItem[]) => void) => {
    const subscription = (_: any, history: HistoryItem[]) => callback(history);
    ipcRenderer.on('history-updated', subscription);
    return () => { ipcRenderer.removeListener('history-updated', subscription); };
  },
  onUpdateProgress: (callback: (percent: number) => void) => {
    const subscription = (_: any, percent: number) => callback(percent);
    ipcRenderer.on('update-progress', subscription);
    return () => { ipcRenderer.removeListener('update-progress', subscription); };
  },
  onShowToast: (callback: (data: { url?: string; message?: string; type?: 'info' | 'warning' }) => void) => {
    const subscription = (_: any, data: { url?: string; message?: string; type?: 'info' | 'warning' }) => callback(data);
    ipcRenderer.on('show-toast', subscription);
    return () => { ipcRenderer.removeListener('show-toast', subscription); };
  },
  onOpenRadial: (callback: (data: { config: AppConfig }) => void) => {
    const subscription = (_: any, data: { config: AppConfig }) => callback(data);
    ipcRenderer.on('open-radial', subscription);
    return () => { ipcRenderer.removeListener('open-radial', subscription); };
  },
  onInspectUrl: (callback: (url: string) => void) => {
    const subscription = (_: any, url: string) => callback(url);
    ipcRenderer.on('inspect-url', subscription);
    return () => { ipcRenderer.removeListener('inspect-url', subscription); };
  },
  onSwitchTab: (callback: (tab: 'download' | 'convert' | 'settings') => void) => {
    const subscription = (_: any, tab: 'download' | 'convert' | 'settings') => callback(tab);
    ipcRenderer.on('switch-tab', subscription);
    return () => { ipcRenderer.removeListener('switch-tab', subscription); };
  },
  onClipboardUrlDetected: (callback: (url: string) => void) => {
    const subscription = (_: any, url: string) => callback(url);
    ipcRenderer.on('clipboard-url-detected', subscription);
    return () => { ipcRenderer.removeListener('clipboard-url-detected', subscription); };
  },
  onOpenRadialMenu: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('open-radial-menu', subscription);
    return () => { ipcRenderer.removeListener('open-radial-menu', subscription); };
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
