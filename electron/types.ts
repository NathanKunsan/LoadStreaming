export type MediaType = 'video' | 'audio';

export type JobStatus = 'Waiting' | 'Downloading' | 'Paused' | 'Completed' | 'Cancelled' | 'Failed';

export interface VideoResolution {
  height: number;
  label: string;
  formatId: string;
}

export interface VideoInfo {
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  resolutions: VideoResolution[];
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  duration?: number;
  channel?: string;
  thumbnail?: string;
  timeRange?: TimeRange;
}

export interface PlaylistInfo {
  isPlaylist: true;
  id: string;
  title: string;
  channel: string;
  itemCount: number;
  items: PlaylistItem[];
  thumbnail?: string;
}

export interface FetchMediaResult {
  isPlaylist: boolean;
  videoInfo?: VideoInfo;
  playlistInfo?: PlaylistInfo;
}

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  mediaType: MediaType;
  resolution?: string; // e.g. "1080p"
  timeRange?: TimeRange;
  speedLimit?: string;
  subFolder?: string;
  downloadSubtitle?: boolean;
  subLang?: string;
  outputDir: string;
  finalFilePath?: string;
  status: JobStatus;
  progress: number; // 0 to 100
  downloadedSizeStr: string;
  totalSizeStr: string;
  downloadSpeedStr: string;
  etaStr: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  mediaType: MediaType;
  resolution?: string;
  filePath: string;
  fileSizeStr: string;
  completedAt: number;
}

export interface AppConfig {
  theme: 'yellow-black' | 'white-black' | 'white-blue' | 'black-blue';
  language: 'th' | 'en';
  outputDir: string;
  enableClipboardMonitor?: boolean;
  enableRadialMenu?: boolean;
  radialShortcut?: string;
  radialActions?: {
    north: string;
    east: string;
    south: string;
    west: string;
  };
}

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'm4a' | 'aac' | 'ogg' | 'opus' | 'wma' | 'aiff' | 'alac' | 'amr';
export type VideoFormat = 'mp4' | 'mkv' | 'mov' | 'webm' | 'avi' | 'wmv' | 'mpeg' | 'mpg' | 'flv' | '3gp' | 'm4v';
export type SubtitleFormat = 'srt' | 'vtt' | 'txt' | 'lrc' | 'ass' | 'json' | 'csv' | 'sbv' | 'md' | 'tsv';
export type TargetCategory = 'audio' | 'video' | 'subtitle';
export type TargetFormat = AudioFormat | VideoFormat | SubtitleFormat;

export interface ConversionJob {
  id: string;
  sourcePath: string;
  sourceName: string;
  sourceSizeStr: string;
  targetFormat: TargetFormat;
  targetCategory: TargetCategory;
  outputDir: string;
  outputPath?: string;
  status: 'Waiting' | 'Converting' | 'Completed' | 'Failed' | 'Cancelled';
  progress: number; // 0-100
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion?: string;
  currentVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export interface DuplicateCheckResult {
  exists: boolean;
  filePath: string;
  fileName: string;
  suggestedName: string;
}
