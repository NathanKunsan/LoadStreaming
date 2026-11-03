import fs from 'fs';
import { SubtitleFormat } from './types';

export interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

// Convert "HH:MM:SS,mmm" or "HH:MM:SS.mmm" or "MM:SS.xx" to seconds
export function timeStringToSeconds(str: string): number {
  if (!str) return 0;
  const clean = str.trim().replace(',', '.');
  const parts = clean.split(':').map(p => parseFloat(p) || 0);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

// Format seconds into SRT format: 00:00:00,000
export function secondsToSrtTime(sec: number): string {
  const totalMs = Math.max(0, Math.floor(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Format seconds into VTT format: 00:00:00.000
export function secondsToVttTime(sec: number): string {
  const totalMs = Math.max(0, Math.floor(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Format seconds into ASS format: 0:00:00.00
export function secondsToAssTime(sec: number): string {
  const totalCs = Math.max(0, Math.floor(sec * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Format seconds into LRC format: [mm:ss.xx]
export function secondsToLrcTime(sec: number): string {
  const totalCs = Math.max(0, Math.floor(sec * 100));
  const m = Math.floor(totalCs / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}]`;
}

// Parse generic subtitle file into structured cues
export function parseSubtitleFile(filePath: string): SubtitleCue[] {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  if (ext === 'json') {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.map((d: any) => ({
          startSec: typeof d.start === 'number' ? d.start : timeStringToSeconds(d.start || ''),
          endSec: typeof d.end === 'number' ? d.end : timeStringToSeconds(d.end || ''),
          text: (d.text || d.line || '').toString().trim()
        })).filter(c => c.text);
      }
    } catch {}
  }

  if (ext === 'csv' || ext === 'tsv') {
    const sep = ext === 'csv' ? ',' : '\t';
    const lines = raw.split('\n');
    const cues: SubtitleCue[] = [];
    for (const line of lines) {
      if (!line.trim() || line.toLowerCase().startsWith('start')) continue;
      const parts = line.split(sep);
      if (parts.length >= 3) {
        cues.push({
          startSec: timeStringToSeconds(parts[0].replace(/"/g, '')),
          endSec: timeStringToSeconds(parts[1].replace(/"/g, '')),
          text: parts.slice(2).join(sep).replace(/^"|"$/g, '').trim()
        });
      }
    }
    if (cues.length > 0) return cues;
  }

  if (ext === 'lrc') {
    const lines = raw.split('\n');
    const cues: SubtitleCue[] = [];
    const lrcRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(lrcRegex);
      if (match) {
        const m = parseInt(match[1]);
        const s = parseInt(match[2]);
        const cs = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        const startSec = m * 60 + s + cs;
        const text = match[4].trim();
        if (text) {
          cues.push({
            startSec,
            endSec: startSec + 4, // Default duration if not specified
            text
          });
        }
      }
    }
    // Adjust endSec to next cue startSec
    for (let i = 0; i < cues.length - 1; i++) {
      cues[i].endSec = cues[i + 1].startSec;
    }
    if (cues.length > 0) return cues;
  }

  if (ext === 'ass' || ext === 'ssa') {
    const lines = raw.split('\n');
    const cues: SubtitleCue[] = [];
    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const parts = line.replace('Dialogue:', '').split(',');
        if (parts.length >= 10) {
          const start = timeStringToSeconds(parts[1]);
          const end = timeStringToSeconds(parts[2]);
          const text = parts.slice(9).join(',').replace(/\{.*?\}/g, '').trim();
          if (text) {
            cues.push({ startSec: start, endSec: end, text });
          }
        }
      }
    }
    if (cues.length > 0) return cues;
  }

  // Standard SRT / VTT / SBV parsing
  const cues: SubtitleCue[] = [];
  const timeRegex = /(?:(\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})\s*(?:-->|,)\s*(?:(\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})/;

  const blocks = raw.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx !== -1) {
      const timeParts = lines[timeLineIdx].split(/-->|,/);
      if (timeParts.length >= 2) {
        const start = timeStringToSeconds(timeParts[0]);
        const end = timeStringToSeconds(timeParts[1]);
        const text = lines.slice(timeLineIdx + 1).join('\n').replace(/<[^>]+>/g, '').trim();
        if (text) {
          cues.push({ startSec: start, endSec: end, text });
        }
      }
    }
  }

  // If no timecodes found at all, treat as plain text line-by-line
  if (cues.length === 0) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    let t = 0;
    for (const line of lines) {
      cues.push({
        startSec: t,
        endSec: t + 3,
        text: line
      });
      t += 3;
    }
  }

  return cues;
}

// Convert parsed cues into requested target format
export function convertSubtitleCues(cues: SubtitleCue[], targetFormat: SubtitleFormat): string {
  switch (targetFormat) {
    case 'srt': {
      return cues.map((cue, idx) => {
        return `${idx + 1}\n${secondsToSrtTime(cue.startSec)} --> ${secondsToSrtTime(cue.endSec)}\n${cue.text}\n`;
      }).join('\n');
    }

    case 'vtt': {
      const header = 'WEBVTT - Generated by LoadStreaming\n\n';
      const body = cues.map((cue, idx) => {
        return `${idx + 1}\n${secondsToVttTime(cue.startSec)} --> ${secondsToVttTime(cue.endSec)}\n${cue.text}\n`;
      }).join('\n');
      return header + body;
    }

    case 'txt': {
      // Clean readable text transcript without any timestamps
      return cues.map(c => c.text).join('\n');
    }

    case 'lrc': {
      return cues.map(c => `${secondsToLrcTime(c.startSec)} ${c.text.replace(/\n/g, ' ')}`).join('\n');
    }

    case 'ass': {
      const header = `[Script Info]
Title: LoadStreaming Transcript
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,50,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
      const events = cues.map(c => {
        const cleanText = c.text.replace(/\n/g, '\\N');
        return `Dialogue: 0,${secondsToAssTime(c.startSec)},${secondsToAssTime(c.endSec)},Default,,0,0,0,,${cleanText}`;
      }).join('\n');
      return header + events;
    }

    case 'json': {
      const formatted = cues.map(c => ({
        start: parseFloat(c.startSec.toFixed(3)),
        end: parseFloat(c.endSec.toFixed(3)),
        text: c.text
      }));
      return JSON.stringify(formatted, null, 2);
    }

    case 'csv': {
      const header = 'Start,End,Text\n';
      const rows = cues.map(c => {
        const escaped = `"${c.text.replace(/"/g, '""')}"`;
        return `"${secondsToSrtTime(c.startSec)}","${secondsToSrtTime(c.endSec)}",${escaped}`;
      }).join('\n');
      return header + rows;
    }

    case 'tsv': {
      const header = 'Start\tEnd\tText\n';
      const rows = cues.map(c => {
        const clean = c.text.replace(/\t/g, ' ').replace(/\n/g, ' ');
        return `${secondsToSrtTime(c.startSec)}\t${secondsToSrtTime(c.endSec)}\t${clean}`;
      }).join('\n');
      return header + rows;
    }

    case 'sbv': {
      // YouTube native SBV format: 0:00:00.000,0:00:00.000
      return cues.map(c => {
        return `${secondsToVttTime(c.startSec)},${secondsToVttTime(c.endSec)}\n${c.text}\n`;
      }).join('\n');
    }

    case 'md': {
      // Markdown formatted transcript
      const lines = cues.map(c => {
        return `### [${secondsToSrtTime(c.startSec).split(',')[0]} - ${secondsToSrtTime(c.endSec).split(',')[0]}]\n\n${c.text}\n`;
      });
      return `# Video Transcript\n\n${lines.join('\n')}`;
    }

    default:
      return cues.map(c => c.text).join('\n');
  }
}
