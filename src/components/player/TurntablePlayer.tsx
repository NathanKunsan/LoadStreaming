import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Disc3,
  Play,
  Pause,
  RotateCcw,
  Search,
  Sparkles,
  CornerUpLeft
} from 'lucide-react';
import { MediaLibraryItem } from '../../../electron/types';
import { translations, Language } from '../../locales/translations';
import { useAudioDeck } from '../../contexts/AudioDeckContext';
import { mechanicalFoley } from '../../utils/mechanicalFoley';
import { formatMediaTime, getDeterministicPalette } from '../../utils/mediaHelpers';
import { RotaryKnob } from './RotaryKnob';

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
  const [rpmMode, setRpmMode] = useState<33 | 45>(33);
  const [pitchPercent, setPitchPercent] = useState<number>(0); // -8 to +8
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

  // Rotational inertia physics loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const baseDegPerSec = rpmMode === 45 ? 270 : 200;
      const targetVel = motorRunning ? baseDegPerSec * (1 + pitchPercent / 100) : 0;

      if (motorRunning) {
        angularVelRef.current += (targetVel - angularVelRef.current) * Math.min(1, dt * 3.8);
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
  }, [motorRunning, rpmMode, pitchPercent]);

  const placeDiscAndPlay = useCallback(
    async (item: MediaLibraryItem) => {
      const exists = await verifyMediaFile(item);
      if (!exists) return;

      mechanicalFoley.playDiscPlace();
      setRpmMode(33);
      setPitchPercent(0);
      setPlaybackRate(1.0);

      // Swing tonearm over after disc settles on platter mat
      setTimeout(async () => {
        mechanicalFoley.playTonearmDrop();
        setStylusDropped(true);
        await loadAndPlayQueue('turntable', [item], 0, true, null);
      }, 240);
    },
    [loadAndPlayQueue, setPlaybackRate, verifyMediaFile]
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

  const updatePitchAndRpm = (nextRpm: 33 | 45, nextPitchPct: number) => {
    setRpmMode(nextRpm);
    setPitchPercent(nextPitchPct);
    const rpmFactor = nextRpm === 45 ? 1.18 : 1.0;
    const totalRate = rpmFactor * (1 + nextPitchPct / 100);
    setPlaybackRate(totalRate);
  };

  // Tonearm angular geometry: 0deg parked -> 20deg outer groove -> 38deg inner run-out groove
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const tonearmAngleDeg = !loadedDisc ? 0 : !stylusDropped ? 14 : 20 + progressRatio * 18;

  const filteredAudio = audioItems.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const [discAccentA, , discAccentB] = getDeterministicPalette(
    loadedDisc ? loadedDisc.title : 'turntable'
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT: Heavy Direct-Drive Studio Turntable Deck */}
      <div className="lg:col-span-8 rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 border-3 border-black dark:border-zinc-700 p-4 md:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-zinc-100 relative overflow-hidden">
        {/* Top Deck Header & Strobe Lamp Indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                motorRunning
                  ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.95)]'
                  : 'bg-zinc-700'
              }`}
            />
            <span className="text-[11px] font-black tracking-widest uppercase text-zinc-300">
              {t.ttModelPlate}
            </span>
          </div>
          <div className="text-[11px] font-mono text-amber-400 font-bold">
            {loadedDisc ? `${(playbackRate * 100).toFixed(0)}%` : '--'}
          </div>
        </div>

        {/* Platter + Tonearm Mechanical Stage */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Circular Stroboscopic Platter & Picture-Disc Record */}
          <div className="md:col-span-8 flex items-center justify-center relative py-2">
            <div className="relative w-68 h-68 sm:w-80 sm:h-80 rounded-full bg-zinc-950 border-4 border-zinc-700 shadow-[0_12px_28px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.12)] flex items-center justify-center">
              {/* Rotating Strobe Dots Bezel */}
              <div
                ref={strobeRingRef}
                className="absolute inset-1 rounded-full border-2 border-dashed border-zinc-600/65 pointer-events-none"
              />

              {/* Orange Strobe Prism Illuminator */}
              <div
                className={`absolute -left-2 bottom-10 w-4 h-7 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center shadow-md ${
                  motorRunning ? 'ring-2 ring-orange-500/60' : ''
                }`}
              >
                <span
                  className={`w-1.5 h-4 rounded-xs ${
                    motorRunning
                      ? 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,1)]'
                      : 'bg-orange-950'
                  }`}
                />
              </div>

              {/* Rubber Platter Mat */}
              <div className="w-[88%] h-[88%] rounded-full bg-[#111114] border border-zinc-800 shadow-inner flex items-center justify-center relative overflow-hidden">
                {loadedDisc ? (
                  <>
                    {/* Rotating Vinyl / Picture-Disc Surface */}
                    <div
                      ref={spinningDiscRef}
                      className="w-[96%] h-[96%] rounded-full relative overflow-hidden border-2 border-zinc-900 shadow-xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${discAccentA}, ${discAccentB})`
                      }}
                    >
                      {loadedDisc.thumbnail ? (
                        <img
                          src={loadedDisc.thumbnail}
                          alt={loadedDisc.title}
                          className="w-full h-full object-cover scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                          <Disc3 className="w-20 h-20 text-amber-400/50" />
                        </div>
                      )}

                      {/* Concentric Micro-Groove Etching */}
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background:
                            'repeating-radial-gradient(circle at center, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 2px, rgba(255,255,255,0.04) 3px, rgba(0,0,0,0.18) 5px)'
                        }}
                      />

                      {/* Outer Black Vinyl Rim */}
                      <div className="absolute inset-0 rounded-full border-[12px] border-zinc-950/90 pointer-events-none" />

                      {/* Center Record Ring & Brass Spindle Hole */}
                      <div className="w-16 h-16 rounded-full bg-zinc-950/88 border-2 border-amber-400/70 flex flex-col items-center justify-center z-10 px-1 text-center shadow-md">
                        <span className="text-[7px] font-bold text-amber-300 uppercase tracking-wider truncate w-full">
                          {t.ttDiscStereo}
                        </span>
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-600 border border-black my-0.5 shadow-inner" />
                        <span className="text-[7px] font-mono text-zinc-400">
                          {rpmMode} {t.ttRpmUnit}
                        </span>
                      </div>
                    </div>

                    {/* Stationary Overhead Studio Light Specular Sheen */}
                    <div
                      className="pointer-events-none absolute inset-[2%] rounded-full opacity-45"
                      style={{
                        background:
                          'conic-gradient(from 25deg, transparent 0deg, rgba(255,255,255,0.26) 24deg, transparent 52deg, transparent 180deg, rgba(255,255,255,0.22) 204deg, transparent 232deg)'
                      }}
                    />
                  </>
                ) : (
                  /* Empty Rubber Platter Mat with Concentric Ribs & Brass Spindle */
                  <div className="w-full h-full rounded-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-6 rounded-full border border-zinc-800/80" />
                    <div className="absolute inset-14 rounded-full border border-zinc-800/80" />
                    <div className="absolute inset-22 rounded-full border border-zinc-800/80" />
                    <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-500 border border-black shadow-md z-10" />
                    <p className="text-[11px] font-bold text-zinc-500 text-center px-8 mt-6">
                      {t.ttNoDiscPrompt}
                    </p>
                  </div>
                )}
              </div>

              {/* Pivoted S-Shaped Mechanical Tonearm Assembly */}
              <div
                className="pointer-events-none absolute -right-6 -top-2 w-40 h-72 z-20 transition-transform duration-500 ease-out"
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
                    {/* Finger Lift */}
                    <path d="M 20 8 Q 30 6 31 15" fill="none" stroke="#E4E4E7" strokeWidth="2.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Right Deck Column: RPM Selector, Pitch Fader, & Rotary Volume */}
          <div className="md:col-span-4 flex flex-col items-center justify-between gap-4 bg-zinc-950/80 p-3.5 rounded-xl border-2 border-zinc-800">
            {/* 33 / 45 RPM Selector */}
            <div className="w-full grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  updatePitchAndRpm(33, pitchPercent);
                }}
                className={`py-1.5 text-[11px] font-black rounded-lg border-2 border-black cursor-pointer transition-all ${
                  rpmMode === 33
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {t.ttRpm33}
              </button>
              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  updatePitchAndRpm(45, pitchPercent);
                }}
                className={`py-1.5 text-[11px] font-black rounded-lg border-2 border-black cursor-pointer transition-all ${
                  rpmMode === 45
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {t.ttRpm45}
              </button>
            </div>

            {/* Tempo Pitch Fader (-8% to +8%) */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                <span>{t.ttPitchLabel}</span>
                <span className={pitchPercent === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {pitchPercent > 0 ? `+${pitchPercent}%` : `${pitchPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min={-8}
                max={8}
                step={1}
                value={pitchPercent}
                onChange={(e) => {
                  mechanicalFoley.playKnobDetent(1.0);
                  updatePitchAndRpm(rpmMode, parseInt(e.target.value, 10));
                }}
                className="w-full accent-amber-400 h-2 bg-zinc-900 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  mechanicalFoley.playClickWheelButton();
                  updatePitchAndRpm(33, 0);
                }}
                className="w-full py-1 text-[10px] font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.ttPitchReset}</span>
              </button>
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
              size={46}
            />
          </div>
        </div>

        {/* Now Spinning Track Bar + Groove Scrubber */}
        <div className="mt-4 bg-zinc-950/90 p-3 rounded-xl border-2 border-zinc-800 space-y-2">
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
            className="w-full accent-amber-400 h-2 bg-zinc-900 rounded-lg cursor-pointer disabled:opacity-40"
          />
        </div>

        {/* Heavy Die-Cast Turntable Transport Controls */}
        <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!loadedDisc}
            onClick={handleStartStopButton}
            className={`px-5 py-2.5 text-xs font-black border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 cursor-pointer disabled:opacity-40 ${
              isPlaying && loadedDisc
                ? 'bg-amber-400 text-black'
                : 'bg-zinc-200 text-zinc-950 hover:bg-white'
            }`}
          >
            {isPlaying && loadedDisc ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{t.ttStartStopBtn}</span>
          </button>

          <button
            type="button"
            disabled={!loadedDisc}
            onClick={handleCueToggle}
            className="px-4 py-2.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
          >
            {stylusDropped ? t.ttCueLiftBtn : t.ttCueDropBtn}
          </button>

          <button
            type="button"
            disabled={!loadedDisc}
            onClick={handleRemoveDisc}
            className="px-4 py-2.5 text-xs font-bold bg-red-500/90 hover:bg-red-500 disabled:opacity-40 text-white border-2 border-black rounded-xl sketch-btn shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 cursor-pointer ml-auto"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
            <span>{t.ttRemoveDiscBtn}</span>
          </button>
        </div>
      </div>

      {/* RIGHT: Record Sleeve Crate (.mp3 Single Discs) */}
      <div className="lg:col-span-4 pencil-box bg-[var(--color-surface)] p-4 flex flex-col h-[540px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-main)]">
            {t.ttCrateTitle} ({filteredAudio.length})
          </h3>
        </div>

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.playerSearchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg)] text-[var(--color-text-main)] border-2 border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {filteredAudio.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-6 text-xs text-[var(--color-text-muted)]">
            {t.ttEmptyCrate}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredAudio.map((item) => {
              const isOnPlatter = loadedDisc?.id === item.id;
              const [c1, , c2] = getDeterministicPalette(item.title || item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => placeDiscAndPlay(item)}
                  className={`w-full text-left p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 group ${
                    isOnPlatter
                      ? 'bg-zinc-900 border-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border-[var(--color-border)] hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {/* Square Jacket Sleeve with Vinyl Record Peeking Out */}
                  <div className="relative w-14 h-12 shrink-0 flex items-center">
                    <div
                      className={`absolute right-0 w-10 h-10 rounded-full bg-zinc-950 border border-zinc-600 flex items-center justify-center transition-transform ${
                        isOnPlatter ? 'translate-x-1.5' : 'group-hover:translate-x-1'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: c1 }}
                      />
                    </div>
                    <div
                      className="relative z-10 w-11 h-11 rounded border-2 border-black overflow-hidden shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${c1}, ${c2})`
                      }}
                    >
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                          <Disc3 className="w-5 h-5 text-white/70" />
                        </div>
                      )}
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
