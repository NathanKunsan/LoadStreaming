import path from 'path';
import fs from 'fs';
import { spawn, exec, ChildProcess } from 'child_process';
import { app, Notification, shell, BrowserWindow } from 'electron';
import { DownloadJob, VideoInfo, VideoResolution, HistoryItem, MediaType, DuplicateCheckResult, PlaylistInfo, PlaylistItem, FetchMediaResult } from './types';

export class DownloadEngine {
  private binDir: string;
  private ytdlpPath: string;
  private ffmpegPath: string;
  private activeJobs: Map<string, { process: ChildProcess; job: DownloadJob }> = new Map();
  private queue: DownloadJob[] = [];
  private maxConcurrent: number = 2;
  private videoInfoCache: Map<string, { info: VideoInfo; timestamp: number }> = new Map();
  private mainWindow?: BrowserWindow;
  private onJobUpdateCallback?: (job: DownloadJob) => void;
  private onHistoryUpdateCallback?: (item: HistoryItem) => void;
  private onQueueSaveCallback?: (jobs: DownloadJob[]) => void;

  constructor() {
    if (app.isPackaged) {
      this.binDir = path.join(process.resourcesPath, 'bin');
    } else {
      this.binDir = path.join(__dirname, '..', 'resources', 'bin');
    }

    this.ytdlpPath = path.join(this.binDir, 'yt-dlp.exe');
    this.ffmpegPath = path.join(this.binDir, 'ffmpeg.exe');
  }

  public setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  public setCallbacks(
    onJobUpdate: (job: DownloadJob) => void,
    onHistoryUpdate: (item: HistoryItem) => void,
    onQueueSave: (jobs: DownloadJob[]) => void
  ) {
    this.onJobUpdateCallback = onJobUpdate;
    this.onHistoryUpdateCallback = onHistoryUpdate;
    this.onQueueSaveCallback = onQueueSave;
  }

  public loadInitialQueue(savedJobs: DownloadJob[]) {
    this.queue = savedJobs.map(j => {
      if (j.status === 'Downloading' || j.status === 'Waiting') {
        return { ...j, status: 'Paused', downloadSpeedStr: '0 KB/s', etaStr: '--' };
      }
      return j;
    });
  }

  public getQueue(): DownloadJob[] {
    return [...this.queue];
  }

  public sanitizeFilename(rawTitle: string): string {
    if (!rawTitle) return `LoadStreaming_${Date.now()}`;
    let cleaned = rawTitle.normalize('NFC');
    cleaned = cleaned.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/_+/g, '_').trim();
    cleaned = cleaned.replace(/[. ]+$/, '');
    if (!cleaned) {
      cleaned = `LoadStreaming_${Date.now()}`;
    }
    return cleaned;
  }

  public resolveDestinationDir(baseDir: string, mediaType: MediaType, subFolder?: string): string {
    let target = baseDir ? path.normalize(baseDir.trim()).replace(/[/\\]+/g, '\\').replace(/\\+$/, '') : app.getPath('downloads');
    const baseName = path.basename(target).toLowerCase();
    if (baseName === 'video' || baseName === 'audio') {
      const parent = path.dirname(target);
      if (path.basename(parent).toLowerCase() === 'loadstreaming') {
        target = path.dirname(parent);
      }
    }
    if (!target.toLowerCase().endsWith('loadstreaming')) {
      target = path.join(target, 'LoadStreaming');
    }

    const sub = mediaType === 'video' ? 'Video' : 'Audio';
    let finalDir = path.join(target, sub);
    if (subFolder && subFolder.trim()) {
      const safeSub = this.sanitizeFilename(subFolder.trim());
      finalDir = path.join(finalDir, safeSub);
    }
    if (!fs.existsSync(finalDir)) {
      try {
        fs.mkdirSync(finalDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create destination dir:', e);
      }
    }
    return finalDir;
  }

  public checkDuplicate(baseDir: string, mediaType: MediaType, rawTitle: string): DuplicateCheckResult {
    const targetDir = this.resolveDestinationDir(baseDir, mediaType);
    const safeTitle = this.sanitizeFilename(rawTitle);
    const ext = mediaType === 'video' ? '.mp4' : '.mp3';
    const targetFile = path.join(targetDir, `${safeTitle}${ext}`);

    const existsOnDisk = fs.existsSync(targetFile);
    const existsInQueue = this.queue.some(j => 
      j.mediaType === mediaType && 
      (j.status === 'Downloading' || j.status === 'Waiting') &&
      this.sanitizeFilename(j.title) === safeTitle
    );

    let suggestedName = safeTitle;
    if (existsOnDisk || existsInQueue) {
      let counter = 1;
      while (
        fs.existsSync(path.join(targetDir, `${safeTitle} (${counter})${ext}`)) ||
        this.queue.some(j => this.sanitizeFilename(j.title) === `${safeTitle} (${counter})`)
      ) {
        counter++;
      }
      suggestedName = `${safeTitle} (${counter})`;
    }

    return {
      exists: existsOnDisk || existsInQueue,
      filePath: targetFile,
      fileName: `${safeTitle}${ext}`,
      suggestedName
    };
  }

  public isPlaylistUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    const playlistRegex = /(?:youtube\.com\/playlist\?list=|youtu\.be\/.*[?&]list=|[?&]list=)([a-zA-Z0-9_-]+)/i;
    return playlistRegex.test(trimmed);
  }

  public isPotentialVideoUrl(rawUrl: string): boolean {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const trimmed = rawUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;

    // Reject non-media platforms
    const excludeRegex = /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|google\.com|wikipedia\.org|stackoverflow\.com|medium\.com)/i;
    if (excludeRegex.test(trimmed)) {
      const hasMediaExt = /\.(mp4|webm|mkv|m3u8|mpd|mov|avi)(\?.*)?$/i.test(trimmed);
      if (!hasMediaExt) return false;
    }

    // Video platforms
    const videoPlatforms = [
      'youtube.com', 'youtu.be', 'tiktok.com', 'facebook.com', 'fb.watch',
      'twitter.com', 'x.com', 'instagram.com', 'vimeo.com', 'dailymotion.com',
      'bilibili.com', 'twitch.tv', 'reddit.com', 'soundcloud.com', 'streamable.com'
    ];
    if (videoPlatforms.some(d => trimmed.toLowerCase().includes(d))) {
      if (/shorts/i.test(trimmed)) return false;
      return true;
    }

    // Direct video stream / file extensions
    const directMediaRegex = /\.(mp4|m3u8|mpd|webm|mkv|mov|avi|flv|m4v)(\?.*)?$/i;
    if (directMediaRegex.test(trimmed)) return true;

    // Common streaming paths
    if (/\/(watch|video|embed|stream|playback)\//i.test(trimmed)) return true;

    return false;
  }

  public validateUrl(rawUrl: string): { valid: boolean; error?: string; isPlaylist?: boolean } {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, error: 'INVALID_URL' };
    }
    const trimmed = rawUrl.trim();

    const shortsRegex = /(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)/i;
    if (shortsRegex.test(trimmed)) {
      return { valid: false, error: 'SHORTS_NOT_SUPPORTED' };
    }

    const isPlaylist = this.isPlaylistUrl(trimmed);
    const ytRegex = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:[?&].*)?$/i;
    const genericHttpRegex = /^https?:\/\/[^\s$.?#].[^\s]*$/i;

    if (!ytRegex.test(trimmed) && !isPlaylist && !genericHttpRegex.test(trimmed)) {
      return { valid: false, error: 'INVALID_URL' };
    }

    return { valid: true, isPlaylist };
  }

  public async getPlaylistInfo(url: string): Promise<PlaylistInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '--flat-playlist',
        '--dump-single-json',
        '--ffmpeg-location', this.ffmpegPath,
        url.trim()
      ];

      const child = spawn(this.ytdlpPath, args, { windowsHide: true });
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Failed to fetch playlist info: ${stderrData || 'Unknown error'}`));
        }

        try {
          const info = JSON.parse(stdoutData);
          const rawEntries = info.entries || [];
          
          const items: PlaylistItem[] = rawEntries
            .filter((e: any) => e && (e.id || e.url) && e.title && e.title !== '[Private video]' && e.title !== '[Deleted video]')
            .map((e: any, index: number) => {
              const videoId = e.id || '';
              const videoUrl = e.url ? (e.url.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${videoId}`) : `https://www.youtube.com/watch?v=${videoId}`;
              
              let thumb = '';
              if (Array.isArray(e.thumbnails) && e.thumbnails.length > 0) {
                thumb = e.thumbnails[e.thumbnails.length - 1].url || '';
              } else if (videoId) {
                thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              }

              return {
                id: videoId || `item_${index}`,
                url: videoUrl,
                title: e.title || `Video ${index + 1}`,
                duration: e.duration || 0,
                channel: e.uploader || e.channel || info.uploader || info.channel || '',
                thumbnail: thumb
              };
            });

          let playlistThumb = '';
          if (Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
            playlistThumb = info.thumbnails[info.thumbnails.length - 1].url;
          } else if (items.length > 0 && items[0].thumbnail) {
            playlistThumb = items[0].thumbnail;
          }

          resolve({
            isPlaylist: true,
            id: info.id || 'playlist',
            title: info.title || 'YouTube Playlist',
            channel: info.uploader || info.channel || '',
            itemCount: items.length,
            items,
            thumbnail: playlistThumb
          });
        } catch (e: any) {
          reject(new Error(`Failed to parse playlist data: ${e.message}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async getMediaInfo(url: string): Promise<FetchMediaResult> {
    const isPlaylist = this.isPlaylistUrl(url);
    if (isPlaylist) {
      try {
        const playlistInfo = await this.getPlaylistInfo(url);
        return { isPlaylist: true, playlistInfo };
      } catch (err) {
        if (url.includes('watch?v=') || url.includes('youtu.be/')) {
          const videoInfo = await this.getVideoInfo(url);
          return { isPlaylist: false, videoInfo };
        }
        throw err;
      }
    } else {
      const videoInfo = await this.getVideoInfo(url);
      return { isPlaylist: false, videoInfo };
    }
  }

  public async getVideoInfo(url: string): Promise<VideoInfo> {
    const trimmedUrl = url.trim();
    const validation = this.validateUrl(trimmedUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const cached = this.videoInfoCache.get(trimmedUrl);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return cached.info;
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-playlist',
        '--skip-download',
        '--no-check-formats',
        '--no-warnings',
        '--socket-timeout', '6',
        '--extractor-args', 'youtube:player_client=android,web;player_skip=configs,webpage,hls',
        '--ffmpeg-location', this.ffmpegPath,
        trimmedUrl
      ];

      const child = spawn(this.ytdlpPath, args, { windowsHide: true });
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Failed to fetch video info: ${stderrData || 'Unknown error'}`));
        }

        try {
          const info = JSON.parse(stdoutData);
          const rawFormats = info.formats || [];
          
          const resolutionMap = new Map<number, VideoResolution>();
          for (const f of rawFormats) {
            if (f.vcodec !== 'none' && f.height && typeof f.height === 'number') {
              const h = f.height;
              if (!resolutionMap.has(h)) {
                resolutionMap.set(h, {
                  height: h,
                  label: `${h}p`,
                  formatId: f.format_id
                });
              }
            }
          }

          const sortedResolutions = Array.from(resolutionMap.values()).sort((a, b) => a.height - b.height);

          if (sortedResolutions.length === 0) {
            sortedResolutions.push({ height: 720, label: '720p', formatId: 'best' });
          }

          const result: VideoInfo = {
            url: trimmedUrl,
            title: info.title || 'Unknown Title',
            thumbnail: info.thumbnail || '',
            duration: info.duration || 0,
            channel: info.uploader || info.channel || '',
            resolutions: sortedResolutions
          };

          this.videoInfoCache.set(trimmedUrl, { info: result, timestamp: Date.now() });
          resolve(result);
        } catch (e: any) {
          reject(new Error(`Failed to parse video metadata: ${e.message}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  public addJob(job: DownloadJob) {
    // Prevent adding duplicate job if same URL is already Downloading or Waiting
    const duplicateRunning = this.queue.find(
      j => j.url === job.url && (j.status === 'Downloading' || j.status === 'Waiting')
    );
    if (duplicateRunning) {
      console.log('Job with same URL is already running or queued:', job.url);
      return;
    }

    const existingIndex = this.queue.findIndex(j => j.id === job.id);
    if (existingIndex === -1) {
      this.queue.unshift(job);
    } else {
      this.queue[existingIndex] = job;
    }
    this.emitUpdate(job);
    this.saveQueue();
    this.processQueue();
  }

  public updateJobInfo(jobId: string, updates: Partial<DownloadJob>) {
    const job = this.queue.find(j => j.id === jobId);
    if (job) {
      Object.assign(job, updates);
      this.emitUpdate(job);
      this.saveQueue();
      this.processQueue();
    }
  }

  public pauseJob(jobId: string) {
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.job.status = 'Paused';
      active.job.downloadSpeedStr = '0 KB/s';
      active.job.etaStr = '--';
      this.activeJobs.delete(jobId);

      try {
        if (process.platform === 'win32' && active.process.pid) {
          exec(`taskkill /pid ${active.process.pid} /T /F`, () => {});
        } else {
          active.process.kill('SIGTERM');
        }
      } catch (err) {
        console.error('Error pausing job:', err);
      }

      this.emitUpdate(active.job);
      this.saveQueue();
      this.processQueue();
    } else {
      const queued = this.queue.find(j => j.id === jobId);
      if (queued) {
        queued.status = 'Paused';
        queued.downloadSpeedStr = '0 KB/s';
        queued.etaStr = '--';
        this.emitUpdate(queued);
        this.saveQueue();
      }
    }
  }

  public resumeJob(jobId: string) {
    const job = this.queue.find(j => j.id === jobId);
    if (job && (job.status === 'Paused' || job.status === 'Failed')) {
      job.status = 'Waiting';
      this.emitUpdate(job);
      this.saveQueue();
      this.processQueue();
    }
  }

  public cancelJob(jobId: string) {
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.job.status = 'Cancelled';
      active.job.downloadSpeedStr = '0 KB/s';
      active.job.etaStr = '--';
      this.activeJobs.delete(jobId);

      try {
        if (process.platform === 'win32' && active.process.pid) {
          exec(`taskkill /pid ${active.process.pid} /T /F`, () => {});
        } else {
          active.process.kill('SIGKILL');
        }
      } catch (err) {
        console.error('Error killing job process:', err);
      }

      // Also cancel any other duplicate waiting jobs with the same URL so it doesn't restart
      for (const other of this.queue) {
        if (other.id !== active.job.id && other.url === active.job.url && other.status === 'Waiting') {
          other.status = 'Cancelled';
          this.emitUpdate(other);
        }
      }

      this.cleanupTempFiles(active.job);
      this.emitUpdate(active.job);
      this.saveQueue();
      this.processQueue();
      return;
    }

    const queued = this.queue.find(j => j.id === jobId);
    if (queued) {
      queued.status = 'Cancelled';
      queued.downloadSpeedStr = '0 KB/s';
      queued.etaStr = '--';

      for (const other of this.queue) {
        if (other.id !== queued.id && other.url === queued.url && other.status === 'Waiting') {
          other.status = 'Cancelled';
          this.emitUpdate(other);
        }
      }

      this.cleanupTempFiles(queued);
      this.emitUpdate(queued);
      this.saveQueue();
      this.processQueue();
    }
  }

  public clearFinishedJobs(): DownloadJob[] {
    this.queue = this.queue.filter(j => j.status === 'Downloading' || j.status === 'Waiting' || j.status === 'Paused');
    this.saveQueue();
    return [...this.queue];
  }

  private cleanupTempFiles(job: DownloadJob) {
    try {
      const sanitized = this.sanitizeFilename(job.title);
      const outputDir = job.outputDir;
      if (!fs.existsSync(outputDir)) return;

      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        if (
          file.startsWith(sanitized) &&
          (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.temp') || file.includes('.temp.'))
        ) {
          try {
            fs.unlinkSync(path.join(outputDir, file));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Error cleaning temp files:', err);
    }
  }

  private processQueue() {
    if (this.activeJobs.size >= this.maxConcurrent) {
      return;
    }

    const nextJob = this.queue.find(j => j.status === 'Waiting' && !j.pendingMetadata);
    if (!nextJob) {
      return;
    }

    this.startDownload(nextJob);
  }

  private startDownload(job: DownloadJob) {
    job.status = 'Downloading';
    job.outputDir = this.resolveDestinationDir(job.outputDir, job.mediaType, job.subFolder);
    this.emitUpdate(job);
    this.saveQueue();

    let titleToUse = job.title;
    if (job.timeRange && job.timeRange.start && job.timeRange.end) {
      const cleanStart = job.timeRange.start.replace(/:/g, '.');
      const cleanEnd = job.timeRange.end.replace(/:/g, '.');
      const tag = `[${cleanStart}-${cleanEnd}]`;
      if (!titleToUse.includes(tag)) {
        titleToUse = `${titleToUse} ${tag}`;
        job.title = titleToUse;
      }
    }

    const safeTitle = this.sanitizeFilename(titleToUse);
    const outputTemplate = path.join(job.outputDir, `${safeTitle}.%(ext)s`);

    // Optimized parameters: smooth output stream, efficient fragmenting without stutter
    const args: string[] = [
      '--no-playlist',
      '--continue',
      '--newline',
      '--ffmpeg-location', this.ffmpegPath,
      '--concurrent-fragments', '2',
      '--buffer-size', '64K',
      '--no-mtime',
      '-o', outputTemplate
    ];

    // Speed limiter
    if (job.speedLimit && job.speedLimit !== 'unlimited') {
      args.push('--limit-rate', job.speedLimit);
    }

    // Time-range section downloading
    if (job.timeRange && job.timeRange.start && job.timeRange.end) {
      args.push('--download-sections', `*${job.timeRange.start}-${job.timeRange.end}`);
    }

    // Subtitle downloading
    if (job.downloadSubtitle) {
      args.push('--write-subs', '--write-auto-subs', '--sub-format', 'srt');
      if (job.subLang) {
        args.push('--sub-langs', job.subLang);
      } else {
        args.push('--sub-langs', 'th,en,all');
      }
    }

    if (job.mediaType === 'video') {
      const height = job.resolution ? job.resolution.replace('p', '') : '1080';
      args.push(
        '-f', `bestvideo[height<=?${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=?${height}]+bestaudio/best[height<=?${height}]/best`,
        '--merge-output-format', 'mp4',
        '--embed-thumbnail',
        '--embed-metadata'
      );
    } else {
      args.push(
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-thumbnail',
        '--embed-metadata',
        '--convert-thumbnails', 'jpg'
      );
    }

    args.push(job.url);

    const child = spawn(this.ytdlpPath, args, { windowsHide: true });
    this.activeJobs.set(job.id, { process: child, job });

    let streamStage = 1; // 1 = video, 2 = audio
    let lastEmitTime = 0;

    let finalExpectedFile = path.join(
      job.outputDir,
      `${safeTitle}.${job.mediaType === 'video' ? 'mp4' : 'mp3'}`
    );

    const handleData = (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        // Detect transition to audio stream
        if (line.includes('[download] Destination:') && job.mediaType === 'video') {
          if (streamStage === 1 && job.progress >= 70) {
            streamStage = 2;
          }
        }

        this.parseSmoothProgress(line, job, streamStage, () => {
          const now = Date.now();
          if (now - lastEmitTime >= 150) {
            lastEmitTime = now;
            this.emitUpdate(job);
          }
        });
      }
    };

    child.stdout.on('data', handleData);
    child.stderr.on('data', handleData);

    child.on('close', (code) => {
      this.activeJobs.delete(job.id);

      if (job.status === 'Paused' || job.status === 'Cancelled') {
        this.saveQueue();
        this.processQueue();
        return;
      }

      if (code === 0) {
        job.status = 'Completed';
        job.progress = 100;
        job.downloadSpeedStr = 'Finished';
        job.etaStr = '00:00';
        job.completedAt = Date.now();

        if (fs.existsSync(finalExpectedFile)) {
          job.finalFilePath = finalExpectedFile;
        } else {
          try {
            const files = fs.readdirSync(job.outputDir);
            const targetExt = job.mediaType === 'video' ? '.mp4' : '.mp3';
            const match = files.find(f => f.startsWith(safeTitle) && f.endsWith(targetExt));
            if (match) {
              job.finalFilePath = path.join(job.outputDir, match);
            }
          } catch (e) {}
        }

        this.notifyDownloadComplete(job);

        if (this.onHistoryUpdateCallback && job.finalFilePath) {
          let sizeStr = job.totalSizeStr || 'Unknown size';
          try {
            if (fs.existsSync(job.finalFilePath)) {
              const stat = fs.statSync(job.finalFilePath);
              sizeStr = this.formatBytes(stat.size);
            }
          } catch (e) {}

          this.onHistoryUpdateCallback({
            id: job.id,
            title: job.title,
            thumbnail: job.thumbnail,
            mediaType: job.mediaType,
            resolution: job.resolution,
            filePath: job.finalFilePath,
            fileSizeStr: sizeStr,
            completedAt: Date.now()
          });
        }
      } else {
        job.status = 'Failed';
        job.error = 'Download interrupted';
      }

      this.emitUpdate(job);
      this.saveQueue();
      this.processQueue();
    });

    child.on('error', (err) => {
      this.activeJobs.delete(job.id);
      job.status = 'Failed';
      job.error = err.message;
      this.emitUpdate(job);
      this.saveQueue();
      this.processQueue();
    });
  }

  private parseSmoothProgress(
    line: string,
    job: DownloadJob,
    streamStage: number,
    onProgressUpdate: () => void
  ) {
    const progressRegex = /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(?:~?\s*)(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/i;
    const match = line.match(progressRegex);

    if (match) {
      const rawPct = parseFloat(match[1]);
      let computed = rawPct;

      if (job.mediaType === 'video') {
        if (streamStage === 1) {
          // Video stream: scale 0-100% to 0-82%
          computed = (rawPct / 100) * 82;
        } else {
          // Audio stream: scale 0-100% to 82-96%
          computed = 82 + (rawPct / 100) * 14;
        }
      } else {
        // Audio only: scale 0-100% to 0-96%
        computed = (rawPct / 100) * 96;
      }

      // MONOTONIC GUARANTEE: Never allow progress to drop backwards!
      job.progress = Math.max(job.progress, Math.min(computed, 99.2));
      job.totalSizeStr = match[2];
      job.downloadSpeedStr = match[3];
      job.etaStr = match[4];
      onProgressUpdate();
      return;
    }

    if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('[ThumbnailsConvertor]')) {
      job.progress = Math.max(job.progress, 98.0);
      job.downloadSpeedStr = 'Finishing...';
      job.etaStr = '00:01';
      onProgressUpdate();
    }
  }

  private notifyDownloadComplete(job: DownloadJob) {
    // Suppress native Windows popup if app is open and focused (in-app toast handles it)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isFocused() && !this.mainWindow.isMinimized()) {
        return;
      }
    }

    if (Notification.isSupported()) {
      const notif = new Notification({
        title: 'LoadStreaming',
        body: `ดาวน์โหลดเสร็จสิ้น: ${job.title}`
      });

      notif.on('click', () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (this.mainWindow.isMinimized()) this.mainWindow.restore();
          this.mainWindow.focus();
        }
        if (job.finalFilePath && fs.existsSync(job.finalFilePath)) {
          shell.showItemInFolder(job.finalFilePath);
        } else if (fs.existsSync(job.outputDir)) {
          shell.openPath(job.outputDir);
        }
      });

      notif.show();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private emitUpdate(job: DownloadJob) {
    if (this.onJobUpdateCallback) {
      this.onJobUpdateCallback({ ...job });
    }
  }

  private saveQueue() {
    if (this.onQueueSaveCallback) {
      this.onQueueSaveCallback([...this.queue]);
    }
  }
}
