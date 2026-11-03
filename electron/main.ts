import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, clipboard, globalShortcut, session, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { DownloadEngine } from './downloader';
import { ConversionEngine } from './converter';
import { StorageManager } from './storage';
import { UpdateManager } from './updater';
import { DownloadJob, AppConfig, MediaType, ConversionJob } from './types';

// Set App User Model ID for Windows Notifications
app.setAppUserModelId('com.loadstreaming.app');

let mainWindow: BrowserWindow | null = null;
let toastWindow: BrowserWindow | null = null;
let radialWindow: BrowserWindow | null = null;
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

function createToastWindow() {
  if (toastWindow && !toastWindow.isDestroyed()) return;
  toastWindow = new BrowserWindow({
    width: 420,
    height: 155,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    toastWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#toast`);
  } else {
    toastWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'toast' });
  }

  toastWindow.on('closed', () => {
    toastWindow = null;
  });
}

function createRadialWindow() {
  if (radialWindow && !radialWindow.isDestroyed()) return;
  radialWindow = new BrowserWindow({
    width: 380,
    height: 380,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    radialWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#radial`);
  } else {
    radialWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'radial' });
  }

  radialWindow.on('blur', () => {
    radialWindow?.hide();
  });

  radialWindow.on('closed', () => {
    radialWindow = null;
  });
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
        if (downloader.isPotentialVideoUrl(text)) {
          if (!toastWindow || toastWindow.isDestroyed()) {
            createToastWindow();
          }
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width, height } = primaryDisplay.workAreaSize;
          toastWindow?.setPosition(width - 435, height - 165);
          toastWindow?.webContents.send('show-toast', { url: text });
          toastWindow?.showInactive();
          toastWindow?.setAlwaysOnTop(true, 'screen-saver');
        }
      }
    } catch {}
  }, 1000);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  createToastWindow();
  createRadialWindow();
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
let capturedBrowserUrl = '';

function getBrowserUrlExePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'GetBrowserUrl.exe');
  }
  return path.join(__dirname, '..', 'resources', 'bin', 'GetBrowserUrl.exe');
}

function captureActiveBrowserUrl(): Promise<string> {
  return new Promise((resolve) => {
    const exePath = getBrowserUrlExePath();
    if (!fs.existsSync(exePath)) {
      resolve('');
      return;
    }
    execFile(exePath, [], { timeout: 1500 }, (error, stdout) => {
      if (error || !stdout) {
        resolve('');
      } else {
        const url = stdout.trim();
        resolve(downloader.isPotentialVideoUrl(url) ? url : '');
      }
    });
  });
}

function registerRadialShortcut(shortcut: string) {
  if (currentRegisteredShortcut) {
    try {
      globalShortcut.unregister(currentRegisteredShortcut);
    } catch {}
  }
  try {
    const keyToRegister = shortcut || 'Alt+Q';
    const ok = globalShortcut.register(keyToRegister, async () => {
      const cfg = storage.getConfig();
      if (cfg.enableRadialMenu === false) return;

      // Capture browser URL under mouse/active window before radial steals focus!
      captureActiveBrowserUrl().then((url) => {
        if (url) capturedBrowserUrl = url;
      });

      if (!radialWindow || radialWindow.isDestroyed()) {
        createRadialWindow();
      }
      const cursor = screen.getCursorScreenPoint();
      radialWindow?.setPosition(Math.round(cursor.x - 190), Math.round(cursor.y - 190));
      radialWindow?.webContents.send('open-radial', { config: cfg });
      radialWindow?.show();
      radialWindow?.focus();
      radialWindow?.setAlwaysOnTop(true, 'screen-saver');
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

// Desktop Toast IPC Handlers
ipcMain.handle('toast-download-now', async (_, url: string) => {
  toastWindow?.hide();
  const cfg = storage.getConfig();
  const isEn = cfg.language === 'en';
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialJob: DownloadJob = {
    id: jobId,
    url,
    title: isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...',
    thumbnail: '',
    mediaType: 'video',
    resolution: '1080p',
    outputDir: downloader.resolveDestinationDir(cfg.outputDir, 'video'),
    status: 'Waiting',
    pendingMetadata: true,
    progress: 0,
    downloadedSizeStr: '0 B',
    totalSizeStr: '--',
    downloadSpeedStr: '--',
    etaStr: '--',
    createdAt: Date.now()
  };
  downloader.addJob(initialJob);

  downloader.getVideoInfo(url).then((info) => {
    const res = info.resolutions && info.resolutions.length > 0
      ? (info.resolutions.find(r => r.height === 1080)?.label || info.resolutions[info.resolutions.length - 1].label)
      : '1080p';
    downloader.updateJobInfo(jobId, {
      title: info.title,
      thumbnail: info.thumbnail,
      resolution: res,
      pendingMetadata: false
    });
  }).catch(() => {
    downloader.updateJobInfo(jobId, {
      status: 'Failed',
      error: isEn ? 'Failed to fetch video information' : 'ไม่สามารถดึงข้อมูลวิดีโอได้',
      pendingMetadata: false
    });
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send('inspect-url', url);
  });
});

ipcMain.handle('toast-inspect', (_, url: string) => {
  toastWindow?.hide();
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.send('inspect-url', url);
});

ipcMain.handle('toast-dismiss', () => {
  toastWindow?.hide();
});

function showDesktopToastMessage(message: string, type: 'info' | 'warning' = 'info') {
  try {
    if (!toastWindow || toastWindow.isDestroyed()) {
      createToastWindow();
    }
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    toastWindow?.setPosition(width - 435, height - 120);
    toastWindow?.webContents.send('show-toast', { message, type });
    toastWindow?.showInactive();
    toastWindow?.setAlwaysOnTop(true, 'screen-saver');

    setTimeout(() => {
      try {
        toastWindow?.hide();
      } catch {}
    }, 3500);
  } catch {}
}

// Desktop Radial Menu Action Handler
ipcMain.handle('execute-radial-action', async (_, actionKey: string) => {
  radialWindow?.hide();
  const cfg = storage.getConfig();
  const isEn = cfg.language === 'en';

  switch (actionKey) {
    case 'actDownloadVideo': {
      let targetUrl = clipboard.readText().trim();
      if (!downloader.isPotentialVideoUrl(targetUrl)) {
        if (capturedBrowserUrl && downloader.isPotentialVideoUrl(capturedBrowserUrl)) {
          targetUrl = capturedBrowserUrl;
        } else {
          targetUrl = await captureActiveBrowserUrl();
        }
      }

      if (downloader.isPotentialVideoUrl(targetUrl)) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const initialJob: DownloadJob = {
          id: jobId,
          url: targetUrl,
          title: isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...',
          thumbnail: '',
          mediaType: 'video',
          resolution: '1080p',
          outputDir: downloader.resolveDestinationDir(cfg.outputDir, 'video'),
          status: 'Waiting',
          pendingMetadata: true,
          progress: 0,
          downloadedSizeStr: '0 B',
          totalSizeStr: '--',
          downloadSpeedStr: '--',
          etaStr: '--',
          createdAt: Date.now()
        };
        downloader.addJob(initialJob);

        showDesktopToastMessage(
          isEn ? 'Added to queue. Starting download...' : 'เพิ่มเข้าคิวแล้ว กำลังเริ่มดาวน์โหลด...',
          'info'
        );

        downloader.getVideoInfo(targetUrl).then((info) => {
          const res = info.resolutions && info.resolutions.length > 0
            ? (info.resolutions.find(r => r.height === 1080)?.label || info.resolutions[info.resolutions.length - 1].label)
            : '1080p';
          downloader.updateJobInfo(jobId, {
            title: info.title,
            thumbnail: info.thumbnail,
            resolution: res,
            pendingMetadata: false
          });
        }).catch(() => {
          downloader.updateJobInfo(jobId, {
            status: 'Failed',
            error: isEn ? 'Failed to fetch video information' : 'ไม่สามารถดึงข้อมูลวิดีโอได้',
            pendingMetadata: false
          });
          showDesktopToastMessage(
            isEn ? 'Failed to fetch video information. Please check URL.' : 'ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาตรวจสอบลิงก์',
            'warning'
          );
        });
      } else {
        showDesktopToastMessage(
          isEn ? 'No video link found in clipboard or browser.' : 'ไม่พบลิงก์วิดีโอจากหน้าจอหรือคลิปบอร์ด',
          'warning'
        );
      }
      break;
    }
    case 'actDownloadAudio': {
      let targetUrl = clipboard.readText().trim();
      if (!downloader.isPotentialVideoUrl(targetUrl)) {
        if (capturedBrowserUrl && downloader.isPotentialVideoUrl(capturedBrowserUrl)) {
          targetUrl = capturedBrowserUrl;
        } else {
          targetUrl = await captureActiveBrowserUrl();
        }
      }

      if (downloader.isPotentialVideoUrl(targetUrl)) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const initialJob: DownloadJob = {
          id: jobId,
          url: targetUrl,
          title: isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...',
          thumbnail: '',
          mediaType: 'audio',
          outputDir: downloader.resolveDestinationDir(cfg.outputDir, 'audio'),
          status: 'Waiting',
          pendingMetadata: true,
          progress: 0,
          downloadedSizeStr: '0 B',
          totalSizeStr: '--',
          downloadSpeedStr: '--',
          etaStr: '--',
          createdAt: Date.now()
        };
        downloader.addJob(initialJob);

        showDesktopToastMessage(
          isEn ? 'Added to queue. Starting MP3 download...' : 'เพิ่มเข้าคิวแล้ว กำลังเริ่มดาวน์โหลด MP3...',
          'info'
        );

        downloader.getVideoInfo(targetUrl).then((info) => {
          downloader.updateJobInfo(jobId, {
            title: info.title,
            thumbnail: info.thumbnail,
            pendingMetadata: false
          });
        }).catch(() => {
          downloader.updateJobInfo(jobId, {
            status: 'Failed',
            error: isEn ? 'Failed to fetch audio information' : 'ไม่สามารถดึงข้อมูลวิดีโอได้',
            pendingMetadata: false
          });
          showDesktopToastMessage(
            isEn ? 'Failed to fetch audio information. Please check URL.' : 'ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาตรวจสอบลิงก์',
            'warning'
          );
        });
      } else {
        showDesktopToastMessage(
          isEn ? 'No video link found in clipboard or browser.' : 'ไม่พบลิงก์วิดีโอจากหน้าจอหรือคลิปบอร์ด',
          'warning'
        );
      }
      break;
    }
    case 'actOpenFolder':
      shell.openPath(cfg.outputDir);
      break;
    case 'actOpenConvert':
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send('switch-tab', 'convert');
      break;
    case 'actToggleApp':
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
      break;
  }
});

ipcMain.handle('close-radial-menu', () => {
  radialWindow?.hide();
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
