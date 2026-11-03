import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, clipboard, globalShortcut, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { DownloadEngine } from './downloader';
import { ConversionEngine } from './converter';
import { StorageManager } from './storage';
import { UpdateManager } from './updater';
import { DownloadJob, AppConfig, MediaType, ConversionJob } from './types';

// Set App User Model ID for Windows Notifications
app.setAppUserModelId('com.loadstreaming.app');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const storage = new StorageManager();
const downloader = new DownloadEngine();
const converter = new ConversionEngine();
const updater = new UpdateManager();

// Load initial persistent jobs into downloader
downloader.loadInitialQueue(storage.getJobs());

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../build/icon.png');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 860,
    minHeight: 640,
    frame: false, // Custom rough pencil titlebar
    backgroundColor: '#18181B',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle headers for embedded webview/iframe preview
  const filterUrls = ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.googlevideo.com/*'];
  session.defaultSession.webRequest.onHeadersReceived({ urls: filterUrls }, (details, callback) => {
    if (details.responseHeaders) {
      delete details.responseHeaders['x-frame-options'];
      delete details.responseHeaders['X-Frame-Options'];
      delete details.responseHeaders['content-security-policy'];
      delete details.responseHeaders['Content-Security-Policy'];
    }
    callback({ cancel: false, responseHeaders: details.responseHeaders });
  });

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: filterUrls }, (details, callback) => {
    details.requestHeaders['Referer'] = 'https://www.youtube.com/';
    details.requestHeaders['Origin'] = 'https://www.youtube.com';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.webContents.send('request-close');
    }
  });

  downloader.setMainWindow(mainWindow);

  // Wire download engine callbacks
  downloader.setCallbacks(
    (job: DownloadJob) => {
      mainWindow?.webContents.send('job-updated', job);
    },
    (historyItem) => {
      storage.addHistoryItem(historyItem);
      mainWindow?.webContents.send('history-updated', storage.getHistory());
    },
    (jobs: DownloadJob[]) => {
      storage.saveJobs(jobs);
    }
  );

  // Wire conversion engine callbacks
  converter.setCallbacks((cJob: ConversionJob) => {
    mainWindow?.webContents.send('conversion-updated', cJob);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function createTray() {
  if (tray) return;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../build/icon.png');

  const trayImage = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayImage);
  tray.setToolTip('LoadStreaming');

  const updateContextMenu = () => {
    const queue = downloader.getQueue();
    const activeCount = queue.filter(j => j.status === 'Downloading' || j.status === 'Waiting').length;
    const statusText = activeCount > 0 
      ? `กำลังดาวน์โหลด: ${activeCount} รายการ`
      : 'สถานะ: พร้อมใช้งาน';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'เปิดหน้าต่าง LoadStreaming',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: statusText,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'ปิดโปรแกรมสมบูรณ์',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let lastClipboardText = '';
function initClipboardMonitor() {
  setInterval(() => {
    const cfg = storage.getConfig();
    if (cfg.enableClipboardMonitor === false) return;
    try {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText && text.length < 500) {
        lastClipboardText = text;
        const check = downloader.validateUrl(text);
        if (check.valid && !check.error) {
          mainWindow?.webContents.send('clipboard-url-detected', text);
        }
      }
    } catch {}
  }, 1000);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  initClipboardMonitor();
  const cfg = storage.getConfig();
  if (cfg.enableRadialMenu !== false) {
    registerRadialShortcut(cfg.radialShortcut || 'Alt+Q');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window controls IPC
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.webContents.send('request-close');
});

ipcMain.handle('minimize-to-tray', () => {
  mainWindow?.hide();
});

ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});

// Config & Storage IPC
ipcMain.handle('get-config', () => {
  return storage.getConfig();
});

ipcMain.handle('update-config', (_, partial: Partial<AppConfig>) => {
  return storage.updateConfig(partial);
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const current = storage.getConfig().outputDir;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'เลือกโฟลเดอร์สำหรับบันทึกไฟล์ (Select Output Folder)',
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory']
  });

  if (!res.canceled && res.filePaths.length > 0) {
    let chosen = path.normalize(res.filePaths[0]).replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
    // Automatically ensure /LoadStreaming subfolder
    const baseName = path.basename(chosen).toLowerCase();
    if (baseName === 'video' || baseName === 'audio') {
      const parent = path.dirname(chosen);
      if (path.basename(parent).toLowerCase() === 'loadstreaming') {
        chosen = parent;
      }
    } else if (!chosen.toLowerCase().endsWith('loadstreaming')) {
      chosen = path.join(chosen, 'LoadStreaming');
    }
    try {
      if (!fs.existsSync(chosen)) {
        fs.mkdirSync(chosen, { recursive: true });
      }
    } catch (e) {}

    storage.updateConfig({ outputDir: chosen });
    return chosen;
  }
  return null;
});

ipcMain.handle('select-file', async (_, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: options?.title || 'เลือกไฟล์ (Select File)',
    properties: ['openFile'],
    filters: options?.filters && options.filters.length > 0 ? options.filters : [
      { name: 'Media Files', extensions: ['mp4', 'mp3', 'wav', 'flac', 'mkv', 'mov', 'webm', 'avi', 'm4a', 'aac', 'ogg', 'opus', 'wmv', '3gp', 'mpg', 'mpeg', 'flv'] }
    ]
  });

  if (!res.canceled && res.filePaths.length > 0) {
    const filePath = res.filePaths[0];
    try {
      const stat = fs.statSync(filePath);
      return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: stat.size
      };
    } catch (e) {
      return {
        filePath,
        fileName: path.basename(filePath),
        fileSize: 0
      };
    }
  }
  return null;
});

ipcMain.handle('select-files', async (_, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
  if (!mainWindow) return [];
  const res = await dialog.showOpenDialog(mainWindow, {
    title: options?.title || 'เลือกไฟล์สำหรับแปลง (Select Files to Convert)',
    properties: ['openFile', 'multiSelections'],
    filters: options?.filters && options.filters.length > 0 ? options.filters : [
      { name: 'Media Files', extensions: ['mp4', 'mp3', 'wav', 'flac', 'mkv', 'mov', 'webm', 'avi', 'm4a', 'aac', 'ogg', 'opus', 'wmv', '3gp', 'mpg', 'mpeg', 'flv'] }
    ]
  });

  if (!res.canceled && res.filePaths.length > 0) {
    return res.filePaths.map((filePath) => {
      try {
        const stat = fs.statSync(filePath);
        return {
          filePath,
          fileName: path.basename(filePath),
          fileSize: stat.size
        };
      } catch (e) {
        return {
          filePath,
          fileName: path.basename(filePath),
          fileSize: 0
        };
      }
    });
  }
  return [];
});

ipcMain.handle('check-duplicate', (_, data: { baseDir: string; mediaType: MediaType; title: string }) => {
  return downloader.checkDuplicate(data.baseDir, data.mediaType, data.title);
});

ipcMain.handle('resolve-destination-dir', (_, data: { baseDir: string; mediaType: MediaType; subFolder?: string }) => {
  return downloader.resolveDestinationDir(data.baseDir, data.mediaType, data.subFolder);
});

ipcMain.handle('start-conversion', async (_, job: ConversionJob) => {
  return await converter.startConversion(job);
});

ipcMain.handle('cancel-conversion', (_, jobId: string) => {
  converter.cancelJob(jobId);
});

// Download IPC
ipcMain.handle('validate-url', (_, url: string) => {
  return downloader.validateUrl(url);
});

ipcMain.handle('get-video-info', async (_, url: string) => {
  return await downloader.getVideoInfo(url);
});

ipcMain.handle('get-playlist-info', async (_, url: string) => {
  return await downloader.getPlaylistInfo(url);
});

ipcMain.handle('get-media-info', async (_, url: string) => {
  return await downloader.getMediaInfo(url);
});

ipcMain.handle('get-jobs', () => {
  return downloader.getQueue();
});

ipcMain.handle('start-download', (_, jobData: any) => {
  const config = storage.getConfig();
  const job: DownloadJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: jobData.url,
    title: jobData.title,
    thumbnail: jobData.thumbnail,
    mediaType: jobData.mediaType,
    resolution: jobData.resolution,
    timeRange: jobData.timeRange,
    speedLimit: jobData.speedLimit,
    subFolder: jobData.subFolder,
    downloadSubtitle: jobData.downloadSubtitle,
    subLang: jobData.subLang,
    outputDir: jobData.outputDir || config.outputDir,
    status: 'Waiting',
    progress: 0,
    downloadedSizeStr: '0 B',
    totalSizeStr: '--',
    downloadSpeedStr: '--',
    etaStr: '--',
    createdAt: Date.now()
  };

  downloader.addJob(job);
  return job;
});

ipcMain.handle('get-clipboard-text', () => {
  try {
    return clipboard.readText();
  } catch {
    return '';
  }
});

let currentRegisteredShortcut = '';
function registerRadialShortcut(shortcut: string) {
  if (currentRegisteredShortcut) {
    try {
      globalShortcut.unregister(currentRegisteredShortcut);
    } catch {}
  }
  try {
    const keyToRegister = shortcut || 'Alt+Q';
    const ok = globalShortcut.register(keyToRegister, () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        mainWindow.webContents.send('open-radial-menu');
      }
    });
    if (ok) currentRegisteredShortcut = keyToRegister;
    return ok;
  } catch {
    return false;
  }
}

ipcMain.handle('register-radial-shortcut', (_, shortcut: string) => {
  return registerRadialShortcut(shortcut);
});

ipcMain.handle('pause-download', (_, jobId: string) => {
  downloader.pauseJob(jobId);
});

ipcMain.handle('resume-download', (_, jobId: string) => {
  downloader.resumeJob(jobId);
});

ipcMain.handle('cancel-download', (_, jobId: string) => {
  downloader.cancelJob(jobId);
});

ipcMain.handle('clear-finished-jobs', () => {
  return downloader.clearFinishedJobs();
});

ipcMain.handle('open-file-location', (_, filePath: string) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.handle('open-directory', (_, dirPath: string) => {
  if (dirPath) {
    shell.openPath(dirPath);
  }
});

// History IPC
ipcMain.handle('get-history', () => {
  return storage.getHistory();
});

ipcMain.handle('clear-history', () => {
  return storage.clearHistory();
});

// Update IPC
ipcMain.handle('check-for-updates', async () => {
  return await updater.checkForUpdates();
});

ipcMain.handle('download-and-apply-update', async (_, downloadUrl: string) => {
  return await updater.downloadAndApplyUpdate(downloadUrl, (percent) => {
    mainWindow?.webContents.send('update-progress', percent);
  });
});
