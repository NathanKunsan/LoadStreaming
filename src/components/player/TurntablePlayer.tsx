import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Search,
  Sparkles,
  CornerUpLeft
} from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime } from '../../utils/mediaHelpers';
import { RotaryKnob } from './RotaryKnob';
import { MediaThumb } from './MediaThumb';

interface TurntablePlayerProps {
  language: Language;
  initialLaunchItem?: MediaLibraryItem | null;
  onConsumedLaunch?: () => void;
}

export const TurntablePlayer: React.FC<TurntablePlayerProps> = ({
  language,
  initialLaunchItem,
  onConsumedLaunch
}) => {
  const t = translations[language];
  const {
    audioItems,
    activeMachine,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    vinylWarmth,
    loadAndPlayQueue,
    playAudio,
    pauseAudio,
    stopAndUnloadAudio,
    seekAudio,
    setVolume,
    setPlaybackRate,
    setVinylWarmth,
    verifyMediaFile
  } = useAudioDeck();

  const isThisMachineActive = activeMachine === 'turntable' && Boolean(currentTrack);
  const loadedDisc = isThisMachineActive ? currentTrack : null;

  const [stylusDropped, setStylusDropped] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // High-FPS Physics Platter Refs (zero React re-render overhead)
  const spinningDiscRef = useRef<HTMLDivElement | null>(null);
  const strobeRingRef = useRef<HTMLDivElement | null>(null);
  const angleDegRef = useRef<number>(0);
  const angularVelRef = useRef<number>(0);

  const motorRunning = Boolean(loadedDisc && isPlaying);

  useEffect(() => {
    setStylusDropped(Boolean(isThisMachineActive && isPlaying));
  }, [isThisMachineActive, isPlaying]);

  // Rotational inertia physics loop tied directly to real audio playbackRate
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const targetVel = motorRunning ? 200 * playbackRate : 0;

      if (motorRunning) {
        angularVelRef.current += (targetVel - angularVelRef.current) * Math.min(1, dt * 4.2);
      } else {
        // Realistic heavy aluminum platter coast-down friction
        angularVelRef.current *= Math.exp(-dt * 1.75);
        if (angularVelRef.current < 0.4) angularVelRef.current = 0;
      }

      if (angularVelRef.current > 0) {
        angleDegRef.current = (angleDegRef.current + angularVelRef.current * dt) % 360;
        if (spinningDiscRef.current) {
          spinningDiscRef.current.style.transform = `rotate(${angleDegRef.current.toFixed(2)}deg)`;
        }
        if (strobeRingRef.current) {
          strobeRingRef.current.style.transform = `rotate(${angleDegRef.current.toFixed(2)}deg)`;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [motorRunning, playbackRate]);

  const placeDiscAndPlay = useCallback(
    async (item: MediaLibraryItem) => {
      const exists = await verifyMediaFile(item);
      if (!exists) return;

      mechanicalFoley.playDiscPlace();

      // Swing tonearm over after disc settles on platter mat
      setTimeout(async () => {
        mechanicalFoley.playTonearmDrop();
        setStylusDropped(true);
        await loadAndPlayQueue('turntable', [item], 0, true, null);
      }, 220);
    },
    [loadAndPlayQueue, verifyMediaFile]
  );

  // Auto-load item if launched from HistorySection
  useEffect(() => {
    if (initialLaunchItem && initialLaunchItem.mediaType === 'audio') {
      placeDiscAndPlay(initialLaunchItem);
      onConsumedLaunch?.();
    }
  }, [initialLaunchItem, placeDiscAndPlay, onConsumedLaunch]);

  const handleStartStopButton = async () => {
    mechanicalFoley.playPianoKeyLatch();
    if (!loadedDisc) return;
    if (isPlaying) {
      pauseAudio();
    } else {
      if (!stylusDropped) {
        mechanicalFoley.playTonearmDrop();
        setStylusDropped(true);
      }
      await playAudio();
    }
  };

  const handleCueToggle = async () => {
    if (!loadedDisc) return;
    if (stylusDropped) {
      mechanicalFoley.playTonearmLift();
      setStylusDropped(false);
      pauseAudio();
    } else {
      mechanicalFoley.playTonearmDrop();
      setStylusDropped(true);
      await playAudio();
    }
  };

  const handleRemoveDisc = () => {
    if (!loadedDisc) return;
    if (stylusDropped) {
      mechanicalFoley.playTonearmLift();
      setStylusDropped(false);
    }
    setTimeout(() => {
      mechanicalFoley.playDiscRemove();
      stopAndUnloadAudio();
    }, 140);
  };

  const speedPresets = [
    { rate: 0.75, label: t.ttSpeed075 },
    { rate: 1.0, label: t.ttSpeed100 },
    { rate: 1.25, label: t.ttSpeed125 },
    { rate: 1.5, label: t.ttSpeed150 }
  ];

  // Tonearm angular geometry: 0deg parked -> 20deg outer groove -> 38deg inner run-out groove
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const tonearmAngleDeg = !loadedDisc ? 0 : !stylusDropped ? 14 : 20 + progressRatio * 18;

  const normalizedQuery = searchQuery.normalize('NFC').trim().toLowerCase();
  const filteredAudio = audioItems.filter((a) => {
    if (!normalizedQuery) return true;
    const titleNorm = (a.title || '').normalize('NFC').toLowerCase();
    const fileNorm = (a.filePath.split(/[/\\]/).pop() || '').normalize('NFC').toLowerCase();
    return titleNorm.includes(normalizedQuery) || fileNorm.includes(normalizedQuery);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-0">
      {/* LEFT: Heavy Direct-Drive Studio Turntable Deck */}
      <div className="lg:col-span-8 h-full min-h-0 rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 border-3 border-black dark:border-zinc-700 p-3.5 md:p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-zinc-100 flex flex-col justify-between overflow-hidden">
        {/* Top Deck Header & Strobe Lamp Indicator */}
        <div className="flex items-center justify-between mb-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                motorRunning ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            />
            <span className="text-[11px] font-black tracking-widest uppercase text-zinc-300">
              {t.ttModelPlate}
            </span>
          </div>
          <div className="text-[11px] font-mono text-amber-400 font-bold">
            {`${Math.round(playbackRate * 100)}%`}
          </div>
        </div>

        {/* Platter + Tonearm Mechanical Stage */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Circular Stroboscopic Platter & Picture-Disc Record */}
          <div className="md:col-span-8 flex items-center justify-center relative h-full min-h-0">
            <div className="relative w-60 h-60 xl:w-68 xl:h-68 rounded-full bg-zinc-950 border-4 border-zinc-700 shadow-[0_10px_24px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.12)] flex items-center justify-center">
              {/* Rotating Strobe Dots Bezel */}
              <div
                ref={strobeRingRef}
                className="absolute inset-1 rounded-full border-2 border-dashed border-zinc-600/65 pointer-events-none"
              />

              {/* Orange Strobe Prism Illuminator */}
              <div
                className={`absolute -left-2 bottom-9 w-3.5 h-6 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center shadow-md ${
                  motorRunning ? 'ring-1 ring-orange-500/60' : ''
                }`}
              >
                <span
                  className={`w-1.5 h-3.5 rounded-xs ${
                    motorRunning ? 'bg-orange-500' : 'bg-orange-950'
                  }`}
                />
              </div>

              {/* Rubber Platter Mat */}
              <div className="w-[88%] h-[88%] rounded-full bg-[#111114] border border-zinc-800 shadow-inner flex items-center justify-center relative overflow-hidden">
                {loadedDisc ? (
                  <>
                    {/* Rotating Vinyl / Picture-Disc Surface (Clean symmetric full artwork, no displaced badge) */}
                    <div
                      ref={spinningDiscRef}
                      className="w-[96%] h-[96%] rounded-full relative overflow-hidden border-2 border-zinc-900 shadow-xl"
                    >
                      <MediaThumb
                        src={loadedDisc.thumbnail}
                        filePath={loadedDisc.filePath}
                        title={loadedDisc.title}
                        mediaType="audio"
                        className="absolute inset-0 w-full h-full"
                        imgClassName="w-full h-full object-cover scale-105"
                      />

                      {/* Concentric Micro-Groove Etching */}
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background:
                            'repeating-radial-gradient(circle at center, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.14) 5px)'
                        }}
                      />

                      {/* Outer Black Vinyl Rim */}
                      <div className="absolute inset-0 rounded-full border-[10px] border-zinc-950/90 pointer-events-none" />

                      {/* Exact Centered Metal Spindle Pin Only */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-600 border-2 border-black shadow-md pointer-events-none z-10" />
                    </div>

                    {/* Stationary Overhead Studio Light Specular Sheen */}
                    <div
                      className="pointer-events-none absolute inset-[2%] rounded-full opacity-40"
                      style={{
                        background:
                          'conic-gradient(from 25deg, transparent 0deg, rgba(255,255,255,0.24) 24deg, transparent 52deg, transparent 180deg, rgba(255,255,255,0.2) 204deg, transparent 232deg)'
                      }}
                    />
                  </>
                ) : (
                  /* Empty Rubber Platter Mat with Concentric Ribs & Brass Spindle */
                  <div className="w-full h-full rounded-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-5 rounded-full border border-zinc-800/80" />
                    <div className="absolute inset-12 rounded-full border border-zinc-800/80" />
                    <div className="absolute inset-19 rounded-full border border-zinc-800/80" />
                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 border border-black shadow-md z-10" />
                    <p className="text-[11px] font-bold text-zinc-500 text-center px-6 mt-5">
                      {t.ttNoDiscPrompt}
                    </p>
                  </div>
                )}
              </div>

              {/* Pivoted S-Shaped Mechanical Tonearm Assembly */}
              <div
                className="pointer-events-none absolute -right-5 -top-2 w-36 h-64 z-20 transition-transform duration-500 ease-out"
                style={{
                  transformOrigin: '78% 18%',
                  transform: `rotate(${tonearmAngleDeg}deg) scale(${stylusDropped ? 1 : 1.03})`
                }}
              >
                <svg viewBox="0 0 160 290" className="w-full h-full drop-shadow-[0_8px_10px_rgba(0,0,0,0.85)]">
                  {/* Gimbal Base & Counterweight */}
                  <circle cx="125" cy="52" r="24" fill="#27272A" stroke="#71717A" strokeWidth="2.5" />
                  <circle cx="125" cy="52" r="12" fill="#52525B" stroke="#18181B" strokeWidth="2" />
                  <rect x="114" y="10" width="22" height="24" rx="4" fill="#3F3F46" stroke="#18181B" strokeWidth="2" />
                  {/* S-Shaped Chrome Tube */}
                  <path
                    d="M 125 52 C 125 115, 102 165, 92 225"
                    fill="none"
                    stroke="#D4D4D8"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 125 52 C 125 115, 102 165, 92 225"
                    fill="none"
                    stroke="#FAFAFA"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Headshell & Diamond Phono Cartridge */}
                  <g transform="translate(80, 218) rotate(16)">
                    <rect x="0" y="0" width="20" height="32" rx="3" fill="#18181B" stroke="#A1A1AA" strokeWidth="1.8" />
                    <rect x="5" y="28" width="10" height="7" rx="1" fill="#FACC15" />
                    <path d="M 20 8 Q 30 6 31 15" fill="none" stroke="#E4E4E7" strokeWidth="2.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Right Deck Column: Working Rotation Speed Buttons, Stylus Warmth, & Rotary Volume */}
          <div className="md:col-span-4 flex flex-col items-center justify-between gap-3 bg-zinc-950/80 p-3 rounded-xl border-2 border-zinc-800">
            <div className="w-full space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 text-center">
                {t.ttSpeedLabel}
              </div>

              {/* 4 Working Rotation Speed Buttons (controls BOTH platter spin AND real audio playback speed) */}
              <div className="grid grid-cols-2 gap-1.5">
                {speedPresets.map((sp) => {
                  const active = Math.abs(playbackRate - sp.rate) < 0.03;
                  return (
                    <button
                      key={sp.rate}
                      type="button"
                      onClick={() => {
                        mechanicalFoley.playClickWheelButton();
                        setPlaybackRate(sp.rate);
                      }}
                      className={`py-2 px-1.5 text-[11px] font-black border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all ${
                        active
                          ? 'bg-amber-400 text-black'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stylus Analog Warmth Switch */}
            <button
              type="button"
              onClick={() => {
                mechanicalFoley.playClickWheelButton();
                setVinylWarmth(!vinylWarmth);
              }}
              className={`w-full py-1.5 px-2.5 text-[11px] font-bold border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 cursor-pointer ${
                vinylWarmth
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.ttVinylWarmthBtn}</span>
            </button>

            <RotaryKnob
              value={volume}
              onChange={setVolume}
              label={t.tvVolumeLabel}
              size={42}
            />
          </div>
        </div>

        {/* Bottom Track Scrubber + Heavy Die-Cast Transport Controls */}
        <div className="mt-2 space-y-2 shrink-0">
          <div className="bg-zinc-950/90 px-3 py-2 rounded-xl border-2 border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-zinc-100 truncate">
                {loadedDisc ? loadedDisc.title : t.ttNoDiscPrompt}
              </div>
              <div className="text-xs font-mono text-amber-400 shrink-0">
                {loadedDisc ? `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}` : '00:00 / 00:00'}
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={loadedDisc ? currentTime : 0}
              disabled={!loadedDisc || duration <= 0}
              onChange={(e) => seekAudio(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-zinc-900 rounded-lg cursor-pointer disabled:opacity-40 block"
            />
          </div>

          <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!loadedDisc}
              onClick={handleStartStopButton}
              className={`px-4 py-2 text-xs font-black border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 cursor-pointer disabled:opacity-40 ${
                isPlaying && loadedDisc
                  ? 'bg-amber-400 text-black'
                  : 'bg-zinc-200 text-zinc-950 hover:bg-white'
              }`}
            >
              {isPlaying && loadedDisc ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{t.ttStartStopBtn}</span>
            </button>

            <button
              type="button"
              disabled={!loadedDisc}
              onClick={handleCueToggle}
              className="px-3.5 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
            >
              {stylusDropped ? t.ttCueLiftBtn : t.ttCueDropBtn}
            </button>

            <button
              type="button"
              disabled={!loadedDisc}
              onClick={handleRemoveDisc}
              className="px-3.5 py-2 text-xs font-bold bg-red-500/90 hover:bg-red-500 disabled:opacity-40 text-white border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span>{t.ttRemoveDiscBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Record Sleeve Crate (.mp3 Single Discs) */}
      <div className="lg:col-span-4 pencil-box bg-[var(--color-surface)] p-3.5 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)]">
            {t.ttCrateTitle} ({filteredAudio.length})
          </h3>
        </div>

        <div className="relative mb-2.5 shrink-0">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.playerSearchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] select-text"
          />
        </div>

        {filteredAudio.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.ttEmptyCrate}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filteredAudio.map((item) => {
              const isOnPlatter = loadedDisc?.filePath === item.filePath;

              return (
                <button
                  key={item.filePath}
                  type="button"
                  onClick={() => placeDiscAndPlay(item)}
                  className={`w-full text-left p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2.5 group ${
                    isOnPlatter
                      ? 'bg-zinc-900 border-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {/* Square Jacket Sleeve with Vinyl Record Peeking Out */}
                  <div className="relative w-13 h-11 shrink-0 flex items-center">
                    <div
                      className={`absolute right-0 w-9 h-9 rounded-full bg-zinc-950 border border-zinc-600 flex items-center justify-center transition-transform ${
                        isOnPlatter ? 'translate-x-1.5' : 'group-hover:translate-x-1'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-amber-400/80 border border-black" />
                    </div>
                    <div className="relative z-10 w-10 h-10 rounded border-2 border-black overflow-hidden shadow-md">
                      <MediaThumb
                        src={item.thumbnail}
                        filePath={item.filePath}
                        title={item.title}
                        mediaType="audio"
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-bold truncate ${
                        isOnPlatter ? 'text-amber-300' : 'text-[var(--color-text-main)]'
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center justify-between">
                      <span>{item.fileSizeStr}</span>
                      <span>{t.ttFormatBadge}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
