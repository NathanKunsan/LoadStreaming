import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { translations } from '../locales/translations';

interface VideoTrimmerProps {
  language: 'th' | 'en';
  videoUrl: string;
  thumbnail?: string;
  duration: number;
  startTime: string;
  endTime: string;
  onChange: (start: string, end: string) => void;
  onReset: () => void;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  return match ? match[1] : null;
}

export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export function formatSecondsToTime(seconds: number, forceHours: boolean = false): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (forceHours || h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  language,
  videoUrl,
  thumbnail,
  duration,
  startTime,
  endTime,
  onChange,
  onReset
}) => {
  const t = translations[language];
  const videoId = extractYouTubeId(videoUrl);
  const hasHours = duration >= 3600;

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<'start' | 'end' | 'playhead' | null>(null);

  const webviewRef = useRef<any>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const startSec = Math.min(Math.max(0, parseTimeToSeconds(startTime)), duration > 0 ? duration : 0);
  const parsedEnd = parseTimeToSeconds(endTime);
  const endSec = parsedEnd > 0 ? Math.min(parsedEnd, duration > 0 ? duration : parsedEnd) : (duration > 0 ? duration : 0);

  // Sync playhead state with webview
  useEffect(() => {
    const timer = setInterval(async () => {
      const wv = webviewRef.current;
      if (!wv) return;
      try {
        const res = await wv.executeJavaScript(`
          (() => {
            const v = document.querySelector('video');
            return v ? { time: v.currentTime, paused: v.paused } : null;
          })()
        `);
        if (res && typeof res.time === 'number' && !isNaN(res.time)) {
          setCurrentTime(res.time);
          setIsPlaying(!res.paused);
        }
      } catch {}
    }, 350);

    return () => clearInterval(timer);
  }, []);

  const seekVideo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(sec, duration > 0 ? duration : sec));
      setCurrentTime(clamped);
      const wv = webviewRef.current;
      if (wv) {
        try {
          wv.executeJavaScript(`
            const v = document.querySelector('video');
            if (v) { v.currentTime = ${clamped}; }
          `);
        } catch {}
      }
    },
    [duration]
  );

  const togglePlay = () => {
    const wv = webviewRef.current;
    if (wv) {
      try {
        wv.executeJavaScript(`
          const v = document.querySelector('video');
          if (v) {
            if (v.paused) { v.play(); } else { v.pause(); }
          }
        `);
      } catch {}
    }
  };

  const handleSetStartAtCurrent = () => {
    const newStart = Math.min(Math.floor(currentTime), Math.max(0, endSec - 1));
    onChange(formatSecondsToTime(newStart, hasHours), formatSecondsToTime(endSec, hasHours));
    seekVideo(newStart);
  };

  const handleSetEndAtCurrent = () => {
    const maxDur = duration > 0 ? duration : currentTime;
    const newEnd = Math.min(maxDur, Math.max(Math.ceil(currentTime), startSec + 1));
    onChange(formatSecondsToTime(startSec, hasHours), formatSecondsToTime(newEnd, hasHours));
    seekVideo(newEnd);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickSec = ratio * duration;
    seekVideo(clickSec);
    setDragMode('playhead');
  };

  useEffect(() => {
    if (!dragMode || duration <= 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const sec = Math.round(ratio * duration);

      if (dragMode === 'start') {
        const newStart = Math.max(0, Math.min(sec, endSec - 1));
        onChange(formatSecondsToTime(newStart, hasHours), formatSecondsToTime(endSec, hasHours));
        seekVideo(newStart);
      } else if (dragMode === 'end') {
        const newEnd = Math.min(duration, Math.max(sec, startSec + 1));
        onChange(formatSecondsToTime(startSec, hasHours), formatSecondsToTime(newEnd, hasHours));
        seekVideo(newEnd);
      } else if (dragMode === 'playhead') {
        seekVideo(sec);
      }
    };

    const handleMouseUp = () => setDragMode(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, duration, startSec, endSec, hasHours, onChange, seekVideo]);

  const totalDuration = duration > 0 ? duration : 1;
  const startPercent = Math.max(0, Math.min(100, (startSec / totalDuration) * 100));
  const endPercent = Math.max(0, Math.min(100, (endSec / totalDuration) * 100));
  const currentPercent = Math.max(0, Math.min(100, (currentTime / totalDuration) * 100));

  return (
    <div className="space-y-2 pt-1">
      {/* 16:9 Video Player */}
      <div className="relative w-full aspect-video bg-black rounded border-2 border-[var(--color-border)] overflow-hidden">
        {videoId ? (
          <webview
            ref={webviewRef}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=https://www.youtube.com&autoplay=0&controls=1&rel=0`}
            useragent={CHROME_UA}
            className="w-full h-full"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          thumbnail && (
            <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
          )
        )}
      </div>

      {/* Control Bar: Play / Current Time / Snap Buttons / Reset */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={togglePlay}
            className="pencil-button px-3 h-8 flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? t.trimPause : t.trimPlay}</span>
          </button>

          <span className="font-mono text-xs font-bold text-[var(--color-accent)]">
            {formatSecondsToTime(currentTime, hasHours)} / {formatSecondsToTime(duration, hasHours)}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleSetStartAtCurrent}
            className="pencil-button-secondary px-2.5 h-8 text-xs font-bold cursor-pointer"
          >
            {t.trimSetStartHere}
          </button>
          <button
            type="button"
            onClick={handleSetEndAtCurrent}
            className="pencil-button-secondary px-2.5 h-8 text-xs font-bold cursor-pointer"
          >
            {t.trimSetEndHere}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="pencil-button-secondary px-2 h-8 text-xs font-semibold cursor-pointer"
            title={t.trimResetFull}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div
        ref={timelineRef}
        onMouseDown={handleTimelineMouseDown}
        className="relative h-9 w-full bg-zinc-900 border-2 border-[var(--color-border)] rounded cursor-pointer select-none"
      >
        {/* Dimmed Left */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
          style={{ width: `${startPercent}%` }}
        />

        {/* Selected Range Highlight */}
        <div
          className="absolute top-0 bottom-0 bg-[var(--color-accent)]/35 border-y-2 border-[var(--color-accent)] pointer-events-none"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`
          }}
        />

        {/* Dimmed Right */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Start Handle */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setDragMode('start');
          }}
          className="absolute top-0 bottom-0 w-5 -ml-2.5 flex items-center justify-center cursor-ew-resize z-20"
          style={{ left: `${startPercent}%` }}
        >
          <div className="w-3 h-full bg-[var(--color-accent)] border border-black rounded-l flex items-center justify-center text-[9px] font-black text-black">
            [
          </div>
        </div>

        {/* End Handle */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setDragMode('end');
          }}
          className="absolute top-0 bottom-0 w-5 -ml-2.5 flex items-center justify-center cursor-ew-resize z-20"
          style={{ left: `${endPercent}%` }}
        >
          <div className="w-3 h-full bg-[var(--color-accent)] border border-black rounded-r flex items-center justify-center text-[9px] font-black text-black">
            ]
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-1 -ml-0.5 bg-red-500 pointer-events-none z-30"
          style={{ left: `${currentPercent}%` }}
        />
      </div>

      {/* Numerical Time Inputs */}
      <div className="grid grid-cols-2 gap-3 pt-0.5">
        <div>
          <label className="text-[11px] font-bold opacity-90 text-[var(--color-text-muted)] flex items-center space-x-1 mb-1">
            <Clock className="w-3 h-3 text-[var(--color-accent)]" />
            <span>{t.startTimeLabel}</span>
          </label>
          <input
            type="text"
            value={startTime}
            onChange={(e) => {
              onChange(e.target.value, endTime);
              seekVideo(parseTimeToSeconds(e.target.value));
            }}
            placeholder={hasHours ? '00:00:00' : '00:00'}
            className="w-full h-8 px-2 text-xs font-mono font-bold bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold opacity-90 text-[var(--color-text-muted)] flex items-center space-x-1">
              <Clock className="w-3 h-3 text-[var(--color-accent)]" />
              <span>{t.endTimeLabel}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                onChange(startTime, formatSecondsToTime(duration, hasHours));
                seekVideo(duration);
              }}
              className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
            >
              {t.maxDurationBtn}
            </button>
          </div>
          <input
            type="text"
            value={endTime}
            onChange={(e) => {
              onChange(startTime, e.target.value);
              seekVideo(parseTimeToSeconds(e.target.value));
            }}
            placeholder={hasHours ? '00:00:00' : '00:00'}
            className="w-full h-8 px-2 text-xs font-mono font-bold bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded outline-none text-[var(--color-text-main)]"
          />
        </div>
      </div>
    </div>
  );
};
