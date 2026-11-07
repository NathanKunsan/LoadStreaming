import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronRight,
  Music,
  Repeat,
  Volume2
} from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck, RepeatMode } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime, getDeterministicPalette } from '../../utils/mediaHelpers';

interface PortableWheelPlayerProps {
  language: Language;
}

type LcdScreenId = 'root' | 'songs' | 'mixtapes' | 'mixtapeTracks' | 'nowPlaying';

export const PortableWheelPlayer: React.FC<PortableWheelPlayerProps> = ({ language }) => {
  const t = translations[language];
  const {
    audioItems,
    mixtapes,
    activeMachine,
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    loadAndPlayQueue,
    playAudio,
    pauseAudio,
    seekAudio,
    nextTrack,
    prevTrack,
    setVolume,
    setRepeatMode
  } = useAudioDeck();

  const [screenStack, setScreenStack] = useState<LcdScreenId[]>(['root']);
  const [cursorByScreen, setCursorByScreen] = useState<Record<string, number>>({
    root: 0,
    songs: 0,
    mixtapes: 0,
    mixtapeTracks: 0
  });
  const [openedMixtapeIdx, setOpenedMixtapeIdx] = useState<number>(0);
  const [nowPlayingMode, setNowPlayingMode] = useState<'volume' | 'scrub'>('volume');

  const wheelRef = useRef<HTMLDivElement | null>(null);
  const isDraggingWheelRef = useRef<boolean>(false);
  const lastWheelAngleRef = useRef<number | null>(null);
  const accumAngleRef = useRef<number>(0);
  const activeListRowRef = useRef<HTMLDivElement | null>(null);

  const currentScreen = screenStack[screenStack.length - 1];

  // Auto-scroll highlighted LCD row into view
  useEffect(() => {
    if (activeListRowRef.current) {
      activeListRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorByScreen, currentScreen]);

  const audioByNormPath = useMemo(() => {
    const map = new Map<string, MediaLibraryItem>();
    for (const item of audioItems) {
      map.set(item.filePath.replace(/[/\\]+/g, '\\').toLowerCase(), item);
    }
    return map;
  }, [audioItems]);

  const selectedMixtapeTracks: MediaLibraryItem[] = useMemo(() => {
    const m = mixtapes[openedMixtapeIdx];
    if (!m) return [];
    return m.trackPaths.map((tp, idx) => {
      const found = audioByNormPath.get(tp.replace(/[/\\]+/g, '\\').toLowerCase());
      if (found) return found;
      return {
        id: `pw_missing_${m.id}_${idx}`,
        title: tp.split(/[/\\]/).pop()?.replace(/\.mp3$/i, '') || tp,
        thumbnail: '',
        mediaType: 'audio',
        filePath: tp,
        fileSizeStr: '--',
        completedAt: m.createdAt
      };
    });
  }, [audioByNormPath, mixtapes, openedMixtapeIdx]);

  const repeatLabel =
    repeatMode === 'all' ? t.pwRepeatAll : repeatMode === 'one' ? t.pwRepeatOne : t.pwRepeatOff;

  const rootMenuItems = [
    { key: 'songs', label: `${t.pwMenuAllSongs} (${audioItems.length})`, hasSub: true },
    { key: 'mixtapes', label: `${t.pwMenuMixtapes} (${mixtapes.length})`, hasSub: true },
    { key: 'shuffle', label: t.pwMenuShuffle, hasSub: false },
    { key: 'repeat', label: `${t.pwMenuRepeat}: ${repeatLabel}`, hasSub: false },
    { key: 'nowPlaying', label: t.pwMenuNowPlaying, hasSub: true }
  ];

  const getItemCountForScreen = (scr: LcdScreenId): number => {
    switch (scr) {
      case 'root':
        return rootMenuItems.length;
      case 'songs':
        return audioItems.length;
      case 'mixtapes':
        return mixtapes.length;
      case 'mixtapeTracks':
        return selectedMixtapeTracks.length;
      default:
        return 0;
    }
  };

  // Execute 1 angular tick (+1 clockwise, -1 counter-clockwise)
  const stepWheelTick = (dir: 1 | -1) => {
    mechanicalFoley.playClickWheelTick();

    if (currentScreen === 'nowPlaying') {
      if (nowPlayingMode === 'scrub' && duration > 0) {
        seekAudio(Math.max(0, Math.min(duration, currentTime + dir * 4)));
      } else {
        setVolume(Math.max(0, Math.min(1, volume + dir * 0.04)));
      }
      return;
    }

    const total = getItemCountForScreen(currentScreen);
    if (total <= 0) return;

    setCursorByScreen((prev) => {
      const curr = prev[currentScreen] || 0;
      const next = Math.max(0, Math.min(total - 1, curr + dir));
      return { ...prev, [currentScreen]: next };
    });
  };

  // Center Select Button Action
  const handleCenterSelect = async () => {
    mechanicalFoley.playClickWheelButton();

    if (currentScreen === 'root') {
      const idx = cursorByScreen.root || 0;
      const picked = rootMenuItems[idx];
      if (!picked) return;

      if (picked.key === 'songs') {
        setScreenStack((s) => [...s, 'songs']);
      } else if (picked.key === 'mixtapes') {
        setScreenStack((s) => [...s, 'mixtapes']);
      } else if (picked.key === 'shuffle') {
        if (audioItems.length > 0) {
          const shuffled = [...audioItems].sort(() => Math.random() - 0.5);
          const ok = await loadAndPlayQueue('portable', shuffled, 0, true, null);
          if (ok) {
            setNowPlayingMode('volume');
            setScreenStack((s) => [...s, 'nowPlaying']);
          }
        }
      } else if (picked.key === 'repeat') {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const nextMode = order[(order.indexOf(repeatMode) + 1) % order.length];
        setRepeatMode(nextMode);
      } else if (picked.key === 'nowPlaying') {
        setNowPlayingMode('volume');
        setScreenStack((s) => [...s, 'nowPlaying']);
      }
      return;
    }

    if (currentScreen === 'songs') {
      const idx = cursorByScreen.songs || 0;
      if (audioItems[idx]) {
        const ok = await loadAndPlayQueue('portable', audioItems, idx, true, null);
        if (ok) {
          setNowPlayingMode('volume');
          setScreenStack((s) => [...s, 'nowPlaying']);
        }
      }
      return;
    }

    if (currentScreen === 'mixtapes') {
      const idx = cursorByScreen.mixtapes || 0;
      if (mixtapes[idx]) {
        setOpenedMixtapeIdx(idx);
        setCursorByScreen((p) => ({ ...p, mixtapeTracks: 0 }));
        setScreenStack((s) => [...s, 'mixtapeTracks']);
      }
      return;
    }

    if (currentScreen === 'mixtapeTracks') {
      const idx = cursorByScreen.mixtapeTracks || 0;
      if (selectedMixtapeTracks[idx]) {
        const ok = await loadAndPlayQueue('portable', selectedMixtapeTracks, idx, true, null);
        if (ok) {
          setNowPlayingMode('volume');
          setScreenStack((s) => [...s, 'nowPlaying']);
        }
      }
      return;
    }

    if (currentScreen === 'nowPlaying') {
      setNowPlayingMode((m) => (m === 'volume' ? 'scrub' : 'volume'));
    }
  };

  const handleMenuBack = () => {
    mechanicalFoley.playClickWheelButton();
    setNowPlayingMode('volume');
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleWheelPlayPause = async () => {
    mechanicalFoley.playClickWheelButton();
    if (currentTrack) {
      if (isPlaying) pauseAudio();
      else await playAudio();
    } else if (audioItems.length > 0) {
      const ok = await loadAndPlayQueue('portable', audioItems, 0, true, null);
      if (ok) setScreenStack(['root', 'nowPlaying']);
    }
  };

  // Circular Pointer Angle Tracking on Click Wheel Ring
  const computePointerAngle = (clientX: number, clientY: number): { angle: number; dist: number } | null => {
    const el = wheelRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return {
      angle: Math.atan2(dy, dx),
      dist: Math.hypot(dx, dy)
    };
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const info = computePointerAngle(e.clientX, e.clientY);
    // Ignore center button region (handled separately)
    if (!info || info.dist < 36) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingWheelRef.current = true;
    lastWheelAngleRef.current = info.angle;
    accumAngleRef.current = 0;
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheelRef.current || lastWheelAngleRef.current === null) return;
    const info = computePointerAngle(e.clientX, e.clientY);
    if (!info || info.dist < 26) return;

    const rawDiff = info.angle - lastWheelAngleRef.current;
    // Wrap safely across -PI/+PI seam
    const wrappedDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    lastWheelAngleRef.current = info.angle;
    accumAngleRef.current += wrappedDiff;

    const STEP_RAD = 0.29; // ~16.6 degrees per crisp click tick
    while (accumAngleRef.current >= STEP_RAD) {
      accumAngleRef.current -= STEP_RAD;
      stepWheelTick(1);
    }
    while (accumAngleRef.current <= -STEP_RAD) {
      accumAngleRef.current += STEP_RAD;
      stepWheelTick(-1);
    }
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingWheelRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingWheelRef.current = false;
      lastWheelAngleRef.current = null;
      accumAngleRef.current = 0;
    }
  };

  const handleMouseWheelScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    stepWheelTick(e.deltaY > 0 ? 1 : -1);
  };

  const [artC1, , artC2] = getDeterministicPalette(currentTrack?.title || 'pocket');
  const companionTracks = activeMachine === 'portable' && queue.length > 0 ? queue : audioItems;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT: Iconic Anodized Pocket Click-Wheel Player Hardware */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center py-1">
        <div
          onWheel={handleMouseWheelScroll}
          className="w-full max-w-[330px] rounded-[34px] bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border-3 border-black p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1),inset_0_2px_3px_rgba(255,255,255,0.5)] select-none flex flex-col items-center"
        >
          {/* Backlit Color LCD Screen with Glass Bezel */}
          <div className="w-full h-[220px] rounded-2xl bg-zinc-950 p-1.5 border-2 border-zinc-800 shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)]">
            <div className="w-full h-full rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900 overflow-hidden flex flex-col relative shadow-inner">
              {/* Classic Glossy LCD Status Header Bar */}
              <div className="h-6 px-2.5 bg-gradient-to-b from-slate-200 to-slate-300 border-b border-slate-400/80 flex items-center justify-between text-[10px] font-extrabold text-slate-800 shrink-0">
                <span className="truncate max-w-[175px]">
                  {currentScreen === 'root'
                    ? t.pwHeaderTitle
                    : currentScreen === 'songs'
                    ? t.pwMenuAllSongs
                    : currentScreen === 'mixtapes'
                    ? t.pwMenuMixtapes
                    : currentScreen === 'mixtapeTracks'
                    ? mixtapes[openedMixtapeIdx]?.name || t.pwMenuMixtapes
                    : t.pwMenuNowPlaying}
                </span>
                <div className="flex items-center gap-1.5">
                  {isPlaying ? (
                    <Play className="w-2.5 h-2.5 fill-sky-600 text-sky-600" />
                  ) : (
                    <Pause className="w-2.5 h-2.5 text-slate-500" />
                  )}
                  {/* Crisp Battery Gauge */}
                  <div className="w-5 h-2.5 rounded-[2px] border border-slate-700 p-[1px] flex items-center relative">
                    <div className="h-full w-[82%] bg-emerald-500 rounded-[1px]" />
                    <span className="w-[2px] h-1.5 bg-slate-700 absolute -right-[3px] rounded-r-[1px]" />
                  </div>
                </div>
              </div>

              {/* LCD Screen Body */}
              <div className="flex-1 overflow-y-auto">
                {currentScreen === 'root' && (
                  <div className="divide-y divide-slate-300/60">
                    {rootMenuItems.map((item, idx) => {
                      const active = (cursorByScreen.root || 0) === idx;
                      return (
                        <div
                          key={item.key}
                          ref={active ? activeListRowRef : null}
                          onClick={() => {
                            setCursorByScreen((p) => ({ ...p, root: idx }));
                            setTimeout(() => handleCenterSelect(), 0);
                          }}
                          className={`px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                              : 'text-slate-800 hover:bg-slate-200/70'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.hasSub && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentScreen === 'songs' && (
                  audioItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-xs font-bold text-slate-500 text-center">
                      {t.pwEmptySongs}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-300/60">
                      {audioItems.map((song, idx) => {
                        const active = (cursorByScreen.songs || 0) === idx;
                        return (
                          <div
                            key={song.id}
                            ref={active ? activeListRowRef : null}
                            onClick={async () => {
                              setCursorByScreen((p) => ({ ...p, songs: idx }));
                              const ok = await loadAndPlayQueue('portable', audioItems, idx, true, null);
                              if (ok) setScreenStack((s) => [...s, 'nowPlaying']);
                            }}
                            className={`px-3 py-1.5 text-[11px] font-bold flex items-center justify-between gap-2 cursor-pointer ${
                              active
                                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">{song.title}</span>
                            {currentTrack?.id === song.id && <Volume2 className="w-3 h-3 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {currentScreen === 'mixtapes' && (
                  mixtapes.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-xs font-bold text-slate-500 text-center">
                      {t.pwEmptySongs}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-300/60">
                      {mixtapes.map((mx, idx) => {
                        const active = (cursorByScreen.mixtapes || 0) === idx;
                        return (
                          <div
                            key={mx.id}
                            ref={active ? activeListRowRef : null}
                            onClick={() => {
                              setCursorByScreen((p) => ({ ...p, mixtapes: idx, mixtapeTracks: 0 }));
                              setOpenedMixtapeIdx(idx);
                              setScreenStack((s) => [...s, 'mixtapeTracks']);
                            }}
                            className={`px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer ${
                              active
                                ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            <span className="truncate">{mx.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {currentScreen === 'mixtapeTracks' && (
                  <div className="divide-y divide-slate-300/60">
                    {selectedMixtapeTracks.map((song, idx) => {
                      const active = (cursorByScreen.mixtapeTracks || 0) === idx;
                      return (
                        <div
                          key={song.id}
                          ref={active ? activeListRowRef : null}
                          onClick={async () => {
                            setCursorByScreen((p) => ({ ...p, mixtapeTracks: idx }));
                            const ok = await loadAndPlayQueue(
                              'portable',
                              selectedMixtapeTracks,
                              idx,
                              true,
                              null
                            );
                            if (ok) setScreenStack((s) => [...s, 'nowPlaying']);
                          }}
                          className={`px-3 py-1.5 text-[11px] font-bold flex items-center justify-between cursor-pointer ${
                            active
                              ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white'
                              : 'text-slate-800'
                          }`}
                        >
                          <span className="truncate">{song.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentScreen === 'nowPlaying' && (
                  <div className="h-full p-3 flex flex-col justify-between">
                    {currentTrack ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-20 h-20 rounded-lg border border-slate-400 shadow-md overflow-hidden shrink-0"
                            style={{ background: `linear-gradient(135deg, ${artC1}, ${artC2})` }}
                          >
                            {currentTrack.thumbnail ? (
                              <img
                                src={currentTrack.thumbnail}
                                alt={currentTrack.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                <Music className="w-8 h-8 text-white/80" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="text-[10px] font-bold text-slate-500">
                              {queue.length > 0 ? `${currentIndex + 1} / ${queue.length}` : '1 / 1'}
                            </div>
                            <div className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-tight">
                              {currentTrack.title}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-700">
                              <Repeat className="w-3 h-3" />
                              <span>{repeatLabel}</span>
                            </div>
                          </div>
                        </div>

                        {/* Glossy Scrubber or Volume Bar */}
                        <div className="space-y-1 pt-2">
                          <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-600">
                            <span>
                              {nowPlayingMode === 'scrub' ? t.pwScrubMode : t.pwVolumeMode}
                            </span>
                            <span>
                              {nowPlayingMode === 'scrub'
                                ? `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`
                                : `${Math.round(volume * 100)}%`}
                            </span>
                          </div>

                          <div className="w-full h-2.5 rounded-full bg-slate-300 border border-slate-400 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-100 ${
                                nowPlayingMode === 'scrub'
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                  : 'bg-gradient-to-r from-sky-400 to-blue-600'
                              }`}
                              style={{
                                width:
                                  nowPlayingMode === 'scrub'
                                    ? `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                                    : `${volume * 100}%`
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-600">
                            <span>{formatMediaTime(currentTime)}</span>
                            <span>-{formatMediaTime(Math.max(0, duration - currentTime))}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs font-bold text-slate-500 text-center">
                        {t.pwEmptySongs}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INTERACTIVE ANGULAR-TRACKING CLICK WHEEL */}
          <div className="mt-6 mb-1 relative flex items-center justify-center">
            <div
              ref={wheelRef}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUp}
              onPointerCancel={handleWheelPointerUp}
              className="w-52 h-52 rounded-full bg-zinc-900 dark:bg-zinc-950 border-3 border-black shadow-[inset_0_2px_8px_rgba(255,255,255,0.12),0_4px_10px_rgba(0,0,0,0.45)] relative flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              {/* Top Cardinal: MENU */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleMenuBack}
                className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px] font-black tracking-widest text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                {t.pwWheelMenuBtn}
              </button>

              {/* Left Cardinal: PREV */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  prevTrack();
                }}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Right Cardinal: NEXT */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  nextTrack();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Bottom Cardinal: PLAY / PAUSE */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleWheelPlayPause}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 p-1.5 flex items-center gap-0.5 text-zinc-200 hover:text-amber-400 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <Pause className="w-3.5 h-3.5" />
              </button>

              {/* Concave Tactile Center Select Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleCenterSelect}
                className="w-20 h-20 rounded-full bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-800 border-2 border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.45)] active:scale-95 transition-transform cursor-pointer"
              />
            </div>
          </div>

          <p className="mt-2 text-[10px] font-semibold text-zinc-700 dark:text-zinc-400 text-center">
            {t.pwWheelHint}
          </p>
        </div>
      </div>

      {/* RIGHT: Companion Active Queue & Direct Library Quick-Select */}
      <div className="lg:col-span-5 pencil-box bg-[var(--color-surface)] p-4 flex flex-col h-[540px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)]">
            {t.pwCompanionTitle} ({companionTracks.length})
          </h3>
        </div>

        {companionTracks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.pwEmptySongs}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {companionTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <button
                  key={`${track.id}_${idx}`}
                  type="button"
                  onClick={async () => {
                    mechanicalFoley.playClickWheelTick();
                    const ok = await loadAndPlayQueue('portable', companionTracks, idx, true, null);
                    if (ok) {
                      setScreenStack(['root', 'nowPlaying']);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isCurrent
                      ? 'bg-zinc-900 border-[var(--color-accent)] text-amber-300'
                      : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-[10px] font-mono opacity-60 w-5 shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-bold truncate">{track.title}</span>
                  </div>
                  <span className="text-[10px] opacity-65 shrink-0">{track.fileSizeStr}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
