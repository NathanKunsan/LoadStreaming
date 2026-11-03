import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import { ConversionJob } from './types';
import { parseSubtitleFile, convertSubtitleCues } from './subtitleConverter';

export class ConversionEngine {
  private binDir: string;
  private ffmpegPath: string;
  private ffprobePath: string;
  private activeJobs: Map<string, ChildProcess> = new Map();
  private onJobUpdateCallback?: (job: ConversionJob) => void;

  constructor() {
    if (app.isPackaged) {
      this.binDir = path.join(process.resourcesPath, 'bin');
    } else {
      this.binDir = path.join(__dirname, '..', 'resources', 'bin');
    }

    this.ffmpegPath = path.join(this.binDir, 'ffmpeg.exe');
    this.ffprobePath = path.join(this.binDir, 'ffprobe.exe');
  }

  public setCallbacks(onJobUpdate: (job: ConversionJob) => void) {
    this.onJobUpdateCallback = onJobUpdate;
  }

  public async getMediaDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ];

      const child = spawn(this.ffprobePath, args, { windowsHide: true });
      let output = '';
      child.stdout.on('data', (d) => output += d.toString());
      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const dur = parseFloat(output.trim());
          resolve(isNaN(dur) ? 0 : dur);
        } else {
          resolve(0);
        }
      });
      child.on('error', () => resolve(0));
    });
  }

  public async startConversion(job: ConversionJob): Promise<ConversionJob> {
    job.status = 'Converting';
    job.progress = 0;
    this.emitUpdate(job);

    if (!fs.existsSync(job.outputDir)) {
      fs.mkdirSync(job.outputDir, { recursive: true });
    }

    // Build unique output filename
    const parsedSource = path.parse(job.sourcePath);
    let outputBase = `${parsedSource.name}.${job.targetFormat}`;
    let counter = 1;
    let outputPath = path.join(job.outputDir, outputBase);
    while (fs.existsSync(outputPath)) {
      outputBase = `${parsedSource.name} (${counter}).${job.targetFormat}`;
      outputPath = path.join(job.outputDir, outputBase);
      counter++;
    }
    job.outputPath = outputPath;

    // Handle Subtitle / Transcript Conversion (Fast 0ms File Parsing)
    const subtitleFormats = ['srt', 'vtt', 'txt', 'lrc', 'ass', 'json', 'csv', 'sbv', 'md', 'tsv'];
    if (subtitleFormats.includes(job.targetFormat) || job.targetCategory === 'subtitle') {
      try {
        const cues = parseSubtitleFile(job.sourcePath);
        const converted = convertSubtitleCues(cues, job.targetFormat as any);
        fs.writeFileSync(outputPath, converted, 'utf8');

        job.status = 'Completed';
        job.progress = 100;
        job.completedAt = Date.now();
        this.emitUpdate(job);
        return job;
      } catch (err: any) {
        job.status = 'Failed';
        job.error = err.message || 'Subtitle conversion failed';
        this.emitUpdate(job);
        return job;
      }
    }

    // Get total duration for progress parsing
    const totalDuration = await this.getMediaDuration(job.sourcePath);

    // Build FFmpeg command arguments based on target format
    const args = ['-y', '-i', job.sourcePath];

    const audioFormats = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff', 'alac', 'amr'];
    if (audioFormats.includes(job.targetFormat)) {
      args.push('-vn'); // strip video if converting to audio
      switch (job.targetFormat) {
        case 'mp3':
          args.push('-c:a', 'libmp3lame', '-b:a', '320k');
          break;
        case 'wav':
          args.push('-c:a', 'pcm_s16le');
          break;
        case 'flac':
          args.push('-c:a', 'flac');
          break;
        case 'm4a':
        case 'aac':
          args.push('-c:a', 'aac', '-b:a', '256k');
          break;
        case 'ogg':
          args.push('-c:a', 'libvorbis', '-q:a', '6');
          break;
        case 'opus':
          args.push('-c:a', 'libopus', '-b:a', '160k');
          break;
        case 'wma':
          args.push('-c:a', 'wmav2', '-b:a', '192k');
          break;
        case 'aiff':
          args.push('-c:a', 'pcm_s16be');
          break;
        case 'alac':
          args.push('-c:a', 'alac');
          break;
        case 'amr':
          args.push('-ar', '8000', '-ac', '1');
          break;
        default:
          break;
      }
    } else {
      // Video formats
      switch (job.targetFormat) {
        case 'mp4':
        case 'mkv':
        case 'mov':
        case 'm4v':
          args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k');
          break;
        case 'webm':
          args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus');
          break;
        case 'avi':
          args.push('-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'mp3', '-b:a', '192k');
          break;
        case 'wmv':
          args.push('-c:v', 'wmv2', '-b:v', '2500k', '-c:a', 'wmav2', '-b:a', '192k');
          break;
        case 'mpeg':
        case 'mpg':
          args.push('-c:v', 'mpeg2video', '-q:v', '4', '-c:a', 'mp2', '-b:a', '192k');
          break;
        case 'flv':
          args.push('-c:v', 'flv', '-c:a', 'mp3', '-b:a', '128k');
          break;
        case '3gp':
          args.push('-c:v', 'h263', '-s', '352x288', '-r', '15', '-b:v', '256k', '-ar', '8000', '-ac', '1');
          break;
        default:
          break;
      }
    }

    args.push(outputPath);

    const child = spawn(this.ffmpegPath, args, { windowsHide: true });
    this.activeJobs.set(job.id, child);

    let lastEmit = 0;

    child.stderr.on('data', (data) => {
      const line = data.toString();

      // Parse time=HH:MM:SS.xx
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && totalDuration > 0) {
        const hours = parseInt(timeMatch[1], 10);
        const mins = parseInt(timeMatch[2], 10);
        const secs = parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + mins * 60 + secs;
        const pct = Math.min(Math.round((currentTime / totalDuration) * 100), 99);
        
        job.progress = Math.max(job.progress, pct);
        const now = Date.now();
        if (now - lastEmit > 200) {
          lastEmit = now;
          this.emitUpdate(job);
        }
      }
    });

    child.on('close', (code) => {
      this.activeJobs.delete(job.id);
      if (job.status === 'Cancelled') {
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch (e) {}
        }
        return;
      }

      if (code === 0 && fs.existsSync(outputPath)) {
        job.status = 'Completed';
        job.progress = 100;
        job.completedAt = Date.now();
      } else {
        job.status = 'Failed';
        job.error = `Conversion failed (code ${code})`;
      }
      this.emitUpdate(job);
    });

    child.on('error', (err) => {
      this.activeJobs.delete(job.id);
      job.status = 'Failed';
      job.error = err.message;
      this.emitUpdate(job);
    });

    return job;
  }

  public cancelJob(jobId: string) {
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {}
      this.activeJobs.delete(jobId);
    }
  }

  private emitUpdate(job: ConversionJob) {
    if (this.onJobUpdateCallback) {
      this.onJobUpdateCallback({ ...job });
    }
  }
}
