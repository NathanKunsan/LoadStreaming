import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, clipboard, globalShortcut, session, screen, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile, spawn } from 'child_process';
import { DownloadEngine } from './downloader';
import { ConversionEngine } from './converter';
import { StorageManager } from './storage';
import { UpdateManager } from './updater';
import { DownloadJob, AppConfig, MediaType, ConversionJob, Mixtape, MediaLibraryItem } from './types';

// Register custom local-media protocol before app ready for zero-CORS, Range-capable video/audio playback
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

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
const lastDiscordProgressSent = new Map<string, number>();

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
      if (discordWs && discordWs.readyState === 1) {
        const cfg = storage.getConfig();
        if (cfg.discordChannelId) {
          if (job.status === 'Failed' || job.status === 'Cancelled') {
            discordWs.send(JSON.stringify({
              type: 'JOB_FAILED',
              channelId: cfg.discordChannelId,
              jobId: job.id,
              title: job.title,
              url: job.url,
              error: job.status === 'Cancelled' ? 'CANCELLED' : job.error
            }));
          } else {
            const now = Date.now();
            const lastSent = lastDiscordProgressSent.get(job.id) || 0;
            if (lastSent === 0 || now - lastSent >= 1000 || job.status === 'Paused' || job.status === 'Completed') {
              lastDiscordProgressSent.set(job.id, now);
              discordWs.send(JSON.stringify({
                type: 'JOB_PROGRESS',
                channelId: cfg.discordChannelId,
                jobId: job.id,
                title: job.title,
                progress: Math.round(job.progress),
                downloadSpeedStr: job.downloadSpeedStr || '--',
                downloadedSizeStr: job.downloadedSizeStr || '--',
                totalSizeStr: job.totalSizeStr || '--',
                etaStr: job.etaStr || '--',
                status: job.status
              }));
            }
          }
        }
      }
    },
    (historyItem) => {
      storage.addHistoryItem(historyItem);
      mainWindow?.webContents.send('history-updated', storage.getHistory());
      if (discordWs && discordWs.readyState === 1) {
        const cfg = storage.getConfig();
        if (cfg.discordChannelId) {
          discordWs.send(JSON.stringify({
            type: 'JOB_COMPLETE',
            channelId: cfg.discordChannelId,
            jobId: historyItem.id,
            title: historyItem.title,
            url: historyItem.filePath
          }));
        }
      }
    },
    (jobs: DownloadJob[]) => {
      storage.saveJobs(jobs);
      if (discordWs && discordWs.readyState === 1) {
        const cfg = storage.getConfig();
        if (cfg.discordChannelId) {
          discordWs.send(JSON.stringify({
            type: 'QUEUE_UPDATED',
            channelId: cfg.discordChannelId,
            queue: jobs.map(j => ({
              id: j.id,
              title: j.title,
              url: j.url,
              status: j.status,
              progress: Math.round(j.progress),
              mediaType: j.mediaType,
              resolution: j.resolution
            }))
          }));
        }
      }
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

let discordWs: any = null;
let discordReconnectTimer: NodeJS.Timeout | null = null;
let discordHeartbeatTimer: NodeJS.Timeout | null = null;

function setupDiscordRemote() {
  if (discordReconnectTimer) {
    clearTimeout(discordReconnectTimer);
    discordReconnectTimer = null;
  }
  if (discordHeartbeatTimer) {
    clearInterval(discordHeartbeatTimer);
    discordHeartbeatTimer = null;
  }
  if (discordWs) {
    try {
      discordWs.close();
    } catch (e) {}
    discordWs = null;
  }

  const config = storage.getConfig();
  if (config.enableDiscordRemote === false || !config.discordChannelId) {
    return;
  }

  let rawUrl = (config.discordWsUrl || '').trim();
  if (!rawUrl || rawUrl === 'ws://localhost:4040') {
    rawUrl = 'wss://loadstreaming-bot.onrender.com';
  }
  let wsUrl = rawUrl;
  if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace(/^https:\/\//i, 'wss://');
  } else if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace(/^http:\/\//i, 'ws://');
  }
  const channelId = config.discordChannelId.trim();

  try {
    const ws = new (globalThis as any).WebSocket(wsUrl);
    discordWs = ws;

    ws.onopen = () => {
      console.log('[DiscordRemote] เชื่อมต่อกับบอทสำเร็จ ลงทะเบียนห้อง:', channelId);
      ws.send(JSON.stringify({ type: 'REGISTER', channelId }));
      const initialQueue = downloader.getQueue();
      ws.send(JSON.stringify({
        type: 'QUEUE_UPDATED',
        channelId,
        queue: initialQueue.map(j => ({
          id: j.id,
          title: j.title,
          url: j.url,
          status: j.status,
          progress: Math.round(j.progress),
          mediaType: j.mediaType,
          resolution: j.resolution
        }))
      }));

      // ส่ง Heartbeat PING ทุกๆ 25 วินาที เพื่อรักษาการเชื่อมต่อและป้องกัน Render พักการทำงาน
      if (discordHeartbeatTimer) clearInterval(discordHeartbeatTimer);
      discordHeartbeatTimer = setInterval(() => {
        try {
          if (discordWs && discordWs.readyState === 1) {
            discordWs.send(JSON.stringify({ type: 'PING' }));
          }
        } catch (e) {}
      }, 25000);
    };

    ws.onmessage = async (event: any) => {
      try {
        const payload = JSON.parse(event.data.toString());
        if (payload.type === 'NEW_JOB' && payload.job) {
          handleIncomingBotJob(payload.job);
        } else if (payload.type === 'QUEUED_JOBS' && Array.isArray(payload.jobs)) {
          for (const job of payload.jobs) {
            handleIncomingBotJob(job);
          }
        } else if (payload.type === 'BOT_ACTION') {
          if (payload.action === 'PAUSE' && payload.jobId) {
            downloader.pauseJob(payload.jobId);
          } else if (payload.action === 'RESUME' && payload.jobId) {
            downloader.resumeJob(payload.jobId);
          } else if (payload.action === 'CANCEL' && payload.jobId) {
            downloader.cancelJob(payload.jobId);
          }
        } else if (payload.type === 'FETCH_PLAYLIST_REQUEST') {
          try {
            const plInfo = await downloader.getPlaylistInfo(payload.url);
            ws.send(JSON.stringify({
              type: 'FETCH_PLAYLIST_RESPONSE',
              requestId: payload.requestId,
              channelId: payload.channelId,
              success: true,
              playlist: plInfo
            }));
          } catch (e: any) {
            ws.send(JSON.stringify({
              type: 'FETCH_PLAYLIST_RESPONSE',
              requestId: payload.requestId,
              channelId: payload.channelId,
              success: false,
              error: e.message || 'Failed to fetch playlist'
            }));
          }
        } else if (payload.type === 'FETCH_MEDIA_INFO_REQUEST') {
          try {
            const mediaInfo = await downloader.getMediaInfo(payload.url);
            ws.send(JSON.stringify({
              type: 'FETCH_MEDIA_INFO_RESPONSE',
              requestId: payload.requestId,
              channelId: payload.channelId,
              success: true,
              mediaInfo
            }));
          } catch (e: any) {
            ws.send(JSON.stringify({
              type: 'FETCH_MEDIA_INFO_RESPONSE',
              requestId: payload.requestId,
              channelId: payload.channelId,
              success: false,
              error: e.message || 'Failed to fetch media info'
            }));
          }
        }
      } catch (err) {
        console.error('[DiscordRemote] ข้อผิดพลาดในการอ่านข้อความ:', err);
      }
    };

    ws.onerror = () => {
      // Quietly ignore connection errors if bot is offline
    };

    ws.onclose = () => {
      if (discordHeartbeatTimer) {
        clearInterval(discordHeartbeatTimer);
        discordHeartbeatTimer = null;
      }
      discordWs = null;
      discordReconnectTimer = setTimeout(() => {
        setupDiscordRemote();
      }, 10000);
    };
  } catch (err) {
    console.error('[DiscordRemote] เริ่มการเชื่อมต่อล้มเหลว:', err);
  }
}

function generateJobId(suffix?: string | number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hours12 = String(hours).padStart(2, '0');
  const base = `LoadStreaming_${year}${month}${day}_${hours12}${minutes}${seconds}${ampm}`;
  return suffix !== undefined ? `${base}_${suffix}` : base;
}

function resolveTargetResolution(preferredRes: string, availableResolutions?: { height: number; label: string }[]): string {
  if (!availableResolutions || availableResolutions.length === 0) {
    return preferredRes || '1080p';
  }
  const cleanPref = preferredRes.toLowerCase();
  const exact = availableResolutions.find(r => r.label.toLowerCase() === cleanPref);
  if (exact) return exact.label;

  const targetH = cleanPref === '4k' ? 2160 : cleanPref === '2k' ? 1440 : (parseInt(preferredRes.replace(/[^0-9]/g, ''), 10) || 1080);
  const bestFit = availableResolutions
    .filter(r => r.height <= targetH)
    .sort((a, b) => b.height - a.height)[0];
  if (bestFit) return bestFit.label;

  return availableResolutions[0].label;
}

async function handleIncomingBotJob(jobData: {
  id?: string;
  url: string;
  channelId?: string;
  isPlaylist?: boolean;
  mediaType?: 'video' | 'audio';
  resolution?: string;
  title?: string;
  thumbnail?: string;
}) {
  const cfg = storage.getConfig();
  const isEn = cfg.language === 'en';
  let url = jobData.url;
  if (!jobData.isPlaylist) {
    url = url.replace(/[?&]list=[^&]+/i, '').replace(/[?&]index=[^&]+/i, '').replace(/[?&]start_radio=[^&]+/i, '').replace(/\?$/, '');
  }
  const mediaType: 'video' | 'audio' = jobData.mediaType === 'audio' ? 'audio' : 'video';
  const targetDir = downloader.resolveDestinationDir(cfg.outputDir, mediaType);
  const preferredRes = jobData.resolution || cfg.defaultVideoResolution || '1080p';

  if (jobData.isPlaylist) {
    try {
      const plInfo = await downloader.getPlaylistInfo(url);
      if (plInfo && plInfo.items && plInfo.items.length > 0) {
        let idx = 1;
        for (const item of plInfo.items) {
          const itemJob: DownloadJob = {
            id: generateJobId(idx++),
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail || '',
            mediaType,
            resolution: mediaType === 'video' ? preferredRes : undefined,
            outputDir: targetDir,
            status: 'Waiting',
            pendingMetadata: false,
            progress: 0,
            downloadedSizeStr: '0 B',
            totalSizeStr: '--',
            downloadSpeedStr: '--',
            etaStr: '--',
            createdAt: Date.now()
          };
          downloader.addJob(itemJob);
        }
        return;
      }
    } catch (e) {
      console.warn('[DiscordRemote] ดึงข้อมูลเพลย์ลิสต์ไม่สำเร็จ จะดาวน์โหลดแบบคลิปเดี่ยว:', e);
    }
  }

  const hasTitle = !!(jobData.title && !jobData.title.startsWith('http'));
  const initialJob: DownloadJob = {
    id: jobData.id || generateJobId(),
    url,
    title: hasTitle ? jobData.title! : (isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...'),
    thumbnail: jobData.thumbnail || '',
    mediaType,
    resolution: mediaType === 'video' ? preferredRes : undefined,
    outputDir: targetDir,
    status: 'Waiting',
    pendingMetadata: !hasTitle,
    progress: 0,
    downloadedSizeStr: '0 B',
    totalSizeStr: '--',
    downloadSpeedStr: '--',
    etaStr: '--',
    createdAt: Date.now()
  };

  downloader.addJob(initialJob);

  if (!hasTitle) {
    downloader.getVideoInfo(url).then((info) => {
      const res = mediaType === 'video'
        ? resolveTargetResolution(preferredRes, info.resolutions)
        : undefined;
      downloader.updateJobInfo(initialJob.id, {
        title: info.title,
        thumbnail: info.thumbnail,
        resolution: res,
        pendingMetadata: false
      });
    }).catch((err) => {
      console.error('[DiscordRemote] ดึงข้อมูลไม่สำเร็จ:', err);
      downloader.updateJobInfo(initialJob.id, {
        pendingMetadata: false
      });
    });
  }
}

function createSafeWebFileStream(filePath: string, start: number, end: number): ReadableStream<Uint8Array> {
  let nodeStream: fs.ReadStream | null = null;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream = fs.createReadStream(filePath, { start, end });
      nodeStream.on('data', (chunk: Buffer | string) => {
        if (closed) return;
        try {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf));
        } catch {
          closed = true;
          nodeStream?.destroy();
        }
      });
      nodeStream.on('end', () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      });
      nodeStream.on('error', (err) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(err);
        } catch {}
      });
    },
    cancel() {
      closed = true;
      if (nodeStream) {
        nodeStream.destroy();
        nodeStream = null;
      }
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('local-media', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      const filePath = parsedUrl.searchParams.get('path') || '';
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Media Not Found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return new Response('Invalid Media Path', { status: 404 });
      }

      const totalSize = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.opus': 'audio/opus',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';

      // Direct buffer response for local images so thumbnails load instantaneously
      if (contentType.startsWith('image/')) {
        const imgBuf = fs.readFileSync(filePath);
        return new Response(imgBuf, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(imgBuf.byteLength),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      }

      const rangeHeader = request.headers.get('range') || request.headers.get('Range');

      if (rangeHeader && totalSize > 0) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
          if (start >= totalSize || start < 0) {
            return new Response(null, {
              status: 416,
              headers: {
                'Content-Range': `bytes */${totalSize}`,
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          if (end >= totalSize) end = totalSize - 1;
          const chunkSize = end - start + 1;
          const stream = createSafeWebFileStream(filePath, start, end);
          return new Response(stream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Range',
              'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
              'Cache-Control': 'no-cache'
            }
          });
        }
      }

      if (totalSize === 0) {
        return new Response(new Uint8Array(0), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': '0',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const stream = createSafeWebFileStream(filePath, 0, totalSize - 1);
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range',
          'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          'Cache-Control': 'no-cache'
        }
      });
    } catch {
      return new Response('Internal Media Error', { status: 500 });
    }
  });

  createWindow();
  createTray();
  createToastWindow();
  createRadialWindow();
  initClipboardMonitor();
  setupDiscordRemote();
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
  const updated = storage.updateConfig(partial);
  setupDiscordRemote();
  return updated;
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
    url: downloader.stripRadioMixParams(downloader.normalizeUrl(jobData.url)),
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
  const preferredRes = cfg.defaultVideoResolution || '1080p';
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initialJob: DownloadJob = {
    id: jobId,
    url,
    title: isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...',
    thumbnail: '',
    mediaType: 'video',
    resolution: preferredRes,
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
    const res = resolveTargetResolution(preferredRes, info.resolutions);
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

function queueSingleVideoRadial(targetUrl: string, mediaType: 'video' | 'audio', cfg: any, isEn: boolean, forcedResolution?: string) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const preferredRes = forcedResolution || cfg.defaultVideoResolution || '1080p';
  const initialJob: DownloadJob = {
    id: jobId,
    url: targetUrl,
    title: isEn ? 'Retrieving media details...' : 'กำลังเชื่อมต่อและดึงข้อมูลสื่อ...',
    thumbnail: '',
    mediaType,
    resolution: mediaType === 'video' ? preferredRes : undefined,
    outputDir: downloader.resolveDestinationDir(cfg.outputDir, mediaType),
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
    isEn
      ? (mediaType === 'audio' ? 'Added to queue. Starting MP3 download...' : `Added to queue (${preferredRes}). Starting download...`)
      : (mediaType === 'audio' ? 'เพิ่มเข้าคิวแล้ว กำลังเริ่มดาวน์โหลด MP3...' : `เพิ่มเข้าคิวแล้ว (${preferredRes}) กำลังเริ่มดาวน์โหลด...`),
    'info'
  );

  downloader.getVideoInfo(targetUrl).then((info) => {
    const res = mediaType === 'video'
      ? resolveTargetResolution(preferredRes, info.resolutions)
      : undefined;
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
}

// Desktop Radial Menu Action Handler
ipcMain.handle('execute-radial-action', async (_, actionKey: string) => {
  radialWindow?.hide();
  const cfg = storage.getConfig();
  const isEn = cfg.language === 'en';

  switch (actionKey) {
    case 'actDownloadVideo':
    case 'actDownloadVideo4K':
    case 'actDownloadVideo1080p':
    case 'actDownloadVideo720p': {
      let targetUrl = clipboard.readText().trim();
      if (!downloader.isPotentialVideoUrl(targetUrl)) {
        if (capturedBrowserUrl && downloader.isPotentialVideoUrl(capturedBrowserUrl)) {
          targetUrl = capturedBrowserUrl;
        } else {
          targetUrl = await captureActiveBrowserUrl();
        }
      }

      if (downloader.isPotentialVideoUrl(targetUrl)) {
        const forcedRes = actionKey === 'actDownloadVideo4K' ? '2160p'
          : actionKey === 'actDownloadVideo1080p' ? '1080p'
          : actionKey === 'actDownloadVideo720p' ? '720p'
          : (cfg.defaultVideoResolution || '1080p');

        if (downloader.isPlaylistUrl(targetUrl)) {
          downloader.getPlaylistInfo(targetUrl).then((plInfo) => {
            if (plInfo && plInfo.items && plInfo.items.length > 0) {
              for (const item of plInfo.items) {
                const itemJob: DownloadJob = {
                  id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  url: item.url,
                  title: item.title,
                  thumbnail: item.thumbnail || '',
                  mediaType: 'video',
                  resolution: forcedRes,
                  outputDir: downloader.resolveDestinationDir(cfg.outputDir, 'video'),
                  status: 'Waiting',
                  progress: 0,
                  downloadedSizeStr: '0 B',
                  totalSizeStr: '--',
                  downloadSpeedStr: '--',
                  etaStr: '--',
                  createdAt: Date.now()
                };
                downloader.addJob(itemJob);
              }
              showDesktopToastMessage(
                isEn ? `Added ${plInfo.items.length} playlist items (${forcedRes}) to queue.` : `เพิ่มเพลย์ลิสต์ ${plInfo.items.length} รายการ (${forcedRes}) เข้าคิวแล้ว`,
                'info'
              );
            }
          }).catch(() => {
            queueSingleVideoRadial(targetUrl, 'video', cfg, isEn, forcedRes);
          });
        } else {
          queueSingleVideoRadial(targetUrl, 'video', cfg, isEn, forcedRes);
        }
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
        if (downloader.isPlaylistUrl(targetUrl)) {
          downloader.getPlaylistInfo(targetUrl).then((plInfo) => {
            if (plInfo && plInfo.items && plInfo.items.length > 0) {
              for (const item of plInfo.items) {
                const itemJob: DownloadJob = {
                  id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  url: item.url,
                  title: item.title,
                  thumbnail: item.thumbnail || '',
                  mediaType: 'audio',
                  outputDir: downloader.resolveDestinationDir(cfg.outputDir, 'audio'),
                  status: 'Waiting',
                  progress: 0,
                  downloadedSizeStr: '0 B',
                  totalSizeStr: '--',
                  downloadSpeedStr: '--',
                  etaStr: '--',
                  createdAt: Date.now()
                };
                downloader.addJob(itemJob);
              }
              showDesktopToastMessage(
                isEn ? `Added ${plInfo.items.length} audio items to queue.` : `เพิ่มเพลงจากเพลย์ลิสต์ ${plInfo.items.length} รายการเข้าคิวแล้ว`,
                'info'
              );
            }
          }).catch(() => {
            queueSingleVideoRadial(targetUrl, 'audio', cfg, isEn);
          });
        } else {
          queueSingleVideoRadial(targetUrl, 'audio', cfg, isEn);
        }
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

// Built-in Retro Media Player IPC
function formatBytesReadable(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function collectDiskMediaFiles(dirPath: string, depth = 0): string[] {
  const results: string[] = [];
  if (depth > 2) return results;
  try {
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectDiskMediaFiles(fullPath, depth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.mp4' || ext === '.mp3') {
          results.push(fullPath);
        }
      }
    }
  } catch {}
  return results;
}

function getBundledFfmpegPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
  }
  return path.join(__dirname, '..', 'resources', 'bin', 'ffmpeg.exe');
}

function getThumbCacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'media-thumbs');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return dir;
}

function runFfmpegThumbArgs(ffmpegExe: string, args: string[], outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(ffmpegExe, args, { windowsHide: true });
      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve(false);
      }, 4000);

      child.on('close', () => {
        clearTimeout(timer);
        try {
          resolve(fs.existsSync(outPath) && fs.statSync(outPath).size > 128);
        } catch {
          resolve(false);
        }
      });
      child.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function extractOrGetCachedThumbnail(filePath: string): Promise<string> {
  try {
    if (!filePath || !fs.existsSync(filePath)) return '';
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return '';

    const norm = path.normalize(filePath).toLowerCase();
    const hash = crypto.createHash('sha256').update(`${norm}|${stat.size}`).digest('hex').slice(0, 24);
    const outPath = path.join(getThumbCacheDir(), `${hash}.jpg`);

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 128) {
      return `local-media://media/stream?path=${encodeURIComponent(outPath)}`;
    }

    // Check adjacent image cover first
    const ext = path.extname(filePath).toLowerCase();
    const baseTitle = path.basename(filePath, ext);
    for (const imgExt of ['.jpg', '.jpeg', '.png', '.webp']) {
      const candidate = path.join(path.dirname(filePath), baseTitle + imgExt);
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 128) {
        return `local-media://media/stream?path=${encodeURIComponent(candidate)}`;
      }
    }

    const ffmpegExe = getBundledFfmpegPath();
    if (!fs.existsSync(ffmpegExe)) return '';

    if (ext === '.mp3') {
      // Extract embedded ID3v2 APIC cover art stream
      const ok = await runFfmpegThumbArgs(
        ffmpegExe,
        ['-y', '-v', 'error', '-i', filePath, '-an', '-frames:v', '1', '-q:v', '2', '-vf', 'scale=480:-1', outPath],
        outPath
      );
      if (ok) {
        return `local-media://media/stream?path=${encodeURIComponent(outPath)}`;
      }
      return '';
    }

    if (ext === '.mp4') {
      // Try 2.5s into video for a clear non-black frame, fallback to 0s for very short clips
      let ok = await runFfmpegThumbArgs(
        ffmpegExe,
        ['-y', '-v', 'error', '-ss', '00:00:02.500', '-i', filePath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=480:-1', outPath],
        outPath
      );
      if (!ok) {
        ok = await runFfmpegThumbArgs(
          ffmpegExe,
          ['-y', '-v', 'error', '-ss', '00:00:00', '-i', filePath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=480:-1', outPath],
          outPath
        );
      }
      if (ok) {
        return `local-media://media/stream?path=${encodeURIComponent(outPath)}`;
      }
    }
    return '';
  } catch {
    return '';
  }
}

ipcMain.handle('extract-media-thumbnail', async (_, filePath: string): Promise<string> => {
  return await extractOrGetCachedThumbnail(filePath);
});

ipcMain.handle('scan-media-library', async (): Promise<MediaLibraryItem[]> => {
  const cfg = storage.getConfig();
  const history = storage.getHistory();
  const seenPaths = new Set<string>();
  const items: MediaLibraryItem[] = [];

  // 1. Include all history items (even if missing on disk, so missing items show on shelf until selected & disintegrated)
  for (const h of history) {
    if (!h.filePath) continue;
    const ext = path.extname(h.filePath).toLowerCase();
    const isMp4 = ext === '.mp4' || (h.mediaType === 'video' && (!ext || ext === '.mp4'));
    const isMp3 = ext === '.mp3' || (h.mediaType === 'audio' && (!ext || ext === '.mp3'));
    if (!isMp4 && !isMp3) continue;

    const norm = path.normalize(h.filePath).toLowerCase();
    if (seenPaths.has(norm)) continue;
    seenPaths.add(norm);

    const uniqueHash = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 20);

    items.push({
      id: h.id || `hist_${uniqueHash}`,
      title: h.title || path.basename(h.filePath, path.extname(h.filePath)),
      thumbnail: h.thumbnail || '',
      mediaType: isMp4 ? 'video' : 'audio',
      resolution: h.resolution,
      filePath: h.filePath,
      fileSizeStr: h.fileSizeStr || '--',
      completedAt: h.completedAt || Date.now()
    });
  }

  // 2. Discover any additional .mp4 / .mp3 files in outputDir (Video, Audio, Converted, and tag subfolders)
  const scanRoots = [
    path.join(cfg.outputDir, 'Video'),
    path.join(cfg.outputDir, 'Audio'),
    path.join(cfg.outputDir, 'Converted'),
    cfg.outputDir
  ];

  const discoveredFiles: string[] = [];
  for (const rootDir of scanRoots) {
    if (rootDir === cfg.outputDir) {
      try {
        if (fs.existsSync(rootDir)) {
          for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
            if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.mp4' || ext === '.mp3') {
                discoveredFiles.push(path.join(rootDir, entry.name));
              }
            }
          }
        }
      } catch {}
    } else {
      discoveredFiles.push(...collectDiskMediaFiles(rootDir, 0));
    }
  }

  for (const filePath of discoveredFiles) {
    const norm = path.normalize(filePath).toLowerCase();
    if (seenPaths.has(norm)) continue;
    seenPaths.add(norm);

    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const baseTitle = path.basename(filePath, ext);
      const uniqueHash = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 20);

      items.push({
        id: `disk_${uniqueHash}`,
        title: baseTitle,
        thumbnail: '',
        mediaType: ext === '.mp4' ? 'video' : 'audio',
        resolution: ext === '.mp4' ? 'MP4' : undefined,
        filePath,
        fileSizeStr: formatBytesReadable(stat.size),
        completedAt: Math.round(stat.mtimeMs || Date.now())
      });
    } catch {}
  }

  // 3. Populate local cached thumbnails (with 4-worker concurrency) so every existing MP3 cover & MP4 frame loads reliably offline & online
  const CONCURRENCY = 4;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      if (fs.existsSync(item.filePath)) {
        const localThumb = await extractOrGetCachedThumbnail(item.filePath);
        if (localThumb) {
          item.thumbnail = localThumb;
        }
      }
    }
  });
  await Promise.all(workers);

  return items;
});

ipcMain.handle('check-media-file-exists', (_, filePath: string): boolean => {
  try {
    if (!filePath) return false;
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
});

ipcMain.handle('remove-media-history-item', (_, data: { id?: string; filePath?: string }) => {
  const updated = storage.removeHistoryItem(data?.id, data?.filePath);
  mainWindow?.webContents.send('history-updated', updated);
  return updated;
});

ipcMain.handle('get-mixtapes', (): Mixtape[] => {
  return storage.getMixtapes();
});

ipcMain.handle('save-mixtapes', (_, mixtapes: Mixtape[]): Mixtape[] => {
  return storage.saveMixtapes(mixtapes);
});
