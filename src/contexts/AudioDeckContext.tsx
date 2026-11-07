import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { MediaLibraryItem, Mixtape, PlayerCategory } from '../../electron/types';
import { toLocalMediaUrl } from '../utils/mediaHelpers';
import { mechanicalFoley } from '../utils/mechanicalFoley';

export type AudioMachineSource = 'turntable' | 'cassette' | 'portable' | null;
export type RepeatMode = 'off' | 'all' | 'one';

interface AudioDeckContextValue {
  library: MediaLibraryItem[];
  videoItems: MediaLibraryItem[];
  audioItems: MediaLibraryItem[];
  mixtapes: Mixtape[];
  refreshLibrary: () => Promise<void>;
  saveMixtapesOptimistic: (next: Mixtape[]) => void;

  // Missing file honesty & particle disintegration pipeline
  missingSpecimen: MediaLibraryItem | null;
  verifyMediaFile: (item: MediaLibraryItem) => Promise<boolean>;
  completeDisintegration: (item: MediaLibraryItem) => void;

  // Persistent Audio Engine state
  activeMachine: AudioMachineSource;
  loadedMixtapeId: string | null;
  queue: MediaLibraryItem[];
  currentIndex: number;
  currentTrack: MediaLibraryItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  vinylWarmth: boolean;

  // Transport controls
  loadAndPlayQueue: (
    machine: Exclude<AudioMachineSource, null>,
    tracks: MediaLibraryItem[],
    startIndex?: number,
    autoPlay?: boolean,
    mixtapeId?: string | null
  ) => Promise<boolean>;
  playAudio: () => Promise<void>;
  pauseAudio: () => void;
  stopAndUnloadAudio: () => void;
  seekAudio: (timeSec: number) => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setVinylWarmth: (enabled: boolean) => void;
  getVuLevels: () => { left: number; right: number };

  // Shortcut launch from History tab into Player tab
  pendingLaunch: { category: PlayerCategory; item: MediaLibraryItem } | null;
  requestLaunchInPlayer: (item: MediaLibraryItem) => void;
  clearPendingLaunch: () => void;
}

const AudioDeckContext = createContext<AudioDeckContextValue | null>(null);

export const AudioDeckProvider: React.FC<{
  children: React.ReactNode;
  historyTriggerCount: number;
}> = ({ children, historyTriggerCount }) => {
  const [library, setLibrary] = useState<MediaLibraryItem[]>([]);
  const [mixtapes, setMixtapes] = useState<Mixtape[]>([]);
  const [missingSpecimen, setMissingSpecimen] = useState<MediaLibraryItem | null>(null);

  const [activeMachine, setActiveMachine] = useState<AudioMachineSource>(null);
  const [loadedMixtapeId, setLoadedMixtapeId] = useState<string | null>(null);
  const [queue, setQueue] = useState<MediaLibraryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [playbackRate, setPlaybackRateState] = useState<number>(1.0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [vinylWarmth, setVinylWarmth] = useState<boolean>(true);
  const [pendingLaunch, setPendingLaunch] = useState<{ category: PlayerCategory; item: MediaLibraryItem } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceConnectedRef = useRef<boolean>(false);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const currentTrack = queue[currentIndex] || null;

  const refreshLibrary = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const [scanned, savedMixtapes] = await Promise.all([
        window.electronAPI.scanMediaLibrary(),
        window.electronAPI.getMixtapes()
      ]);
      if (Array.isArray(scanned)) setLibrary(scanned);
      if (Array.isArray(savedMixtapes)) setMixtapes(savedMixtapes);
    } catch (e) {
      console.error('Failed to scan media library:', e);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary, historyTriggerCount]);

  // Manage subtle vinyl groove warmth crackle loop when turntable is actively playing
  useEffect(() => {
    if (activeMachine === 'turntable' && isPlaying && vinylWarmth && currentTrack) {
      mechanicalFoley.startVinylCrackle();
    } else {
      mechanicalFoley.stopVinylCrackle();
    }
    return () => {
      mechanicalFoley.stopVinylCrackle();
    };
  }, [activeMachine, isPlaying, vinylWarmth, currentTrack]);

  const saveMixtapesOptimistic = useCallback((next: Mixtape[]) => {
    // 0ms instant optimistic local state update
    setMixtapes(next);
    if (window.electronAPI) {
      window.electronAPI.saveMixtapes(next).catch((e) => {
        console.error('Failed to persist mixtapes:', e);
      });
    }
  }, []);

  const verifyMediaFile = useCallback(async (item: MediaLibraryItem): Promise<boolean> => {
    if (!window.electronAPI) return true;
    try {
      const exists = await window.electronAPI.checkMediaFileExists(item.filePath);
      if (!exists) {
        mechanicalFoley.playMissingErrorThud();
        setMissingSpecimen(item);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const completeDisintegration = useCallback((item: MediaLibraryItem) => {
    const normTarget = item.filePath.replace(/[/\\]+/g, '\\').toLowerCase();

    // 0ms instant optimistic removal from shelf, queue, and custom mixtapes
    setLibrary((prev) =>
      prev.filter((m) => m.id !== item.id && m.filePath.replace(/[/\\]+/g, '\\').toLowerCase() !== normTarget)
    );
    setMixtapes((prev) =>
      prev.map((mx) => ({
        ...mx,
        trackPaths: mx.trackPaths.filter((tp) => tp.replace(/[/\\]+/g, '\\').toLowerCase() !== normTarget)
      }))
    );
    setQueue((prev) =>
      prev.filter((q) => q.id !== item.id && q.filePath.replace(/[/\\]+/g, '\\').toLowerCase() !== normTarget)
    );
    setMissingSpecimen(null);

    // Non-blocking background persistence cleanup
    if (window.electronAPI) {
      window.electronAPI.removeMediaHistoryItem({ id: item.id, filePath: item.filePath }).catch(() => {});
    }
  }, []);

  const ensureAnalyserConnected = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl || mediaSourceConnectedRef.current) return;
    const ctx = mechanicalFoley.getAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      mediaSourceConnectedRef.current = true;
    } catch {
      // Fallback safely if already attached
    }
  }, []);

  const loadTrackIntoElement = useCallback(
    async (track: MediaLibraryItem, autoPlay: boolean) => {
      const audioEl = audioRef.current;
      if (!audioEl) return;

      ensureAnalyserConnected();
      const ctx = mechanicalFoley.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const mediaUrl = toLocalMediaUrl(track.filePath);
      audioEl.src = mediaUrl;
      audioEl.volume = volume;
      audioEl.playbackRate = playbackRate;
      audioEl.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);

      if (autoPlay) {
        try {
          await audioEl.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      } else {
        audioEl.pause();
        setIsPlaying(false);
      }
    },
    [ensureAnalyserConnected, playbackRate, volume]
  );

  const loadAndPlayQueue = useCallback(
    async (
      machine: Exclude<AudioMachineSource, null>,
      tracks: MediaLibraryItem[],
      startIndex = 0,
      autoPlay = true,
      mixtapeId: string | null = null
    ): Promise<boolean> => {
      if (!tracks.length) return false;
      const clampedIdx = Math.max(0, Math.min(tracks.length - 1, startIndex));
      const target = tracks[clampedIdx];

      const ok = await verifyMediaFile(target);
      if (!ok) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        return false;
      }

      setActiveMachine(machine);
      setLoadedMixtapeId(mixtapeId);
      setQueue(tracks);
      setCurrentIndex(clampedIdx);
      if (machine !== 'turntable') {
        setPlaybackRateState(1.0);
        if (audioRef.current) audioRef.current.playbackRate = 1.0;
      }
      await loadTrackIntoElement(target, autoPlay);
      return true;
    },
    [loadTrackIntoElement, verifyMediaFile]
  );

  const playAudio = useCallback(async () => {
    const audioEl = audioRef.current;
    if (!audioEl || !currentTrack) return;

    const ok = await verifyMediaFile(currentTrack);
    if (!ok) {
      audioEl.pause();
      setIsPlaying(false);
      return;
    }

    ensureAnalyserConnected();
    const ctx = mechanicalFoley.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      await audioEl.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [currentTrack, ensureAnalyserConnected, verifyMediaFile]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const stopAndUnloadAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setCurrentIndex(0);
    setLoadedMixtapeId(null);
    setActiveMachine(null);
  }, []);

  const seekAudio = useCallback((timeSec: number) => {
    const audioEl = audioRef.current;
    if (!audioEl || !Number.isFinite(timeSec)) return;
    const clamped = Math.max(0, Math.min(audioEl.duration || timeSec, timeSec));
    audioEl.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const nextTrack = useCallback(async () => {
    if (queue.length === 0) return;
    let nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all' || activeMachine === 'cassette') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    const candidate = queue[nextIdx];
    if (!candidate) return;
    const ok = await verifyMediaFile(candidate);
    if (!ok) {
      pauseAudio();
      return;
    }
    setCurrentIndex(nextIdx);
    await loadTrackIntoElement(candidate, true);
  }, [activeMachine, currentIndex, loadTrackIntoElement, pauseAudio, queue, repeatMode, verifyMediaFile]);

  const prevTrack = useCallback(async () => {
    if (queue.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3.5) {
      seekAudio(0);
      return;
    }
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    const candidate = queue[prevIdx];
    if (!candidate) return;
    const ok = await verifyMediaFile(candidate);
    if (!ok) {
      pauseAudio();
      return;
    }
    setCurrentIndex(prevIdx);
    await loadTrackIntoElement(candidate, isPlaying);
  }, [currentIndex, isPlaying, loadTrackIntoElement, pauseAudio, queue, seekAudio, verifyMediaFile]);

  const setVolume = useCallback((vol: number) => {
    const c = Math.max(0, Math.min(1, vol));
    setVolumeState(c);
    if (audioRef.current) {
      audioRef.current.volume = c;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const c = Math.max(0.75, Math.min(1.35, rate));
    setPlaybackRateState(c);
    if (audioRef.current) {
      audioRef.current.playbackRate = c;
    }
  }, []);

  const getVuLevels = useCallback((): { left: number; right: number } => {
    if (!isPlaying || !analyserRef.current || !freqDataRef.current) {
      return { left: 0, right: 0 };
    }
    analyserRef.current.getByteFrequencyData(freqDataRef.current);
    const arr = freqDataRef.current;
    let lowMidSum = 0;
    let midHighSum = 0;
    const split = Math.floor(arr.length * 0.38);
    for (let i = 1; i < split; i++) {
      lowMidSum += arr[i];
    }
    for (let i = split; i < Math.floor(arr.length * 0.82); i++) {
      midHighSum += arr[i];
    }
    const lNorm = Math.min(1, (lowMidSum / Math.max(1, split - 1)) / 185);
    const rNorm = Math.min(1, (midHighSum / Math.max(1, Math.floor(arr.length * 0.82) - split)) / 155);
    // Blend into realistic stereo program energy
    return {
      left: Math.min(1, lNorm * 0.75 + rNorm * 0.25),
      right: Math.min(1, lNorm * 0.58 + rNorm * 0.45)
    };
  }, [isPlaying]);

  const requestLaunchInPlayer = useCallback((item: MediaLibraryItem) => {
    const category: PlayerCategory = item.mediaType === 'video' ? 'tv' : 'turntable';
    setPendingLaunch({ category, item });
  }, []);

  const clearPendingLaunch = useCallback(() => {
    setPendingLaunch(null);
  }, []);

  const videoItems = library.filter((i) => i.mediaType === 'video');
  const audioItems = library.filter((i) => i.mediaType === 'audio');

  return (
    <AudioDeckContext.Provider
      value={{
        library,
        videoItems,
        audioItems,
        mixtapes,
        refreshLibrary,
        saveMixtapesOptimistic,
        missingSpecimen,
        verifyMediaFile,
        completeDisintegration,
        activeMachine,
        loadedMixtapeId,
        queue,
        currentIndex,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playbackRate,
        repeatMode,
        vinylWarmth,
        loadAndPlayQueue,
        playAudio,
        pauseAudio,
        stopAndUnloadAudio,
        seekAudio,
        nextTrack,
        prevTrack,
        setVolume,
        setPlaybackRate,
        setRepeatMode,
        setVinylWarmth,
        getVuLevels,
        pendingLaunch,
        requestLaunchInPlayer,
        clearPendingLaunch
      }}
    >
      {children}
      {/* Persistent Top-Level Audio Element so playback never interrupts across app tabs */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          e.currentTarget.volume = volume;
          e.currentTarget.playbackRate = playbackRate;
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (repeatMode === 'one' && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else if (activeMachine === 'turntable' && repeatMode === 'off') {
            // Single record finishes at inner run-out groove
            setIsPlaying(false);
          } else {
            nextTrack();
          }
        }}
      />
    </AudioDeckContext.Provider>
  );
};

export function useAudioDeck(): AudioDeckContextValue {
  const ctx = useContext(AudioDeckContext);
  if (!ctx) {
    throw new Error('useAudioDeck must be used inside AudioDeckProvider');
  }
  return ctx;
}
