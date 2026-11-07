import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppConfig, HistoryItem, DownloadJob, Mixtape } from './types';

export class StorageManager {
  private configPath: string;
  private historyPath: string;
  private jobsPath: string;
  private mixtapesPath: string;
  private config: AppConfig;
  private history: HistoryItem[] = [];
  private jobs: DownloadJob[] = [];
  private mixtapes: Mixtape[] = [];

  constructor() {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }

    this.configPath = path.join(userData, 'config.json');
    this.historyPath = path.join(userData, 'history.json');
    this.jobsPath = path.join(userData, 'jobs.json');
    this.mixtapesPath = path.join(userData, 'mixtapes.json');

    // Default config with check for installer configured directory
    let defaultDownloads = '';
    const installerFile = app.isPackaged
      ? path.join(path.dirname(process.execPath), 'default_download_dir.txt')
      : path.join(__dirname, '..', 'default_download_dir.txt');

    if (fs.existsSync(installerFile)) {
      try {
        defaultDownloads = fs.readFileSync(installerFile, 'utf8').trim();
      } catch (e) {}
    }

    if (!defaultDownloads) {
      const userDownloads = app.getPath('downloads') || path.join(process.env.USERPROFILE || 'C:\\', 'Downloads');
      defaultDownloads = path.join(userDownloads, 'LoadStreaming');
    }

    defaultDownloads = defaultDownloads.replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
    if (!defaultDownloads.toLowerCase().endsWith('loadstreaming')) {
      defaultDownloads = path.join(defaultDownloads, 'LoadStreaming');
    }

    try {
      if (!fs.existsSync(defaultDownloads)) {
        fs.mkdirSync(defaultDownloads, { recursive: true });
      }
      fs.mkdirSync(path.join(defaultDownloads, 'Video'), { recursive: true });
      fs.mkdirSync(path.join(defaultDownloads, 'Audio'), { recursive: true });
      fs.mkdirSync(path.join(defaultDownloads, 'Converted'), { recursive: true });
    } catch (e) {}

    this.config = {
      theme: 'yellow-black',
      language: 'th',
      outputDir: defaultDownloads,
      defaultVideoResolution: '1080p',
      discordWsUrl: 'wss://loadstreaming-bot.onrender.com'
    };

    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.outputDir) {
          parsed.outputDir = parsed.outputDir.replace(/[/\\]+/g, '\\').replace(/\\+$/, '');
          if (!parsed.outputDir.toLowerCase().endsWith('loadstreaming')) {
            parsed.outputDir = path.join(parsed.outputDir, 'LoadStreaming');
          }
        }
        if (parsed.discordWsUrl === 'ws://localhost:4040' || !parsed.discordWsUrl) {
          parsed.discordWsUrl = 'wss://loadstreaming-bot.onrender.com';
        }
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }

    try {
      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf8');
        this.history = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }

    try {
      if (fs.existsSync(this.jobsPath)) {
        const raw = fs.readFileSync(this.jobsPath, 'utf8');
        const loadedJobs: DownloadJob[] = JSON.parse(raw);
        // If app previously exited while downloading or waiting, convert them to Paused
        // so user can resume them right away without losing data
        this.jobs = loadedJobs.map(job => {
          if (job.status === 'Downloading' || job.status === 'Waiting') {
            return {
              ...job,
              status: 'Paused',
              downloadSpeedStr: '0 KB/s',
              etaStr: '--'
            };
          }
          return job;
        });
      }
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }

    try {
      if (fs.existsSync(this.mixtapesPath)) {
        const raw = fs.readFileSync(this.mixtapesPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.mixtapes = parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load mixtapes:', e);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...partial };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save config:', e);
    }
    return { ...this.config };
  }

  public getHistory(): HistoryItem[] {
    return [...this.history];
  }

  public addHistoryItem(item: HistoryItem): HistoryItem[] {
    this.history.unshift(item);
    if (this.history.length > 200) {
      this.history = this.history.slice(0, 200);
    }
    this.saveHistory();
    return [...this.history];
  }

  public removeHistoryItem(id?: string, filePath?: string): HistoryItem[] {
    const normTarget = filePath ? path.normalize(filePath).toLowerCase() : '';
    this.history = this.history.filter((h) => {
      if (id && h.id === id) return false;
      if (normTarget && h.filePath && path.normalize(h.filePath).toLowerCase() === normTarget) return false;
      return true;
    });
    this.saveHistory();

    if (normTarget && this.mixtapes.length > 0) {
      let mixtapeChanged = false;
      this.mixtapes = this.mixtapes.map((m) => {
        const filtered = m.trackPaths.filter(
          (tp) => path.normalize(tp).toLowerCase() !== normTarget
        );
        if (filtered.length !== m.trackPaths.length) {
          mixtapeChanged = true;
          return { ...m, trackPaths: filtered };
        }
        return m;
      });
      if (mixtapeChanged) {
        this.saveMixtapesInternal();
      }
    }

    return [...this.history];
  }

  public clearHistory(): HistoryItem[] {
    this.history = [];
    this.saveHistory();
    return [];
  }

  private saveHistory() {
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  // Persistent Mixtapes
  public getMixtapes(): Mixtape[] {
    return [...this.mixtapes];
  }

  public saveMixtapes(mixtapes: Mixtape[]): Mixtape[] {
    this.mixtapes = [...mixtapes];
    this.saveMixtapesInternal();
    return [...this.mixtapes];
  }

  private saveMixtapesInternal() {
    try {
      fs.writeFileSync(this.mixtapesPath, JSON.stringify(this.mixtapes, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save mixtapes:', e);
    }
  }

  // Persistent Jobs Queue
  public getJobs(): DownloadJob[] {
    return [...this.jobs];
  }

  public saveJobs(jobs: DownloadJob[]) {
    this.jobs = [...jobs];
    try {
      fs.writeFileSync(this.jobsPath, JSON.stringify(this.jobs, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save jobs:', e);
    }
  }
}
